"""数据清洗与去重.

流程:
1. 过滤无效记录(无价/无标题/原价异常)
2. 平台内按 product_id 精确去重,保留销量高者
3. 标题清洗(去 HTML 残留、空白规范化)
4. 规格指纹填充(品牌/型号/存储/尺寸/代数)
5. 跨平台同款合并:
   a. 优先按规格指纹精确匹配(同型号同存储 -> 同款)
   b. 否则用 spec_similarity >= 0.7 判同款
   c. 兜底用标题 bigram 相似度 >= 0.85
   同款取价格最低为代表,并把所有平台价聚合到 cross_platform_prices
"""
from __future__ import annotations

import re
from typing import List, Tuple

from .models import Product
from .specs import extract_spec, spec_similarity


def _norm_title(t: str) -> str:
    """标题归一化: 去除多余空白/特殊符号,小写,便于跨平台近似去重。"""
    t = re.sub(r"[\s\u200b\(\)\[\]（）【】]+", "", t)
    t = re.sub(r"[【】\[\]\(\)（）]", "", t)
    return t.lower()


def _title_bigram_similarity(a: str, b: str) -> float:
    """简单的 Jaccard 字符 bigram 相似度,兜底跨平台匹配。"""
    def bigrams(s: str):
        return {s[i:i + 2] for i in range(len(s) - 1)} or {s}
    A = bigrams(a)
    B = bigrams(b)
    if not A or not B:
        return 0.0
    return len(A & B) / len(A | B)


def _is_same_item(a: Product, b: Product) -> Tuple[bool, str]:
    """判定两商品是否为同款。返回(是否同款, 判定方式)。

    含价格合理性兜底: 同款同SKU跨平台价差通常<30%,若价格相差超 2.5 倍,
    即便规格指纹一致也判为非同款(很可能是不同存储档位/不同代际的产品),
    避免把不同价位段的产品误并为同一款。
    """
    # 不同平台才需要跨平台匹配;同平台已由 product_id 精确去重
    if a.platform == b.platform:
        return False, ""

    # 价格合理性兜底
    lo, hi = min(a.price, b.price), max(a.price, b.price)
    if lo > 0 and hi / lo > 2.5:
        return False, "price_disproportional"

    sa = extract_spec(a.title)
    sb = extract_spec(b.title)

    # 1. 规格指纹精确一致(型号+存储等核心字段对齐)
    if sa.fingerprint and sb.fingerprint and sa.fingerprint == sb.fingerprint:
        return True, "spec_exact"

    # 2. 规格相似度
    sim = spec_similarity(sa, sb)
    if sim >= 0.7:
        return True, f"spec_sim={sim:.2f}"

    # 3. 兜底标题 bigram
    title_sim = _title_bigram_similarity(_norm_title(a.title), _norm_title(b.title))
    if title_sim >= 0.85:
        return True, f"title_sim={title_sim:.2f}"

    return False, ""


def clean_and_dedup(products: List[Product]) -> List[Product]:
    """清洗与去重流程(详见模块 docstring)。"""
    # 1. 过滤无效 + 标题清洗
    valid: List[Product] = []
    for p in products:
        if not p.title or p.price <= 0:
            continue
        p.title = re.sub(r"<[^>]+>", "", p.title).strip()
        p.title = re.sub(r"\s+", " ", p.title)
        if p.original_price and p.original_price < p.price:
            p.original_price = None
        valid.append(p)

    # 2. 平台内精确去重
    seen = {}
    for p in valid:
        key = p.dedup_key
        if key not in seen:
            seen[key] = p
        else:
            cur = seen[key]
            if p.sales > cur.sales or (p.sales == cur.sales and p.price < cur.price):
                seen[key] = p
    intra_deduped = list(seen.values())

    # 3. 填充规格指纹(供复核与显示)
    for p in intra_deduped:
        p.spec_fingerprint = extract_spec(p.title).fingerprint

    # 4. 跨平台同款合并(并查集式聚类)
    n = len(intra_deduped)
    parent = list(range(n))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(x, y):
        rx, ry = find(x), find(y)
        if rx != ry:
            parent[rx] = ry

    for i in range(n):
        for j in range(i + 1, n):
            same, _ = _is_same_item(intra_deduped[i], intra_deduped[j])
            if same:
                union(i, j)

    # 5. 按聚类分组,每组取价格最低为代表,聚合各平台价
    clusters: dict = {}
    for i in range(n):
        r = find(i)
        clusters.setdefault(r, []).append(intra_deduped[i])

    merged: List[Product] = []
    for members in clusters.values():
        rep = min(members, key=lambda x: x.price)
        if len(members) > 1:
            # 聚合同款各平台价(去重,同平台只留最低)
            per_platform: dict = {}
            for m in sorted(members, key=lambda x: x.price):
                if m.platform not in per_platform:
                    per_platform[m.platform] = {
                        "platform": m.platform,
                        "price": m.price,
                        "url": m.url,
                        "shop_name": m.shop_name,
                    }
            rep.cross_platform_prices = list(per_platform.values())
            span = len(per_platform)
            min_p = min(x["price"] for x in rep.cross_platform_prices)
            max_p = max(x["price"] for x in rep.cross_platform_prices)
            if max_p > min_p:
                rep.tags = list(dict.fromkeys(
                    rep.tags + [f"同款{span}平台价差{max_p-min_p:.0f}元"]))
            else:
                rep.tags = list(dict.fromkeys(rep.tags + [f"同款{span}平台同价"]))
        merged.append(rep)

    return merged


def sort_by_price(products: List[Product], ascending: bool = True) -> List[Product]:
    """按价格排序,价格相同则按销量降序。"""
    return sorted(products, key=lambda p: (p.price, -p.sales) if ascending else (-p.price, -p.sales))

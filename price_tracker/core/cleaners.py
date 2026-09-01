"""数据清洗与去重."""
from __future__ import annotations

import re
from typing import List

from .models import Product


def _norm_title(t: str) -> str:
    """标题归一化: 去除多余空白/特殊符号,小写,便于跨平台近似去重。"""
    t = re.sub(r"[\s\u200b\(\)\[\]（）【】]+", "", t)
    t = re.sub(r"[【】\[\]\(\)（）]", "", t)
    return t.lower()


def _title_similarity(a: str, b: str) -> float:
    """简单的 Jaccard 字符 bigram 相似度,用于跨平台同款近似匹配。"""
    def bigrams(s: str):
        return {s[i:i + 2] for i in range(len(s) - 1)} or {s}
    A = bigrams(a)
    B = bigrams(b)
    if not A or not B:
        return 0.0
    return len(A & B) / len(A | B)


def clean_and_dedup(products: List[Product]) -> List[Product]:
    """清洗与去重流程.

    1. 过滤无效记录(无价/无标题/价格异常)
    2. 平台内按 product_id 精确去重,保留销量较高者
    3. 标题清洗(去 HTML 标签残留、空白规范化)
    4. 跨平台近似同款合并: 同标题相似度>0.85 视为同款,保留价格最低者并标记 cross_match
    """
    # 1. 过滤无效
    valid = []
    for p in products:
        if not p.title or p.price <= 0:
            continue
        # 清洗标题
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
            # 保留销量更高者;销量相等保留价格更低者
            cur = seen[key]
            if p.sales > cur.sales or (p.sales == cur.sales and p.price < cur.price):
                seen[key] = p
    intra_deduped = list(seen.values())

    # 3. 跨平台近似同款合并
    merged: List[Product] = []
    norm_titles = {p.product_id if False else id(p): _norm_title(p.title) for p in intra_deduped}
    used = set()
    for i, p in enumerate(intra_deduped):
        if i in used:
            continue
        cluster = [p]
        used.add(i)
        ti = _norm_title(p.title)
        for j in range(i + 1, len(intra_deduped)):
            if j in used:
                continue
            tj = _norm_title(intra_deduped[j].title)
            if _title_similarity(ti, tj) >= 0.85:
                cluster.append(intra_deduped[j])
                used.add(j)
        # 取价格最低为该同款代表
        rep = min(cluster, key=lambda x: x.price)
        if len(cluster) > 1:
            rep.tags = list(set(rep.tags + [f"同款{len(cluster)}平台"]))
        merged.append(rep)

    return merged


def sort_by_price(products: List[Product], ascending: bool = True) -> List[Product]:
    """按价格排序,价格相同则按销量降序。"""
    return sorted(products, key=lambda p: (p.price, -p.sales) if ascending else (-p.price, -p.sales))

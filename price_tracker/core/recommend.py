"""性价比推荐: 综合打分并标注推荐商品."""
from __future__ import annotations

from typing import List, Tuple

from .models import Product, Platform


def rank_value(products: List[Product]) -> List[Tuple[Product, float, List[str]]]:
    """为每个商品计算性价比分(0-100)与标签,按分数降序返回。"""
    if not products:
        return []
    prices = [p.price for p in products]
    sales = [p.sales for p in products]
    scores = [p.shop_score for p in products]
    p_min, p_max = min(prices), max(prices)
    s_max = max(sales) or 1
    sc_max = max(scores) or 5.0

    results: List[Tuple[Product, float, List[str]]] = []
    for p in products:
        # 价格分: 越低越高(0-1)
        price_score = 1 - ((p.price - p_min) / (p_max - p_min)) if p_max > p_min else 1.0
        # 销量分: 越高越高(0-1)
        sales_score = p.sales / s_max
        # 评分分
        score_score = p.shop_score / sc_max if sc_max > 0 else 0
        # 平台权重: pdd 偏低价权重略高,jd 偏评分权重略高
        weights = _platform_weights(p.platform)
        total = (weights["price"] * price_score +
                 weights["sales"] * sales_score +
                 weights["score"] * score_score) * 100
        total = round(total, 1)
        tags = []
        if total >= 80:
            tags.append("强烈推荐")
        elif total >= 65:
            tags.append("推荐")
        if p.price == p_min:
            tags.append("最低价")
        if p.shop_score >= sc_max - 0.01:
            tags.append("口碑最佳")
        if p.sales >= s_max * 0.9:
            tags.append("热销")
        if "百亿补贴" in p.tags or "自营" in p.tags:
            tags.append("官方背书")
        results.append((p, total, tags))
    results.sort(key=lambda x: x[1], reverse=True)
    return results


def _platform_weights(platform: str) -> dict:
    """不同平台对价格/销量/评分的侧重。"""
    if platform == Platform.PDD.value:
        return {"price": 0.6, "sales": 0.25, "score": 0.15}
    if platform == Platform.JD.value:
        return {"price": 0.4, "sales": 0.25, "score": 0.35}
    if platform == Platform.TAOBAO.value:
        return {"price": 0.5, "sales": 0.3, "score": 0.2}
    return {"price": 0.5, "sales": 0.3, "score": 0.2}


def recommend_best_value(products: List[Product], top_n: int = 3) -> List[dict]:
    """返回 top_n 性价比推荐商品的字典结构(供CLI/Web统一展示)。"""
    ranked = rank_value(products)
    out = []
    for i, (p, score, tags) in enumerate(ranked[:top_n]):
        out.append({
            "rank": i + 1,
            "product": p.to_dict(),
            "value_score": score,
            "tags": tags,
        })
    return out

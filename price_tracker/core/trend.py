"""价格趋势与统计: 历史价格序列、平台价格分布统计。"""
from __future__ import annotations

from typing import List, Dict, Any

from .models import Product, Platform


def build_trend_series(products: List[Product]) -> Dict[str, Any]:
    """构建价格趋势可视化数据。

    返回:
      series: 每个商品的历史价格序列(适合折线图)
      labels: 时间轴标签(天)
      platform_avg_trend: 各平台平均价随时间的演变(用于平台对比)
    """
    # 用最长历史确定时间轴长度
    max_len = max((len(p.history) for p in products), default=0)
    if max_len == 0:
        return {"labels": [], "series": [], "platform_avg_trend": []}

    # 历史序列顺序是 最近->最远,绘制时反转为 远->近(左到右)
    labels = [f"T-{max_len - i - 1}" for i in range(max_len)]
    series = []
    platform_buckets: Dict[str, List[List[float]]] = {}

    for p in products:
        hist = list(reversed(p.history))  # 远->近
        # 左侧补齐到 max_len
        padded = [None] * (max_len - len(hist)) + hist  # type: ignore
        series.append({
            "id": p.dedup_key,
            "title": p.title[:24],
            "platform": p.platform,
            "platform_label": Platform(p.platform).label if p.platform in Platform._value2member_map_ else p.platform,
            "price": p.price,
            "data": padded,
        })
        platform_buckets.setdefault(p.platform, []).append(hist)

    # 各平台平均价趋势
    platform_avg_trend = []
    for plat, hists in platform_buckets.items():
        avg = []
        for i in range(max_len):
            vals = [h[i] for h in hists if i < len(h)]
            avg.append(round(sum(vals) / len(vals), 2) if vals else None)
        platform_avg_trend.append({
            "platform": plat,
            "platform_label": Platform(plat).label if plat in Platform._value2member_map_ else plat,
            "data": avg,
        })

    return {"labels": labels, "series": series, "platform_avg_trend": platform_avg_trend}


def summary_stats(products: List[Product]) -> Dict[str, Any]:
    """整体统计概览(用于仪表盘卡片)。"""
    if not products:
        return {"count": 0, "platform_count": 0, "avg_price": 0,
                "min_price": 0, "max_price": 0, "total_sales": 0, "avg_score": 0}
    prices = [p.price for p in products]
    platforms = {p.platform for p in products}
    return {
        "count": len(products),
        "platform_count": len(platforms),
        "avg_price": round(sum(prices) / len(prices), 2),
        "min_price": round(min(prices), 2),
        "max_price": round(max(prices), 2),
        "total_sales": sum(p.sales for p in products),
        "avg_score": round(sum(p.shop_score for p in products) / len(products), 2),
    }

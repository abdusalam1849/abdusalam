"""横向对比逻辑: 跨平台价格/销量/评分对比,定位各平台性价比。"""
from __future__ import annotations

from typing import List, Dict, Any

from .models import Product, Platform


def compare_products(products: List[Product]) -> Dict[str, Any]:
    """生成横向对比报告.

    返回:
      by_platform: 各平台聚合统计(均价/最低价/中位价/平均销量/平均评分/样本数)
      cheapest: 全局最低价商品
      highest_rated: 评分最高商品
      best_seller: 销量最高商品
      price_spread: 同款价差分析(最高/最低/差额/倍率)
      platform_ranking: 综合性价比平台排名
    """
    if not products:
        return {"by_platform": {}, "cheapest": None, "highest_rated": None,
                "best_seller": None, "price_spread": {}, "platform_ranking": []}

    # 按平台聚合
    by_platform: Dict[str, Dict[str, Any]] = {}
    for p in products:
        bucket = by_platform.setdefault(p.platform, {
            "label": Platform(p.platform).label if p.platform in Platform._value2member_map_ else p.platform,
            "prices": [], "sales": [], "scores": [], "items": []
        })
        bucket["prices"].append(p.price)
        bucket["sales"].append(p.sales)
        bucket["scores"].append(p.shop_score)
        bucket["items"].append(p)

    for plat, b in by_platform.items():
        prices = b["prices"]
        b["count"] = len(prices)
        b["min_price"] = round(min(prices), 2)
        b["max_price"] = round(max(prices), 2)
        b["avg_price"] = round(sum(prices) / len(prices), 2)
        b["median_price"] = round(sorted(prices)[len(prices) // 2], 2)
        b["avg_sales"] = int(sum(b["sales"]) / len(b["sales"]))
        b["avg_score"] = round(sum(b["scores"]) / len(b["scores"]), 2)

    cheapest = min(products, key=lambda x: x.price)
    highest_rated = max(products, key=lambda x: x.shop_score)
    best_seller = max(products, key=lambda x: x.sales)

    all_prices = [p.price for p in products]
    price_spread = {
        "min": round(min(all_prices), 2),
        "max": round(max(all_prices), 2),
        "diff": round(max(all_prices) - min(all_prices), 2),
        "ratio": round(max(all_prices) / min(all_prices), 2) if min(all_prices) > 0 else 0,
    }

    # 平台综合性价比排名: 价格越低 + 销量越高 + 评分越高 得分越高
    ranking = sorted(by_platform.items(), key=lambda kv: _platform_value_score(kv[1]), reverse=True)
    platform_ranking = [{"platform": plat, "label": b["label"],
                         "value_score": round(_platform_value_score(b), 3),
                         "avg_price": b["avg_price"]} for plat, b in ranking]

    return {
        "by_platform": by_platform,
        "cheapest": cheapest,
        "highest_rated": highest_rated,
        "best_seller": best_seller,
        "price_spread": price_spread,
        "platform_ranking": platform_ranking,
    }


def _platform_value_score(b: Dict[str, Any]) -> float:
    """平台性价比分: 0-1 价格倒数(权重0.5) + 0-1 销量(权重0.3) + 评分(权重0.2)。"""
    # 价格倒数归一: 用 1/(1+price/1000) 让价格越低分越高且平滑
    price_score = 1 / (1 + b["avg_price"] / 1000)
    sales_score = min(b["avg_sales"] / 50000, 1.0)
    score_score = b["avg_score"] / 5.0
    return 0.5 * price_score + 0.3 * sales_score + 0.2 * score_score

"""采集编排: 串联多平台采集器 + 清洗 + 对比 + 推荐 + 趋势。"""
from __future__ import annotations

from typing import List, Dict, Any, Optional

from .core import (
    BaseCollector, Product, clean_and_dedup, sort_by_price,
    compare_products, recommend_best_value, build_trend_series, summary_stats,
)
from .collectors import JDCollector, TaobaoCollector, PDDCollector


COLLECTOR_MAP = {
    "jd": JDCollector,
    "taobao": TaobaoCollector,
    "pdd": PDDCollector,
}


def run_pipeline(
    keyword: str,
    platforms: Optional[List[str]] = None,
    limit_per_platform: int = 15,
    mode: str = "mock",
    seed: Optional[int] = None,
    history_days: int = 14,
) -> Dict[str, Any]:
    """端到端采集对比流程,返回完整结果结构(供 CLI/Web 复用)。"""
    platforms = platforms or list(COLLECTOR_MAP.keys())

    # 1. 多平台并行采集(顺序执行,结果汇总)
    raw: List[Product] = []
    per_platform_counts: Dict[str, int] = {}
    for plat in platforms:
        cls = COLLECTOR_MAP.get(plat)
        if not cls:
            continue
        # mock 模式传 seed 让结果可复现
        kwargs = {"mode": mode}
        if mode == "mock" and seed is not None:
            # 每个平台用不同 seed 偏移避免雷同
            kwargs["seed"] = seed + hash(plat) % 1000
        collector = cls(**kwargs)
        # mock 模式直接调用 _mock_search 以注入 history_days 控制
        if mode == "mock":
            from .collectors.mock import generate_products
            from .core.models import Platform
            items = generate_products(keyword, cls.platform, limit_per_platform,
                                      seed=kwargs.get("seed"), days_history=history_days)
        else:
            items = collector.collect(keyword, limit_per_platform)
        raw.extend(items)
        per_platform_counts[plat] = len(items)

    # 2. 清洗去重
    cleaned = clean_and_dedup(raw)

    # 3. 按价格升序
    sorted_items = sort_by_price(cleaned, ascending=True)

    # 4. 横向对比
    comparison = compare_products(sorted_items)

    # 5. 性价比推荐
    recommendations = recommend_best_value(sorted_items, top_n=5)

    # 6. 趋势
    trend = build_trend_series(sorted_items)
    stats = summary_stats(sorted_items)

    return {
        "keyword": keyword,
        "mode": mode,
        "per_platform_counts": per_platform_counts,
        "raw_count": len(raw),
        "cleaned_count": len(cleaned),
        "stats": stats,
        "products": [p.to_dict() for p in sorted_items],
        "comparison": _serialize_comparison(comparison),
        "recommendations": recommendations,
        "trend": trend,
    }


def _serialize_comparison(c: Dict[str, Any]) -> Dict[str, Any]:
    """把对比结果中的 Product 对象序列化为 dict。"""
    out = {
        "by_platform": {},
        "cheapest": c["cheapest"].to_dict() if c.get("cheapest") else None,
        "highest_rated": c["highest_rated"].to_dict() if c.get("highest_rated") else None,
        "best_seller": c["best_seller"].to_dict() if c.get("best_seller") else None,
        "price_spread": c.get("price_spread", {}),
        "platform_ranking": c.get("platform_ranking", []),
    }
    for plat, b in c.get("by_platform", {}).items():
        out["by_platform"][plat] = {
            "label": b["label"], "count": b["count"],
            "min_price": b["min_price"], "max_price": b["max_price"],
            "avg_price": b["avg_price"], "median_price": b["median_price"],
            "avg_sales": b["avg_sales"], "avg_score": b["avg_score"],
        }
    return out


# 内置示例数据: 网页初始化与 CLI --demo 使用
SAMPLE_KEYWORD = "无线蓝牙耳机"


def build_sample_result() -> Dict[str, Any]:
    """生成演示用示例数据与对应结果(固定seed保证稳定)。"""
    return run_pipeline(
        keyword=SAMPLE_KEYWORD,
        platforms=["jd", "taobao", "pdd"],
        limit_per_platform=8,
        mode="mock",
        seed=42,
        history_days=14,
    )

"""采集编排: 串联多平台采集器 + 清洗 + 对比 + 推荐 + 趋势 + 预测。

支持:
- 多平台并发采集(ThreadPoolExecutor,IO 密集场景加速)
- 异常价格检测(IQR,标注疑似虚假低价/错填价,可选过滤)
- 规格指纹跨平台同款合并(见 cleaners)
- 价格预测(EMA + 线性回归,给"观望/入手"提示)
"""
from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Optional

from .core import (
    BaseCollector, Product, clean_and_dedup, sort_by_price,
    compare_products, recommend_best_value, build_trend_series, summary_stats,
)
from .core.outliers import detect_outliers
from .core.forecast import build_forecasts
from .collectors import JDCollector, TaobaoCollector, PDDCollector, PddOpenAPICollector
from .collectors.mock import generate_products
from .core.models import Platform


COLLECTOR_MAP = {
    "jd": JDCollector,
    "taobao": TaobaoCollector,
    "pdd": PDDCollector,
    # 备选: 多多进宝官方API通道(需 PDD_CLIENT_ID/SECRET)
    "pdd_openapi": PddOpenAPICollector,
}


def _collect_one(
    platform_key: str,
    keyword: str,
    limit: int,
    mode: str,
    seed: Optional[int],
    history_days: int,
    logger: logging.Logger,
) -> List[Product]:
    """采集单个平台(供线程池调用)。mock 模式直接走生成器以注入 history_days。"""
    cls = COLLECTOR_MAP[platform_key]
    if mode == "mock":
        plat_enum = cls.platform
        s = (seed + hash(platform_key)) % 100000 if seed is not None else None
        items = generate_products(keyword, plat_enum, limit, seed=s, days_history=history_days)
        logger.info(f"[{plat_enum.label}] mock 采集: {len(items)} 条")
        return items
    # live 模式: 实例化采集器(凭证从环境变量读取),自动重试/限速
    collector = cls(mode=mode)
    return collector.collect(keyword, limit)


def run_pipeline(
    keyword: str,
    platforms: Optional[List[str]] = None,
    limit_per_platform: int = 15,
    mode: str = "mock",
    seed: Optional[int] = None,
    history_days: int = 14,
    parallel: bool = True,
    detect_anomalies: bool = True,
    filter_anomalies: bool = False,
    top_n: int = 5,
) -> Dict[str, Any]:
    """端到端采集对比流程,返回完整结果结构(供 CLI/Web 复用)。

    Args:
        parallel: 是否并发采集多平台(默认 True)
        detect_anomalies: 是否做异常价检测并标注(默认 True,仅标注不删)
        filter_anomalies: 是否直接剔除异常价商品(默认 False,谨慎)
        top_n: 性价比推荐数量
    """
    logger = logging.getLogger("price_tracker")
    platforms = platforms or ["jd", "taobao", "pdd"]

    raw: List[Product] = []
    per_platform_counts: Dict[str, int] = {}

    # 1. 多平台采集(并发或顺序)
    if parallel and len(platforms) > 1 and mode != "mock":
        # live 模式并发(各平台独立速率限制器,不会互相干扰)
        with ThreadPoolExecutor(max_workers=min(len(platforms), 4)) as ex:
            futures = {
                ex.submit(_collect_one, p, keyword, limit_per_platform,
                          mode, seed, history_days, logger): p
                for p in platforms
            }
            for fut in as_completed(futures):
                p = futures[fut]
                try:
                    items = fut.result()
                    raw.extend(items)
                    per_platform_counts[p] = len(items)
                except Exception as e:  # noqa: BLE001
                    logger.warning(f"[{p}] 采集异常: {e}")
                    per_platform_counts[p] = 0
    else:
        # mock 模式或单平台: 顺序(结果稳定可复现,且 mock 不涉及IO)
        for p in platforms:
            items = _collect_one(p, keyword, limit_per_platform, mode, seed, history_days, logger)
            raw.extend(items)
            per_platform_counts[p] = len(items)

    # 2. 清洗去重(含规格指纹跨平台同款合并)
    cleaned = clean_and_dedup(raw)

    # 3. 异常价检测(标注或过滤)
    anomalies: List[dict] = []
    if detect_anomalies:
        cleaned, anomalies = detect_outliers(cleaned, k=3.0, min_samples=5)
        if filter_anomalies and anomalies:
            bad_ids = {a["product"]["product_id"] for a in anomalies}
            cleaned = [p for p in cleaned if p.product_id not in bad_ids]

    # 4. 按价格升序
    sorted_items = sort_by_price(cleaned, ascending=True)

    # 5. 横向对比
    comparison = compare_products(sorted_items)

    # 6. 性价比推荐
    recommendations = recommend_best_value(sorted_items, top_n=top_n)

    # 7. 趋势 + 预测
    trend = build_trend_series(sorted_items)
    forecasts = build_forecasts(sorted_items)
    stats = summary_stats(sorted_items)

    return {
        "keyword": keyword,
        "mode": mode,
        "per_platform_counts": per_platform_counts,
        "raw_count": len(raw),
        "cleaned_count": len(cleaned),
        "anomaly_count": len(anomalies),
        "stats": stats,
        "products": [p.to_dict() for p in sorted_items],
        "comparison": _serialize_comparison(comparison),
        "recommendations": recommendations,
        "trend": trend,
        "forecasts": forecasts,
        "anomalies": anomalies,
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
        parallel=False,  # 示例数据顺序采集保证可复现
    )

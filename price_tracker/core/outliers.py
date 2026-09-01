"""异常价格检测.

电商采集常遇到两类脏数据:
1. 钓鱼/虚假低价(价格远低于市场均价,诱导下单)
2. 错填价(价格异常高,如多输一位)

本模块用 IQR(四分位距)法识别异常价格并标注,默认不删除而是打标,
由上层决定是否过滤,避免误删真实促销爆款。
"""
from __future__ import annotations

from typing import List, Tuple

from .models import Product


def _quartiles(values: List[float]) -> Tuple[float, float, float, float]:
    """返回 Q1, Q2(中位数), Q3, IQR。空列表返回 0."""
    if not values:
        return 0.0, 0.0, 0.0, 0.0
    s = sorted(values)
    n = len(s)

    def _pct(p: float) -> float:
        # 线性插值法计算分位
        idx = p * (n - 1)
        lo = int(idx)
        hi = min(lo + 1, n - 1)
        frac = idx - lo
        return s[lo] + (s[hi] - s[lo]) * frac

    q1 = _pct(0.25)
    q2 = _pct(0.50)
    q3 = _pct(0.75)
    iqr = q3 - q1
    return q1, q2, q3, iqr


def detect_outliers(
    products: List[Product],
    k: float = 3.0,
    min_samples: int = 5,
) -> Tuple[List[Product], List[dict]]:
    """检测并标注异常价格商品。

    Args:
        products: 待检测商品
        k: IQR 倍数阈值(默认3.0,比标准1.5宽松,避免误伤促销)
        min_samples: 样本数低于此值不检测(样本太少分位不可靠)

    Returns:
        (products, outliers)  products 原地给异常项追加 "疑似异常价" 标签;
        outliers 为异常项明细 [{product, reason, lower_bound, upper_bound}]
    """
    prices = [p.price for p in products if p.price > 0]
    q1, q2, q3, iqr = _quartiles(prices)
    outliers: List[dict] = []

    if len(prices) < min_samples or iqr == 0:
        return products, outliers

    lower = q1 - k * iqr
    upper = q3 + k * iqr

    for p in products:
        if p.price <= 0:
            continue
        if p.price < lower:
            reason = f"价格 ¥{p.price:.2f} 低于下界 ¥{lower:.2f}(疑似虚假低价)"
            p.tags = list(dict.fromkeys(p.tags + ["疑似异常价"]))
            outliers.append({
                "product": p.to_dict(), "reason": reason,
                "bound": round(lower, 2), "side": "low",
            })
        elif p.price > upper:
            reason = f"价格 ¥{p.price:.2f} 高于上界 ¥{upper:.2f}(疑似错填价)"
            p.tags = list(dict.fromkeys(p.tags + ["疑似异常价"]))
            outliers.append({
                "product": p.to_dict(), "reason": reason,
                "bound": round(upper, 2), "side": "high",
            })
    return products, outliers


def filter_outliers(products: List[Product], k: float = 3.0, min_samples: int = 5) -> List[Product]:
    """直接剔除异常价格商品(谨慎使用,可能误删真实促销)。"""
    _, outliers = detect_outliers(products, k=k, min_samples=min_samples)
    bad_ids = {o["product"]["product_id"] for o in outliers}
    return [p for p in products if p.product_id not in bad_ids]

"""价格预测.

基于历史价格序列做短周期预测(注意: 仅基于价格序列本身,不含外部因素,
适合做"近期是否会降价/能否再等等"的辅助判断,非投资建议):
- EMA(指数移动平均): 平滑并预测下一周期,反映近期趋势
- 线性回归斜率: 判断涨/跌方向与速率
- 综合: 给出"建议观望/可入手"提示
"""
from __future__ import annotations

from typing import List, Optional, Tuple


def ema(values: List[float], span: int = 5) -> List[float]:
    """指数移动平均。span 越大越平滑。"""
    if not values:
        return []
    alpha = 2 / (span + 1)
    out = [values[0]]
    for v in values[1:]:
        out.append(alpha * v + (1 - alpha) * out[-1])
    return out


def linear_fit(values: List[float]) -> Tuple[float, float]:
    """最小二乘线性回归,返回(斜率, 截距)。空列表返回(0, 0)."""
    n = len(values)
    if n < 2:
        return 0.0, values[0] if values else 0.0
    xs = list(range(n))
    mx = sum(xs) / n
    my = sum(values) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, values))
    den = sum((x - mx) ** 2 for x in xs)
    slope = num / den if den else 0.0
    intercept = my - slope * mx
    return slope, intercept


def forecast_price(history: List[float], horizon: int = 3) -> dict:
    """对单品历史价格做预测。

    Args:
        history: 历史价格序列(远->近, 即最右为最新)
        horizon: 预测未来周期数

    Returns:
        {ema_series, next_ema, slope, slope_pct, trend, suggestion, forecast}
    """
    # history 约定: 远->近。若传入的是 近->远,则反转
    if not history or len(history) < 3:
        return {"ema_series": [], "next_ema": None, "slope": 0,
                "slope_pct": 0, "trend": "数据不足", "suggestion": "数据不足,无法预测",
                "forecast": []}

    series = list(history)
    ema_series = ema(series, span=min(5, len(series)))
    next_ema = alpha_next(series, span=min(5, len(series)))

    slope, intercept = linear_fit(series)
    # 周期斜率占当前价百分比
    cur = series[-1]
    slope_pct = (slope / cur * 100) if cur else 0

    # 趋势判定: 斜率 + EMA 方向
    if slope_pct < -0.5:
        trend = "下行"
        suggestion = "价格在降,可再观望"
    elif slope_pct > 0.5:
        trend = "上行"
        suggestion = "价格在涨,建议尽快入手"
    else:
        trend = "平稳"
        suggestion = "价格平稳,可入手"

    # 线性外推未来 horizon 周期
    n = len(series)
    forecast = [max(0.01, intercept + slope * (n + i)) for i in range(1, horizon + 1)]
    forecast = [round(v, 2) for v in forecast]

    return {
        "ema_series": [round(v, 2) for v in ema_series],
        "next_ema": round(next_ema, 2) if next_ema else None,
        "slope": round(slope, 3),
        "slope_pct": round(slope_pct, 2),
        "trend": trend,
        "suggestion": suggestion,
        "forecast": forecast,
    }


def alpha_next(values: List[float], span: int) -> Optional[float]:
    """预测下一周期 EMA 值。"""
    if not values:
        return None
    alpha = 2 / (span + 1)
    prev = values[0]
    for v in values[1:]:
        prev = alpha * v + (1 - alpha) * prev
    # 下一个点用最后一个 EMA 外推
    return alpha * values[-1] + (1 - alpha) * prev


def build_forecasts(products) -> List[dict]:
    """为每个有历史价的商品生成预测。products 为 Product 列表。"""
    out = []
    for p in products:
        # history 约定: 最近->最远。预测需 远->近,故反转
        hist = list(reversed(p.history)) if p.history else []
        if not hist:
            continue
        fc = forecast_price(hist)
        if fc["next_ema"] is None:
            continue
        out.append({
            "id": p.dedup_key,
            "title": p.title[:24],
            "platform": p.platform,
            "price": p.price,
            "trend": fc["trend"],
            "suggestion": fc["suggestion"],
            "next_ema": fc["next_ema"],
            "slope_pct": fc["slope_pct"],
            "forecast": fc["forecast"],
        })
    return out

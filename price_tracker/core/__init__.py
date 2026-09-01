"""核心数据处理模块."""
from .models import Product, Platform
from .base import BaseCollector, RateLimiter
from .cleaners import clean_and_dedup, sort_by_price
from .compare import compare_products
from .recommend import recommend_best_value, rank_value
from .trend import build_trend_series, summary_stats
from .outliers import detect_outliers, filter_outliers
from .specs import extract_spec, spec_similarity, Spec
from .forecast import forecast_price, build_forecasts, ema, linear_fit

__all__ = [
    "Product",
    "Platform",
    "BaseCollector",
    "RateLimiter",
    "clean_and_dedup",
    "sort_by_price",
    "compare_products",
    "recommend_best_value",
    "rank_value",
    "build_trend_series",
    "summary_stats",
    "detect_outliers",
    "filter_outliers",
    "extract_spec",
    "spec_similarity",
    "Spec",
    "forecast_price",
    "build_forecasts",
    "ema",
    "linear_fit",
]

"""核心数据处理模块."""
from .models import Product, Platform
from .base import BaseCollector
from .cleaners import clean_and_dedup, sort_by_price
from .compare import compare_products
from .recommend import recommend_best_value, rank_value
from .trend import build_trend_series, summary_stats

__all__ = [
    "Product",
    "Platform",
    "BaseCollector",
    "clean_and_dedup",
    "sort_by_price",
    "compare_products",
    "recommend_best_value",
    "rank_value",
    "build_trend_series",
    "summary_stats",
]

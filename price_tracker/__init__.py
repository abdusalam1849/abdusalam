"""电商商品价格自动化采集与对比工具.

提供从主流电商平台（京东 / 淘宝 / 拼多多）批量采集商品信息、
清洗去重、按价格排序、横向对比、趋势可视化与性价比推荐能力。
"""
from .models import Product, AnalysisReport
from .pipeline import Pipeline

__version__ = "1.0.0"
__all__ = ["Product", "AnalysisReport", "Pipeline"]

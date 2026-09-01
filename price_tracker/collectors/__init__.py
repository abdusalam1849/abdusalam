"""采集器集合."""
from .jd import JDCollector
from .taobao import TaobaoCollector
from .pdd import PDDCollector
from .openapi import PddOpenAPICollector
from .mock import generate_products

__all__ = [
    "JDCollector",
    "TaobaoCollector",
    "PDDCollector",
    "PddOpenAPICollector",
    "generate_products",
]

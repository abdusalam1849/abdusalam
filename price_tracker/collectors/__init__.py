"""采集器集合."""
from .jd import JDCollector
from .taobao import TaobaoCollector
from .pdd import PDDCollector
from .mock import generate_products

__all__ = [
    "JDCollector",
    "TaobaoCollector",
    "PDDCollector",
    "generate_products",
]

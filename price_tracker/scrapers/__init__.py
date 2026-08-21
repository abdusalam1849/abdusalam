"""采集器子包：基类 + 平台适配器."""
from .base import BaseScraper, ScraperRegistry
from .jd import JdScraper
from .taobao import TaobaoScraper
from .pdd import PddScraper
from .demo import DemoScraper

__all__ = [
    "BaseScraper",
    "ScraperRegistry",
    "JdScraper",
    "TaobaoScraper",
    "PddScraper",
    "DemoScraper",
]

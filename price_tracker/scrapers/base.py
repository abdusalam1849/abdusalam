"""采集器基类与注册中心."""
from __future__ import annotations

import logging
import random
import time
from abc import ABC, abstractmethod
from typing import Dict, Iterable, List, Optional

import requests

from ..models import Product

logger = logging.getLogger(__name__)


class BaseScraper(ABC):
    """所有平台采集器的抽象基类.

    子类需实现 :meth:`_fetch`，返回原始 HTML / JSON 文本，
    以及 :meth:`_parse` 将原始响应解析为 :class:`Product` 列表。
    本基类负责：

    1. HTTP 会话与浏览器级请求头；
    2. 重试与超时控制；
    3. 反爬被拦截时自动回退到 demo 数据（保证工具始终可用）；
    4. 统一的 ``search`` 入口。
    """

    platform: str = "base"
    display_name: str = "基类"
    search_url: str = ""

    # 浏览器级请求头，降低被风控概率
    DEFAULT_HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
    }

    def __init__(self, timeout: int = 10, retries: int = 1, proxy: Optional[str] = None) -> None:
        self.timeout = timeout
        self.retries = retries
        self.session = requests.Session()
        self.session.headers.update(self.DEFAULT_HEADERS)
        if proxy:
            self.session.proxies.update({"http": proxy, "https": proxy})

    # ------------------------------------------------------------------
    # 公开接口
    # ------------------------------------------------------------------
    def search(self, keyword: str, limit: int = 20, allow_fallback: bool = True) -> List[Product]:
        """搜索关键词，返回至多 ``limit`` 个商品."""
        keyword = (keyword or "").strip()
        if not keyword:
            return []
        try:
            raw = self._fetch(keyword, limit=limit)
            products = self._parse(raw, keyword=keyword)[:limit]
            if products:
                logger.info("[%s] 关键词 %r 命中 %d 条", self.platform, keyword, len(products))
                return products
            if allow_fallback:
                logger.warning("[%s] 解析为空，回退 demo 数据", self.platform)
                return self._fallback_demo(keyword, limit)
            return []
        except Exception as exc:  # noqa: BLE001  采集需容错
            logger.warning("[%s] 采集失败 %s; allow_fallback=%s", self.platform, exc, allow_fallback)
            if allow_fallback:
                return self._fallback_demo(keyword, limit)
            return []

    # ------------------------------------------------------------------
    # 子类实现
    # ------------------------------------------------------------------
    @abstractmethod
    def _fetch(self, keyword: str, limit: int) -> str:
        """实际发起请求，返回原始响应文本."""

    @abstractmethod
    def _parse(self, raw: str, *, keyword: str) -> List[Product]:
        """解析原始响应为 Product 列表."""

    # ------------------------------------------------------------------
    # demo 回退：保证工具在网络受限 / 风控拦截时仍可演示
    # ------------------------------------------------------------------
    def _fallback_demo(self, keyword: str, limit: int) -> List[Product]:
        from .demo import DemoScraper
        return DemoScraper().generate_for(keyword, self.platform, limit)


class ScraperRegistry:
    """采集器注册中心：维护平台名 → 采集器实例映射."""

    def __init__(self) -> None:
        self._scrapers: Dict[str, BaseScraper] = {}

    def register(self, scraper: BaseScraper) -> BaseScraper:
        self._scrapers[scraper.platform] = scraper
        return scraper

    def get(self, platform: str) -> Optional[BaseScraper]:
        return self._scrapers.get(platform)

    def all(self) -> Iterable[BaseScraper]:
        return self._scrapers.values()

    def platforms(self) -> List[str]:
        return list(self._scrapers.keys())

    def search_all(self, keyword: str, limit: int = 20) -> List[Product]:
        """并发搜索所有已注册平台（简单串行实现，避免触发风控）."""
        results: List[Product] = []
        for scraper in self._scrapers.values():
            results.extend(scraper.search(keyword, limit=limit))
            time.sleep(random.uniform(0.2, 0.6))  # 礼貌延时
        return results

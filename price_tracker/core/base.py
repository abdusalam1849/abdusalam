"""采集器抽象基类.

提供生产级采集能力:
- 重试与指数退避(可配置次数/退避基数/抖动)
- 每平台速率限制(令牌桶式简单限速,避免触发风控)
- User-Agent 轮换池
- 结构化日志(可注入 logger,默认 stderr)
- mock/live 双模式,凭证从环境变量注入,未配置或失败自动回退 mock
"""
from __future__ import annotations

import abc
import logging
import os
import random
import time
from typing import List, Optional

from .models import Product, Platform


# UA 轮换池: 桌面 + 移动端混合,降低单一指纹被风控概率
DEFAULT_UA_POOL = [
    # 桌面 Chrome
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    # 移动端
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
]


def _default_logger() -> logging.Logger:
    logger = logging.getLogger("price_tracker")
    if not logger.handlers:
        h = logging.StreamHandler()
        h.setFormatter(logging.Formatter("[%(asctime)s] %(levelname)s %(message)s",
                                         datefmt="%H:%M:%S"))
        logger.addHandler(h)
        logger.setLevel(logging.WARNING)
    return logger


class RateLimiter:
    """简单的最小间隔速率限制器(线程安全)."""

    def __init__(self, min_interval: float = 1.0):
        self.min_interval = min_interval
        self._last = 0.0
        import threading
        self._lock = threading.Lock()

    def wait(self) -> None:
        with self._lock:
            now = time.monotonic()
            delta = now - self._last
            if delta < self.min_interval:
                time.sleep(self.min_interval - delta)
            self._last = time.monotonic()


class BaseCollector(abc.ABC):
    """平台采集器接口.

    新增平台只需继承本类并实现 search()。采集器有两种工作模式:
    - mock: 生成符合该平台分布特征的模拟数据,用于演示与算法验证(默认)
    - live: 真实抓取,需通过环境变量配置平台凭证(cookie/token)

    设计说明: 京东/淘宝/拼多多均有强反爬机制(动态签名参数、登录态校验、
    动态渲染、滑块验证)。生产环境真实抓取通常需要:
      a) 申请平台开放平台API(JD Open API / 淘宝开放平台 / 拼多多开放平台),或
      b) 配置登录态cookie + 浏览器自动化(Playwright),并处理风控。
    本工具的 live 骨架展示了请求/解析结构,凭证由环境变量注入,未配置时回退 mock。
    """

    platform: Platform = Platform.MOCK

    def __init__(
        self,
        mode: str = "mock",
        seed: Optional[int] = None,
        max_retries: int = 3,
        backoff_base: float = 1.5,
        backoff_jitter: float = 0.3,
        rate_limit: float = 1.0,
        logger: Optional[logging.Logger] = None,
    ):
        self.mode = mode
        self.rng = random.Random(seed)
        self.max_retries = max_retries
        self.backoff_base = backoff_base
        self.backoff_jitter = backoff_jitter
        self.rate_limiter = RateLimiter(rate_limit)
        self.logger = logger or _default_logger()
        # 凭证从环境变量读取,避免硬编码
        self.cookie = os.environ.get(self._cred_env("COOKIE"), "")
        self.token = os.environ.get(self._cred_env("TOKEN"), "")
        self._ua_rng = random.Random(seed)

    def _cred_env(self, suffix: str) -> str:
        return f"{self.platform.value.upper()}_{suffix}"

    @abc.abstractmethod
    def search(self, keyword: str, limit: int = 20) -> List[Product]:
        """按关键词搜索采集商品列表(live 实现)."""
        raise NotImplementedError

    def _live_ready(self) -> bool:
        """live 模式是否已具备凭证。子类可覆盖(如 OpenAPI 需 appkey+secret)."""
        return bool(self.cookie or self.token)

    def pick_ua(self) -> str:
        """随机选取一个 User-Agent。"""
        return self._ua_rng.choice(DEFAULT_UA_POOL)

    def request_with_retry(self, do_request, *, context: str = ""):
        """对一次 HTTP 请求做重试+退避,do_request() 应返回 response 或抛异常.

        会先 rate-limit,失败后指数退避重试,达到 max_retries 仍失败则抛出最后异常。
        """
        import requests  # 局部导入, mock 模式无需 requests
        last_exc: Optional[Exception] = None
        for attempt in range(1, self.max_retries + 1):
            self.rate_limiter.wait()
            try:
                return do_request()
            except (requests.exceptions.Timeout,
                    requests.exceptions.ConnectionError) as e:
                last_exc = e
                if attempt >= self.max_retries:
                    break
                # 指数退避 + 抖动
                delay = self.backoff_base ** attempt + self.rng.uniform(0, self.backoff_jitter)
                self.logger.warning(
                    f"[{self.platform.label}] {context} 第{attempt}次失败({type(e).__name__}),"
                    f"{delay:.1f}s 后重试")
                time.sleep(delay)
            except requests.exceptions.HTTPError as e:
                status = e.response.status_code if e.response is not None else "?"
                # 4xx(非429)通常不可重试;429/5xx 可重试
                if status not in (429, 500, 502, 503, 504) or attempt >= self.max_retries:
                    last_exc = e
                    break
                last_exc = e
                delay = self.backoff_base ** attempt + self.rng.uniform(0, self.backoff_jitter)
                self.logger.warning(
                    f"[{self.platform.label}] {context} HTTP {status},"
                    f"{delay:.1f}s 后重试")
                time.sleep(delay)
        # 全部重试失败
        raise last_exc if last_exc else RuntimeError(f"[{self.platform.label}] {context} 请求失败")

    def collect(self, keyword: str, limit: int = 20) -> List[Product]:
        """统一入口: 根据 mode 决定走 live 还是 mock.

        live 模式重试耗尽或解析异常时,回退 mock 并记录警告,保证工具可用。
        """
        if self.mode == "live" and self._live_ready():
            try:
                items = self.search(keyword, limit)
                self.logger.info(f"[{self.platform.label}] live 采集成功: {len(items)} 条")
                return items
            except Exception as e:  # noqa: BLE001
                self.logger.warning(
                    f"[{self.platform.label}] live 采集失败({type(e).__name__}: {e}),回退 mock")
                return self._mock_search(keyword, limit)
        return self._mock_search(keyword, limit)

    def _mock_search(self, keyword: str, limit: int) -> List[Product]:
        """子类可覆盖以提供平台特征化的模拟数据。"""
        return []

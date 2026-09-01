"""采集器抽象基类."""
from __future__ import annotations

import abc
import os
import random
from typing import List, Optional

from .models import Product, Platform


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

    def __init__(self, mode: str = "mock", seed: Optional[int] = None):
        self.mode = mode
        self.rng = random.Random(seed)
        # 凭证从环境变量读取,避免硬编码
        self.cookie = os.environ.get(self._cred_env("COOKIE"), "")
        self.token = os.environ.get(self._cred_env("TOKEN"), "")

    def _cred_env(self, suffix: str) -> str:
        return f"{self.platform.value.upper()}_{suffix}"

    @abc.abstractmethod
    def search(self, keyword: str, limit: int = 20) -> List[Product]:
        """按关键词搜索采集商品列表."""
        raise NotImplementedError

    def _live_ready(self) -> bool:
        """live 模式是否已具备凭证."""
        return bool(self.cookie or self.token)

    def collect(self, keyword: str, limit: int = 20) -> List[Product]:
        """统一入口: 根据 mode 决定走 live 还是 mock."""
        if self.mode == "live" and self._live_ready():
            try:
                return self.search(keyword, limit)
            except Exception as e:  # noqa: BLE001
                # live 抓取失败时回退 mock 并打印提示,保证工具可用
                print(f"[{self.platform.label}] live 抓取失败({e}),回退 mock")
                return self._mock_search(keyword, limit)
        return self._mock_search(keyword, limit)

    def _mock_search(self, keyword: str, limit: int) -> List[Product]:
        """子类可覆盖以提供平台特征化的模拟数据."""
        return []

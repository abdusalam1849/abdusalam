"""开放平台 API 采集器(以多多进宝为参考实现).

与 scraping 采集器不同,本类对接平台**官方开放 API**,合规且稳定:

- 多多进宝(拼多多联盟开放平台)提供 `pdd.ddk.goods.search` 等接口
  官方文档: https://open.pinduoduo.com/
- 鉴权: ClientID(应用ID) + ClientSecret(密钥),通过 HMAC/MD5 生成 sign
- 请求参数升序排列后拼接,再 append secret,做 MD5 = sign

凭证从环境变量注入:
  PDD_CLIENT_ID / PDD_CLIENT_SECRET  (或通用 PDD_TOKEN 作为双用途凭证)

说明: 该接口需要先在多多进宝后台创建应用并审核通过;未配置凭证时 _live_ready()
返回 False,自动回退 mock。本实现给出完整可用的 sign 算法与请求结构,
配置真实凭证后即可直接调用生产接口。
"""
from __future__ import annotations

import hashlib
import time
from typing import List, Optional

from ..core.base import BaseCollector
from ..core.models import Product, Platform
from .mock import generate_products


class PddOpenAPICollector(BaseCollector):
    """多多进宝开放API采集器(官方合规通道)."""

    platform = Platform.PDD

    GATEWAY = "https://gw-api.pinduoduo.com/api/router"

    def __init__(self, mode: str = "mock", seed: Optional[int] = None, **kwargs):
        super().__init__(mode=mode, seed=seed, **kwargs)
        # 多多进宝用 client_id / client_secret 而非 cookie
        self.client_id = self.token or _env("PDD_CLIENT_ID", "")
        self.client_secret = _env("PDD_CLIENT_SECRET", "")

    def _live_ready(self) -> bool:
        return bool(self.client_id and self.client_secret)

    def _mock_search(self, keyword: str, limit: int) -> List[Product]:
        return generate_products(keyword, Platform.PDD, limit,
                                 seed=hash(keyword) & 0xffff)

    def search(self, keyword: str, limit: int = 20) -> List[Product]:
        """调用 pdd.ddk.goods.search 开放接口。"""
        import requests  # 局部导入

        params = {
            "type": "pdd.ddk.goods.search",
            "keyword": keyword,
            "page": 1,
            "page_size": min(limit, 100),
            "sort_type": 1,         # 1=综合
            "with_coupon": "true",
            # 官方要求的标准字段
            "client_id": self.client_id,
            "timestamp": str(int(time.time())),
            "data_type": "JSON",
        }
        params["sign"] = self._sign(params)

        def _do():
            resp = requests.get(self.GATEWAY, params=params, timeout=10,
                                headers={"User-Agent": self.pick_ua()})
            resp.raise_for_status()
            return resp
        resp = self.request_with_retry(_do, context=f"多多进宝API '{keyword}'")
        return self._parse(resp.json(), limit)

    def _sign(self, params: dict) -> str:
        """多多进宝官方签名算法.

        规则(简化版,与官方文档一致):
          1. 参数按键名 ASCII 升序排列
          2. 拼成 key1value1key2value2... (不含 sign 本身)
          3. 前后拼接 client_secret:  secret + body + secret
          4. MD5 后转大写
        """
        items = sorted((k, v) for k, v in params.items() if k != "sign" and v is not None)
        body = "".join(f"{k}{v}" for k, v in items)
        raw = f"{self.client_secret}{body}{self.client_secret}"
        return hashlib.md5(raw.encode("utf-8")).hexdigest().upper()

    def _parse(self, data: dict, limit: int) -> List[Product]:
        items = (data.get("goods_search_response", {})
                 .get("goods_list", []))
        products: List[Product] = []
        for it in items[:limit]:
            try:
                price = float(it.get("min_group_price", 0)) / 100  # 分 -> 元
                if price <= 0:
                    continue
            except (TypeError, ValueError):
                continue
            tags = []
            if it.get("has_coupon"):
                tags.append("有券")
            if it.get("opt_name"):
                tags.append(it["opt_name"])
            products.append(Product(
                platform=Platform.PDD.value,
                product_id=str(it.get("goods_sign", it.get("goods_id", ""))),
                title=it.get("goods_name", "").strip(),
                price=round(price, 2),
                original_price=float(it.get("min_normal_price", 0)) / 100 or None,
                sales=int(it.get("sales_tip", 0) or _parse_sales_tip(it.get("sales_tip", ""))),
                shop_name=it.get("mall_name", ""),
                shop_score=0.0,
                url=f"https://mobile.yangkeduo.com/goods.html?goods_id={it.get('goods_id')}",
                image_url=it.get("goods_image_url", ""),
                tags=tags,
            ))
        return products


def _env(name: str, default: str = "") -> str:
    import os
    return os.environ.get(name, default) or default


def _parse_sales_tip(s) -> int:
    """'已拼1万+件' -> 10000。"""
    if isinstance(s, (int, float)):
        return int(s)
    import re
    m = re.search(r"(\d+(?:\.\d+)?)\s*([万千])?", str(s))
    if not m:
        return 0
    num = float(m.group(1))
    unit = m.group(2)
    if unit == "万":
        num *= 10000
    elif unit == "千":
        num *= 1000
    return int(num)

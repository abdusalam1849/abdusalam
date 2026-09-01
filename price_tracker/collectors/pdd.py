"""拼多多采集器.

说明: 拼多多无 PC 公开搜索页,搜索接口需 app 版本签名 + 登录态,风控极强。
生产抓取通常依赖 Playwright 模拟移动端 App 内 H5,或对接多多进宝/开放平台 API。
本 live 骨架仅示意;未配置 PDD_COOKIE 时回退 mock。
"""
from __future__ import annotations

import re
from typing import List

import requests

from ..core.base import BaseCollector
from ..core.models import Product, Platform
from .mock import generate_products


class PDDCollector(BaseCollector):
    platform = Platform.PDD

    SEARCH_URL = "https://mobile.yangkeduo.com/proxy/api/search/goods"

    def _mock_search(self, keyword: str, limit: int) -> List[Product]:
        return generate_products(keyword, Platform.PDD, limit,
                                 seed=hash(keyword) & 0xffff)

    def search(self, keyword: str, limit: int = 20) -> List[Product]:
        """live 抓取拼多多搜索结果(移动端 H5 API,带重试与UA轮换)。"""
        ua = self.pick_ua()

        def _do():
            headers = {
                "User-Agent": ua + " PDDMobile/6.45.0",
                "Cookie": self.cookie,
                "Referer": "https://mobile.yangkeduo.com/search_result.html",
                "Content-Type": "application/json",
            }
            params = {"keyword": keyword, "page": 1, "size": limit, "sort": "price_asc"}
            resp = requests.get(self.SEARCH_URL, params=params, headers=headers, timeout=10)
            resp.raise_for_status()
            return resp
        resp = self.request_with_retry(_do, context=f"PDD搜索 '{keyword}'")
        try:
            return self._parse_json(resp.json(), limit)
        except ValueError as e:
            # 响应非 JSON(可能是风控页),抛出让上层回退 mock
            raise RuntimeError(f"PDD响应非JSON: {e}")

    def _parse_json(self, data: dict, limit: int) -> List[Product]:
        items = data.get("data", {}).get("items", []) or data.get("items", [])
        products: List[Product] = []
        for it in items[:limit]:
            try:
                price = float(it.get("price", 0)) / 100  # 接口价格单位分
            except (TypeError, ValueError):
                price = 0.0
            tags = []
            if it.get("is_subsidy"):
                tags.append("百亿补贴")
            if it.get("free_shipping"):
                tags.append("包邮")
            products.append(Product(
                platform=Platform.PDD.value,
                product_id=str(it.get("goods_id", "")),
                title=it.get("goods_name", "").strip(),
                price=round(price, 2),
                original_price=float(it.get("origin_price", 0)) / 100 or None,
                sales=int(it.get("cnt", it.get("sales", 0)) or 0),
                shop_name=it.get("mall_name", ""),
                shop_score=float(it.get("mall_score", 0) or 0) or 0.0,
                url=f"https://mobile.yangkeduo.com/goods.html?goods_id={it.get('goods_id')}",
                image_url=it.get("hd_thumb_url") or it.get("thumb_url", ""),
                tags=tags,
            ))
        return products

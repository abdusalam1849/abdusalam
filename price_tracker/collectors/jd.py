"""京东采集器.

live 模式骨架参考 JD 搜索页结构。注意: 京东搜索结果页大量内容由前端
JS 异步渲染,且含 cookie 校验与风控;实际抓取通常需 Playwright + 登录态。
本骨架展示请求/解析结构,未配置 JD_COOKIE 时自动回退 mock。
"""
from __future__ import annotations

import json
import re
from typing import List, Optional

import requests

from ..core.base import BaseCollector
from ..core.models import Product, Platform
from .mock import generate_products


class JDCollector(BaseCollector):
    platform = Platform.JD

    SEARCH_URL = "https://search.jd.com/Search"

    def _mock_search(self, keyword: str, limit: int) -> List[Product]:
        return generate_products(keyword, Platform.JD, limit, seed=hash(keyword) & 0xffff)

    def search(self, keyword: str, limit: int = 20) -> List[Product]:
        """live 抓取: 解析京东搜索结果页商品列表。"""
        headers = {
            "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                            "AppleWebKit/537.36 (KHTML, like Gecko) "
                            "Chrome/120.0 Safari/537.36"),
            "Referer": "https://www.jd.com/",
            "Cookie": self.cookie,
        }
        params = {"keyword": keyword, "enc": "utf-8", "psort": "3", "page": 1}
        resp = requests.get(self.SEARCH_URL, params=params, headers=headers, timeout=10)
        resp.raise_for_status()
        return self._parse_html(resp.text, keyword, limit)

    def _parse_html(self, html: str, keyword: str, limit: int) -> List[Product]:
        """从搜索页 HTML 提取商品。京东商品列表在 <li class="gl-item"> 中。

        实际生产中数据常嵌在 window.__INITIAL_STATE__ 的 JSON 中,这里同时尝试两种方式。
        """
        products: List[Product] = []
        # 方式1: 内嵌 JSON state
        m = re.search(r"window\.__INITIAL_STATE__\s*=\s*({.*?});", html, re.S)
        if m:
            try:
                state = json.loads(m.group(1))
                items = (state.get("search", {})
                              .get("searchInfo", {})
                              .get("itemList", []))
                for it in items[:limit]:
                    products.append(self._from_jd_item(it))
            except (json.JSONDecodeError, KeyError):
                pass

        # 方式2: 兜底正则
        if not products:
            pattern = re.compile(
                r'<li[^>]*class="gl-item"[^>]*data-sku="(\d+)"'
                r'[\s\S]*?<a[^>]*href="([^"]+)"[\s\S]*?'
                r'<em[^>]*>([\s\S]*?)</em>[\s\S]*?'
                r'<strong[^>]*class="J_\?[^"]*"[^>]*>¥([\d.]+)</strong>',
                re.S,
            )
            for sku, url, title, price in pattern.findall(html)[:limit]:
                products.append(Product(
                    platform=Platform.JD.value,
                    product_id=sku,
                    title=re.sub(r"<[^>]+>", "", title).strip(),
                    price=float(price),
                    url=f"https:{url}" if url.startswith("//") else url,
                ))
        return products

    def _from_jd_item(self, it: dict) -> Product:
        return Product(
            platform=Platform.JD.value,
            product_id=str(it.get("skuId", it.get("spuId", ""))),
            title=it.get("name", "").strip(),
            price=float(it.get("price", it.get("jdPrice", 0)) or 0),
            original_price=float(it.get("mPrice", 0)) or None,
            shop_name=it.get("shop", {}).get("shopName", ""),
            shop_score=0.0,
            url=f"https://item.jd.com/{it.get('skuId')}.html",
            image_url=it.get("image", ""),
            tags=["自营"] if it.get("isJdSale") else [],
        )

"""淘宝采集器.

说明: 淘宝搜索强依赖登录态,且请求需携带动态签名参数 sign(由前端JS生成)。
未登录 / 无正确 sign 时接口返回空或风控页。生产抓取一般走:
  - 淘宝开放平台API(需AppKey/Secret,合规)
  - 或 Playwright 注入登录态 cookie 后调用搜索接口

本 live 骨架展示请求结构,实际成功率取决于 cookie/sign;未配置 TAOBAO_COOKIE 时回退 mock。
"""
from __future__ import annotations

import json
import re
from typing import List

import requests

from ..core.base import BaseCollector
from ..core.models import Product, Platform
from .mock import generate_products


class TaobaoCollector(BaseCollector):
    platform = Platform.TAOBAO

    # H5 搜索接口,返回 JSON。需登录态 cookie。
    SEARCH_URL = "https://h5api.m.taobao.com/h5/mtop.relationrecommend.wirelessrecommend.recommend/1.0/"

    def _mock_search(self, keyword: str, limit: int) -> List[Product]:
        return generate_products(keyword, Platform.TAOBAO, limit,
                                  seed=hash(keyword) & 0xffff)

    def search(self, keyword: str, limit: int = 20) -> List[Product]:
        """live 抓取淘宝搜索结果。"""
        headers = {
            "User-Agent": ("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
                            "AppleWebKit/605.1.15 Safari/604.1"),
            "Cookie": self.cookie,
            "Referer": "https://s.taobao.com/",
        }
        params = {
            "q": keyword,
            "spm": "a212z0.0.0.0",
            "tab": "all",
            "app": "search",
        }
        resp = requests.get("https://s.taobao.com/search",
                            params=params, headers=headers, timeout=10)
        resp.raise_for_status()
        return self._parse_html(resp.text, limit)

    def _parse_html(self, html: str, limit: int) -> List[Product]:
        """淘宝搜索结果常嵌在 window.__pageData__ 或 g_page_config 中。"""
        products: List[Product] = []
        m = re.search(r"window\.__pageData__\s*=\s*({.*?})\s*</script>", html, re.S)
        if not m:
            m = re.search(r"g_page_config\s*=\s*({.*?});", html, re.S)
        if not m:
            return products
        try:
            data = json.loads(m.group(1))
        except json.JSONDecodeError:
            return products
        items = (data.get("mods", {}).get("itemlist", {})
                 .get("data", {}).get("auctions", []))
        for it in items[:limit]:
            try:
                products.append(Product(
                    platform=Platform.TAOBAO.value,
                    product_id=str(it.get("nid") or it.get("item_id")),
                    title=it.get("raw_title") or it.get("title", ""),
                    price=float(it.get("view_price") or 0),
                    sales=self._parse_sales(it.get("view_sales", "")),
                    shop_name=it.get("nick") or it.get("shop_name", ""),
                    shop_score=float(it.get("shopcard", {}).get("rate", 0) or 0) or 0.0,
                    url=it.get("detail_url", ""),
                    image_url="https:" + it.get("pic_url", "") if it.get("pic_url") else "",
                    tags=[t for t in ["包邮", "天猫"] if it.get("iconList") and t.lower() in str(it["iconList"]).lower()],
                ))
            except (ValueError, TypeError):
                continue
        return products

    @staticmethod
    def _parse_sales(s: str) -> int:
        """'月销 1万+ 笔' -> 10000."""
        import re
        m = re.search(r"(\d+(?:\.\d+)?)\s*([万千])?", s)
        if not m:
            return 0
        num = float(m.group(1))
        unit = m.group(2)
        if unit == "万":
            num *= 10000
        elif unit == "千":
            num *= 1000
        return int(num)

"""淘宝 / 天猫采集器.

注意：淘宝搜索页强制登录态。本采集器在无 cookie 情况下大概率拿不到结果，
因此会通过 :class:`BaseScraper` 的 fallback 机制回退到 demo 数据。
设计上保留了完整流程以便用户接入登录态后即可真实采集。
"""
from __future__ import annotations

import re
from typing import List

from ..models import Product
from .base import BaseScraper


class TaobaoScraper(BaseScraper):
    platform = "taobao"
    display_name = "淘宝"
    search_url = "https://s.taobao.com/search"

    def _fetch(self, keyword: str, limit: int) -> str:
        params = {
            "q": keyword,
            "imgfile": "",
            "js": "1",
            "stats_click": "search_radio_all:1",
            "initiative_id": "staobaoz_20230101",
            "ie": "utf8",
        }
        # 也可尝试调用 m 站：https://s.m.taobao.com/h5?q=xxx
        resp = self.session.get(self.search_url, params=params, timeout=self.timeout,
                                allow_redirects=True)
        resp.encoding = resp.apparent_encoding or "utf-8"
        return resp.text

    def _parse(self, raw: str, *, keyword: str) -> List[Product]:
        products: List[Product] = []
        # 淘宝 SSR 页面里通常嵌入了 g_page_config 或 result JSON
        json_m = re.search(r'g_page_config\s*=\s*(\{.*?\});', raw, re.S) \
            or re.search(r'"data":\s*(\{.*?"auctions"\:.*?\})', raw, re.S)
        if not json_m:
            # 兼容 m 站 JSON：result.results 数组
            json_m2 = re.search(r'\{"[^"]*results[^"]*":\s*(\[.*?\])\s*\}', raw, re.S)
            if not json_m2:
                return []
            try:
                import json as _json
                items = _json.loads(json_m2.group(1))
            except Exception:
                return []
            for it in items[:30]:
                products.append(self._from_m_item(it))
            return products

        try:
            import json as _json
            cfg = _json.loads(json_m.group(1))
            auctions = cfg.get("mods", {}).get("itemlist", {}).get("data", {}).get("auctions", [])
        except Exception:
            auctions = []
        for it in auctions[:30]:
            try:
                price = float(it.get("view_price", "0").lstrip("¥"))
            except (ValueError, TypeError):
                continue
            pid = str(it.get("nid") or it.get("item_id") or "")
            title = re.sub(r"<[^>]+>", "", it.get("raw_title") or it.get("title") or "")
            sales = self._parse_sales(it.get("view_sales") or it.get("sale") or "")
            shop = it.get("nick") or it.get("shop_name") or "淘宝店"
            products.append(
                Product(
                    platform=self.platform,
                    product_id=pid,
                    title=title,
                    price=price,
                    original_price=None,
                    sales=sales,
                    shop_name=shop,
                    shop_rating=4.7,
                    url=it.get("detail_url") or f"https://item.taobao.com/item.htm?id={pid}",
                    image_url=it.get("pic_url") or "",
                )
            )
        return products

    @staticmethod
    def _parse_sales(text: str) -> int:
        """解析 '月销 1.2万+' 形式的销量."""
        m = re.search(r'(\d+(?:\.\d+)?)\s*万', text)
        if m:
            return int(float(m.group(1)) * 10000)
        m = re.search(r'(\d+)', text)
        return int(m.group(1)) if m else 0

    @staticmethod
    def _from_m_item(it: dict) -> Product:
        try:
            price = float(it.get("price", 0))
        except (ValueError, TypeError):
            price = 0.0
        return Product(
            platform="taobao",
            product_id=str(it.get("nid") or it.get("item_id") or ""),
            title=it.get("title", "") if isinstance(it.get("title"), str) else str(it.get("title", "")),
            price=price,
            original_price=None,
            sales=TaobaoScraper._parse_sales(it.get("sales", "")),
            shop_name=it.get("shop_name") or it.get("nick") or "淘宝店",
            shop_rating=4.7,
            url=it.get("url") or it.get("detail_url") or "",
            image_url=it.get("img") or it.get("pic_url") or "",
        )

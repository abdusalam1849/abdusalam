"""拼多多采集器.

拼多多反爬强度高，公开搜索接口需要 cookie / 风控参数。
本采集器实现请求骨架，无凭证时通过基类 fallback 回退 demo。
"""
from __future__ import annotations

import re
from typing import List

from ..models import Product
from .base import BaseScraper


class PddScraper(BaseScraper):
    platform = "pdd"
    display_name = "拼多多"
    # 移动端 H5 接口相对开放
    search_url = "https://mobile.yangkeduo.com/proxy/api/search"

    def _fetch(self, keyword: str, limit: int) -> str:
        params = {
            "keyword": keyword,
            "page": "1",
            "size": str(limit),
            "sort": "default",
            "direction": "1",
        }
        headers = {
            "Referer": f"https://mobile.yangkeduo.com/search_result.html?search_key={keyword}",
            "Origin": "https://mobile.yangkeduo.com",
        }
        resp = self.session.get(self.search_url, params=params, headers=headers, timeout=self.timeout)
        return resp.text

    def _parse(self, raw: str, *, keyword: str) -> List[Product]:
        import json as _json
        try:
            data = _json.loads(raw)
        except _json.JSONDecodeError:
            return []
        items = data.get("items") or data.get("data", {}).get("items") or []
        if isinstance(items, dict):
            items = items.get("list", [])
        products: List[Product] = []
        for it in items[:30]:
            goods = it.get("goods") or it
            try:
                # 拼多多价格单位为分
                price_cents = int(goods.get("min_normal_price") or goods.get("min_oneword_group_price") or 0)
                price = round(price_cents / 100, 2)
            except (ValueError, TypeError):
                continue
            if price <= 0:
                continue
            gid = str(goods.get("goods_id") or "")
            sales = int(goods.get("cnt") or goods.get("sales_tip_num") or 0)
            products.append(
                Product(
                    platform=self.platform,
                    product_id=gid,
                    title=goods.get("goods_name", ""),
                    price=price,
                    original_price=None,
                    sales=sales,
                    shop_name=goods.get("mall_name") or "拼多多商家",
                    shop_rating=round(float(goods.get("mall_score") or 4.5), 2),
                    url=f"https://mobile.yangkeduo.com/goods.html?goods_id={gid}",
                    image_url=goods.get("thumb_url") or goods.get("image_url") or "",
                )
            )
        return products

    @staticmethod
    def _parse_sales_tip(tip: str) -> int:
        """解析 '已拼 1.2万件'."""
        if not isinstance(tip, str):
            try:
                return int(tip)
            except (ValueError, TypeError):
                return 0
        m = re.search(r'(\d+(?:\.\d+)?)\s*万', tip)
        if m:
            return int(float(m.group(1)) * 10000)
        m = re.search(r'(\d+)', tip)
        return int(m.group(1)) if m else 0

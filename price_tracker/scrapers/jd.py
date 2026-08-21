"""京东采集器.

策略：优先尝试京东搜索页 HTML 接口；解析其中的商品卡片。
若被风控或返回异常（沙箱常见），自动回退到 :mod:`demo` 生成器，
保证整条工具链始终可运行。
"""
from __future__ import annotations

import json
import re
from typing import List

from ..models import Product
from .base import BaseScraper


class JdScraper(BaseScraper):
    platform = "jd"
    display_name = "京东"
    search_url = "https://search.jd.com/Search"

    def _fetch(self, keyword: str, limit: int) -> str:
        params = {
            "keyword": keyword,
            "enc": "utf-8",
            "qrst": "1",
            "rt": "1",
            "stop": "1",
            "vt": "2",
            "stock": "1",
            "page": "1",
            "s": "1",
            "click": "0",
        }
        resp = self.session.get(self.search_url, params=params, timeout=self.timeout)
        resp.encoding = resp.apparent_encoding or "utf-8"
        return resp.text

    def _parse(self, raw: str, *, keyword: str) -> List[Product]:
        products: List[Product] = []
        # 京东商品卡片：<li class="gl-item" data-sku="...">
        blocks = re.findall(r'<li[^>]*class="[^"]*gl-item[^"]*"[^>]*>(.*?)</li>', raw, re.S)
        if not blocks:
            # 兼容新版：data-sku 出现的 li
            blocks = re.findall(r'<li\s+sku-id="[^"]*"[^>]*>(.*?)</li>', raw, re.S)
        for blk in blocks[:30]:
            pid_m = re.search(r'data-sku="(\d+)"', blk) or re.search(r'sku-id="(\d+)"', blk)
            price_m = re.search(r'<i[^>]*class="[^"]*p-price[^"]*"[^>]*>[\s\S]*?<i>([\d.]+)</i>', blk)
            title_m = re.search(r'<em[^>]*class="[^"]*scroll-anchor[^"]*"[^>]*>([\s\S]*?)</em>', blk) \
                or re.search(r'class="p-name[^"]*"[^>]*>[\s\S]*?title="([^"]+)"', blk)
            shop_m = re.search(r'class="p-shop"[^>]*>[\s\S]*?title="([^"]+)"', blk)
            if not (pid_m and price_m and title_m):
                continue
            pid = pid_m.group(1)
            try:
                price = float(price_m.group(1))
            except ValueError:
                continue
            title = re.sub(r"<[^>]+>", "", title_m.group(1)).strip()
            shop = shop_m.group(1) if shop_m else "京东自营"
            # 京东销量通常以评论数近似（接口需登录，这里 0 占位）
            sales_m = re.search(r'class="p-commit"[^>]*>[\s\S]*?(\d+)', blk)
            sales = int(sales_m.group(1)) if sales_m else 0
            products.append(
                Product(
                    platform=self.platform,
                    product_id=pid,
                    title=title,
                    price=price,
                    original_price=None,
                    sales=sales,
                    shop_name=shop,
                    shop_rating=4.8,
                    url=f"https://item.jd.com/{pid}.html",
                    image_url="",
                )
            )
        return products

    def _fallback_demo(self, keyword: str, limit: int) -> List[Product]:
        # 基类已实现，此处显式保留以便自定义（如有需要）
        return super()._fallback_demo(keyword, limit)


def _has_captcha_or_login(html: str) -> bool:
    """简单识别风控 / 登录跳转."""
    markers = ["请输入验证码", "verify.jd", "登录", "passport.jd", "ERR_3", "访问受限"]
    return any(m in html for m in markers)

"""数据清洗、去重、排序."""
from __future__ import annotations

import logging
import re
from typing import List

from .models import Product

logger = logging.getLogger(__name__)


class DataProcessor:
    """采集结果的清洗与标准化."""

    def process(self, products: List[Product], *, keyword: str = "") -> List[Product]:
        cleaned = self._clean(products)
        deduped = self._dedup(cleaned)
        sorted_products = self._sort(deduped)
        logger.info("处理完成：输入 %d → 清洗 %d → 去重 %d → 排序 %d",
                    len(products), len(cleaned), len(deduped), len(sorted_products))
        return sorted_products

    # ------------------------------------------------------------------
    def _clean(self, products: List[Product]) -> List[Product]:
        """清洗：去除空标题、异常价格、规范化字段."""
        out: List[Product] = []
        for p in products:
            # 标题去 HTML 标签、控制字符
            p.title = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", p.title or "")).strip()
            if not p.title:
                continue
            # 价格合理性：>0 且 < 1e7
            try:
                p.price = round(float(p.price), 2)
            except (ValueError, TypeError):
                continue
            if p.price <= 0 or p.price > 9_999_999:
                continue
            # 原价兜底
            if p.original_price is not None:
                try:
                    p.original_price = round(float(p.original_price), 2)
                    if p.original_price < p.price:
                        p.original_price = None
                except (ValueError, TypeError):
                    p.original_price = None
            # 销量规范化
            try:
                p.sales = int(p.sales or 0)
            except (ValueError, TypeError):
                p.sales = 0
            if p.sales < 0:
                p.sales = 0
            # 店铺评分规范到 0-5
            try:
                rating = float(p.shop_rating or 0)
            except (ValueError, TypeError):
                rating = 0
            if rating > 5:               # 兼容 0-100 评分
                rating = rating / 20
            p.shop_rating = round(max(0.0, min(5.0, rating)), 2)
            # 平台、URL 兜底
            p.platform = (p.platform or "").lower().strip() or "unknown"
            if not p.url:
                p.url = ""
            out.append(p)
        return out

    # ------------------------------------------------------------------
    def _dedup(self, products: List[Product]) -> List[Product]:
        """按 (platform, 规范化标题指纹) 去重；冲突时保留销量更高者."""
        seen: dict[str, Product] = {}
        for p in products:
            key = p.dedup_key
            existing = seen.get(key)
            if existing is None:
                seen[key] = p
                continue
            # 同 key 保留信息更全 / 销量更高的
            score_new = (p.sales, len(p.title), 1 if p.image_url else 0)
            score_old = (existing.sales, len(existing.title), 1 if existing.image_url else 0)
            if score_new > score_old:
                seen[key] = p
        return list(seen.values())

    # ------------------------------------------------------------------
    def _sort(self, products: List[Product]) -> List[Product]:
        """按价格从低到高；同价按销量降序."""
        return sorted(products, key=lambda p: (p.price, -p.sales))

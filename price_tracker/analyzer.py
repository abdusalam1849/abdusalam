"""分析模块：横向对比、平台汇总、价格趋势、性价比推荐."""
from __future__ import annotations

import statistics
from collections import defaultdict
from typing import Dict, List

from .models import ComparisonRow, Product


class DataAnalyzer:
    """对清洗后的商品列表做横向对比与推荐."""

    def analyze(self, products: List[Product], *, keyword: str) -> Dict:
        if not products:
            return {
                "keyword": keyword,
                "total": 0,
                "comparison": [],
                "stats": {},
                "recommendations": [],
                "platform_summary": [],
                "trend": {},
            }
        prices = [p.price for p in products]
        sales = [p.sales for p in products]
        ratings = [p.shop_rating for p in products]

        # 性价比分：归一化价格（越低越好）+ 销量 + 店铺评分
        scored = [self._with_value_score(p, prices, sales, ratings) for p in products]

        # 排序：综合分降序用于推荐；价格升序用于对比展示
        comparison = self._build_comparison(scored)
        platform_summary = self._build_platform_summary(scored)
        stats = self._build_stats(products, prices, sales, ratings)
        recommendations = self._build_recommendations(scored)
        trend = self._build_trend(scored)

        return {
            "keyword": keyword,
            "total": len(products),
            "comparison": comparison,
            "stats": stats,
            "recommendations": recommendations,
            "platform_summary": platform_summary,
            "trend": trend,
        }

    # ------------------------------------------------------------------
    @staticmethod
    def _with_value_score(p: Product, prices: List[float], sales: List[int], ratings: List[float]) -> Product:
        """计算性价比分（0-100）写入 product._value_score 临时属性."""
        p_min, p_max = min(prices), max(prices)
        s_min, s_max = min(sales), max(sales)
        # 价格越低分越高
        price_norm = 1.0 if p_max == p_min else 1 - (p.price - p_min) / (p_max - p_min)
        # 销量越高分越高（log 缩尾）
        sales_norm = 1.0 if s_max == s_min else (p.sales - s_min) / (s_max - s_min)
        rating_norm = p.shop_rating / 5.0
        # 折扣加成
        discount_norm = p.discount_rate
        # 权重：价格 0.5 + 销量 0.2 + 评分 0.2 + 折扣 0.1
        score = 100 * (
            0.50 * price_norm
            + 0.20 * sales_norm
            + 0.20 * rating_norm
            + 0.10 * discount_norm
        )
        setattr(p, "_value_score", round(score, 2))
        setattr(p, "_price_norm", round(price_norm, 4))
        return p

    # ------------------------------------------------------------------
    def _build_comparison(self, scored: List[Product]) -> List[Dict]:
        """按价格升序输出对比行."""
        rows: List[ComparisonRow] = []
        # 价格升序
        by_price = sorted(scored, key=lambda p: p.price)
        for idx, p in enumerate(by_price, 1):
            badges = []
            score = getattr(p, "_value_score", 0)
            if idx == 1:
                badges.append("最低价")
            if score >= 75:
                badges.append("高性价比")
            if p.discount_rate >= 0.2:
                badges.append("大额优惠")
            if p.shop_rating >= 4.8:
                badges.append("高分店铺")
            if p.sales >= 10000:
                badges.append("热销爆款")
            rows.append(ComparisonRow(
                rank=idx,
                title=p.title,
                platform=p.platform,
                price=p.price,
                sales=p.sales,
                shop_rating=p.shop_rating,
                url=p.url,
                value_score=score,
                badges=badges,
            ))
        return [r.__dict__ for r in rows]

    # ------------------------------------------------------------------
    def _build_platform_summary(self, scored: List[Product]) -> List[Dict]:
        grouped: Dict[str, List[Product]] = defaultdict(list)
        for p in scored:
            grouped[p.platform].append(p)
        summary = []
        for platform, items in grouped.items():
            prices = [p.price for p in items]
            summary.append({
                "platform": platform,
                "display": self._platform_display(platform),
                "count": len(items),
                "min_price": round(min(prices), 2),
                "max_price": round(max(prices), 2),
                "avg_price": round(statistics.mean(prices), 2),
                "median_price": round(statistics.median(prices), 2),
                "avg_rating": round(statistics.mean(p.shop_rating for p in items), 2),
                "total_sales": sum(p.sales for p in items),
            })
        # 平均价升序
        summary.sort(key=lambda x: x["avg_price"])
        return summary

    # ------------------------------------------------------------------
    def _build_stats(self, products: List[Product], prices, sales, ratings) -> Dict:
        return {
            "count": len(products),
            "price_min": round(min(prices), 2),
            "price_max": round(max(prices), 2),
            "price_avg": round(statistics.mean(prices), 2),
            "price_median": round(statistics.median(prices), 2),
            "price_stdev": round(statistics.pstdev(prices), 2) if len(prices) > 1 else 0.0,
            "price_range": round(max(prices) - min(prices), 2),
            "sales_total": sum(sales),
            "sales_avg": round(statistics.mean(sales), 0),
            "rating_avg": round(statistics.mean(ratings), 2),
            "discount_count": sum(1 for p in products if p.original_price),
        }

    # ------------------------------------------------------------------
    def _build_recommendations(self, scored: List[Product]) -> List[Dict]:
        """推荐：综合性价比 Top 3."""
        ranked = sorted(scored, key=lambda p: -getattr(p, "_value_score", 0))
        out = []
        for i, p in enumerate(ranked[:3], 1):
            reasons = []
            score = getattr(p, "_value_score", 0)
            min_price = min(x.price for x in scored)
            if abs(p.price - min_price) < 0.01:
                reasons.append("全场最低价")
            if p.shop_rating >= 4.8:
                reasons.append(f"店铺评分 {p.shop_rating} 接近满分")
            if p.sales >= 10000:
                reasons.append(f"销量 {p.sales} 人气高")
            if p.discount_rate >= 0.2:
                reasons.append(f"折扣率 {p.discount_rate:.0%}")
            if not reasons:
                reasons.append("综合价格 / 销量 / 评分表现均衡")
            out.append({
                "rank": i,
                "title": p.title,
                "platform": p.platform,
                "display": self._platform_display(p.platform),
                "price": p.price,
                "original_price": p.original_price,
                "sales": p.sales,
                "shop_rating": p.shop_rating,
                "value_score": score,
                "url": p.url,
                "image_url": p.image_url,
                "reasons": reasons,
            })
        return out

    # ------------------------------------------------------------------
    def _build_trend(self, scored: List[Product]) -> Dict:
        """价格趋势：按价格升序的销量曲线 + 按平台的价格分布."""
        by_price = sorted(scored, key=lambda p: p.price)
        return {
            "price_curve": [
                {"idx": i + 1, "price": p.price, "sales": p.sales,
                 "title": p.title, "platform": p.platform}
                for i, p in enumerate(by_price)
            ],
            "platform_distribution": self._build_platform_summary(scored),
        }

    # ------------------------------------------------------------------
    @staticmethod
    def _platform_display(platform: str) -> str:
        return {"jd": "京东", "taobao": "淘宝", "pdd": "拼多多"}.get(platform, platform)

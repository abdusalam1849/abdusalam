"""数据模型定义."""
from __future__ import annotations

import hashlib
import time
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class Product:
    """统一商品数据模型.

    各平台采集器输出的统一结构，供后续清洗 / 排序 / 分析 / 可视化模块消费。
    """

    platform: str                # jd | taobao | pdd
    product_id: str              # 平台商品 ID（去重主键之一）
    title: str
    price: float                 # 当前售价（元）
    original_price: Optional[float] = None   # 划线价 / 原价
    sales: int = 0               # 销量（已售 / 评价数）
    shop_name: str = ""
    shop_rating: float = 0.0     # 店铺评分 0-5
    url: str = ""
    image_url: str = ""
    fetched_at: float = field(default_factory=time.time)

    # ---------- 衍生字段 ----------
    @property
    def discount_rate(self) -> float:
        """折扣力度：原价相对当前价的优惠比例（0-1）。"""
        if not self.original_price or self.original_price <= 0:
            return 0.0
        return max(0.0, min(1.0, 1.0 - self.price / self.original_price))

    @property
    def dedup_key(self) -> str:
        """去重键：平台 + 规范化标题指纹。"""
        norm_title = "".join(c for c in self.title.lower() if c.isalnum())[:64]
        digest = hashlib.md5(norm_title.encode("utf-8")).hexdigest()[:12]
        return f"{self.platform}:{self.product_id}:{digest}"

    # ---------- 序列化 ----------
    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["discount_rate"] = round(self.discount_rate, 4)
        d["dedup_key"] = self.dedup_key
        return d


@dataclass
class ComparisonRow:
    """横向对比表的一行."""

    rank: int
    title: str
    platform: str
    price: float
    sales: int
    shop_rating: float
    url: str
    value_score: float           # 性价比分（0-100，越高越优）
    badges: List[str] = field(default_factory=list)


@dataclass
class AnalysisReport:
    """采集 + 分析后的完整报告."""

    keyword: str
    total: int
    products: List[Dict[str, Any]]
    comparison: List[Dict[str, Any]]
    stats: Dict[str, Any]
    recommendations: List[Dict[str, Any]]
    platform_summary: List[Dict[str, Any]]
    trend: Dict[str, Any]
    generated_at: float = field(default_factory=time.time)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "keyword": self.keyword,
            "total": self.total,
            "products": self.products,
            "comparison": self.comparison,
            "stats": self.stats,
            "recommendations": self.recommendations,
            "platform_summary": self.platform_summary,
            "trend": self.trend,
            "generated_at": self.generated_at,
        }

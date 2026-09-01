"""数据模型定义."""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import List, Optional


class Platform(str, Enum):
    """支持的平台."""

    JD = "jd"
    TAOBAO = "taobao"
    PDD = "pdd"
    MOCK = "mock"

    @property
    def label(self) -> str:
        return {
            Platform.JD: "京东",
            Platform.TAOBAO: "淘宝",
            Platform.PDD: "拼多多",
            Platform.MOCK: "模拟",
        }[self]


@dataclass
class Product:
    """标准化商品数据结构.

    所有平台采集器最终都映射为该结构,保证后续清洗/对比逻辑统一。
    """

    platform: str           # 平台标识 jd/taobao/pdd
    product_id: str         # 平台内唯一商品ID(用于去重)
    title: str              # 商品名称
    price: float            # 当前价格(元)
    original_price: Optional[float] = None  # 划线价/原价
    sales: int = 0          # 销量(件/月销)
    shop_name: str = ""     # 店铺名称
    shop_score: float = 0.0  # 店铺评分 0-5
    url: str = ""           # 商品链接
    image_url: str = ""     # 主图链接
    history: List[float] = field(default_factory=list)  # 历史价格序列(最近->最远)
    tags: List[str] = field(default_factory=list)       # 标签(自营/包邮/百亿补贴等)

    def to_dict(self) -> dict:
        d = asdict(self)
        return d

    @property
    def discount_ratio(self) -> float:
        """折扣率: 当前价/原价,无原价返回1.0."""
        if self.original_price and self.original_price > 0:
            return round(self.price / self.original_price, 3)
        return 1.0

    @property
    def dedup_key(self) -> str:
        """去重键: 平台+商品ID."""
        return f"{self.platform}:{self.product_id}"

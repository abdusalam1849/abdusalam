"""演示数据生成器.

在沙箱 / 离线 / 反爬拦截场景下提供结构一致、参数化、可复现的仿真数据，
便于演示与单元测试。所有商品字段结构与真实采集结果一致。
"""
from __future__ import annotations

import hashlib
import random
from typing import List

from ..models import Product


# 各平台仿真调性：价格区间、店铺评分范围、销量区间、店铺命名
_PLATFORM_PROFILE = {
    "jd": {
        "price_mul": (1.0, 1.15),
        "rating": (4.6, 4.95),
        "sales": (500, 50000),
        "shops": ["京东自营官方旗舰店", "京东数码旗舰店", "京东家电自营店", "京东国际自营"],
        "suffix": ["官方旗舰店", "自营旗舰店", "官方店", "数码专营店"],
        "logo": "JD",
    },
    "taobao": {
        "price_mul": (0.85, 1.05),
        "rating": (4.4, 4.9),
        "sales": (200, 20000),
        "shops": ["天猫官方旗舰店", "淘宝优品店", "天猫超市", "潮品数码专营店", "正品行货店"],
        "suffix": ["旗舰店", "专营店", "专卖直营", "精选好店"],
        "logo": "TB",
    },
    "pdd": {
        "price_mul": (0.6, 0.9),
        "rating": (4.0, 4.7),
        "sales": (1000, 100000),
        "shops": ["拼多多官方旗舰店", "百亿补贴官方", "品牌特卖店", "工厂直供店", "砍价直营店"],
        "suffix": ["百亿补贴", "工厂直营", "官方旗舰店", "特惠店"],
        "logo": "PDD",
    },
}


# 关键词 → 商品类型画像（在 demo 数据中提供更贴切的结果）
_KEYWORD_TEMPLATES = {
    "iphone": {"base_price": 5200, "specs": ["128G", "256G", "512G", "1T"], "colors": ["午夜黑", "星光白", "钛原色", "蓝色"]},
    "手机": {"base_price": 2500, "specs": ["8+128G", "12+256G", "16+512G"], "colors": ["黑色", "白色", "蓝色", "渐变绿"]},
    "笔记本": {"base_price": 5500, "specs": ["i5 16G 512G", "i7 32G 1T", "R7 16G 1T"], "colors": ["深空灰", "银色", "星光金"]},
    "耳机": {"base_price": 350, "specs": ["主动降噪", "降噪版", "运动版", "Pro"], "colors": ["白色", "黑色", "米色"]},
    "电视": {"base_price": 3200, "specs": ['55"', '65"', '75"', '85"'], "colors": ["黑色"]},
    "default": {"base_price": 200, "specs": ["标准版", "升级版", "Pro 版", "旗舰版"], "colors": ["黑色", "白色", "蓝色"]},
}


def _match_template(keyword: str) -> dict:
    kw = keyword.lower()
    for k, v in _KEYWORD_TEMPLATES.items():
        if k != "default" and k in kw:
            return v
    return _KEYWORD_TEMPLATES["default"]


def _seed(keyword: str, platform: str, idx: int) -> int:
    """关键词 + 平台 + 序号 → 稳定伪随机种子（同一关键词可复现）."""
    raw = f"{keyword}:{platform}:{idx}".encode("utf-8")
    return int(hashlib.md5(raw).hexdigest()[:8], 16)


class DemoScraper:
    """演示数据采集器（非真实网络请求）."""

    platform = "demo"

    def generate_for(self, keyword: str, platform: str, limit: int) -> List[Product]:
        profile = _PLATFORM_PROFILE.get(platform)
        if not profile:
            return []
        tpl = _match_template(keyword)
        rng = random.Random()
        products: List[Product] = []
        count = max(3, min(limit, 8))  # 每平台 3-8 个，凑成多样化结果
        for i in range(count):
            seed = _seed(keyword, platform, i)
            rng.seed(seed)
            base_price = tpl["base_price"] * rng.uniform(*profile["price_mul"])
            spec = rng.choice(tpl["specs"])
            color = rng.choice(tpl["colors"])
            # 价格小幅波动，保证同一关键词下结果稳定
            price = round(base_price * (1 + (seed % 17 - 8) / 100.0), 2)
            original = round(price * rng.uniform(1.05, 1.35), 2) if rng.random() > 0.3 else None
            sales = rng.randint(*profile["sales"])
            rating = round(rng.uniform(*profile["rating"]), 2)
            shop = rng.choice(profile["shops"])
            shop_full = f"{shop}（{rng.choice(profile['suffix'])}）"
            product_id = f"{platform[:2]}{seed % 10000:04d}"
            pid_num = seed % 90000 + 10000
            title = f"{keyword.upper()} {spec} {color} {' '.join([profile['logo']])} 京东/淘宝/拼多多同款"
            # 简化标题更贴近真实搜索结果
            title = self._build_title(keyword, spec, color, profile["logo"])
            url = self._build_url(platform, pid_num)
            image_url = self._build_image(platform, pid_num)
            products.append(
                Product(
                    platform=platform,
                    product_id=product_id,
                    title=title,
                    price=price,
                    original_price=original,
                    sales=sales,
                    shop_name=shop_full,
                    shop_rating=rating,
                    url=url,
                    image_url=image_url,
                )
            )
        return products

    # ------------------------------------------------------------------
    @staticmethod
    def _build_title(keyword: str, spec: str, color: str, logo: str) -> str:
        brand_prefix = ""
        low = keyword.lower()
        if "iphone" in low:
            brand_prefix = "Apple/苹果 "
        elif "手机" in low:
            brand_prefix = "新款 "
        elif "笔记本" in low:
            brand_prefix = "轻薄本 "
        elif "耳机" in low:
            brand_prefix = "无线蓝牙 "
        elif "电视" in low:
            brand_prefix = "4K 超高清 "
        return f"{brand_prefix}{keyword} {spec} {color}【{logo}正品·全国联保】"

    @staticmethod
    def _build_url(platform: str, pid: int) -> str:
        if platform == "jd":
            return f"https://item.jd.com/{pid}.html"
        if platform == "taobao":
            return f"https://item.taobao.com/item.htm?id={pid}"
        if platform == "pdd":
            return f"https://mobile.yangkeduo.com/goods.html?goods_id={pid}"
        return f"https://example.com/item/{pid}"

    @staticmethod
    def _build_image(platform: str, pid: int) -> str:
        # 用占位图，便于前端展示；不依赖外网
        return f"https://via.placeholder.com/160x160/EEE/999?text={platform.upper()}%23{pid}"

"""模拟数据生成器.

按平台分布特征生成商品数据,用于演示与算法验证。各平台的价/量分布、
店铺评分、标签特征参考公开市场观察做差异化,使横向对比有实际意义。
"""
from __future__ import annotations

import hashlib
import random
import string
from typing import List, Optional

from ..core.models import Product, Platform


# 每个平台的特征参数: 价格倍率(相对基准)、销量范围、评分范围、典型标签
_PLATFORM_PROFILE = {
    Platform.JD: {
        "price_mul": (0.95, 1.20),   # 京东偏正价
        "sales": (200, 50000),
        "score": (4.6, 4.95),
        "shops": ["京东自营官方旗舰店", "品牌官方旗舰店", "京东超市", "数码专营店"],
        "tags": ["自营", "包邮", "PLUS会员价", "白条免息"],
    },
    Platform.TAOBAO: {
        "price_mul": (0.70, 1.05),   # 淘宝跨度大、低价款多
        "sales": (50, 100000),
        "score": (4.5, 4.9),
        "shops": ["品牌官方企业店", "天猫旗舰店", "潮品数码专营店", "厂家直销店"],
        "tags": ["包邮", "七天无理由", "运费险", "聚划算"],
    },
    Platform.PDD: {
        "price_mul": (0.55, 0.95),   # 拼多多最低价
        "sales": (500, 200000),
        "score": (4.4, 4.85),
        "shops": ["百亿补贴官方", "品牌旗舰店", "源头工厂店", "9.9特卖"],
        "tags": ["百亿补贴", "包邮", "全国联保", "拼单立减"],
    },
}

# 基准关键词价格档(模拟真实品类价段)
_KEYWORD_PRICE_BANDS = {
    "手机": (1500, 9999),
    "iphone": (3500, 11999),
    "耳机": (49, 2599),
    "笔记本": (2999, 18999),
    "电视": (1099, 14999),
    "空调": (1599, 8999),
    "冰箱": (999, 7999),
    "洗衣机": (899, 5999),
    "扫地机器人": (599, 4999),
    "键盘": (69, 1299),
    "鼠标": (29, 599),
    "显示器": (699, 5999),
    "平板": (999, 9999),
    "相机": (1599, 29999),
    "默认": (29, 999),
}

_BRANDS = ["小米", "华为", "荣耀", "OPPO", "vivo", "联想", "戴尔", "罗技",
           "索尼", "三星", "苹果", "ANKER", "漫步者", "雷柏", "黑鲨", "红米"]


def _hash_id(*parts) -> str:
    """用 hash 生成稳定的商品ID,避免每次刷新都跳变。"""
    s = "|".join(str(p) for p in parts)
    return hashlib.md5(s.encode("utf-8")).hexdigest()[:12]


def _price_band(keyword: str):
    k = keyword.lower()
    for key, band in _KEYWORD_PRICE_BANDS.items():
        if key != "默认" and key in k:
            return band
    return _KEYWORD_PRICE_BANDS["默认"]


def _gen_title(keyword: str, brand: str, rng: random.Random) -> str:
    suffixes = [f"{rng.randint(1,9)}GB+{rng.randint(64,512)}GB",
                f"第{rng.randint(8,14)}代", "2026新款", "升级版", "Pro Max",
                "旗舰款", f"{rng.randint(1,16)}核", "国行正品", "港版"]
    parts = [brand, keyword, rng.choice(suffixes)]
    rng.shuffle(parts)
    return " ".join(parts)


def _gen_history(price: float, days: int, rng: random.Random) -> List[float]:
    """生成历史价格序列: 围绕当前价做小幅波动,且整体略高于当前价(模拟降价趋势)。"""
    if days <= 0:
        return []
    seq = []
    # 起点比当前价高 5%~25%
    cur = price * (1 + rng.uniform(0.05, 0.25))
    for i in range(days):
        # 缓慢下降 + 随机波动 + 偶发小促销
        noise = rng.uniform(-0.04, 0.04)
        promo = -0.10 if rng.random() < 0.08 else 0.0
        cur = max(price * 0.85, cur * (1 - 0.005 + noise) * (1 + promo))
        seq.append(round(cur, 2))
    # 最后一个点收敛到当前价
    seq[-1] = price
    return seq


def generate_products(
    keyword: str,
    platform: Platform,
    limit: int,
    seed: Optional[int] = None,
    days_history: int = 14,
) -> List[Product]:
    """为指定平台生成模拟商品列表."""
    rng = random.Random(seed)
    profile = _PLATFORM_PROFILE[platform]
    lo, hi = _price_band(keyword)
    products: List[Product] = []
    for i in range(limit):
        brand = rng.choice(_BRANDS)
        # 基准价按 log 均匀分布模拟价格长尾
        import math
        base = math.exp(rng.uniform(math.log(lo), math.log(hi)))
        mul = rng.uniform(*profile["price_mul"])
        price = round(base * mul, 2)
        original = round(price * rng.uniform(1.05, 1.6), 2) if rng.random() < 0.7 else None
        sales = rng.randint(*profile["sales"])
        score = round(rng.uniform(*profile["score"]), 2)
        shop = rng.choice(profile["shops"])
        tags_n = rng.randint(1, 3)
        tags = rng.sample(profile["tags"], tags_n)
        pid = _hash_id(platform.value, keyword, brand, i)
        title = _gen_title(keyword, brand, rng)
        history = _gen_history(price, days_history, rng)
        # 拼接可点击链接(模拟结构,真实采集器会返回真实URL)
        url = _mock_url(platform, pid)
        image = _mock_image(platform, pid)
        products.append(Product(
            platform=platform.value,
            product_id=pid,
            title=title,
            price=price,
            original_price=original,
            sales=sales,
            shop_name=shop,
            shop_score=score,
            url=url,
            image_url=image,
            history=history,
            tags=tags,
        ))
    return products


def _mock_url(platform: Platform, pid: str) -> str:
    return {
        Platform.JD: f"https://item.jd.com/{pid}.html",
        Platform.TAOBAO: f"https://item.taobao.com/item.htm?id={pid}",
        Platform.PDD: f"https://mobile.yangkeduo.com/goods.html?goods_id={pid}",
    }[platform]


def _mock_image(platform: Platform, pid: str) -> str:
    # 用 picsum 占位图,带固定 seed 保证同一商品图稳定
    return f"https://picsum.photos/seed/{platform.value}{pid}/200/200"

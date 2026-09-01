"""商品标题规格抽取.

从自由文本标题中抽取:品牌、型号/规格(存储、尺寸、代数等)、颜色。
用于跨平台同款识别: 即使标题措辞不同(如"苹果15 Pro Max"vs"iPhone 15 Pro Max 256G"),
只要型号指纹一致即可判为同款,大幅提升跨平台合并的准确度。
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List


# 品牌词典(中文别名 + 英文)。匹配时优先长名,避免"小米"误匹配"小"。
BRAND_MAP = {
    "apple": "苹果", "iphone": "苹果",
    "huawei": "华为", "honor": "荣耀",
    "xiaomi": "小米", "redmi": "红米", "mi": "小米",
    "oppo": "OPPO", "vivo": "vivo", "iqoo": "iQOO",
    "samsung": "三星", "galaxy": "三星",
    "lenovo": "联想", "thinkpad": "联想",
    "dell": "戴尔", "hp": "惠普", "asus": "华硕",
    "sony": "索尼", "logitech": "罗技", "razer": "雷蛇",
    "anker": "ANKER", "漫步者": "漫步者", "edifier": "漫步者",
    "leipai": "雷柏", "雷柏": "雷柏",
    "blackshark": "黑鲨",
    "jd": "京东",
}

# 规格正则: 存储、尺寸、代数、容量
SPEC_PATTERNS = [
    re.compile(r"(\d+)\s*(GB|TB)\b", re.I),         # 256GB / 1TB
    re.compile(r"(\d+(?:\.\d+)?)\s*(寸|英寸|inch)\b", re.I),  # 6.5寸
    re.compile(r"第\s*(\d+)\s*代"),                   # 第13代
    re.compile(r"(\d+)\s*核"),                       # 8核
    re.compile(r"(\d{4})\s*新款"),                    # 2024新款
    re.compile(r"\b(\d+)\s*GB\+\s*(\d+)\s*GB\b", re.I),  # 8GB+256GB
]

# 常见型号关键词(用于指纹)
MODEL_TOKENS = re.compile(
    r"\b(iphone\s*\d+\s*(?:pro(?:\s*max)?|mini|plus|se)?"
    r"|ipad\s*(?:air|pro|mini)?"
    r"|galaxy\s*s\d+|mate\s*\d+\s*pro"
    r"|redmi\s*note\s*\d+|mi\s*\d+"
    r"|find\s*x\d+|reno\d+"
    r"|thinkpad\s*t\d+|xps\s*\d+)\b", re.I)


@dataclass
class Spec:
    """商品规格指纹。"""
    brand: str = ""
    models: List[str] = field(default_factory=list)
    storage: str = ""        # 如 "256GB"
    size: str = ""           # 如 "6.5寸"
    generation: str = ""     # 如 "13代"
    cores: str = ""          # 如 "8核"
    year: str = ""           # 如 "2024"
    ram_storage: str = ""    # 如 "8GB+256GB"
    colors: List[str] = field(default_factory=list)

    @property
    def fingerprint(self) -> str:
        """归一化指纹: 品牌+型号+核心规格,忽略次要差异。

        同款商品在不同平台的标题措辞可能不同,但指纹应一致。
        例: "苹果 iPhone 15 Pro Max 256GB 钛灰色" 与
            "Apple iPhone15ProMax 256G 原色钛" 指纹相近。
        """
        parts = [self.brand]
        # 型号统一小写去空格
        parts.extend(m.lower().replace(" ", "") for m in self.models)
        if self.ram_storage:
            parts.append(self.ram_storage.lower().replace(" ", ""))
        elif self.storage:
            parts.append(self.storage.lower())
        if self.size:
            parts.append(self.size)
        if self.generation:
            parts.append(self.generation)
        if self.year:
            parts.append(self.year)
        return "|".join(p for p in parts if p)


# 常见颜色词
COLOR_WORDS = {"黑", "白", "灰", "蓝", "绿", "红", "粉", "金", "银", "紫",
               "钛", "原色", "深空", "午夜", "星光", "远峰"}


def extract_spec(title: str) -> Spec:
    """从标题抽取规格指纹。"""
    spec = Spec()
    t = title or ""

    # 品牌: 优先匹配长 token(避免短名误命中)
    lower = t.lower()
    # 按品牌名长度降序匹配,先匹长后匹短
    for key in sorted(BRAND_MAP, key=len, reverse=True):
        if key in lower:
            spec.brand = BRAND_MAP[key]
            break
        # 中文别名直接子串匹配
        cn = BRAND_MAP[key]
        if len(cn) >= 2 and cn in t:
            spec.brand = cn
            break

    # 型号 token
    spec.models = [m.group(0) for m in MODEL_TOKENS.finditer(t)]

    # 存储(接受 256GB / 256G / 1TB / 1T 等写法,统一归一为 GB/TB)
    m = re.search(r"(\d+)\s*(GB|TB|G|T)\b", t, re.I)
    if m:
        num = m.group(1)
        unit = m.group(2).upper()
        # 单字母 G/T 归一为 GB/TB
        unit = "GB" if unit == "G" else ("TB" if unit == "T" else unit)
        spec.storage = f"{num}{unit}"

    # 尺寸
    m = re.search(r"(\d+(?:\.\d+)?)\s*(寸|英寸|inch)", t, re.I)
    if m:
        spec.size = f"{m.group(1)}寸"

    # 代数
    m = re.search(r"第\s*(\d+)\s*代", t)
    if m:
        spec.generation = f"{m.group(1)}代"

    # 核数
    m = re.search(r"(\d+)\s*核", t)
    if m:
        spec.cores = f"{m.group(1)}核"

    # 年份
    m = re.search(r"(20\d{2})\s*新款", t)
    if m:
        spec.year = m.group(1)

    # RAM+存储
    m = re.search(r"(\d+)\s*GB\+\s*(\d+)\s*GB", t, re.I)
    if m:
        spec.ram_storage = f"{m.group(1)}GB+{m.group(2)}GB"

    # 颜色(简单词匹配)
    spec.colors = [c for c in COLOR_WORDS if c in t][:2]

    return spec


def spec_similarity(a: Spec, b: Spec) -> float:
    """两个规格指纹的相似度(0-1)。

    判定逻辑:
    - 若型号指纹完全一致 -> 1.0(同款)
    - 否则按品牌/存储/尺寸/代数等字段加权
    """
    af, bf = a.fingerprint, b.fingerprint
    if af and bf and af == bf:
        return 1.0
    score = 0.0
    if a.brand and a.brand == b.brand:
        score += 0.3
    # 型号集合 Jaccard
    if a.models or b.models:
        sa = {m.lower() for m in a.models}
        sb = {m.lower() for m in b.models}
        if sa and sb:
            score += 0.35 * len(sa & sb) / len(sa | sb)
        elif sa and sb and sa.isdisjoint(sb):
            score -= 0.2  # 型号明显不同 -> 惩罚
    if a.storage and a.storage == b.storage:
        score += 0.15
    if a.size and a.size == b.size:
        score += 0.1
    if a.generation and a.generation == b.generation:
        score += 0.1
    if a.ram_storage and a.ram_storage == b.ram_storage:
        score += 0.2
    return max(0.0, min(1.0, score))

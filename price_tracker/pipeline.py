"""采集 + 处理 + 分析 + 可视化 编排流水线."""
from __future__ import annotations

import logging
from typing import Dict, List, Optional

from .analyzer import DataAnalyzer
from .models import AnalysisReport, Product
from .processor import DataProcessor
from .scrapers import (
    BaseScraper,
    DemoScraper,
    JdScraper,
    PddScraper,
    ScraperRegistry,
    TaobaoScraper,
)
from .visualizer import Visualizer

logger = logging.getLogger(__name__)


class Pipeline:
    """一键串起 采集→清洗→分析→可视化 的主流程."""

    def __init__(
        self,
        scrapers: Optional[List[BaseScraper]] = None,
        processor: Optional[DataProcessor] = None,
        analyzer: Optional[DataAnalyzer] = None,
        visualizer: Optional[Visualizer] = None,
    ) -> None:
        self.registry = ScraperRegistry()
        for s in scrapers or self._default_scrapers():
            self.registry.register(s)
        self.processor = processor or DataProcessor()
        self.analyzer = analyzer or DataAnalyzer()
        self.visualizer = visualizer or Visualizer()

    @staticmethod
    def _default_scrapers() -> List[BaseScraper]:
        return [JdScraper(), TaobaoScraper(), PddScraper()]

    # ------------------------------------------------------------------
    def run(
        self,
        keyword: str,
        *,
        limit: int = 20,
        platforms: Optional[List[str]] = None,
        demo: bool = False,
        allow_fallback: bool = True,
    ) -> AnalysisReport:
        """运行完整流水线并返回报告.

        :param keyword: 搜索关键词
        :param limit: 每平台采集上限
        :param platforms: 指定平台；None 表示全部
        :param demo: True 时强制走 demo 生成器（沙箱 / 离线 / 演示场景推荐）
        :param allow_fallback: 真实采集失败时是否回退 demo
        """
        keyword = (keyword or "").strip()
        if not keyword:
            raise ValueError("keyword 不能为空")

        if demo:
            products = self._collect_demo(keyword, limit, platforms)
        else:
            scrapers = (
                [self.registry.get(p) for p in platforms if self.registry.get(p)]
                if platforms else list(self.registry.all())
            )
            products: List[Product] = []
            for scraper in scrapers:
                products.extend(scraper.search(keyword, limit=limit, allow_fallback=allow_fallback))

        cleaned = self.processor.process(products, keyword=keyword)
        analysis = self.analyzer.analyze(cleaned, keyword=keyword)
        report = AnalysisReport(
            keyword=keyword,
            total=len(cleaned),
            products=[p.to_dict() for p in cleaned],
            comparison=analysis["comparison"],
            stats=analysis["stats"],
            recommendations=analysis["recommendations"],
            platform_summary=analysis["platform_summary"],
            trend=analysis["trend"],
        )
        logger.info("流水线完成：%s 共 %d 条商品", keyword, report.total)
        return report

    # ------------------------------------------------------------------
    def _collect_demo(self, keyword: str, limit: int, platforms: Optional[List[str]]) -> List[Product]:
        demo = DemoScraper()
        platforms = platforms or ["jd", "taobao", "pdd"]
        out: List[Product] = []
        for p in platforms:
            out.extend(demo.generate_for(keyword, p, limit))
        return out

    # ------------------------------------------------------------------
    # 便捷导出
    # ------------------------------------------------------------------
    def report_to_dict(self, report: AnalysisReport) -> Dict:
        return report.to_dict()

    def report_to_terminal(self, report: AnalysisReport) -> str:
        return self.visualizer.render_terminal(report.to_dict())

    def report_to_chart_json(self, report: AnalysisReport) -> str:
        return self.visualizer.render_chart_json(report.to_dict())

    def report_to_html(self, report: AnalysisReport, path: Optional[str] = None) -> str:
        html = self.visualizer.render_html_report(report.to_dict())
        if path:
            with open(path, "w", encoding="utf-8") as f:
                f.write(html)
        return html

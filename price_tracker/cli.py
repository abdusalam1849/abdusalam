"""命令行入口.

示例:
    python -m price_tracker.cli search "iPhone 15" --limit 10
    python -m price_tracker.cli search "蓝牙耳机" --demo --json result.json
    python -m price_tracker.cli search "电视" --platforms jd pdd --html report.html
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from typing import List, Optional

from .pipeline import Pipeline


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="price-tracker",
        description="电商商品价格自动化采集与对比工具",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_search = sub.add_parser("search", help="按关键词采集并对比")
    p_search.add_argument("keyword", help="搜索关键词")
    p_search.add_argument("--limit", type=int, default=20, help="每平台采集上限 (默认 20)")
    p_search.add_argument("--platforms", nargs="*", default=None,
                          choices=["jd", "taobao", "pdd"],
                          help="指定平台，默认全部 (jd taobao pdd)")
    p_search.add_argument("--demo", action="store_true",
                          help="强制使用 demo 数据（不发起真实网络请求）")
    p_search.add_argument("--no-fallback", action="store_true",
                          help="真实采集失败时不回退 demo 数据")
    p_search.add_argument("--json", dest="json_path", default=None,
                          help="将完整报告 JSON 写入指定路径")
    p_search.add_argument("--html", dest="html_path", default=None,
                          help="将 HTML 报告写入指定路径")
    p_search.add_argument("--chart-json", dest="chart_json_path", default=None,
                          help="将前端图表 JSON 写入指定路径")
    p_search.add_argument("--quiet", action="store_true", help="抑制终端报告输出")
    p_search.add_argument("--verbose", "-v", action="store_true", help="开启 DEBUG 日志")

    sub.add_parser("platforms", help="列出支持的平台")

    sub.add_parser("version", help="打印版本号")

    return parser


def main(argv: Optional[List[str]] = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if getattr(args, "verbose", False) else logging.WARNING,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    if args.command == "version":
        from . import __version__
        print(__version__)
        return 0

    if args.command == "platforms":
        pipeline = Pipeline()
        print("支持的平台：")
        for s in pipeline.registry.all():
            print(f"  - {s.platform:8} {s.display_name}")
        return 0

    if args.command == "search":
        pipeline = Pipeline()
        report = pipeline.run(
            args.keyword,
            limit=args.limit,
            platforms=args.platforms,
            demo=args.demo,
            allow_fallback=not args.no_fallback,
        )
        if args.json_path:
            with open(args.json_path, "w", encoding="utf-8") as f:
                json.dump(report.to_dict(), f, ensure_ascii=False, indent=2)
        if args.html_path:
            pipeline.report_to_html(report, path=args.html_path)
        if args.chart_json_path:
            with open(args.chart_json_path, "w", encoding="utf-8") as f:
                f.write(pipeline.report_to_chart_json(report))
        if not args.quiet:
            print(pipeline.report_to_terminal(report))
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())

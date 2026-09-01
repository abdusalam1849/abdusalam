"""命令行工具入口.

用法:
  python -m price_tracker.cli "无线蓝牙耳机"
  python -m price_tracker.cli "手机" --platforms jd pdd --limit 10
  python -m price_tracker.cli --demo                      # 跑内置示例
  python -m price_tracker.cli "耳机" --mode live           # 真实抓取(需配置cookie)
  python -m price_tracker.cli "耳机" --output result.json  # 导出结果

依赖: rich(表格/彩色输出)。未安装时回退纯文本。
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from typing import List

from .pipeline import run_pipeline, build_sample_result

try:
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from rich.bar import Bar as _Bar  # noqa
    RICH = True
except Exception:  # pragma: no cover
    RICH = False
    Console = None  # type: ignore


PLATFORM_LABEL = {"jd": "京东", "taobao": "淘宝", "pdd": "拼多多"}


def _fmt_price(p: float) -> str:
    return f"¥{p:,.2f}"


def _fmt_sales(n: int) -> str:
    if n >= 10000:
        return f"{n/10000:.1f}万"
    return str(n)


def _bar(value: float, max_value: float, width: int = 20) -> str:
    if max_value <= 0:
        return ""
    filled = int((value / max_value) * width)
    return "█" * filled + "░" * (width - filled)


def print_result(result: dict) -> None:
    """打印采集对比结果。rich 可用时彩色表格,否则纯文本。"""
    if RICH:
        _print_rich(result)
    else:
        _print_plain(result)


def _print_rich(result: dict) -> None:
    console = Console()
    stats = result["stats"]
    comp = result["comparison"]

    # 概览
    anomaly_n = result.get("anomaly_count", 0)
    console.print(Panel.fit(
        f"[bold cyan]关键词:[/] {result['keyword']}   "
        f"[bold]模式:[/] {result['mode']}   "
        f"[bold]原始采集:[/] {result['raw_count']}   "
        f"[bold]去重后:[/] {result['cleaned_count']}"
        + (f"   [bold red]异常价:[/] {anomaly_n}" if anomaly_n else "") + "\n"
        f"均价 [green]{_fmt_price(stats['avg_price'])}[/]  "
        f"最低 [green]{_fmt_price(stats['min_price'])}[/]  "
        f"最高 [yellow]{_fmt_price(stats['max_price'])}[/]  "
        f"总销量 [magenta]{_fmt_sales(stats['total_sales'])}[/]  "
        f"平均评分 [blue]{stats['avg_score']}[/]  "
        f"平台数 {stats['platform_count']}",
        title="采集结果概览", border_style="cyan",
    ))

    # 平台对比
    bp = comp["by_platform"]
    if bp:
        t = Table(title="各平台横向对比", border_style="blue")
        t.add_column("平台", style="bold")
        t.add_column("样本数", justify="right")
        t.add_column("均价", justify="right")
        t.add_column("最低价", justify="right", style="green")
        t.add_column("中位价", justify="right")
        t.add_column("最高价", justify="right", style="yellow")
        t.add_column("平均销量", justify="right")
        t.add_column("平均评分", justify="right")
        for plat, b in bp.items():
            t.add_row(b["label"], str(b["count"]),
                      _fmt_price(b["avg_price"]), _fmt_price(b["min_price"]),
                      _fmt_price(b["median_price"]), _fmt_price(b["max_price"]),
                      _fmt_sales(b["avg_sales"]), str(b["avg_score"]))
        console.print(t)

    # 价格价差
    ps = comp.get("price_spread", {})
    if ps:
        console.print(Panel(
            f"最低 {_fmt_price(ps['min'])}  →  最高 {_fmt_price(ps['max'])}  "
            f"价差 [red]{_fmt_price(ps['diff'])}[/]  倍率 [red]×{ps['ratio']}[/]",
            title="价格区间", border_style="yellow"))

    # 商品明细(按价格升序)
    products = result["products"]
    max_sales = max((p["sales"] for p in products), default=1) or 1
    t = Table(title="商品明细(按价格升序)", border_style="green", show_lines=False)
    t.add_column("#", style="dim", width=3)
    t.add_column("平台", width=6)
    t.add_column("商品名称", max_width=36, no_wrap=False)
    t.add_column("价格", justify="right", style="green bold")
    t.add_column("原价", justify="right", style="dim")
    t.add_column("销量", justify="right")
    t.add_column("店评", justify="right")
    t.add_column("店铺", max_width=20)
    t.add_column("销量条", overflow="ignore")
    for i, p in enumerate(products, 1):
        op = p.get("original_price")
        t.add_row(str(i), PLATFORM_LABEL.get(p["platform"], p["platform"]),
                  p["title"][:34], _fmt_price(p["price"]),
                  _fmt_price(op) if op else "-",
                  _fmt_sales(p["sales"]),
                  str(p["shop_score"]), p["shop_name"][:18],
                  _bar(p["sales"], max_sales))
    console.print(t)

    # 性价比推荐
    recs = result["recommendations"]
    if recs:
        t = Table(title=f"★ 性价比推荐 TOP{len(recs)}", border_style="magenta")
        t.add_column("排名", style="bold magenta")
        t.add_column("平台")
        t.add_column("商品")
        t.add_column("价格", justify="right", style="green")
        t.add_column("销量", justify="right")
        t.add_column("评分", justify="right")
        t.add_column("性价比分", justify="right", style="bold yellow")
        t.add_column("标签", style="cyan")
        for r in recs:
            p = r["product"]
            t.add_row(f"#{r['rank']}", PLATFORM_LABEL.get(p["platform"], p["platform"]),
                      p["title"][:30], _fmt_price(p["price"]),
                      _fmt_sales(p["sales"]), str(p["shop_score"]),
                      f"{r['value_score']}", " ".join(r["tags"]))
        console.print(t)

    # 异常价提醒
    anomalies = result.get("anomalies", [])
    if anomalies:
        t = Table(title=f"⚠ 疑似异常价 ({len(anomalies)})", border_style="red")
        t.add_column("平台", width=6)
        t.add_column("商品")
        t.add_column("价格", justify="right", style="red bold")
        t.add_column("边界", justify="right")
        t.add_column("原因", style="yellow")
        for a in anomalies:
            p = a["product"]
            t.add_row(PLATFORM_LABEL.get(p["platform"], p["platform"]),
                      p["title"][:28], _fmt_price(p["price"]),
                      _fmt_price(a["bound"]), a["reason"][:40])
        console.print(t)

    # 价格预测
    forecasts = result.get("forecasts", [])
    if forecasts:
        t = Table(title="📈 价格趋势预测 (EMA + 线性回归)", border_style="blue")
        t.add_column("平台", width=6)
        t.add_column("商品")
        t.add_column("现价", justify="right", style="green")
        t.add_column("趋势", style="bold")
        t.add_column("下期EMA", justify="right")
        t.add_column("斜率%", justify="right")
        t.add_column("预测(3期)", justify="right", style="dim")
        t.add_column("建议", style="cyan")
        for f in forecasts[:10]:
            trend_color = {"下行": "green", "上行": "red", "平稳": "yellow"}.get(f["trend"], "white")
            t.add_row(PLATFORM_LABEL.get(f["platform"], f["platform"]),
                      f["title"][:24], _fmt_price(f["price"]),
                      f"[{trend_color}]{f['trend']}[/]",
                      _fmt_price(f["next_ema"]),
                      f"{f['slope_pct']:+.2f}%",
                      " ".join(_fmt_price(x) for x in f["forecast"]),
                      f["suggestion"])
        console.print(t)

    # 平台综合性价比排名
    pr = comp.get("platform_ranking", [])
    if pr:
        console.print(Panel(
            "  ".join(f"{i+1}. [bold]{r['label']}[/] "
                     f"(分 {r['value_score']} / 均价 {_fmt_price(r['avg_price'])})"
                     for i, r in enumerate(pr)),
            title="平台综合性价比排名", border_style="cyan"))


def _print_plain(result: dict) -> None:
    stats = result["stats"]
    comp = result["comparison"]
    print(f"\n=== 采集结果概览 ===")
    print(f"关键词: {result['keyword']}  模式: {result['mode']}")
    print(f"原始 {result['raw_count']} → 去重后 {result['cleaned_count']}")
    print(f"均价 ¥{stats['avg_price']}  最低 ¥{stats['min_price']}  最高 ¥{stats['max_price']}")
    print(f"总销量 {stats['total_sales']}  平均评分 {stats['avg_score']}  平台 {stats['platform_count']}\n")

    print("=== 各平台对比 ===")
    print(f"{'平台':<6}{'样本':>5}{'均价':>12}{'最低':>12}{'最高':>12}{'均销':>10}{'均分':>6}")
    for plat, b in comp["by_platform"].items():
        print(f"{b['label']:<6}{b['count']:>5}{_fmt_price(b['avg_price']):>12}"
              f"{_fmt_price(b['min_price']):>12}{_fmt_price(b['max_price']):>12}"
              f"{_fmt_sales(b['avg_sales']):>10}{b['avg_score']:>6}")

    ps = comp.get("price_spread", {})
    print(f"\n价格区间: {_fmt_price(ps.get('min',0))} ~ {_fmt_price(ps.get('max',0))} "
          f"价差 {_fmt_price(ps.get('diff',0))} 倍率 ×{ps.get('ratio',0)}\n")

    print("=== 商品明细(按价格升序) ===")
    for i, p in enumerate(result["products"], 1):
        print(f"{i:>2}. [{PLATFORM_LABEL.get(p['platform'], p['platform'])}] "
              f"{_fmt_price(p['price'])}  {p['title'][:30]}  "
              f"销{_fmt_sales(p['sales'])}  评{p['shop_score']}  {p['shop_name']}")

    print(f"\n=== 性价比推荐 TOP{len(result['recommendations'])} ===")
    for r in result["recommendations"]:
        p = r["product"]
        print(f"#{r['rank']} [{PLATFORM_LABEL.get(p['platform'], p['platform'])}] "
              f"{_fmt_price(p['price'])}  {p['title'][:24]}  分 {r['value_score']}  {','.join(r['tags'])}")

    anomalies = result.get("anomalies", [])
    if anomalies:
        print(f"\n=== 疑似异常价 ({len(anomalies)}) ===")
        for a in anomalies:
            p = a["product"]
            print(f"[{PLATFORM_LABEL.get(p['platform'], p['platform'])}] "
                  f"{_fmt_price(p['price'])}  {p['title'][:24]}  {a['reason'][:40]}")

    forecasts = result.get("forecasts", [])
    if forecasts:
        print(f"\n=== 价格趋势预测 ({len(forecasts[:10])}) ===")
        for f in forecasts[:10]:
            print(f"[{PLATFORM_LABEL.get(f['platform'], f['platform'])}] "
                  f"{_fmt_price(f['price'])}  {f['trend']}  下期EMA {_fmt_price(f['next_ema'])}  "
                  f"斜率{f['slope_pct']:+.2f}%  -> {f['suggestion']}")


def export_csv(result: dict, path: str) -> None:
    """导出商品明细为 CSV(UTF-8 BOM,Excel 友好)。"""
    import csv
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["排名", "平台", "商品名称", "价格", "原价", "销量",
                    "店铺评分", "店铺", "规格指纹", "链接", "标签"])
        for i, p in enumerate(result["products"], 1):
            w.writerow([
                i, PLATFORM_LABEL.get(p["platform"], p["platform"]),
                p["title"], p["price"], p.get("original_price") or "",
                p["sales"], p["shop_score"], p["shop_name"],
                p.get("spec_fingerprint", ""), p["url"],
                " ".join(p.get("tags", [])),
            ])


def main(argv: List[str] = None) -> int:
    parser = argparse.ArgumentParser(
        prog="price_tracker",
        description="电商商品价格自动化采集与对比工具",
    )
    parser.add_argument("keyword", nargs="?", help="搜索关键词")
    parser.add_argument("--platforms", nargs="+", default=["jd", "taobao", "pdd"],
                        choices=["jd", "taobao", "pdd", "pdd_openapi"], help="采集平台")
    parser.add_argument("--limit", type=int, default=15, help="每个平台采集数量")
    parser.add_argument("--mode", choices=["mock", "live"], default="mock",
                        help="mock=模拟数据(默认) live=真实抓取(需配置cookie)")
    parser.add_argument("--seed", type=int, default=None, help="mock随机种子(可复现)")
    parser.add_argument("--history-days", type=int, default=14, help="历史价格天数")
    parser.add_argument("--top-n", type=int, default=5, help="性价比推荐数量")
    parser.add_argument("--filter-outliers", action="store_true",
                        help="直接剔除异常价商品(默认仅标注)")
    parser.add_argument("--no-anomaly", action="store_true",
                        help="跳过异常价检测")
    parser.add_argument("--verbose", action="store_true",
                        help="显示采集重试/限速等详细日志")
    parser.add_argument("--output", "-o", help="结果导出JSON文件路径")
    parser.add_argument("--csv", help="商品明细导出CSV文件路径")
    parser.add_argument("--demo", action="store_true", help="运行内置示例数据")
    args = parser.parse_args(argv)

    if args.verbose:
        logging.getLogger("price_tracker").setLevel(logging.INFO)

    if args.demo:
        result = build_sample_result()
    else:
        if not args.keyword:
            parser.error("请提供搜索关键词,或使用 --demo 运行示例")
        result = run_pipeline(
            keyword=args.keyword,
            platforms=args.platforms,
            limit_per_platform=args.limit,
            mode=args.mode,
            seed=args.seed,
            history_days=args.history_days,
            detect_anomalies=not args.no_anomaly,
            filter_anomalies=args.filter_outliers,
            top_n=args.top_n,
        )

    print_result(result)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"\n结果已导出(JSON): {args.output}")
    if args.csv:
        export_csv(result, args.csv)
        print(f"商品明细已导出(CSV): {args.csv}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

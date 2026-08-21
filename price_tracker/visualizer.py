"""可视化模块：CLI 表格 + 网页图表 JSON 数据 + 独立 HTML 报告."""
from __future__ import annotations

import json
from typing import Dict, List


class Visualizer:
    """生成终端可读表格、HTML 报告与前端图表所需的纯数据结构。"""

    def render_terminal(self, report: Dict) -> str:
        """生成可在终端直接显示的纯文本报告（不依赖 rich）。"""
        out: List[str] = []
        kw = report.get("keyword", "")
        total = report.get("total", 0)
        out.append("=" * 78)
        out.append(f"  电商价格采集对比报告｜关键词：{kw}｜共 {total} 条")
        out.append("=" * 78)

        stats = report.get("stats", {})
        if stats:
            out.append(
                f"  价格区间 ¥{stats.get('price_min', 0):.2f} ~ ¥{stats.get('price_max', 0):.2f}"
                f"  均价 ¥{stats.get('price_avg', 0):.2f}  中位 ¥{stats.get('price_median', 0):.2f}"
                f"  标准差 ¥{stats.get('price_stdev', 0):.2f}"
            )
            out.append(
                f"  销量合计 {stats.get('sales_total', 0)}  均销 {stats.get('sales_avg', 0)}"
                f"  店铺评分均 {stats.get('rating_avg', 0)}  含折扣商品 {stats.get('discount_count', 0)}"
            )

        platform_summary = report.get("platform_summary", [])
        if platform_summary:
            out.append("")
            out.append("  [平台对比]")
            out.append(f"  {'平台':<8}{'数量':<6}{'最低':<10}{'最高':<10}{'均价':<10}{'中位':<10}{'评分':<8}{'总销量':<10}")
            for s in platform_summary:
                out.append(
                    f"  {s['display']:<8}{s['count']:<6}¥{s['min_price']:<8.2f}¥{s['max_price']:<8.2f}"
                    f"¥{s['avg_price']:<8.2f}¥{s['median_price']:<8.2f}{s['avg_rating']:<8}{s['total_sales']:<10}"
                )

        comparison = report.get("comparison", [])
        if comparison:
            out.append("")
            out.append("  [商品横向对比 — 按价格升序]")
            header = f"  {'#':<3}{'平台':<8}{'价格':<10}{'销量':<10}{'评分':<6}{'性价比':<8}{'标签':<24}标题"
            out.append(header)
            out.append("  " + "-" * 76)
            for row in comparison:
                badges = " ".join(row.get("badges", [])) or "-"
                title = row["title"][:30]
                out.append(
                    f"  {row['rank']:<3}{row['platform']:<8}¥{row['price']:<8.2f}"
                    f"{row['sales']:<10}{row['shop_rating']:<6}{row['value_score']:<8}{badges:<24}{title}"
                )

        recommendations = report.get("recommendations", [])
        if recommendations:
            out.append("")
            out.append("  [性价比 Top 推荐]")
            for rec in recommendations:
                out.append(
                    f"  #{rec['rank']} [{rec['display']}] {rec['title'][:40]} "
                    f"¥{rec['price']}  性价比 {rec['value_score']}  {', '.join(rec['reasons'])}"
                )
                if rec.get("url"):
                    out.append(f"     链接：{rec['url']}")

        out.append("=" * 78)
        return "\n".join(out)

    def render_chart_json(self, report: Dict) -> str:
        """生成前端 Chart.js 可直接消费的 JSON 字符串。"""
        chart_data = self._build_chart_payload(report)
        return json.dumps(chart_data, ensure_ascii=False)

    def _build_chart_payload(self, report: Dict) -> Dict:
        # 1) 价格分布柱状图（按价格升序）
        comparison = report.get("comparison", [])
        labels = [f"#{r['rank']}" for r in comparison]
        prices = [r["price"] for r in comparison]
        sales = [r["sales"] for r in comparison]
        scores = [r["value_score"] for r in comparison]
        platform_colors = {"jd": "#e1251b", "taobao": "#ff6600", "pdd": "#e02e24"}
        bg = [platform_colors.get(r["platform"], "#888") for r in comparison]

        # 2) 平台价格箱型近似（min/avg/max）
        platform_summary = report.get("platform_summary", [])
        platform_labels = [s["display"] for s in platform_summary]
        platform_min = [s["min_price"] for s in platform_summary]
        platform_avg = [s["avg_price"] for s in platform_summary]
        platform_max = [s["max_price"] for s in platform_summary]

        # 3) 销量散点
        price_sales_scatter = [
            {"x": r["price"], "y": r["sales"], "platform": r["platform"]}
            for r in comparison
        ]

        return {
            "price_distribution": {
                "labels": labels,
                "datasets": [{
                    "label": "价格 (¥)",
                    "data": prices,
                    "backgroundColor": bg,
                    "borderColor": bg,
                }],
            },
            "sales_trend": {
                "labels": labels,
                "datasets": [{
                    "label": "销量",
                    "data": sales,
                    "borderColor": "#1f77b4",
                    "backgroundColor": "rgba(31,119,180,0.15)",
                    "fill": True,
                }],
            },
            "value_score_bar": {
                "labels": labels,
                "datasets": [{
                    "label": "性价比分",
                    "data": scores,
                    "backgroundColor": bg,
                }],
            },
            "platform_compare": {
                "labels": platform_labels,
                "datasets": [
                    {"label": "最低价", "data": platform_min, "backgroundColor": "#2ecc71"},
                    {"label": "均价", "data": platform_avg, "backgroundColor": "#3498db"},
                    {"label": "最高价", "data": platform_max, "backgroundColor": "#e74c3c"},
                ],
            },
            "price_sales_scatter": {
                "datasets": [{
                    "label": "价格 vs 销量",
                    "data": price_sales_scatter,
                    "backgroundColor": bg,
                }],
            },
        }

    def render_html_report(self, report: Dict, chart_data: Dict = None) -> str:
        """生成独立的静态 HTML 报告（含内嵌 Chart.js）。"""
        if chart_data is None:
            chart_data = self._build_chart_payload(report)
        import json as _json
        # 用 __TOKEN__ 占位符 + str.replace，避免与 CSS/JS 中的花括号冲突
        html = HTML_REPORT_TEMPLATE
        replacements = {
            "__KEYWORD__": report.get("keyword", ""),
            "__TOTAL__": str(report.get("total", 0)),
            "__STATS_JSON__": _json.dumps(report.get("stats", {}), ensure_ascii=False),
            "__PLATFORM_JSON__": _json.dumps(report.get("platform_summary", []), ensure_ascii=False),
            "__COMPARISON_JSON__": _json.dumps(report.get("comparison", []), ensure_ascii=False),
            "__RECOMMENDATIONS_JSON__": _json.dumps(report.get("recommendations", []), ensure_ascii=False),
            "__CHART_JSON__": _json.dumps(chart_data, ensure_ascii=False),
        }
        for token, value in replacements.items():
            html = html.replace(token, value)
        return html


# 模板使用 __TOKEN__ 占位符（render_html_report 用 str.replace 替换），
# 因此模板里的 CSS/JS 花括号无需任何转义。
HTML_REPORT_TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>电商价格对比报告｜__KEYWORD__</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
body{font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;max-width:1100px;margin:0 auto;padding:20px;color:#222;background:#fafafa}
h1{font-size:22px;border-bottom:3px solid #e1251b;padding-bottom:8px}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
.card{background:#fff;border-radius:8px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
canvas{max-height:280px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{border-bottom:1px solid #eee;padding:6px 8px;text-align:left}
th{background:#f5f5f5}
.badge{display:inline-block;padding:2px 8px;border-radius:10px;background:#e1251b;color:#fff;font-size:11px;margin-right:4px}
.rec{background:linear-gradient(135deg,#fff9e6,#fff);border:1px solid #ffd966;padding:12px;border-radius:8px;margin-bottom:10px}
</style></head><body>
<h1>电商价格采集对比报告｜关键词：__KEYWORD__｜共 __TOTAL__ 条</h1>
<div class="grid">
  <div class="card"><h3>价格分布（按价格升序）</h3><canvas id="c1"></canvas></div>
  <div class="card"><h3>性价比评分</h3><canvas id="c3"></canvas></div>
  <div class="card"><h3>各平台价格对比</h3><canvas id="c4"></canvas></div>
  <div class="card"><h3>价格 vs 销量</h3><canvas id="c5"></canvas></div>
</div>
<div class="card" style="margin-top:16px"><h3>商品横向对比</h3>
<table><thead><tr><th>#</th><th>平台</th><th>价格</th><th>销量</th><th>评分</th><th>性价比</th><th>标签</th><th>标题</th></tr></thead>
<tbody id="tb"></tbody></table></div>
<div class="card" style="margin-top:16px"><h3>性价比 Top 推荐</h3><div id="recs"></div></div>
<script>
var chart=__CHART_JSON__;
var stats=__STATS_JSON__;
var platform=__PLATFORM_JSON__;
var comparison=__COMPARISON_JSON__;
var recs=__RECOMMENDATIONS_JSON__;
new Chart(c1,{type:'bar',data:chart.price_distribution,options:{plugins:{legend:{display:false},title:{display:true,text:'价格分布'}},scales:{y:{beginAtZero:true,ticks:{callback:function(v){return '¥'+v;}}}}}});
new Chart(c3,{type:'bar',data:chart.value_score_bar,options:{plugins:{legend:{display:false},title:{display:true,text:'性价比评分'}},scales:{y:{beginAtZero:true,max:100}}}});
new Chart(c4,{type:'bar',data:chart.platform_compare,options:{plugins:{title:{display:true,text:'各平台价格对比'}},scales:{y:{ticks:{callback:function(v){return '¥'+v;}}}}}});
new Chart(c5,{type:'scatter',data:{datasets:[{label:'价格 vs 销量',data:chart.price_sales_scatter.datasets[0].data.map(function(p){return {x:p.x,y:p.y};}),backgroundColor:'#9b59b6'}]},options:{plugins:{title:{display:true,text:'价格 vs 销量'}},scales:{x:{title:{display:true,text:'价格 (¥)'}},y:{title:{display:true,text:'销量'}}}}}});
var tb=document.getElementById('tb');
comparison.forEach(function(r){var tr=document.createElement('tr');
tr.innerHTML='<td>'+r.rank+'</td><td>'+r.platform+'</td><td>¥'+r.price.toFixed(2)+'</td><td>'+r.sales+'</td><td>'+r.shop_rating+'</td><td>'+r.value_score+'</td><td>'+(r.badges||[]).map(function(b){return '<span class="badge">'+b+'</span>';}).join('')+'</td><td title="'+r.title+'">'+r.title.slice(0,30)+'</td>';
tb.appendChild(tr);});
var recsEl=document.getElementById('recs');
recs.forEach(function(r){var div=document.createElement('div');div.className='rec';
div.innerHTML='<div><b>#'+r.rank+'</b> ['+r.display+'] '+r.title+' <span style="color:#e1251b;font-weight:bold">¥'+r.price+'</span> 性价比 '+r.value_score+'</div><div style="font-size:13px;color:#666">'+r.reasons.join('｜')+'</div><div style="font-size:12px;margin-top:4px"><a href="'+r.url+'" target="_blank">'+r.url+'</a></div>';
recsEl.appendChild(div);});
</script></body></html>
"""

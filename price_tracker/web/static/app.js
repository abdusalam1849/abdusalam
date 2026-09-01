// 价格采集对比工具 - 前端逻辑
// 依赖: ECharts (CDN 加载)

const PLATFORM_LABEL = { jd: "京东", taobao: "淘宝", pdd: "拼多多" };
const PLATFORM_COLOR = { jd: "#e1251b", taobao: "#ff6700", pdd: "#e02020" };

const state = { result: null, loading: false };

const $ = (sel) => document.querySelector(sel);

function platformTag(p) {
  const v = PLATFORM_LABEL[p] || p;
  return `<span class="platform-tag ${p}">${v}</span>`;
}

function fmtPrice(n) {
  if (n == null) return "-";
  return "¥" + Number(n).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtSales(n) {
  if (n == null) return "-";
  if (n >= 10000) return (n / 10000).toFixed(1) + "万";
  return String(n);
}

// ===== 概览卡片 =====
function renderStats(stats) {
  const cards = [
    { label: "商品总数", value: stats.count, small: false },
    { label: "采集平台", value: stats.platform_count, small: false },
    { label: "最低价", value: fmtPrice(stats.min_price), small: false },
    { label: "最高价", value: fmtPrice(stats.max_price), small: false },
    { label: "均价", value: fmtPrice(stats.avg_price), small: false },
    { label: "总销量", value: fmtSales(stats.total_sales), small: false },
    { label: "平均店铺评分", value: stats.avg_score?.toFixed(2) || "-", small: false },
  ];
  $("#cards").innerHTML = cards.map(c =>
    `<div class="card"><div class="label">${c.label}</div><div class="value ${c.small ? "small" : ""}">${c.value}</div></div>`
  ).join("");
}

// ===== 价格区间 =====
function renderPriceSpread(spread) {
  if (!spread) { $("#spread").innerHTML = ""; return; }
  $("#spread").innerHTML = `
    <div style="display:flex;gap:30px;align-items:center;flex-wrap:wrap">
      <div>最低 <b class="price">${fmtPrice(spread.min)}</b></div>
      <div>最高 <b style="color:var(--warn)">${fmtPrice(spread.max)}</b></div>
      <div>价差 <b style="color:var(--bad)">${fmtPrice(spread.diff)}</b></div>
      <div>倍率 <b style="color:var(--bad)">×${spread.ratio}</b></div>
      <div style="flex:1;min-width:200px;height:10px;background:var(--panel-2);border-radius:5px;position:relative;overflow:hidden">
        <div style="position:absolute;left:0;top:0;height:100%;width:100%;background:linear-gradient(90deg,var(--good),var(--warn),var(--bad))"></div>
      </div>
    </div>`;
}

// ===== 平台对比表 + 柱状图 =====
function renderPlatformComparison(comp) {
  const bp = comp.by_platform || {};
  const rows = Object.entries(bp).map(([k, b]) => `
    <tr>
      <td>${platformTag(k)}</td>
      <td class="num">${b.count}</td>
      <td class="num price">${fmtPrice(b.avg_price)}</td>
      <td class="num">${fmtPrice(b.min_price)}</td>
      <td class="num">${fmtPrice(b.median_price)}</td>
      <td class="num">${fmtPrice(b.max_price)}</td>
      <td class="num">${fmtSales(b.avg_sales)}</td>
      <td class="num">${b.avg_score?.toFixed(2)}</td>
    </tr>`).join("");
  $("#platformTable").innerHTML = rows
    ? `<table><thead><tr><th>平台</th><th class="num">样本</th><th class="num">均价</th><th class="num">最低</th><th class="num">中位</th><th class="num">最高</th><th class="num">均销</th><th class="num">均分</th></tr></thead><tbody>${rows}</tbody></table>`
    : `<div class="empty">无数据</div>`;

  // 平台综合性价比排名
  const ranking = comp.platform_ranking || [];
  $("#ranking").innerHTML = ranking.length ? ranking.map((r, i) => {
    const w = (r.value_score / (ranking[0].value_score || 1)) * 100;
    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <b style="width:24px">${i + 1}</b>
      <span>${platformTag(r.platform)}</span>
      <span style="color:var(--muted);font-size:12px">均价 ${fmtPrice(r.avg_price)}</span>
      <div style="flex:1;height:10px;background:var(--panel-2);border-radius:5px;overflow:hidden">
        <div style="height:100%;width:${w}%;background:var(--accent)"></div>
      </div>
      <b style="color:var(--warn);width:48px;text-align:right">${r.value_score}</b>
    </div>`;
  }).join("") : `<div class="empty">无数据</div>`;

  // 平台均价柱状图
  const chart = echarts.init($("#platformChart"));
  const labels = Object.values(bp).map(b => b.label);
  const avgs = Object.values(bp).map(b => b.avg_price);
  const mins = Object.values(bp).map(b => b.min_price);
  const maxs = Object.values(bp).map(b => b.max_price);
  const colors = Object.keys(bp).map(k => PLATFORM_COLOR[k]);
  chart.setOption({
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { data: ["均价", "最低价", "最高价"], textStyle: { color: "#8b98a5" } },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: { type: "category", data: labels, axisLabel: { color: "#8b98a5" } },
    yAxis: { type: "value", axisLabel: { color: "#8b98a5", formatter: v => "¥" + v } },
    series: [
      { name: "均价", type: "bar", data: avgs, itemStyle: { color: "#4fd1c5" }, barWidth: "20%" },
      { name: "最低价", type: "bar", data: mins, itemStyle: { color: "#4ade80" }, barWidth: "20%" },
      { name: "最高价", type: "bar", data: maxs, itemStyle: { color: "#fbbf24" }, barWidth: "20%" },
    ]
  });
  window.addEventListener("resize", () => chart.resize());
}

// ===== 商品明细表 =====
function renderProducts(products) {
  if (!products || !products.length) {
    $("#productTable").innerHTML = `<div class="empty"><div class="icon">📭</div>暂无商品数据</div>`;
    return;
  }
  const maxSales = Math.max(...products.map(p => p.sales), 1);
  const rows = products.map((p, i) => {
    const cpp = p.cross_platform_prices || [];
    const cppCell = cpp.length > 1
      ? cpp.map(c => `<span class="platform-tag ${c.platform}">${PLATFORM_LABEL[c.platform] || c.platform}</span> ${fmtPrice(c.price)}`).join("<br>")
      : `<span style="color:var(--muted)">单平台</span>`;
    return `
    <tr>
      <td class="num">${i + 1}</td>
      <td>${platformTag(p.platform)}</td>
      <td><div style="max-width:260px">${escapeHtml(p.title)}</div>
          <div style="color:var(--muted);font-size:11px;margin-top:2px">${escapeHtml(p.shop_name)} ${p.tags && p.tags.length ? "· " + p.tags.map(t => `<span class="tag">${t}</span>`).join("") : ""}</div>
          ${p.spec_fingerprint ? `<div style="color:var(--muted);font-size:10px;margin-top:1px">指纹: ${escapeHtml(p.spec_fingerprint)}</div>` : ""}
      </td>
      <td class="num"><span class="price">${fmtPrice(p.price)}</span>${p.original_price ? `<span class="price old">${fmtPrice(p.original_price)}</span>` : ""}</td>
      <td class="num">${fmtSales(p.sales)}</td>
      <td class="num">${p.shop_score?.toFixed(2)}</td>
      <td style="font-size:11px">${cppCell}</td>
      <td>${p.url ? `<a href="${p.url}" target="_blank" rel="noopener">查看↗</a>` : "-"}</td>
    </tr>`;
  }).join("");
  $("#productTable").innerHTML = `
    <table>
      <thead><tr><th class="num">#</th><th>平台</th><th>商品 / 店铺 / 指纹</th><th class="num">价格</th><th class="num">销量</th><th class="num">店评</th><th>跨平台同款</th><th>链接</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ===== 价格趋势折线图 =====
function renderTrend(trend) {
  const chart = echarts.init($("#trendChart"));
  const labels = trend.labels || [];
  // 各商品价格趋势(取前8条避免过密)
  const items = (trend.series || []).slice(0, 8);
  const series = items.map(s => ({
    name: `[${PLATFORM_LABEL[s.platform] || s.platform}] ${s.title}`,
    type: "line",
    smooth: true,
    symbol: "circle",
    symbolSize: 5,
    data: s.data,
    connectNulls: true,
    lineStyle: { width: 2 },
  }));
  // 平台均价趋势
  const platSeries = (trend.platform_avg_trend || []).map(s => ({
    name: `${s.platform_label}均价`,
    type: "line",
    smooth: true,
    symbol: "diamond",
    symbolSize: 8,
    data: s.data,
    lineStyle: { width: 3, type: "dashed" },
    itemStyle: { color: PLATFORM_COLOR[s.platform] },
  }));
  chart.setOption({
    tooltip: { trigger: "axis" },
    legend: { type: "scroll", textStyle: { color: "#8b98a5", fontSize: 11 }, bottom: 0 },
    grid: { left: 50, right: 20, top: 20, bottom: 60 },
    xAxis: { type: "category", data: labels, axisLabel: { color: "#8b98a5" } },
    yAxis: { type: "value", scale: true, axisLabel: { color: "#8b98a5", formatter: v => "¥" + v } },
    series: [...series, ...platSeries],
  });
  window.addEventListener("resize", () => chart.resize());
}

// ===== 散点图: 价格×销量 =====
function renderScatter(products) {
  const chart = echarts.init($("#scatterChart"));
  const grouped = {};
  (products || []).forEach(p => {
    (grouped[p.platform] = grouped[p.platform] || []).push([p.price, p.sales, p.title]);
  });
  const series = Object.entries(grouped).map(([k, arr]) => ({
    name: PLATFORM_LABEL[k] || k,
    type: "scatter",
    symbolSize: d => Math.max(8, Math.min(40, Math.sqrt(d[1]) / 5)),
    data: arr,
    itemStyle: { color: PLATFORM_COLOR[k], opacity: 0.7 },
  }));
  chart.setOption({
    tooltip: {
      trigger: "item",
      formatter: p => `${p.data[2]}<br/>价格 ${fmtPrice(p.data[0])}<br/>销量 ${fmtSales(p.data[1])}`,
    },
    legend: { textStyle: { color: "#8b98a5" } },
    grid: { left: 60, right: 20, top: 30, bottom: 50 },
    xAxis: { type: "value", name: "价格(元)", nameTextStyle: { color: "#8b98a5" }, axisLabel: { color: "#8b98a5" } },
    yAxis: { type: "value", name: "销量", nameTextStyle: { color: "#8b98a5" }, axisLabel: { color: "#8b98a5" } },
    series,
  });
  window.addEventListener("resize", () => chart.resize());
}

// ===== 性价比推荐 =====
function renderRecommendations(recs) {
  if (!recs || !recs.length) {
    $("#recommend").innerHTML = `<div class="empty">无推荐数据</div>`;
    return;
  }
  $("#recommend").innerHTML = recs.map(r => {
    const p = r.product;
    const rankCls = r.rank === 1 ? "rank-1" : r.rank === 2 ? "rank-2" : r.rank === 3 ? "rank-3" : "";
    const tags = r.tags.map(t => {
      const cls = ["强烈推荐", "推荐"].includes(t) ? "rec" : (["热销"].includes(t) ? "hot" : "");
      return `<span class="tag ${cls}">${t}</span>`;
    }).join("");
    const w = r.value_score;
    return `<div class="recommend-item">
      <div class="rank ${rankCls}">#${r.rank}</div>
      <div class="info">
        <div class="t">${platformTag(p.platform)} ${escapeHtml(p.title)}</div>
        <div class="m">${escapeHtml(p.shop_name)} · 销${fmtSales(p.sales)} · 评${p.shop_score?.toFixed(2)}</div>
        <div style="margin-top:4px">${tags}</div>
      </div>
      <div class="p">
        <div class="pr">${fmtPrice(p.price)}</div>
        <div class="sc">性价比 ${r.value_score}<span class="score-bar" style="width:${w * 0.6}px"></span></div>
      </div>
    </div>`;
  }).join("");
}

// ===== 异常价提醒 =====
function renderAnomalies(anomalies) {
  const box = $("#anomalies");
  if (!box) return;
  if (!anomalies || !anomalies.length) {
    box.innerHTML = `<div class="empty">未检测到异常价格</div>`;
    return;
  }
  box.innerHTML = `<table>
    <thead><tr><th>平台</th><th>商品</th><th class="num">价格</th><th class="num">边界</th><th>类型</th><th>原因</th></tr></thead>
    <tbody>${anomalies.map(a => {
      const p = a.product;
      const sideLabel = a.side === "low" ? "低价异常" : "高价异常";
      const sideCls = a.side === "low" ? "tag hot" : "tag";
      return `<tr>
        <td>${platformTag(p.platform)}</td>
        <td>${escapeHtml(p.title).slice(0, 28)}</td>
        <td class="num price">${fmtPrice(p.price)}</td>
        <td class="num">${fmtPrice(a.bound)}</td>
        <td><span class="${sideCls}">${sideLabel}</span></td>
        <td style="color:var(--muted);font-size:12px">${escapeHtml(a.reason)}</td>
      </tr>`;
    }).join("")}</tbody></table>`;
}

// ===== 价格预测 =====
function renderForecasts(forecasts) {
  const box = $("#forecasts");
  if (!box) return;
  if (!forecasts || !forecasts.length) {
    box.innerHTML = `<div class="empty">无足够历史数据做预测</div>`;
    return;
  }
  const trendColor = { "下行": "var(--good)", "上行": "var(--bad)", "平稳": "var(--warn)" };
  box.innerHTML = `<table>
    <thead><tr><th>平台</th><th>商品</th><th class="num">现价</th><th>趋势</th>
    <th class="num">下期EMA</th><th class="num">斜率</th><th class="num">预测3期</th><th>建议</th></tr></thead>
    <tbody>${forecasts.slice(0, 12).map(f => `<tr>
      <td>${platformTag(f.platform)}</td>
      <td>${escapeHtml(f.title)}</td>
      <td class="num price">${fmtPrice(f.price)}</td>
      <td><b style="color:${trendColor[f.trend] || "var(--text)"}">${f.trend}</b></td>
      <td class="num">${fmtPrice(f.next_ema)}</td>
      <td class="num">${f.slope_pct >= 0 ? "+" : ""}${f.slope_pct.toFixed(2)}%</td>
      <td class="num" style="color:var(--muted)">${f.forecast.map(x => fmtPrice(x)).join(" ")}</td>
      <td style="color:var(--accent);font-size:12px">${f.suggestion}</td>
    </tr>`).join("")}</tbody></table>`;
}

// ===== 主渲染 =====
function renderResult(result) {
  state.result = result;
  $("#keywordLabel").textContent = result.keyword;
  $("#modeLabel").textContent = result.mode === "live" ? "真实抓取" : "模拟数据";
  $("#rawCount").textContent = result.raw_count;
  $("#cleanedCount").textContent = result.cleaned_count;
  const an = result.anomaly_count || 0;
  const anEl = $("#anomalyCount");
  if (anEl) anEl.textContent = an;
  if (anEl && anEl.parentElement) anEl.parentElement.style.display = an ? "block" : "none";
  renderStats(result.stats);
  renderPriceSpread(result.comparison.price_spread);
  renderPlatformComparison(result.comparison);
  renderProducts(result.products);
  renderTrend(result.trend);
  renderScatter(result.products);
  renderRecommendations(result.recommendations);
  renderAnomalies(result.anomalies);
  renderForecasts(result.forecasts);
  $("#results").style.display = "block";
}

function renderError(msg) {
  $("#errorBox").innerHTML = `<div class="error">⚠ ${escapeHtml(msg)}</div>`;
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ===== 事件 =====
async function loadSample() {
  try {
    const r = await fetch("/api/sample");
    const data = await r.json();
    if (data.error) { renderError(data.error); return; }
    renderResult(data);
    $("#bannerText").innerHTML = `已加载 <b>示例数据</b>(关键词:<b>${data.keyword}</b>)。在上方输入框输入关键词后点击「现场采集」即可重新运行采集脚本。`;
  } catch (e) {
    renderError("加载示例数据失败: " + e.message);
  }
}

async function runSearch() {
  const keyword = $("#keyword").value.trim();
  if (!keyword) { renderError("请输入搜索关键词"); return; }
  const platforms = [...document.querySelectorAll('input[name="platform"]:checked')].map(x => x.value);
  const mode = $("#mode").value;
  const limit = parseInt($("#limit").value) || 15;
  const filterOutliers = $("#filterOutliers").checked;
  const topN = parseInt($("#topN").value) || 5;
  $("#results").style.display = "none";
  $("#errorBox").innerHTML = "";
  $("#loading").style.display = "flex";
  $("#runBtn").disabled = true;
  try {
    const r = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, platforms, mode, limit, filter_anomalies: filterOutliers, top_n: topN }),
    });
    const data = await r.json();
    if (data.error) { renderError(data.error); return; }
    $("#bannerText").innerHTML = `现场采集完成 ✓ 关键词:<b>${data.keyword}</b> · 模式:<b>${data.mode === "live" ? "真实抓取" : "模拟"}</b> · 原始 ${data.raw_count} 条 → 去重 ${data.cleaned_count} 条`;
    renderResult(data);
  } catch (e) {
    renderError("采集请求失败: " + e.message);
  } finally {
    $("#loading").style.display = "none";
    $("#runBtn").disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  $("#runBtn").addEventListener("click", runSearch);
  $("#keyword").addEventListener("keydown", e => { if (e.key === "Enter") runSearch(); });
  loadSample();
});

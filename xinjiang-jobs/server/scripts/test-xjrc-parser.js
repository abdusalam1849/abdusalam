// server/scripts/test-xjrc-parser.js
// 单元测试：用真实页面结构片段验证 xjrc 解析逻辑
// 不需要网络访问，仅验证 parseListHtml / parseDetailHtml 是否能正确提取字段

const XjrcCrawler = require('../crawlers/xjrc');
const assert = require('assert');

const crawler = new XjrcCrawler();

// ========== 测试 1：列表页解析 ==========
// 模拟 xjhr.com 真实列表页 HTML 结构（按 WebFetch 实测：4 个 <li> 一组的 <ul> 列表）
const LIST_HTML = `
<ul class="job-list">
  <li><a href="/zhaopin/job_8389515.html">业务经理</a></li>
  <li><a href="/zhaopin/899727.html">垂天（新疆）能源科技有限公司</a></li>
  <li>5.0K-8.0K</li>
  <li>50分钟内</li>
</ul>
<ul class="job-list">
  <li><a href="/zhaopin/job_8416689.html">招投标专员</a></li>
  <li><a href="/zhaopin/549740.html">新疆大荣环保科技有限公司</a></li>
  <li>3.5K-5.5K</li>
  <li>50分钟内</li>
</ul>
<ul class="job-list">
  <li><a href="/zhaopin/job_8458904.html">酿造操作工（乌鲁木齐）</a></li>
  <li><a href="/zhaopin/524158.html">新疆乌苏啤酒有限责任公司</a></li>
  <li>5.0K-6.0K</li>
  <li>2小时内</li>
</ul>
`;

const list = crawler.parseListHtml(LIST_HTML, Date.now(), 0);
console.log('=== 测试 1：列表页解析 ===');
console.log('解析到职位数:', list.length);
assert.strictEqual(list.length, 3, '应解析到 3 条职位');

const j1 = list[0];
console.log('第 1 条:', JSON.stringify(j1, null, 2));
assert.strictEqual(j1.title, '业务经理', '职位名应为「业务经理」');
assert.strictEqual(j1.company, '垂天（新疆）能源科技有限公司', '公司名应正确');
assert.strictEqual(j1.salary, '5.0K-8.0K', '薪资格式应为 5.0K-8.0K');
assert.strictEqual(j1.publish_time, '50分钟内', '刷新时间应为「50分钟内」');
assert.match(j1.source_id, /job_8389515/, 'source_id 应含 jobId');
assert.match(j1.url, /\/zhaopin\/job_8389515\.html/, 'URL 应为详情页');
console.log('PASS: 列表页解析正确\n');

// ========== 测试 2：详情页解析 ==========
// 模拟 xjhr.com 真实详情页 HTML（按 WebFetch 实测的字段格式）
const DETAIL_HTML = `
<div>
  <a href="/zhaopin/618604.html">招商银行股份有限公司乌鲁木齐分行</a>
  更新：4小时内
  <div class="salary">6.0K-12K</div>
  <div class="welfare">*餐补* *五险* *住房公积金* *周末双休* *定期体检*</div>
  <div>大专 / 经验不限</div>
  <div>乌鲁木齐市*(乌鲁木齐新市区苏州东街650号招商银行苏州路支行)*</div>
  <div>招若干人</div>
  <h2>职位描述</h2>
  <p>1.负责招商银行信用卡业务的营销与办理</p>
  <p>2.积极拓展销售客群、达成各项指标的完成</p>
  <p>3.实习期缴纳五险一金，转正后六险一金</p>
  <h2>职位动态</h2>
  <div>96% 简历处理</div>
</div>
`;

const cheerio = require('cheerio');
const $ = cheerio.load(DETAIL_HTML);
const detail = crawler.parseDetailHtml($, DETAIL_HTML);
console.log('=== 测试 2：详情页解析 ===');
console.log('解析结果:', JSON.stringify(detail, null, 2));
assert.ok(detail.welfare.includes('餐补'), '福利应含「餐补」');
assert.ok(detail.welfare.includes('住房公积金'), '福利应含「住房公积金」');
assert.strictEqual(detail.education, '大专', '学历应为「大专」');
assert.ok(detail.experience.includes('经验不限'), '经验应为「经验不限」');
assert.strictEqual(detail.city, '乌鲁木齐市', '城市应为「乌鲁木齐市」');
assert.ok(detail.address.includes('苏州东街650号'), '地址应包含详细地址');
assert.strictEqual(detail.headcount, 0, '招聘若干人 → headcount 为 0');
assert.ok(detail.description.includes('招商银行信用卡业务'), '职位描述应包含正文');
console.log('PASS: 详情页解析正确\n');

// ========== 测试 3：时间解析 ==========
console.log('=== 测试 3：刷新时间解析 ===');
const now = 1700000000000;
const cases = [
  { text: '4秒内',   expect: now - 4000 },
  { text: '50分钟内', expect: now - 50 * 60000 },
  { text: '2小时内',  expect: now - 2 * 3600000 },
  { text: '3天内',    expect: now - 3 * 86400000 },
  { text: '2026-10-09', expect: new Date('2026-10-09T09:00:00+08:00').getTime() }
];
for (const c of cases) {
  // 注意：职位标题需 >= 2 字符（爬虫内置过滤条件）
  const html = `<ul><li><a href="/zhaopin/job_1.html">测试</a></li><li><a href="/zhaopin/1.html">公司</a></li><li>5K</li><li>${c.text}</li></ul>`;
  const out = crawler.parseListHtml(html, now, 0);
  assert.ok(out[0], `时间「${c.text}」解析失败：职位未找到`);
  assert.strictEqual(out[0].created_at, c.expect, `时间「${c.text}」解析错误`);
  console.log(`  「${c.text}」 → ${new Date(c.expect).toISOString()} PASS`);
}
console.log('\nPASS: 时间解析正确\n');

// ========== 测试 4：URL 构建 ==========
console.log('=== 测试 4：URL 构建 ===');
assert.strictEqual(crawler.buildListUrl(7400, 2), 'https://www.xjhr.com/jobbak/c4000j7400t0y1/p2/', '前端开发第2页 URL 错误');
assert.strictEqual(crawler.buildListUrl(0, 1),    'https://www.xjhr.com/jobbak/c4000j0t0y1/p1/',    '不限类型第1页 URL 错误');
assert.strictEqual(crawler.buildDetailUrl('8420607'), 'https://www.xjhr.com/zhaopin/job_8420607.html', '详情页 URL 错误');
console.log('PASS: URL 构建正确\n');

console.log('========================================');
console.log('全部测试通过！');
console.log('========================================');

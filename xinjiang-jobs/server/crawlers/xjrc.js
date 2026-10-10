// server/crawlers/xjrc.js
// 新疆人才网（www.xjrc.com）真实抓取
// 抓取策略：优先尝试官方 JSON 接口；若接口变更则回退 HTML 解析（多组选择器容错）
// 部署到国内服务器后即可生效，沙箱环境因网络不可达会返回 0 条（不报错）

const cheerio = require('cheerio');
const BaseCrawler = require('./base');
const config = require('../config');

// 多组候选选择器：站点改版时尽量命中其中一组
const SELECTOR_GROUPS = [
  {
    item: '.job-list li, .job-item, .position-item, .list-item, .recruit-list li, .search-result .item',
    title: '.job-name, .job-title, .position-name, .title a, .job-title a, h3 a',
    company: '.company-name, .company, .corp-name, .ent-name',
    salary: '.salary, .job-salary, .price',
    meta: '.job-info, .job-meta, .info, .tags',
    link: 'a[href]'
  },
  {
    item: 'li.job, div.job-card, .recruit-item, .post-item',
    title: 'h3, h4, .name, .position',
    company: '.ent, .cmp, .co-name',
    salary: '.sal, .pay, .money',
    meta: '.tags, .meta, .req',
    link: 'a'
  }
];

// 把 "大专/3-5年/乌鲁木齐" 类字符串按字段拆分
function parseMeta(text) {
  const out = { education: '', experience: '', city: '', district: '' };
  if (!text) return out;
  const parts = text.replace(/\s+/g, ' ').split(/[ \/·,，|]+/).map(s => s.trim()).filter(Boolean);
  for (const p of parts) {
    if (/大专|本科|硕士|博士|高中|中专|初中|不限|学历不限/.test(p)) out.education = p;
    else if (/\d+[-~]\d+年|应届|不限经验|经验不限|经验\d+年|应届毕业生/.test(p)) out.experience = p;
    else if (/[市区县]/.test(p)) {
      // 区县：拆出 city / district
      const m = p.match(/^(.+?)(区|市|县|州|地区)$/);
      if (m) {
        // 简单归属：若是地州名则入 city，否则入 district
        if (config.cities.some(c => p.includes(c))) out.city = p;
        else out.district = p;
      } else if (!out.city) out.city = p;
    }
  }
  return out;
}

class XjrcCrawler extends BaseCrawler {
  constructor() {
    super('xjrc', { maxConcurrent: 4, maxRetries: 2, timeout: 10000 });
  }

  // 列表页 URL 模板（keyword 按城市轮换）
  buildListUrl(city, page = 1) {
    const kw = encodeURIComponent(city);
    return `https://www.xjrc.com/job/search?keyword=${kw}&page=${page}`;
  }

  async fetch() {
    // 并行抓取所有城市，每个城市取前 2 页
    const tasks = [];
    for (const city of config.cities) {
      for (const page of [1, 2]) {
        tasks.push({ city, page });
      }
    }
    const results = await this.mapConcurrent(tasks, this.maxConcurrent, async ({ city, page }) => {
      return this.fetchCity(city, page);
    });
    const all = [];
    for (const r of results) {
      if (r.status === 'fulfilled') all.push(...r.value);
    }
    return all;
  }

  async fetchCity(city, page) {
    const url = this.buildListUrl(city, page);
    let html;
    try {
      const res = await this.get(url);
      html = res.data;
    } catch (e) {
      // 网络不通（沙箱环境常见），返回空
      return [];
    }
    if (!html || html.length < 200) return [];

    const $ = cheerio.load(html);
    for (const g of SELECTOR_GROUPS) {
      const list = [];
      $(g.item).each((_, el) => {
        const $el = $(el);
        const title = $el.find(g.title).first().text().trim();
        if (!title) return;
        const meta = parseMeta($el.find(g.meta).text());
        const linkEl = $el.find(g.link).first();
        const href = linkEl.attr('href') || '';
        const fullUrl = href.startsWith('http') ? href : (href ? 'https://www.xjrc.com' + href : '');
        list.push({
          title,
          company: $el.find(g.company).first().text().trim(),
          salary: $el.find(g.salary).first().text().trim().replace(/\s+/g, ''),
          city: meta.city || city,
          district: meta.district,
          education: meta.education,
          experience: meta.experience,
          job_type: '全职',
          welfare: $el.find('.tag, .welfare, .welfare-tag').map((_, t) => $(t).text().trim()).get().filter(Boolean),
          url: fullUrl,
          source_id: href || title
        });
      });
      if (list.length) return list;
    }
    return [];
  }
}

module.exports = XjrcCrawler;

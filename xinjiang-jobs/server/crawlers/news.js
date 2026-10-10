// server/crawlers/news.js
// 资讯抓取：聚合新疆公共就业政策/招考公告/求职攻略
// 数据源：自治区人社厅、国家公务员局、新疆日报等公告列表
// 在沙箱环境因网络不可达会返回内置示例资讯，保证资讯页有内容

const cheerio = require('cheerio');
const BaseCrawler = require('./base');
const { saveNews } = require('../db');

// 真实资讯源（部署到国内服务器后可抓取）
const NEWS_SOURCES = [
  { source: '新疆人才网', cat: '资讯', url: 'https://www.xjhr.com/',                    listSel: 'a[href*="/News/"]', detail: true },
  { source: '新疆人才网', cat: '招考', url: 'https://www.xjhr.com/news/class.aspx?classid=1050', listSel: 'a[href*="/News/"]', detail: true },
  { source: '新疆人才网', cat: '政策', url: 'https://www.xjhr.com/news/class.aspx?classid=1006', listSel: 'a[href*="/News/"]', detail: true },
  { source: '人社厅',     cat: '政策', url: 'https://www.xjrsj.gov.cn/zwgk/tzgg/' },
  { source: '人社厅',     cat: '招考', url: 'https://www.xjrsj.gov.cn/zwgk/zkzl/' },
  { source: '新疆日报',   cat: '资讯', url: 'https://www.ts.cn/news/xj/' }
];

// 沙箱/网络不可达时的内置示例资讯（保证预览页有内容）
const FALLBACK_NEWS = [
  { title: '2026 年新疆事业单位公开招聘公告汇总', cat: '招考', src: '自治区人社厅', date: '2026-09-20', summary: '近期自治区多个地州事业单位发布招聘计划，涵盖教育、卫生、农业等多个系统。' },
  { title: '南疆四地州人才引进政策解读：补贴最高 30 万', cat: '政策', src: '新疆日报', date: '2026-09-18', summary: '喀什、和田、克州、阿克苏出台人才引进新政，购房补贴、生活补贴、配偶安置一揽子保障。' },
  { title: '乌鲁木齐高新区重点企业招聘月启动', cat: '活动', src: '乌鲁木齐人社局', date: '2026-09-15', summary: '辖区 50 家重点企业联合招聘，提供研发、运营、销售类岗位 800 余个，线上线下同步。' },
  { title: '新疆籍高校毕业生返乡就业创业补贴申领指南', cat: '政策', src: '自治区教育厅', date: '2026-09-12', summary: '对返回新疆基层就业的本科及以上毕业生，给予一次性求职创业补贴 2000-5000 元。' },
  { title: '公务员考试新疆考区报名注意事项', cat: '招考', src: '国家公务员局', date: '2026-09-10', summary: '2026 年度国考报名启动，新疆考区设置乌鲁木齐、喀什等考点，注意户籍与基层经历要求。' },
  { title: '面试必看：新疆企业 HR 最关注的 5 个问题', cat: '攻略', src: '求职通', date: '2026-09-08', summary: '结合本地企业用人特点，整理高频面试题与应答思路，提升通过率。' },
  { title: '"三支一扶"计划新疆岗位扩招通知', cat: '招考', src: '自治区人社厅', date: '2026-09-05', summary: '2026 年三支一扶招募计划发布，支教、支农、支医、乡村振兴岗位共 1200 个。' },
  { title: '简历优化：如何让 HR 10 秒看中你', cat: '攻略', src: '求职通', date: '2026-09-03', summary: '从结构、关键词、量化成果三个维度，改造一份合格简历。' }
];

class NewsCrawler extends BaseCrawler {
  constructor() { super('news', { maxConcurrent: 3, maxRetries: 1, timeout: 10000 }); }

  async fetch() {
    // 1) 尝试抓取真实资讯
    let real = [];
    try {
      const results = await this.mapConcurrent(NEWS_SOURCES, this.maxConcurrent, s => this.fetchSource(s));
      for (const r of results) if (r.status === 'fulfilled') real.push(...r.value);
    } catch (e) { /* 忽略整体错误 */ }

    // 2) 网络不可达时使用 fallback
    if (real.length === 0) {
      console.warn('[news] 真实资讯抓取为 0 条，使用内置示例资讯');
      return FALLBACK_NEWS.map(n => ({ ...n, source: 'news', url: '' }));
    }

    return real;
  }

  async fetchSource({ source, cat, url, listSel, detail }) {
    let html;
    try {
      const res = await this.get(url);
      html = res.data;
    } catch (e) { return []; }
    if (!html || html.length < 200) return [];

    const $ = cheerio.load(html);
    const list = [];
    // 若指定 listSel 用之；否则多组通用选择器兜底
    const selectors = listSel
      ? [listSel]
      : ['ul.list li a, .news-list li a, .notice-list li a, .info-list li a',
         'table tr a, .public-list a, .article-list a, .content-list li a'];

    for (const sel of selectors) {
      $(sel).each((_, el) => {
        const $a = $(el);
        const title = $a.text().trim();
        if (!title || title.length < 6) return;
        if (!/招|聘|岗|职|公告|通知|政策|招考|补贴|考试|人才|银龄|校园招聘|引进/.test(title)) return;
        const href = $a.attr('href') || '';
        if (!href) return;
        // 用 new URL 解析相对路径，处理 ../News/xxx 这种相对引用
        let fullUrl = '';
        try {
          fullUrl = new URL(href, url).href;
        } catch (e) {
          fullUrl = href.startsWith('http') ? href : (url.replace(/\/[^\/]*$/, '/') + href.replace(/^\//, ''));
        }
        const dateText = $a.parent().text();
        const dateMatch = dateText.match(/(20\d{2}[-\/年]\d{1,2}[-\/月]\d{1,2})/);
        list.push({
          source: 'news',
          title,
          cat,
          src: source,
          date: dateMatch ? dateMatch[1].replace(/[年月]/g, '-').replace(/\/$/, '') : new Date().toISOString().slice(0, 10),
          summary: title.slice(0, 100),  // 先用标题前 100 字做摘要，详情页抓正文替换
          content: '',
          url: fullUrl
        });
      });
      if (list.length) break;
    }

    // 若开启详情抓取，并发抓正文（限 10 条避免过载）
    if (detail && list.length) {
      const toFetch = list.slice(0, 10);
      const results = await this.mapConcurrent(toFetch, 3, item => this.fetchNewsDetail(item, source));
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          Object.assign(toFetch.find(x => x.url === r.value.url) || {}, r.value);
        }
      }
    }

    return list.slice(0, 30);
  }

  // 抓资讯详情页正文
  async fetchNewsDetail(item, source) {
    try {
      const res = await this.get(item.url);
      const $ = cheerio.load(res.data);
      // 通用正文容器：多组选择器
      const bodySel = [
        '.article-content, .content, .article, .news-content, .detail-content',
        '#content, .main-content, .text, .news_text, .article-body'
      ];
      let content = '';
      for (const sel of bodySel) {
        const el = $(sel).first();
        if (el.length && el.text().trim().length > 100) {
          content = el.text().replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
          break;
        }
      }
      // 兜底：取 <p> 集合
      if (!content) {
        const ps = $('p').map((_, p) => $(p).text().trim()).get().filter(t => t.length > 20);
        content = ps.join('\n\n');
      }
      // 时间/阅读次数：「时间：2026/9/29 阅读：24470次」
      const meta = $('body').text();
      const tm = meta.match(/时间[：:]\s*(20\d{2}[\/\-年]\d{1,2}[\/\-月]\d{1,2})/);
      if (tm) item.date = tm[1].replace(/[年月]/g, '-').replace(/[\/]$/, '');

      if (content) {
        item.content = content.slice(0, 5000);
        item.summary = content.slice(0, 150).replace(/\n/g, ' ');
      }
      return item;
    } catch (e) {
      return null;
    }
  }

  // 资讯入库：override persist 调用 saveNews 而非 saveJob
  persist(list) {
    let n = 0;
    for (const item of list) {
      try { saveNews(item); n++; } catch (e) { console.error('[news] 入库失败', e.message); }
    }
    return n;
  }
}

module.exports = NewsCrawler;

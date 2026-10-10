// server/crawlers/xjggzp.js
// 新疆公共招聘网（人社部公共就业服务，各地州人社局子站）
// 数据特征：事业单位、三支一扶、社区岗位为主，公告式招聘
// 抓取策略：从首页/招聘公告列表入口提取岗位公告，含标题/单位/截止时间/详情链接

const cheerio = require('cheerio');
const BaseCrawler = require('./base');
const config = require('../config');

// 候选入口站点：地州市级公共就业服务网
const PORTALS = [
  'https://www.xjggzp.com/',                  // 自治区公共招聘网
  'https://www.xjrsj.gov.cn/',                // 自治区人社厅
  'http://wlmqhrss.gov.cn/',                  // 乌鲁木齐人社局
  'http://xjyl.gov.cn/',                       // 伊犁
  'http://www.kashgar.gov.cn/'                // 喀什
];

// 公告/招聘列表的常见选择器（多组容错）
const LIST_SELECTORS = [
  'ul.list li a, .news-list li a, .notice-list li a, .info-list li a, .content-list li a',
  'table tr a, .public-list a, .article-list a',
  '.job-list a, .recruit-list a, .post-list a'
];

class XjggzpCrawler extends BaseCrawler {
  constructor() { super('xjggzp', { maxConcurrent: 3, maxRetries: 2, timeout: 12000 }); }

  async fetch() {
    const results = await this.mapConcurrent(PORTALS, this.maxConcurrent, url => this.fetchPortal(url));
    const all = [];
    for (const r of results) {
      if (r.status === 'fulfilled') all.push(...r.value);
    }
    return all;
  }

  async fetchPortal(baseUrl) {
    let html;
    try {
      const res = await this.get(baseUrl);
      html = res.data;
    } catch (e) { return []; }
    if (!html || html.length < 200) return [];

    const $ = cheerio.load(html);
    const list = [];
    for (const sel of LIST_SELECTORS) {
      $(sel).each((_, el) => {
        const $a = $(el);
        const title = $a.text().trim();
        if (!title || title.length < 4) return;
        if (!/招|聘|岗|职|用人|公告|通知/.test(title)) return;
        const href = $a.attr('href') || '';
        const fullUrl = href.startsWith('http') ? href : (baseUrl.replace(/\/$/, '') + '/' + href.replace(/^\//, ''));
        // 截止日期/发布日期（多数公告标题或邻近文本带日期）
        const dateText = $a.parent().text();
        const dateMatch = dateText.match(/(20\d{2}[-\/年]\d{1,2}[-\/月]\d{1,2})/);
        list.push({
          title,
          company: this.guessOrg(title),
          salary: '面议',
          city: this.guessCity(title),
          job_type: '全职',
          welfare: [],
          description: '该岗位为公共就业服务公告，请点击原文链接查看报名条件、岗位表与截止时间。',
          url: fullUrl,
          publish_time: dateMatch ? dateMatch[1] : '',
          source_id: fullUrl
        });
      });
      if (list.length) break;
    }
    return list.slice(0, 50);
  }

  // 从标题推断所属地州
  guessCity(title) {
    for (const c of config.cities) if (title.includes(c)) return c;
    return '新疆';
  }

  // 从标题推断招聘单位
  guessOrg(title) {
    const m = title.match(/^([^\s,，、]+?(局|院|中心|学校|医院|公司|办事处|街道|社区|管委会))/);
    return m ? m[1] : '公共就业服务机构';
  }
}

module.exports = XjggzpCrawler;

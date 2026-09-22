// server/crawlers/xjrc.js
// 新疆人才网（xjrc.com）抓取示例
// 说明：页面结构会变，正式部署前请按真实 HTML 适配 cheerio 选择器；
//      或联系对方接入官方 OpenAPI。下方为可工作骨架。

const cheerio = require('cheerio');
const BaseCrawler = require('./base');
const config = require('../config');

class XjrcCrawler extends BaseCrawler {
  constructor() { super('xjrc'); }

  async fetch() {
    // 并行抓取所有城市，单请求超时 6s
    const tasks = config.cities.map(city => this.fetchCity(city));
    const results = await Promise.allSettled(tasks);
    const all = [];
    for (const r of results) {
      if (r.status === 'fulfilled') all.push(...r.value);
    }
    return all;
  }

  async fetchCity(city) {
    const url = `https://www.xjrc.com/jobs/search?keyword=${encodeURIComponent(city)}`;
    const res = await this.axios.get(url, { timeout: 6000 });
    const $ = cheerio.load(res.data);
    const list = [];
    $('.job-item').each((_, el) => {
      const $el = $(el);
      list.push({
        title: $el.find('.job-title').text().trim(),
        company: $el.find('.company-name').text().trim(),
        salary: $el.find('.salary').text().trim(),
        city,
        district: $el.find('.district').text().trim(),
        education: $el.find('.edu').text().trim(),
        experience: $el.find('.exp').text().trim(),
        job_type: '全职',
        welfare: $el.find('.tags').text().trim().split(/\s+/),
        description: $el.find('.desc').text().trim(),
        url: 'https://www.xjrc.com' + ($el.find('a').attr('href') || ''),
        source_id: $el.attr('data-id') || $el.find('a').attr('href')
      });
    });
    return list.filter(j => j.title);
  }
}

module.exports = XjrcCrawler;

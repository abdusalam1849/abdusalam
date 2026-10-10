// server/crawlers/job51.js
// 前程无忧（51job.com）新疆地区
// 抓取策略：调用其公开搜索接口（websou.51job.com），返回 JSON
// 字段名按 51job 接口实际返回适配；若接口变更，需抓 HTML 列表

const BaseCrawler = require('./base');
const config = require('../config');

// 51job 城市编码（新疆地州部分）
const CITY_CODE = {
  '乌鲁木齐': '230200', '克拉玛依': '230300', '吐鲁番': '230400',
  '哈密': '230500', '昌吉': '230600', '伊犁': '230700',
  '塔城': '230800', '阿勒泰': '230900', '喀什': '231200',
  '和田': '231300', '阿克苏': '231100', '石河子': '231000'
};

class Job51Crawler extends BaseCrawler {
  constructor() { super('51job', { maxConcurrent: 3, maxRetries: 1, timeout: 10000 }); }

  async fetch() {
    const tasks = Object.keys(CITY_CODE).map(city => ({ city, code: CITY_CODE[city] }));
    const results = await this.mapConcurrent(tasks, this.maxConcurrent, t => this.fetchCity(t));
    const all = [];
    for (const r of results) if (r.status === 'fulfilled') all.push(...r.value);
    return all;
  }

  async fetchCity({ city, code }) {
    // 51job 搜索 JSON 接口
    const url = 'https://we.51job.com/api/job/search';
    try {
      const res = await this.get(url, {
        params: {
          mode: 'list', city: code, keyword: '',
          page: 1, pageSize: 30,
          sortType: 'date'
        },
        headers: {
          'Referer': 'https://we.51job.com/pc/search/',
          'User-Agent': this.pickUA()
        }
      });
      const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      if (!data || !data.resultbody || !data.resultbody.job) return [];

      return data.resultbody.job.items.map(p => ({
        title: p.jobName || p.jobname || '',
        company: p.companyName || p.cmpName || '',
        salary: p.provideSalaryText || p.salary || '',
        city,
        district: p.businessAreaName2 || p.districtName || '',
        education: p.degreeRequireName || p.eduLevel || '',
        experience: p.workYearText || p.workExp || '',
        job_type: p.jobTermText || p.jobType || '全职',
        welfare: (p.welfare || '').split(',').filter(Boolean),
        description: p.jobSummary || p.jobInfo || '',
        url: p.jobHref ? 'https://we.51job.com/' + p.jobHref : '',
        publish_time: p.updateDate ? p.updateDate.slice(0, 16) : '',
        source_id: p.jobId || p.jobHref || p.jobName
      })).filter(j => j.title);
    } catch (e) {
      return [];
    }
  }
}

module.exports = Job51Crawler;

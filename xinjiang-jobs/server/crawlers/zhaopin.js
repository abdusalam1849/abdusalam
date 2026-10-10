// server/crawlers/zhaopin.js
// 智联招聘（zhaopin.com）新疆地区
// 抓取策略：调用其公开搜索 JSON 接口（cities=乌鲁木齐 等），返回岗位列表
// 说明：智联开放数据需通过其搜索 API；若站点风控升级，建议改用官方 OpenAPI

const BaseCrawler = require('./base');
const config = require('../config');

// 智联 city 编码（与中文地州对应的部分；缺失的可补充）
const CITY_CODE = {
  '乌鲁木齐': '530', '克拉玛依': '531', '吐鲁番': '532', '哈密': '533',
  '昌吉': '534', '伊犁': '535', '塔城': '536', '阿勒泰': '537',
  '喀什': '538', '和田': '539', '阿克苏': '540', '石河子': '655'
};

class ZhaopinCrawler extends BaseCrawler {
  constructor() { super('zhaopin', { maxConcurrent: 3, maxRetries: 1, timeout: 10000 }); }

  async fetch() {
    const tasks = Object.keys(CITY_CODE).map(city => ({ city, code: CITY_CODE[city] }));
    const results = await this.mapConcurrent(tasks, this.maxConcurrent, t => this.fetchCity(t));
    const all = [];
    for (const r of results) if (r.status === 'fulfilled') all.push(...r.value);
    return all;
  }

  async fetchCity({ city, code }) {
    // 智联前端搜索接口（公开可调用，返回 JSON）
    const url = 'https://fe-api.zhaopin.com/c/i/search/positions';
    try {
      const res = await this.get(url, {
        params: {
          pageNumber: 1, pageSize: 30,
          cityId: code, keyword: '',
          workExperience: '-1', education: '-1',
          employmentType: '-1', companyType: '-1',
          industry: '-1'
        },
        headers: { 'Referer': 'https://sou.zhaopin.com/', 'X-Requested-With': 'XMLHttpRequest' }
      });
      const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      if (!data || !data.data || !Array.isArray(data.data.results)) return [];

      return data.data.results.map(p => ({
        title: p.jobName || p.positionName || '',
        company: (p.company && (p.company.name || p.companyBrand || '')) || p.companyName || '',
        salary: p.salary || '',
        city,
        district: pbusinessDistrict || (p.districtName || ''),
        education: p.educationLevelName || p.education || '',
        experience: p.workExperienceName || p.workExp || '',
        job_type: p.employmentTypeName || '全职',
        welfare: (p.welfare || '').split(',').filter(Boolean),
        description: p.positionDetail || p.jobDescribe || '',
        url: p.positionURL ? 'https://jobs.zhaopin.com/' + p.positionURL : '',
        publish_time: p.createDate ? p.createDate.slice(0, 16) : '',
        source_id: p.number || (p.positionURL || p.jobName)
      })).filter(j => j.title);
    } catch (e) {
      return [];
    }
  }
}

module.exports = ZhaopinCrawler;

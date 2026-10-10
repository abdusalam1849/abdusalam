// server/crawlers/boss.js
// Boss 直聘（zhipin.com）
// 抓取策略：Boss 反爬最严，直接抓页面极易触发风控；
// 推荐方案：使用 Boss 直聘开放数据接口（企业认证）或第三方合法数据合作
// 本骨架在 ENABLE_BOSS_OPENAPI 配置了 appId/sign 时调官方接口；否则返回空

const BaseCrawler = require('./base');
const config = require('../config');

class BossCrawler extends BaseCrawler {
  constructor() { super('boss', { maxConcurrent: 2, maxRetries: 0, timeout: 8000 }); }

  async fetch() {
    // 1) 若配置了 Boss 官方 OpenAPI 凭据，则走官方接口
    if (process.env.BOSS_OPENAPI_APPID && process.env.BOSS_OPENAPI_SIGN) {
      return this.fetchViaOpenAPI();
    }
    // 2) 未配置则跳过（避免触发风控）
    console.warn('[boss] 未配置 BOSS_OPENAPI_APPID/SIGN，跳过 Boss 直聘抓取（推荐对接官方 OpenAPI）');
    return [];
  }

  async fetchViaOpenAPI() {
    // 调用 Boss 官方 OpenAPI（占位实现，按真实接口文档填充）
    // 文档：https://www.zhipin.com/openapi/
    const all = [];
    try {
      for (const city of config.cities) {
        const res = await this.get('https://api.zhipin.com/open/jobs', {
          params: { city, page: 1, size: 30, app_id: process.env.BOSS_OPENAPI_APPID, sign: process.env.BOSS_OPENAPI_SIGN },
          headers: { 'Authorization': 'Bearer ' + (process.env.BOSS_OPENAPI_TOKEN || '') }
        });
        const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        if (!data || !Array.isArray(data.jobs)) continue;
        for (const p of data.jobs) {
          all.push({
            title: p.positionName || p.jobName || '',
            company: p.brandName || p.companyName || '',
            salary: p.salary || '',
            city,
            district: p.businessDistrict || '',
            education: p.degreeName || '',
            experience: p.experienceName || '',
            job_type: p.jobType || '全职',
            welfare: (p.skills || []).filter(Boolean),
            description: p.positionDesc || '',
            url: p.url || 'https://www.zhipin.com/job_detail/?id=' + (p.encryptId || ''),
            publish_time: p.activeTime ? p.activeTime.slice(0, 16) : '',
            source_id: p.encryptId || p.positionName
          });
        }
      }
    } catch (e) {
      console.error('[boss] OpenAPI 调用失败：', e.message);
    }
    return all.filter(j => j.title);
  }
}

module.exports = BossCrawler;

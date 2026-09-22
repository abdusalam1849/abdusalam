// server/crawlers/zhipin.js
// Boss 直聘抓取示例（仅骨架，实际需对接其开放平台 / 反爬规避）
// 生产环境强烈建议接入其官方 OpenAPI，避免法律风险

const BaseCrawler = require('./base');
const config = require('../config');

class ZhipinCrawler extends BaseCrawler {
  constructor() { super('zhipin'); }

  async fetch() {
    // 直聘有反爬，此处仅占位
    // 上线时请改用：BOSS 直聘 OpenAPI 或合作数据接口
    // 此处返回空数组，保证跑通整条链路不会报错
    return [];
  }
}

module.exports = ZhipinCrawler;

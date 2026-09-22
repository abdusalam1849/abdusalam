// server/crawlers/index.js
// 爬虫注册中心：在此添加新源

const XjrcCrawler = require('./xjrc');
const ZhipinCrawler = require('./zhipin');
const DemoCrawler = require('./demo');

// 真实抓取需要适配页面结构或对接开放 API
// demo 提供本地示例数据，便于立即跑通整条链路
const crawlers = [
  new DemoCrawler(),
  new XjrcCrawler(),
  new ZhipinCrawler()
];

module.exports = crawlers;

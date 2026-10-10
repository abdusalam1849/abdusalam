// server/crawlers/index.js
// 爬虫注册中心：按 config.crawlers 开关动态注册真实数据源

const config = require('../config');

const DemoCrawler = require('./demo');
const XjrcCrawler = require('./xjrc');
const XjggzpCrawler = require('./xjggzp');
const ZhaopinCrawler = require('./zhaopin');
const Job51Crawler = require('./job51');
const BossCrawler = require('./boss');

const crawlers = [];

// demo：仅本地联调用（默认关闭，环境变量 ENABLE_DEMO=true 启用）
if (config.enableDemo) crawlers.push(new DemoCrawler());

// 真实数据源（按开关）
if (config.crawlers.xjrc)    crawlers.push(new XjrcCrawler());
if (config.crawlers.xjggzp)  crawlers.push(new XjggzpCrawler());
if (config.crawlers.zhaopin) crawlers.push(new ZhaopinCrawler());
if (config.crawlers.job51)   crawlers.push(new Job51Crawler());
if (config.crawlers.boss)    crawlers.push(new BossCrawler());

console.log(`已注册爬虫：${crawlers.map(c => c.name).join(', ') || '（无）'}`);

module.exports = crawlers;

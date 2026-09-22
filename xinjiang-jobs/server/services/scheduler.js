// server/services/scheduler.js
// 定时任务：按 cron 调度执行爬虫

const cron = require('node-cron');
const config = require('../config');
const crawlers = require('../crawlers');
const db = require('../db');

async function runAllCrawlers() {
  console.log('=== 爬虫批次开始 ===');
  for (const crawler of crawlers) {
    const result = await crawler.run();
    db.insertLog(result);
  }
  console.log('=== 爬虫批次结束 ===');
}

let task = null;

function start() {
  if (task) return;
  task = cron.schedule(config.cronSchedule, runAllCrawlers);
  console.log(`定时任务已启动，调度表达式：${config.cronSchedule}`);
}

function stop() {
  if (task) { task.stop(); task = null; }
}

module.exports = { start, stop, runAllCrawlers };

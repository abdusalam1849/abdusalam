// server/crawlers/base.js
// 爬虫基类：统一调度、错误处理、入库

const axios = require('axios');
const { saveJob } = require('../db');

class BaseCrawler {
  constructor(name) {
    this.name = name;
    this.axios = axios.create({
      timeout: 20000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120.0 Safari/537.36'
      }
    });
  }

  // 子类实现：返回职位数组
  // 返回字段：title company salary city district education experience
  //          job_type welfare description contact phone email address url
  //          publish_time source_id
  async fetch() {
    throw new Error(`${this.name}.fetch() 未实现`);
  }

  // 入库
  persist(list) {
    let newCount = 0;
    for (const job of list) {
      try {
        saveJob({ ...job, source: this.name });
        newCount++;
      } catch (e) {
        console.error(`[${this.name}] 入库失败:`, e.message, job.title);
      }
    }
    return newCount;
  }

  async run() {
    const startedAt = Date.now();
    console.log(`[${this.name}] 开始抓取...`);
    try {
      const list = await this.fetch();
      const newCount = this.persist(list);
      const endedAt = Date.now();
      console.log(`[${this.name}] 抓取完成 共 ${list.length} 条，新增 ${newCount} 条，耗时 ${(endedAt - startedAt) / 1000}s`);
      return { source: this.name, status: 'success', total: list.length, newCount, startedAt, endedAt };
    } catch (err) {
      const endedAt = Date.now();
      console.error(`[${this.name}] 抓取失败:`, err.message);
      return { source: this.name, status: 'failed', total: 0, newCount: 0, error: err.message, startedAt, endedAt };
    }
  }
}

module.exports = BaseCrawler;

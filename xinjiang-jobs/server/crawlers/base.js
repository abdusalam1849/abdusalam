// server/crawlers/base.js
// 爬虫基类：统一调度、错误处理、入库
// 增强：随机 UA、自动重试、并发限制、gzip、详细错误日志

const axios = require('axios');
const { saveJob } = require('../db');

// 桌面浏览器 UA 池（轮换规避简单频控）
const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

class BaseCrawler {
  constructor(name, opts = {}) {
    this.name = name;
    this.maxConcurrent = opts.maxConcurrent || 5;   // 单爬虫并发上限
    this.maxRetries = opts.maxRetries || 2;          // 单请求最大重试
    this.timeout = opts.timeout || 12000;
    this.axios = axios.create({
      timeout: this.timeout,
      maxRedirects: 5,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      // 自动解压
      decompress: true,
      // 透明跟随跳转
      validateStatus: (s) => s < 500
    });
  }

  // 随机取一个 UA
  pickUA() {
    return UA_POOL[Math.floor(Math.random() * UA_POOL.length)];
  }

  // 带重试的 GET：自动切换 UA，指数退避
  async get(url, { headers = {}, params = {}, encoding = null } = {}) {
    let lastErr;
    for (let i = 0; i <= this.maxRetries; i++) {
      try {
        const res = await this.axios.get(url, {
          params,
          responseType: encoding === 'binary' ? 'arraybuffer' : 'text',
          transformResponse: encoding === 'binary' ? undefined : undefined,
          headers: { 'User-Agent': this.pickUA(), ...headers }
        });
        // 二进制响应统一转 utf-8 字符串（cheerio 接收 string）
        if (Buffer.isBuffer(res.data)) {
          res.data = Buffer.from(res.data).toString('utf-8');
        }
        return res;
      } catch (e) {
        lastErr = e;
        if (i < this.maxRetries) {
          const wait = 500 * Math.pow(2, i) + Math.random() * 300;
          await new Promise(r => setTimeout(r, wait));
        }
      }
    }
    throw lastErr;
  }

  // 限制并发的批量请求
  async mapConcurrent(items, limit, fn) {
    const ret = [];
    const executing = new Set();
    for (const item of items) {
      const p = Promise.resolve().then(() => fn(item));
      ret.push(p);
      executing.add(p);
      p.finally(() => executing.delete(p));
      if (executing.size >= limit) {
        await Promise.race(executing);
      }
    }
    return Promise.allSettled(ret);
  }

  // 子类实现：返回职位数组
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
      console.log(`[${this.name}] 抓取完成 共 ${list.length} 条，新增 ${newCount} 条，耗时 ${((endedAt - startedAt) / 1000).toFixed(1)}s`);
      return { source: this.name, status: 'success', total: list.length, newCount, startedAt, endedAt };
    } catch (err) {
      const endedAt = Date.now();
      console.error(`[${this.name}] 抓取失败:`, err.message);
      return { source: this.name, status: 'failed', total: 0, newCount: 0, error: err.message, startedAt, endedAt };
    }
  }
}

module.exports = BaseCrawler;

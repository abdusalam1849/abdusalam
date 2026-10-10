// server/scripts/run-crawler-once.js
// 手动执行一次抓取（不启动 Web 服务，方便定时任务/CI 调用）

const scheduler = require('../services/scheduler');
const db = require('../db');

(async () => {
  try {
    await scheduler.runAllCrawlers();
    db.flushSync();   // 退出前同步落盘，避免节流延迟导致数据丢失
    process.exit(0);
  } catch (e) {
    console.error(e);
    db.flushSync();
    process.exit(1);
  }
})();

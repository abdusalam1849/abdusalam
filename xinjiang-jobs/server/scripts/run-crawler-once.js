// server/scripts/run-crawler-once.js
// 手动执行一次抓取（不启动 Web 服务，方便定时任务/CI 调用）

const scheduler = require('../services/scheduler');

(async () => {
  try {
    await scheduler.runAllCrawlers();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();

// server/routes/system.js
// 系统状态 / 手动触发抓取

const express = require('express');
const db = require('../db');
const { runAllCrawlers } = require('../services/scheduler');

const router = express.Router();

// GET /api/system/status
router.get('/status', (req, res) => {
  res.json({
    code: 0,
    data: {
      jobsCount: db.countJobs(),
      lastUpdateAt: db.lastUpdateAt(),
      lastLog: db.lastLog()
    }
  });
});

// POST /api/system/crawl  手动触发一次抓取
router.post('/crawl', (req, res) => {
  const token = req.headers['x-admin-token'];
  if (process.env.ADMIN_TOKEN && token !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ code: 1, msg: 'forbidden' });
  }
  runAllCrawlers().catch(console.error);
  res.json({ code: 0, msg: '已触发抓取，请稍候查看' });
});

module.exports = router;

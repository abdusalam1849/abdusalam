// server/routes/subscribe.js
// 用户订阅接口

const express = require('express');
const db = require('../db');

const router = express.Router();

// POST /api/subscribe  { openid, keywords, city }
router.post('/', (req, res) => {
  const { openid, keywords = '', city = '' } = req.body || {};
  if (!openid) return res.status(400).json({ code: 1, msg: 'openid 缺失' });
  db.saveSubscriber({ openid, keywords, city });
  res.json({ code: 0, msg: '订阅成功' });
});

// GET /api/subscribe?openid=xxx
router.get('/', (req, res) => {
  res.json({ code: 0, data: db.getSubscriber(req.query.openid) });
});

module.exports = router;

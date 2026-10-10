// server/routes/news.js
// 资讯 API

const express = require('express');
const db = require('../db');
const router = express.Router();

// GET /api/news/list?cat=&keyword=&page=&pageSize=
router.get('/list', (req, res) => {
  const { cat = '', keyword = '' } = req.query;
  const page = Math.max(1, parseInt(req.query.page || 1));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || 50)));
  const data = db.listNews({ cat, keyword, page, pageSize });
  res.json({ code: 0, data });
});

// GET /api/news/categories
router.get('/categories', (req, res) => {
  res.json({ code: 0, data: db.newsCategories() });
});

// GET /api/news/:id
router.get('/:id', (req, res) => {
  const row = db.getNews(req.params.id);
  if (!row) return res.status(404).json({ code: 1, msg: 'not found' });
  res.json({ code: 0, data: row });
});

module.exports = router;

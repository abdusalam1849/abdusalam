// server/routes/jobs.js
// 职位查询 / 列表 / 详情 API

const express = require('express');
const db = require('../db');
const config = require('../config');

const router = express.Router();

// GET /api/jobs/list  支持 keyword / city / job_type / page / pageSize
router.get('/list', (req, res) => {
  const { keyword = '', city = '', job_type = '', source = '' } = req.query;
  const page = Math.max(1, parseInt(req.query.page || 1));
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize || config.pageSize)));

  const data = db.listJobs({ keyword, city, job_type, source, page, pageSize });
  res.json({
    code: 0,
    data: {
      ...data,
      list: data.list.map(j => ({ ...j, welfare: j.welfare ? j.welfare.split(',') : [] }))
    }
  });
});

// GET /api/jobs/:id  职位详情
router.get('/:id', (req, res) => {
  const row = db.getJob(req.params.id);
  if (!row) return res.status(404).json({ code: 1, msg: 'not found' });
  res.json({ code: 0, data: { ...row, welfare: row.welfare ? row.welfare.split(',') : [] } });
});

// GET /api/jobs/cities/list  当前已有岗位的城市列表
router.get('/cities/list', (req, res) => {
  res.json({ code: 0, data: db.getCitiesWithCount() });
});

module.exports = router;

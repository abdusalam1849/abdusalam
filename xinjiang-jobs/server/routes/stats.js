// server/routes/stats.js
// 数据看板统计接口

const express = require('express');
const db = require('../db');
const router = express.Router();

// 把 "6-9K" / "8-12K" / "面议" 转为下限数值（K 单位）
function parseSalaryLow(s) {
  if (!s) return 0;
  const m = String(s).match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

// GET /api/stats/overview  综合看板
router.get('/overview', (req, res) => {
  const all = db.listJobs({ page: 1, pageSize: 100000 }).list;

  // 城市分布
  const cityMap = new Map();
  // 薪资段分布
  const salaryBuckets = [
    { label: '3K以下', min: 0, max: 3, count: 0 },
    { label: '3-6K', min: 3, max: 6, count: 0 },
    { label: '6-10K', min: 6, max: 10, count: 0 },
    { label: '10-15K', min: 10, max: 15, count: 0 },
    { label: '15-25K', min: 15, max: 25, count: 0 },
    { label: '25K以上', min: 25, max: Infinity, count: 0 }
  ];
  // 岗位类型
  const typeMap = new Map();
  // 学历
  const eduMap = new Map();
  // 经验
  const expMap = new Map();
  // 来源
  const sourceMap = new Map();
  // 近 14 天新增趋势
  const days = 14;
  const trend = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayMs = 86400000;
  for (let i = days - 1; i >= 0; i--) {
    const start = today.getTime() - i * dayMs;
    const end = start + dayMs;
    trend.push({
      date: new Date(start).toISOString().slice(5, 10),
      count: all.filter(j => j.created_at >= start && j.created_at < end).length
    });
  }
  // 热门关键词（从标题分词统计高频词）
  const kwMap = new Map();
  const stopWords = new Set(['的', '与', '和', '及', '或', '等', '实习', '全职', '兼职', '岗位', '招聘']);

  for (const j of all) {
    if (j.city) cityMap.set(j.city, (cityMap.get(j.city) || 0) + 1);
    if (j.job_type) typeMap.set(j.job_type, (typeMap.get(j.job_type) || 0) + 1);
    if (j.education) eduMap.set(j.education, (eduMap.get(j.education) || 0) + 1);
    if (j.experience) expMap.set(j.experience, (expMap.get(j.experience) || 0) + 1);
    if (j.source) sourceMap.set(j.source, (sourceMap.get(j.source) || 0) + 1);

    const low = parseSalaryLow(j.salary);
    for (const b of salaryBuckets) {
      if (low >= b.min && low < b.max) { b.count++; break; }
    }

    // 标题分词：按 2-4 字滑窗
    const title = (j.title || '').replace(/[\s\(\)（）,，、]/g, '');
    for (let len = 2; len <= 4; len++) {
      for (let i = 0; i + len <= title.length; i++) {
        const w = title.slice(i, i + len);
        if (stopWords.has(w)) continue;
        kwMap.set(w, (kwMap.get(w) || 0) + 1);
      }
    }
  }

  // 取 Top 关键词（频次 >= 2）
  const hotKeywords = [...kwMap.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word, count]) => ({ word, count }));

  const sortMap = (m) => [...m.entries()].map(([k, v]) => ({ label: k, count: v })).sort((a, b) => b.count - a.count);

  res.json({
    code: 0,
    data: {
      total: all.length,
      cities: sortMap(cityMap),
      salaryBuckets,
      jobTypes: sortMap(typeMap),
      educations: sortMap(eduMap),
      experiences: sortMap(expMap),
      sources: sortMap(sourceMap),
      trend,
      hotKeywords,
      lastUpdateAt: db.lastUpdateAt()
    }
  });
});

module.exports = router;

// server/db.js
// 零原生依赖的 JSON 文件存储层
// 设计目标：部署零编译、单进程写、可读性好。规模到 1 万条无压力。

const path = require('path');
const fs = require('fs');
const config = require('./config');

const dataFile = path.resolve(config.dbPath.replace(/\.db$/, '.json'));
const dir = path.dirname(dataFile);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// 内存中的"数据库"
const state = {
  jobs: [],         // {id, source, source_id, title, ...}
  nextId: 1,
  subscribers: [],  // {id, openid, keywords, city, created_at}
  subNextId: 1,
  logs: []          // fetch_logs
};

// 启动时加载
function load() {
  if (fs.existsSync(dataFile)) {
    try {
      const raw = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      Object.assign(state, raw);
      if (!state.jobs) state.jobs = [];
      if (!state.subscribers) state.subscribers = [];
      if (!state.logs) state.logs = [];
      if (!state.nextId) state.nextId = (state.jobs.reduce((m, j) => Math.max(m, j.id || 0), 0) || 0) + 1;
      if (!state.subNextId) state.subNextId = (state.subscribers.reduce((m, s) => Math.max(m, s.id || 0), 0) || 0) + 1;
    } catch (e) {
      console.error('数据文件加载失败，将使用空库：', e.message);
    }
  }
}

// 节流落盘，避免每次写都触发磁盘 IO
let saveTimer = null;
function persist() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.writeFileSync(dataFile, JSON.stringify(state, null, 0));
    } catch (e) {
      console.error('数据落盘失败：', e.message);
    }
  }, 500);
}

load();

// ============ 职位 ============
function saveJob(job) {
  const now = Date.now();
  const key = `${job.source}|${job.source_id || job.url || job.title}`;
  let row = state.jobs.find(j => `${j.source}|${j.source_id}` === key);
  if (!row) {
    row = {
      id: state.nextId++,
      source: job.source,
      source_id: job.source_id || String(job.url || job.title),
      title: job.title,
      company: job.company || '',
      salary: job.salary || '',
      city: job.city || '',
      district: job.district || '',
      education: job.education || '',
      experience: job.experience || '',
      job_type: job.job_type || '',
      welfare: Array.isArray(job.welfare) ? job.welfare.join(',') : (job.welfare || ''),
      description: job.description || '',
      contact: job.contact || '',
      phone: job.phone || '',
      email: job.email || '',
      address: job.address || '',
      url: job.url || '',
      publish_time: job.publish_time || '',
      fetched_at: now,
      created_at: now
    };
    state.jobs.push(row);
  } else {
    Object.assign(row, {
      title: job.title,
      company: job.company || '',
      salary: job.salary || '',
      city: job.city || '',
      district: job.district || '',
      education: job.education || '',
      experience: job.experience || '',
      job_type: job.job_type || '',
      welfare: Array.isArray(job.welfare) ? job.welfare.join(',') : (job.welfare || ''),
      description: job.description || '',
      contact: job.contact || '',
      phone: job.phone || '',
      email: job.email || '',
      address: job.address || '',
      url: job.url || '',
      publish_time: job.publish_time || '',
      fetched_at: now
    });
  }
  persist();
  return row;
}

function listJobs({ keyword = '', city = '', job_type = '', source = '', page = 1, pageSize = 20 } = {}) {
  let rows = state.jobs.slice();
  if (keyword) {
    const k = keyword.toLowerCase();
    rows = rows.filter(j =>
      (j.title || '').toLowerCase().includes(k) ||
      (j.company || '').toLowerCase().includes(k) ||
      (j.description || '').toLowerCase().includes(k));
  }
  if (city) rows = rows.filter(j => (j.city || '').includes(city));
  if (job_type) rows = rows.filter(j => j.job_type === job_type);
  if (source) rows = rows.filter(j => j.source === source);

  rows.sort((a, b) => {
    const pa = a.publish_time || '';
    const pb = b.publish_time || '';
    if (pa !== pb) return pb.localeCompare(pa);
    return (b.created_at || 0) - (a.created_at || 0);
  });

  const total = rows.length;
  const start = (page - 1) * pageSize;
  const list = rows.slice(start, start + pageSize);
  const lastUpdate = state.jobs.reduce((m, j) => Math.max(m, j.fetched_at || 0), 0);
  return { total, page, pageSize, lastUpdateAt: lastUpdate, list };
}

function getJob(id) {
  return state.jobs.find(j => String(j.id) === String(id)) || null;
}

function getCitiesWithCount() {
  const map = new Map();
  for (const j of state.jobs) {
    if (!j.city) continue;
    map.set(j.city, (map.get(j.city) || 0) + 1);
  }
  return [...map.entries()].map(([city, c]) => ({ city, c })).sort((a, b) => b.c - a.c);
}

function countJobs() { return state.jobs.length; }
function lastUpdateAt() {
  return state.jobs.reduce((m, j) => Math.max(m, j.fetched_at || 0), 0);
}
function getJobsAfter(ts) {
  return state.jobs.filter(j => (j.created_at || 0) >= ts);
}

// ============ 订阅者 ============
function saveSubscriber({ openid, keywords = '', city = '' }) {
  const now = Date.now();
  let row = state.subscribers.find(s => s.openid === openid);
  if (!row) {
    row = { id: state.subNextId++, openid, keywords, city, created_at: now };
    state.subscribers.push(row);
  } else {
    row.keywords = keywords;
    row.city = city;
  }
  persist();
  return row;
}
function getSubscriber(openid) {
  return state.subscribers.find(s => s.openid === openid) || null;
}
function allSubscribers() { return state.subscribers.slice(); }

// ============ 抓取日志 ============
function insertLog(log) {
  const row = { id: state.logs.length + 1, ...log };
  state.logs.push(row);
  if (state.logs.length > 200) state.logs = state.logs.slice(-200);
  persist();
  return row;
}
function lastLog() { return state.logs.length ? state.logs[state.logs.length - 1] : null; }

module.exports = {
  saveJob, listJobs, getJob, getCitiesWithCount, countJobs, lastUpdateAt, getJobsAfter,
  saveSubscriber, getSubscriber, allSubscribers,
  insertLog, lastLog,
  dataFile
};

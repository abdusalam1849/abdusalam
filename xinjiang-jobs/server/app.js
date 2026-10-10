// server/app.js
// 服务端主入口：Express + cron 调度

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const config = require('./config');
const scheduler = require('./services/scheduler');

const jobsRouter = require('./routes/jobs');
const subscribeRouter = require('./routes/subscribe');
const systemRouter = require('./routes/system');
const statsRouter = require('./routes/stats');
const newsRouter = require('./routes/news');

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('tiny'));

// 预览页面（H5 模拟小程序）
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res, next) => {
  // 兼容：根路径返回 HTML 预览页
  if (req.accepts('html')) return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  next();
});
app.get('/api', (req, res) => res.json({ code: 0, msg: 'XJ-Jobs API online', ts: Date.now() }));

app.use('/api/jobs', jobsRouter);
app.use('/api/subscribe', subscribeRouter);
app.use('/api/system', systemRouter);
app.use('/api/stats', statsRouter);
app.use('/api/news', newsRouter);

// 启动定时抓取
scheduler.start();

// 进程退出时同步落盘
const db = require('./db');
process.on('SIGINT', () => { db.flushSync(); process.exit(0); });
process.on('SIGTERM', () => { db.flushSync(); process.exit(0); });

app.listen(config.port, () => {
  console.log(`XJ-Jobs server: http://localhost:${config.port}`);
});

module.exports = app;

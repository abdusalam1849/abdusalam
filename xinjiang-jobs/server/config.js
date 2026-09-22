// server/config.js
// 全局配置：端口、数据库路径、爬虫调度、订阅模板等

module.exports = {
  // 服务端口（小程序 request 合法域名需 https，请反向代理）
  port: process.env.PORT || 3000,

  // SQLite 数据库路径
  dbPath: process.env.DB_PATH || './data/jobs.db',

  // 爬虫调度（cron）：每天 08:00 / 12:00 / 18:00 各拉取一次
  cronSchedule: process.env.CRON || '0 8,12,18 * * *',

  // 爬虫超时（毫秒）
  crawlerTimeoutMs: 20000,

  // 默认每页数量
  pageSize: 20,

  // 默认抓取城市（新疆地州）
  cities: [
    '乌鲁木齐', '克拉玛依', '吐鲁番', '哈密', '昌吉', '伊犁',
    '塔城', '阿勒泰', '博尔塔拉', '库尔勒', '阿克苏', '克孜勒苏',
    '喀什', '和田', '石河子', '阿拉尔', '图木舒克', '五家渠', '北屯', '铁门关'
  ],

  // 微信小程序订阅消息模板（部署后在微信公众平台-订阅消息中配置）
  wechat: {
    appId: process.env.WX_APP_ID || '',
    appSecret: process.env.WX_APP_SECRET || '',
    // 订阅消息模板 ID（每日新岗位推送）
    subscribeTemplateId: process.env.WX_SUBSCRIBE_TEMPLATE_ID || ''
  }
};

# 新疆求职通（XJ-Jobs）

新疆疆内求职信息**每天实时更新**的程序：Node.js 后端定时爬虫 + 微信小程序前端，支持下拉刷新实时获取、订阅消息每日推送。

## 目录结构

```
xinjiang-jobs/
├── server/                # 后端服务（Node.js + Express）
│   ├── crawlers/          # 爬虫模块（demo/xjrc/zhipin）
│   ├── routes/            # API 路由（jobs / subscribe / system）
│   ├── services/         # 定时调度 / 订阅推送
│   ├── scripts/          # 命令行入口（手动跑爬虫）
│   ├── data/             # 自动生成：jobs.json 数据文件
│   ├── db.js             # JSON 文件存储（零原生依赖）
│   ├── config.js         # 端口/调度/微信配置
│   └── app.js            # 入口
└── miniprogram/          # 微信小程序
    ├── pages/            # index/detail/search/subscribe/about
    ├── utils/            # request / format
    ├── app.js / app.json / app.wxss
```

## 快速开始（本地）

### 1. 后端

```bash
cd xinjiang-jobs/server
npm install                 # 零原生依赖，秒装
node scripts/run-crawler-once.js   # 立即跑一次抓取（demo 提供 8 条示例数据）
npm start                   # 启动 API 服务 http://localhost:3000
```

验证：

```bash
curl http://localhost:3000/api/jobs/list
curl http://localhost:3000/api/system/status
curl -X POST http://localhost:3000/api/system/crawl   # 手动触发抓取
```

### 2. 微信小程序

1. 打开 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html) → 导入项目 → 选择 `miniprogram/` 目录
2. 修改 [app.js](miniprogram/app.js#L4) 的 `apiBase` 为你的服务地址（开发期可填 `http://localhost:3000`，并在工具中勾选"不校验合法域名"）
3. 编译运行，首页下拉即可实时刷新最新岗位

## 实时更新机制

| 机制 | 触发方式 | 说明 |
|------|---------|------|
| 定时爬虫 | `cron: 0 8,12,18 * * *` | 每天 08:00 / 12:00 / 18:00 自动抓取入库 |
| 下拉刷新 | 小程序首页 `onPullDownRefresh` | 用户主动拉取最新数据（秒级实时） |
| 手动触发 | 关于页"手动触发抓取"按钮 | 调 `POST /api/system/crawl` 立即拉取 |
| 订阅推送 | 订阅页授权 + 服务端 `pushDailyJobs()` | 配置微信订阅模板后，每日给订阅用户推送匹配岗位 |

## 配置项（环境变量）

| 变量 | 说明 | 默认 |
|------|------|------|
| `PORT` | 服务端口 | `3000` |
| `DB_PATH` | 数据文件路径 | `./data/jobs.db`（实际生成 `.json`） |
| `CRON` | 抓取调度 cron | `0 8,12,18 * * *` |
| `WX_APP_ID` / `WX_APP_SECRET` | 微信小程序凭据 | 空（不配置则不推送） |
| `WX_SUBSCRIBE_TEMPLATE_ID` | 订阅消息模板 ID | 空 |
| `ADMIN_TOKEN` | 手动触发抓取的鉴权 token（请求头 `x-admin-token`） | 空（不设则不校验） |

## 生产部署

### 后端（任意 Node 16+ 服务器 / 云函数 / 容器）

```bash
# 守护进程示例
PORT=3000 ADMIN_TOKEN=your-secret nohup node app.js > xj-jobs.log 2>&1 &
```

通过 Nginx / Caddy 反向代理成 HTTPS 域名（小程序 request 合法域名必须 https）：

```nginx
server {
  listen 443 ssl;
  server_name jobs.example.com;
  ssl_certificate     /path/cert.pem;
  ssl_certificate_key /path/key.pem;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
  }
}
```

### 小程序上线

1. 在 [微信公众平台](https://mp.weixin.qq.com) 注册小程序，获取 AppID 与 AppSecret，填入服务端 `WX_APP_ID` / `WX_APP_SECRET`
2. 「开发管理 → 服务器域名 → request 合法域名」加入 `https://jobs.example.com`
3. 「功能 → 订阅消息」创建模板（如：`thing1` 标题、`thing2` 摘要、`date3` 时间），把模板 ID 填入 `WX_SUBSCRIBE_TEMPLATE_ID` 与小程序 `app.js` 的 `subscribeTemplateId`
4. 在开发者工具上传代码 → 公众平台提交审核 → 发布

## 添加新数据源

在 [server/crawlers/](server/crawlers/) 新建类继承 `BaseCrawler`，实现 `fetch()` 返回职位数组（字段见下），然后在 [crawlers/index.js](server/crawlers/index.js) 注册即可。

职位字段：`title` `company` `salary` `city` `district` `education` `experience` `job_type` `welfare`(数组) `description` `contact` `phone` `email` `address` `url` `publish_time` `source_id`

## 注意事项

- `demo` 爬虫返回内置示例数据，**生产环境请在 `crawlers/index.js` 中移除 `new DemoCrawler()`**
- `xjrc` 爬虫的选择器为示例骨架，正式上线前请按新疆人才网真实页面结构适配，或对接其官方数据接口
- Boss 直聘等商业平台有反爬，请走官方 OpenAPI 而非页面抓取，避免法律风险
- 数据按职位去重（`source` + `source_id`），重复抓取会更新原记录
- 本存储为单进程 JSON 文件方案，规模 1 万条内无压力；如需更大规模，可改用 SQLite/MySQL，仅替换 [db.js](server/db.js) 一个文件

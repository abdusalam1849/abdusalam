// server/services/subscribe.js
// 微信订阅消息推送

const axios = require('axios');
const config = require('../config');
const db = require('../db');

async function getAccessToken() {
  if (!config.wechat.appId || !config.wechat.appSecret) return null;
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${config.wechat.appId}&secret=${config.wechat.appSecret}`;
  const { data } = await axios.get(url);
  return data.access_token;
}

async function pushDailyJobs() {
  const token = await getAccessToken();
  if (!token) {
    console.warn('未配置微信 appId/secret，跳过订阅推送');
    return;
  }
  const tplId = config.wechat.subscribeTemplateId;
  if (!tplId) {
    console.warn('未配置订阅模板 ID，跳过订阅推送');
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startTs = today.getTime();
  const todayJobs = db.getJobsAfter(startTs);

  for (const sub of db.allSubscribers()) {
    const keywords = (sub.keywords || '').split(',').filter(Boolean);
    let jobs = todayJobs;
    if (sub.city) jobs = jobs.filter(j => j.city === sub.city);
    if (keywords.length) jobs = jobs.filter(j =>
      keywords.some(k => (j.title || '').includes(k) || (j.description || '').includes(k)));
    if (!jobs.length) continue;

    try {
      await axios.post(
        `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${token}`,
        {
          touser: sub.openid,
          template_id: tplId,
          page: 'pages/index/index',
          data: {
            thing1: { value: '新疆岗位更新' },
            thing2: { value: `今日新增 ${todayJobs.length} 条` },
            date3: { value: new Date().toLocaleString('zh-CN', { hour12: false }) }
          }
        }
      );
    } catch (e) {
      console.error('推送失败', e.message);
    }
  }
}

module.exports = { pushDailyJobs };

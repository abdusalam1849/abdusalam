// miniprogram/app.js
App({
  globalData: {
    // 部署后改成你的 https 域名（需在小程序后台 request 合法域名中加入）
    apiBase: 'http://localhost:3000',
    subscribeTemplateId: '' // 在微信公众平台-订阅消息中创建后填入
  },
  onLaunch() {
    console.log('XJ-Jobs 小程序启动');
  }
});

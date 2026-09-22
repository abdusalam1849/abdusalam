// miniprogram/pages/subscribe/subscribe.js
// 订阅页：调起订阅消息授权 + 上报关键词/城市
const api = require('../../utils/request');
const app = getApp();

Page({
  data: { openid: '', keywords: '', city: '', subscribed: false, loading: false },
  onLoad() {
    // 实际项目应使用 wx.login -> code2session 拿到 openid
    // 这里先用本地随机 ID 占位，便于离线联调
    let oid = wx.getStorageSync('openid');
    if (!oid) { oid = 'demo_' + Math.random().toString(36).slice(2, 10); wx.setStorageSync('openid', oid); }
    this.setData({ openid: oid });
    this.load();
  },
  async load() {
    try {
      const sub = await api.getSubscribe(this.data.openid);
      if (sub) this.setData({ keywords: sub.keywords || '', city: sub.city || '', subscribed: true });
    } catch (e) {}
  },
  onKeyInput(e) { this.setData({ keywords: e.detail.value }); },
  onCityInput(e) { this.setData({ city: e.detail.value }); },
  async submit() {
    if (!this.data.keywords && !this.data.city) {
      return wx.showToast({ title: '请填写关键词或城市', icon: 'none' });
    }
    this.setData({ loading: true });
    // 1. 调起订阅消息授权（每日推送 1 次）
    const tplId = app.globalData.subscribeTemplateId;
    if (tplId) {
      wx.requestSubscribeMessage({
        tmplIds: [tplId],
        success: () => this.saveSubscribe(),
        fail: () => { wx.showToast({ title: '已跳过授权，仍保存偏好', icon: 'none' }); this.saveSubscribe(); }
      });
    } else {
      await this.saveSubscribe();
    }
  },
  async saveSubscribe() {
    try {
      await api.subscribe({
        openid: this.data.openid,
        keywords: this.data.keywords,
        city: this.data.city
      });
      this.setData({ subscribed: true, loading: false });
      wx.showToast({ title: '订阅成功', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '保存失败', icon: 'none' });
      this.setData({ loading: false });
    }
  }
});

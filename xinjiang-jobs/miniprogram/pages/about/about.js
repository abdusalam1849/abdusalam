// miniprogram/pages/about/about.js
const api = require('../../utils/request');
const { dateTime } = require('../../utils/format');
Page({
  data: { status: null, lastText: '—' },
  onLoad() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  async load() {
    try {
      const s = await api.status();
      this.setData({ status: s, lastText: dateTime(s.lastUpdateAt) });
    } catch (e) {
      wx.showToast({ title: '服务不可达', icon: 'none' });
    }
  },
  triggerCrawl() {
    wx.showModal({
      title: '手动触发',
      content: '将立即拉取最新岗位，确认吗？',
      success: (r) => {
        if (!r.confirm) return;
        wx.showLoading({ title: '触发中...' });
        api.crawl().then(() => {
          wx.hideLoading();
          wx.showToast({ title: '已触发', icon: 'success' });
          setTimeout(() => this.load(), 3000);
        }).catch(() => {
          wx.hideLoading();
          wx.showToast({ title: '触发失败', icon: 'none' });
        });
      }
    });
  }
});

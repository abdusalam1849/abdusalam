// miniprogram/pages/detail/detail.js
const api = require('../../utils/request');
const { dateTime } = require('../../utils/format');

Page({
  data: { job: null, loading: true },
  onLoad(opts) { this.load(opts.id); },
  async load(id) {
    try {
      const job = await api.jobDetail(id);
      this.setData({
        job: {
          ...job,
          welfare: job.welfare || [],
          publishText: job.publish_time ? '发布于 ' + job.publish_time : '实时抓取'
        },
        loading: false
      });
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },
  copyPhone() {
    if (!this.data.job || !this.data.job.phone) return;
    wx.setClipboardData({ data: this.data.job.phone });
  },
  openSource() {
    const url = this.data.job && this.data.job.url;
    if (!url) return wx.showToast({ title: '无原文链接', icon: 'none' });
    // 站外链接在小程序中无法直接打开，复制到剪贴板
    wx.setClipboardData({ data: url, success: () => wx.showToast({ title: '链接已复制' }) });
  }
});

// miniprogram/pages/index/index.js
// 首页：岗位列表 + 下拉刷新 + 触底分页

const api = require('../../utils/request');
const { timeAgo, dateTime } = require('../../utils/format');

Page({
  data: {
    list: [],
    page: 1,
    pageSize: 20,
    total: 0,
    loading: false,
    noMore: false,
    lastUpdateAt: 0,
    lastUpdateText: '加载中...'
  },

  onLoad() { this.refresh(); },

  onPullDownRefresh() {
    // 下拉刷新 = 实时更新
    this.refresh().finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.noMore || this.data.loading) return;
    this.loadMore();
  },

  async refresh() {
    this.setData({ page: 1, list: [], noMore: false });
    return this.loadJobs();
  },

  async loadMore() {
    if (this.data.noMore || this.data.loading) return;
    this.setData({ page: this.data.page + 1 });
    await this.loadJobs(true);
  },

  async loadJobs(append = false) {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const data = await api.listJobs({
        page: this.data.page,
        pageSize: this.data.pageSize
      });
      const mapped = data.list.map(j => ({ ...j, ago: timeAgo(j.created_at) }));
      const merged = append ? this.data.list.concat(mapped) : mapped;
      this.setData({
        list: merged,
        total: data.total,
        noMore: merged.length >= data.total,
        lastUpdateAt: data.lastUpdateAt,
        lastUpdateText: '更新于 ' + dateTime(data.lastUpdateAt)
      });
    } catch (e) {
      wx.showToast({ title: e.msg || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  goDetail(e) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${e.currentTarget.dataset.id}` });
  },

  tapFilter() {
    wx.switchTab({ url: '/pages/search/search' });
  }
});

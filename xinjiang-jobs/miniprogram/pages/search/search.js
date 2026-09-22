// miniprogram/pages/search/search.js
const api = require('../../utils/request');
const { timeAgo } = require('../../utils/format');

Page({
  data: {
    keyword: '',
    city: '',
    job_type: '',
    cityList: [],
    jobTypes: ['全职', '兼职', '实习'],
    list: [],
    total: 0,
    showCity: false,
    showType: false,
    loading: false
  },
  onLoad() {
    this.loadCities();
    this.search();
  },
  async loadCities() {
    try {
      const cities = await api.cities();
      this.setData({ cityList: cities });
    } catch (e) {}
  },
  onInput(e) { this.setData({ keyword: e.detail.value }); },
  pickCity(e) { this.setData({ city: e.currentTarget.dataset.city, showCity: false }); this.search(); },
  pickType(e) { this.setData({ job_type: e.currentTarget.dataset.t, showType: false }); this.search(); },
  toggleCity() { this.setData({ showCity: !this.data.showCity }); },
  toggleType() { this.setData({ showType: !this.data.showType }); },
  clearCity() { this.setData({ city: '', showCity: false }); this.search(); },
  clearType() { this.setData({ job_type: '', showType: false }); this.search(); },
  async search() {
    this.setData({ loading: true });
    try {
      const data = await api.listJobs({
        keyword: this.data.keyword,
        city: this.data.city,
        job_type: this.data.job_type,
        page: 1, pageSize: 50
      });
      this.setData({
        list: data.list.map(j => ({ ...j, ago: timeAgo(j.created_at) })),
        total: data.total, loading: false
      });
    } catch (e) {
      wx.showToast({ title: '查询失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },
  goDetail(e) { wx.navigateTo({ url: `/pages/detail/detail?id=${e.currentTarget.dataset.id}` }); }
});

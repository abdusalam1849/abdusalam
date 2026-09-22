// miniprogram/utils/request.js
// 统一网络请求封装

const app = getApp();

function request(path, opts = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: app.globalData.apiBase + path,
      method: opts.method || 'GET',
      data: opts.data || {},
      header: { 'content-type': 'application/json', ...(opts.header || {}) },
      success: (res) => {
        if (res.statusCode === 200 && res.data.code === 0) {
          resolve(res.data.data);
        } else {
          reject(res.data || res);
        }
      },
      fail: reject
    });
  });
}

const api = {
  listJobs: (params) => request(`/api/jobs/list?${buildQuery(params)}`),
  jobDetail: (id) => request(`/api/jobs/${id}`),
  cities: () => request('/api/jobs/cities/list'),
  status: () => request('/api/system/status'),
  crawl: () => request('/api/system/crawl', { method: 'POST' }),
  subscribe: (data) => request('/api/subscribe', { method: 'POST', data }),
  getSubscribe: (openid) => request(`/api/subscribe?openid=${encodeURIComponent(openid)}`)
};

function buildQuery(params = {}) {
  return Object.keys(params)
    .filter(k => params[k] !== '' && params[k] !== undefined && params[k] !== null)
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');
}

module.exports = api;

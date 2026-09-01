const app = getApp()

Page({
  data: {
    searchKeyword: '',
    theme: 'dark',
    banners: [
      { id: 1, title: '全新正式版', desc: '黑白双主题 + 真实数据统计，已可上架', color: 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)' },
      { id: 2, title: '会员特惠', desc: '解锁全部VIP工具', color: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)' },
      { id: 3, title: '24 个工具', desc: '覆盖生活/计算/财务/文本全场景', color: 'linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)' }
    ],
    quickTools: [],
    hotTools: [],
    historyTools: [],
    favorites: [],
    stats: {
      toolCount: 0,
      categoryCount: 6,
      userCount: '加载中'
    }
  },

  onLoad() {
    // 主题监听
    this._themeFn = (theme) => {
      this.setData({ theme })
    }
    app.onThemeChange(this._themeFn)
    this.setData({ theme: app.globalData.theme })
    this.initData()
    this.loadRealTimeStats()
  },

  onUnload() {
    app.offThemeChange(this._themeFn)
  },

  onShow() {
    this.loadHistory()
    this.loadFavorites()
    this.refreshUsage()
  },

  initData() {
    const { getHotTools, enrichToolsWithUsage, TOOLS } = require('../../utils/tools-data.js')
    const hot = getHotTools(6)
    const quickIds = ['calculator','bmi','unit-convert','currency','notes','countdown','qr-code','random','pomodoro','discount','base-convert','char-count']
    const quick = enrichToolsWithUsage(quickIds.map(id => TOOLS.find(t => t.id === id)).filter(Boolean))
    this.setData({
      hotTools: hot,
      quickTools: quick,
      'stats.toolCount': TOOLS.length
    })
  },

  // 实时统计：用户数（云端聚合，无云则回退本地累计使用数）
  loadRealTimeStats() {
    app.fetchCloudUsageCounts((ok, counts) => {
      const totalUsage = Object.values(counts).reduce((s, v) => s + v, 0)
      // 云端返回 totalUsers 时使用真实去重用户数；否则以本地累计使用次数兜底
      let userCount
      if (ok && typeof counts.totalUsers === 'number' && counts.totalUsers > 0) {
        userCount = this.fmtUserCount(counts.totalUsers)
      } else {
        userCount = totalUsage > 0 ? this.fmtUserCount(totalUsage) : '新上线'
      }
      this.setData({ 'stats.userCount': userCount })
    })
  },

  fmtUserCount(n) {
    if (n < 100) return n + ' 位'
    if (n < 1000) return Math.floor(n / 100) * 100 + '+ 位'
    if (n < 10000) return Math.floor(n / 1000) + 'k+ 位'
    return Math.floor(n / 10000) + '万+ 位'
  },

  // 使用计数刷新（工具列表中实时显示真实使用次数）
  refreshUsage() {
    const { getHotTools, enrichToolsWithUsage, TOOLS } = require('../../utils/tools-data.js')
    app.fetchCloudUsageCounts((ok, counts) => {
      const merged = ok ? counts : app.getAllUsageCounts()
      const hot = getHotTools(6, merged)
      const quickIds = ['calculator','bmi','unit-convert','currency','notes','countdown','qr-code','random','pomodoro','discount','base-convert','char-count']
      const quick = enrichToolsWithUsage(quickIds.map(id => TOOLS.find(t => t.id === id)).filter(Boolean), merged)
      this.setData({ hotTools: hot, quickTools: quick })
      this.loadRealTimeStats()
    })
  },

  loadHistory() {
    const history = wx.getStorageSync('history') || []
    this.setData({
      historyTools: history.slice(0, 6)
    })
  },

  loadFavorites() {
    const favorites = wx.getStorageSync('favorites') || []
    this.setData({
      favorites: favorites.slice(0, 6)
    })
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value })
  },

  onSearchConfirm() {
    const { searchKeyword } = this.data
    if (!searchKeyword.trim()) return
    wx.switchTab({
      url: '/pages/category/category',
      success: () => {
        const pages = getCurrentPages()
        const catPage = pages[pages.length - 1]
        if (catPage && catPage.searchFromHome) {
          catPage.searchFromHome(searchKeyword)
        }
      }
    })
  },

  goToTool(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/tool-detail/tool-detail?id=${id}`
    })
  },

  goToCategory(e) {
    const id = e.currentTarget.dataset.id || ''
    wx.switchTab({
      url: '/pages/category/category'
    })
  },

  viewAllHistory() {
    wx.switchTab({ url: '/pages/mine/mine' })
  },

  viewAllFavorites() {
    wx.switchTab({ url: '/pages/cart/cart' })
  },

  onPullDownRefresh() {
    this.initData()
    this.loadHistory()
    this.loadFavorites()
    this.refreshUsage()
    wx.stopPullDownRefresh()
  },

  onShareAppMessage() {
    return {
      title: 'Abdusalam 工具箱 · 黑白双主题，真实数据无虚标',
      path: '/pages/index/index'
    }
  }
})

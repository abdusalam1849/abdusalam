Page({
  data: {
    searchKeyword: '',
    banners: [
      { id: 1, title: '新版上线', desc: '20+ 工具全新升级', color: 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)' },
      { id: 2, title: '会员特惠', desc: '解锁全部VIP工具', color: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)' },
      { id: 3, title: '年度推荐', desc: '百万用户的共同选择', color: 'linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)' }
    ],
    quickTools: [],
    hotTools: [],
    historyTools: [],
    favorites: [],
    stats: {
      toolCount: 20,
      categoryCount: 6,
      userCount: '1280万+'
    }
  },

  onLoad() {
    this.initData()
  },

  onShow() {
    this.loadHistory()
    this.loadFavorites()
  },

  initData() {
    const { getHotTools, TOOLS } = require('../../utils/tools-data.js')
    const hot = getHotTools(8)
    const quick = TOOLS.slice(0, 8)
    this.setData({
      hotTools: hot,
      quickTools: quick
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
    wx.stopPullDownRefresh()
  }
})

const app = getApp()
const { CATEGORIES, getToolsByCategory, searchTools, enrichToolsWithUsage, TOOLS } = require('../../utils/tools-data.js')

Page({
  data: {
    theme: 'dark',
    activeCategory: 'all',
    searchKeyword: '',
    isSearching: false,
    categories: [],
    tools: [],
    searchResults: []
  },

  onLoad() {
    // 主题监听
    this._themeFn = (theme) => { this.setData({ theme }) }
    app.onThemeChange(this._themeFn)
    this.setData({
      theme: app.globalData.theme,
      categories: [{ id: 'all', name: '全部', icon: '🎯', desc: '查看所有工具', color: 'linear-gradient(135deg, #7c3aed, #5b21b6)' }, ...CATEGORIES],
      tools: enrichToolsWithUsage(TOOLS)
    })
  },

  onUnload() {
    app.offThemeChange(this._themeFn)
  },

  onShow() {
    // 每次进入刷新真实使用次数
    this.refreshUsage()
    this.setData({ theme: app.globalData.theme })
  },

  refreshUsage() {
    app.fetchCloudUsageCounts((ok, counts) => {
      const merged = ok ? counts : app.getAllUsageCounts()
      this.setData({
        tools: getToolsByCategory(this.data.activeCategory, merged),
        searchResults: this.data.searchKeyword ? searchTools(this.data.searchKeyword, merged) : []
      })
    })
  },

  // 供首页搜索跳转调用
  searchFromHome(keyword) {
    this.setData({
      searchKeyword: keyword,
      isSearching: !!keyword
    })
    this.doSearch(keyword)
  },

  switchCategory(e) {
    const id = e.currentTarget.dataset.id
    const tools = getToolsByCategory(id, app.getAllUsageCounts())
    this.setData({
      activeCategory: id,
      tools
    })
  },

  onSearchInput(e) {
    const val = e.detail.value
    this.setData({
      searchKeyword: val,
      isSearching: !!val
    })
    if (val) {
      this.doSearch(val)
    }
  },

  doSearch(kw) {
    const results = searchTools(kw, app.getAllUsageCounts())
    this.setData({ searchResults: results })
  },

  clearSearch() {
    this.setData({
      searchKeyword: '',
      isSearching: false,
      searchResults: []
    })
  },

  goToTool(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/tool-detail/tool-detail?id=${id}`
    })
  }
})

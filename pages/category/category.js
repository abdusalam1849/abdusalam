const { CATEGORIES, getToolsByCategory, searchTools, TOOLS } = require('../../utils/tools-data.js')

Page({
  data: {
    activeCategory: 'all',
    searchKeyword: '',
    isSearching: false,
    categories: [],
    tools: [],
    searchResults: []
  },

  onLoad() {
    this.setData({
      categories: [{ id: 'all', name: '全部', icon: '🎯', desc: '查看所有工具', color: 'linear-gradient(135deg, #7c3aed, #5b21b6)' }, ...CATEGORIES],
      tools: TOOLS
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
    const tools = getToolsByCategory(id)
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
    const results = searchTools(kw)
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

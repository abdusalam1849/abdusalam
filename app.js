App({
  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 初始化收藏数据
    const favorites = wx.getStorageSync('favorites')
    if (!favorites) {
      wx.setStorageSync('favorites', [])
    }

    // 初始化使用历史
    const history = wx.getStorageSync('history')
    if (!history) {
      wx.setStorageSync('history', [])
    }

    // 初始化会员状态
    const isVip = wx.getStorageSync('isVip')
    if (isVip === '') {
      wx.setStorageSync('isVip', false)
    }
  },

  globalData: {
    userInfo: null,
    appName: 'Abdusalam 工具箱',
    version: '1.0.0'
  },

  // 工具方法：添加到历史记录
  addHistory(tool) {
    const history = wx.getStorageSync('history') || []
    const idx = history.findIndex(i => i.id === tool.id)
    if (idx > -1) {
      history.splice(idx, 1)
    }
    history.unshift({
      id: tool.id,
      name: tool.name,
      icon: tool.icon,
      time: Date.now()
    })
    // 只保留最近20条
    if (history.length > 20) {
      history.length = 20
    }
    wx.setStorageSync('history', history)
  },

  // 工具方法：切换收藏状态
  toggleFavorite(tool) {
    const favorites = wx.getStorageSync('favorites') || []
    const idx = favorites.findIndex(i => i.id === tool.id)
    if (idx > -1) {
      favorites.splice(idx, 1)
      wx.setStorageSync('favorites', favorites)
      return false
    } else {
      favorites.unshift({
        id: tool.id,
        name: tool.name,
        icon: tool.icon,
        desc: tool.desc,
        category: tool.category,
        isVip: tool.isVip || false,
        time: Date.now()
      })
      wx.setStorageSync('favorites', favorites)
      return true
    }
  },

  // 检查是否已收藏
  isFavorite(toolId) {
    const favorites = wx.getStorageSync('favorites') || []
    return favorites.some(i => i.id === toolId)
  }
})

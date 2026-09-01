// Abdusalam 工具箱 - 正式版
App({
  onLaunch() {
    // 初始化本地存储
    this.initStorage()

    // 初始化云开发（如已配置）
    if (wx.cloud) {
      try {
        wx.cloud.init({ traceUser: true })
        this.globalData.cloudReady = true
      } catch(e) {
        this.globalData.cloudReady = false
      }
    }

    // 加载主题设置
    const theme = wx.getStorageSync('theme') || 'dark'
    this.globalData.theme = theme
    this.applyTheme(theme)

    // 加载会员状态
    this.globalData.isVip = wx.getStorageSync('isVip') || false

    // 上报活跃用户
    this.reportActive()
  },

  globalData: {
    userInfo: null,
    appName: 'Abdusalam 工具箱',
    version: '2.0.0',
    theme: 'dark',
    isVip: false,
    cloudReady: false,
    themeListeners: []
  },

  // 初始化本地存储
  initStorage() {
    if (wx.getStorageSync('favorites') === '') wx.setStorageSync('favorites', [])
    if (wx.getStorageSync('history') === '') wx.setStorageSync('history', [])
    if (wx.getStorageSync('isVip') === '') wx.setStorageSync('isVip', false)
    if (wx.getStorageSync('theme') === '') wx.setStorageSync('theme', 'dark')
    if (wx.getStorageSync('tool_usage') === '') wx.setStorageSync('tool_usage', {})
  },

  // ========== 主题管理 ==========
  applyTheme(theme) {
    this.globalData.theme = theme
    wx.setStorageSync('theme', theme)

    // 设置导航栏 / 标签栏颜色（黑色 / 白色两套）
    if (theme === 'light') {
      wx.setNavigationBarColor({ frontColor: '#000000', backgroundColor: '#ffffff' })
      wx.setBackgroundColor({ backgroundColor: '#ffffff' })
      wx.setTabBarStyle({ color: '#9a9a9a', selectedColor: '#7c3aed', backgroundColor: '#ffffff', borderStyle: 'white' })
    } else {
      wx.setNavigationBarColor({ frontColor: '#ffffff', backgroundColor: '#000000' })
      wx.setBackgroundColor({ backgroundColor: '#000000' })
      wx.setTabBarStyle({ color: '#6e6e6e', selectedColor: '#7c3aed', backgroundColor: '#0a0a0a', borderStyle: 'black' })
    }

    // 通知所有页面
    this.globalData.themeListeners.forEach(fn => fn(theme))
  },

  setTheme(theme) {
    this.applyTheme(theme)
  },

  toggleTheme() {
    const next = this.globalData.theme === 'dark' ? 'light' : 'dark'
    this.applyTheme(next)
    return next
  },

  onThemeChange(fn) {
    this.globalData.themeListeners.push(fn)
  },

  offThemeChange(fn) {
    const idx = this.globalData.themeListeners.indexOf(fn)
    if (idx > -1) this.globalData.themeListeners.splice(idx, 1)
  },

  // ========== 使用统计（真实数据）==========
  // 记录工具使用次数到本地
  recordToolUsage(toolId) {
    const usage = wx.getStorageSync('tool_usage') || {}
    usage[toolId] = (usage[toolId] || 0) + 1
    wx.setStorageSync('tool_usage', usage)

    // 如果云开发可用，上报到云端
    if (this.globalData.cloudReady) {
      wx.cloud.callFunction({
        name: 'trackUsage',
        data: { toolId, action: 'use' },
        fail: () => {} // 静默失败，不影响用户体验
      })
    }
  },

  // 获取工具的真实使用次数
  getToolUsageCount(toolId) {
    const usage = wx.getStorageSync('tool_usage') || {}
    return usage[toolId] || 0
  },

  // 获取全部工具的使用次数（本地真实数据）
  getAllUsageCounts() {
    return wx.getStorageSync('tool_usage') || {}
  },

  // 获取云端聚合使用次数（实时，跨用户）。无云则回退本地计数。
  // 回调式：fn(success, counts)
  fetchCloudUsageCounts(cb) {
    if (!this.globalData.cloudReady) {
      cb && cb(false, this.getAllUsageCounts())
      return
    }
    wx.cloud.callFunction({
      name: 'trackUsage',
      data: { action: 'getAll' },
      success: (res) => {
        const counts = (res.result && res.result.counts) || {}
        // 合并：云端为主，本地补充未上报的
        const local = this.getAllUsageCounts()
        const merged = Object.assign({}, local, counts)
        cb && cb(true, merged)
      },
      fail: () => {
        cb && cb(false, this.getAllUsageCounts())
      }
    })
  },

  // 上报活跃用户（去重，每日一次）
  reportActive() {
    const today = new Date().toDateString()
    const lastReport = wx.getStorageSync('last_active_date')
    if (lastReport === today) return

    wx.setStorageSync('last_active_date', today)

    if (this.globalData.cloudReady) {
      wx.cloud.callFunction({
        name: 'trackUsage',
        data: { action: 'active' },
        fail: () => {}
      })
    }
  },

  // ========== 工具方法 ==========
  addHistory(tool) {
    const history = wx.getStorageSync('history') || []
    const idx = history.findIndex(i => i.id === tool.id)
    if (idx > -1) history.splice(idx, 1)
    history.unshift({ id: tool.id, name: tool.name, icon: tool.icon, time: Date.now() })
    if (history.length > 20) history.length = 20
    wx.setStorageSync('history', history)

    // 记录使用次数
    this.recordToolUsage(tool.id)
  },

  toggleFavorite(tool) {
    const favorites = wx.getStorageSync('favorites') || []
    const idx = favorites.findIndex(i => i.id === tool.id)
    if (idx > -1) {
      favorites.splice(idx, 1)
      wx.setStorageSync('favorites', favorites)
      return false
    } else {
      favorites.unshift({
        id: tool.id, name: tool.name, icon: tool.icon,
        desc: tool.desc, category: tool.category,
        isVip: tool.isVip || false, time: Date.now()
      })
      wx.setStorageSync('favorites', favorites)
      return true
    }
  },

  isFavorite(toolId) {
    const favorites = wx.getStorageSync('favorites') || []
    return favorites.some(i => i.id === toolId)
  }
})

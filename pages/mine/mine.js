const app = getApp()
const { TOOLS, formatUsage, getUsageCount } = require('../../utils/tools-data.js')

Page({
  data: {
    userInfo: null,
    hasUserInfo: false,
    isVip: false,
    historyCount: 0,
    favoriteCount: 0,
    toolCount: 0,
    totalUsage: 0,
    history: [],
    theme: 'dark',
    menuGroups: [],
    showHistory: false
  },

  onLoad() {
    // 监听主题变化
    this._themeFn = (theme) => {
      this.setData({ theme })
    }
    app.onThemeChange(this._themeFn)
  },

  onUnload() {
    app.offThemeChange(this._themeFn)
  },

  onShow() {
    this.loadData()
    this.loadCloudStats()
    this.setData({ theme: app.globalData.theme })
  },

  loadData() {
    const userInfo = wx.getStorageSync('userInfo') || null
    const isVip = wx.getStorageSync('isVip') || false
    const history = wx.getStorageSync('history') || []
    const favorites = wx.getStorageSync('favorites') || []
    // 本地累计使用次数（兜底，先渲染）
    const usage = app.getAllUsageCounts()
    const totalUsage = Object.values(usage).reduce((sum, v) => sum + v, 0)

    // 使用历史时间格式化
    const fmtHistory = history.map(h => ({
      ...h,
      timeStr: this.fmtTime(h.time)
    }))

    const menuGroups = [
      {
        groupTitle: '数据管理',
        items: [
          { id: 'history', icon: '🕒', name: '使用历史', desc: '最近使用的工具记录', badge: history.length > 0 ? String(history.length) : '', action: 'toggleHistory' },
          { id: 'favorites', icon: '⭐', name: '我的收藏', desc: '收藏过的所有工具', badge: favorites.length > 0 ? String(favorites.length) : '', action: 'goFavorites' },
          { id: 'clear', icon: '🗑️', name: '清空缓存', desc: '清理本地数据和缓存', badge: '', action: 'clearCache' }
        ]
      },
      {
        groupTitle: '个性化',
        items: [
          { id: 'theme', icon: app.globalData.theme === 'dark' ? '🌙' : '☀️', name: '主题切换', desc: app.globalData.theme === 'dark' ? '当前：暗色模式' : '当前：亮色模式', badge: '', action: 'toggleTheme', isSwitch: true, switchChecked: app.globalData.theme === 'light' },
          { id: 'lang', icon: '🌐', name: '语言设置', desc: '简体中文 / English', badge: '中文', action: 'openLang' },
          { id: 'notify', icon: '🔔', name: '消息通知', desc: '工具提醒与推送', badge: '开', action: 'openNotify' }
        ]
      },
      {
        groupTitle: '关于',
        items: [
          { id: 'about', icon: 'ℹ️', name: '关于 Abdusalam', desc: '版本 ' + app.globalData.version, badge: '', action: 'openAbout' },
          { id: 'rate', icon: '⭐', name: '给个好评', desc: '支持作者持续更新', badge: '', action: 'rateUs' },
          { id: 'share', icon: '📤', name: '分享给朋友', desc: '好工具值得被更多人知道', badge: '', action: 'shareApp' },
          { id: 'feedback', icon: '💬', name: '意见反馈', desc: '帮助我们变得更好', badge: '', action: 'openFeedback' }
        ]
      }
    ]

    this.setData({
      userInfo,
      hasUserInfo: !!userInfo,
      isVip,
      history: fmtHistory,
      historyCount: history.length,
      favoriteCount: favorites.length,
      toolCount: TOOLS.length,
      totalUsage,
      menuGroups
    })
  },

  fmtTime(ts) {
    const d = new Date(ts)
    const now = new Date()
    const diff = now - d
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
    const pad = n => String(n).padStart(2, '0')
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  },

  // 拉取云端聚合使用次数（实时跨用户）。无云则保持本地累计。
  loadCloudStats() {
    app.fetchCloudUsageCounts((ok, counts) => {
      const merged = counts || app.getAllUsageCounts()
      const totalUsage = Object.values(merged).reduce((s, v) => s + (Number(v) || 0), 0)
      this.setData({ totalUsage })
    })
  },

  // 主题切换
  toggleTheme() {
    const next = app.toggleTheme()
    wx.showToast({
      title: next === 'dark' ? '🌙 已切换暗色' : '☀️ 已切换亮色',
      icon: 'none'
    })
    this.loadData()
  },

  onLogin() {
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        wx.setStorageSync('userInfo', res.userInfo)
        this.setData({ userInfo: res.userInfo, hasUserInfo: true })
        wx.showToast({ title: '登录成功', icon: 'success' })
      },
      fail: () => {
        const mockUser = { nickName: 'Abdusalam 用户', avatarUrl: '', gender: 0 }
        wx.setStorageSync('userInfo', mockUser)
        this.setData({ userInfo: mockUser, hasUserInfo: true })
        wx.showToast({ title: '欢迎使用', icon: 'success' })
      }
    })
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？本地收藏和历史仍会保留。',
      confirmColor: '#dc2626',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('userInfo')
          this.setData({ userInfo: null, hasUserInfo: false })
          wx.showToast({ title: '已退出', icon: 'none' })
        }
      }
    })
  },

  onMenuAction(e) {
    const action = e.currentTarget.dataset.action
    if (this[action]) {
      this[action]()
    } else {
      wx.showToast({ title: '功能开发中...', icon: 'none' })
    }
  },

  toggleHistory() {
    this.setData({ showHistory: !this.data.showHistory })
  },

  goFavorites() {
    wx.switchTab({ url: '/pages/cart/cart' })
  },

  clearCache() {
    wx.showModal({
      title: '清空缓存',
      content: '将清除使用历史和统计。收藏数据将保留。确定继续？',
      confirmColor: '#dc2626',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('history')
          wx.removeStorageSync('logs')
          wx.removeStorageSync('tool_usage')
          wx.showToast({ title: '清理完成', icon: 'success' })
          this.loadData()
        }
      }
    })
  },

  openLang() {
    wx.showActionSheet({
      itemList: ['🇨🇳 简体中文（当前）', '🇺🇸 English', '🇯🇵 日本語'],
      success: () => wx.showToast({ title: '已设置', icon: 'success' })
    })
  },

  openNotify() {
    wx.showActionSheet({
      itemList: ['✅ 开启通知（当前）', '❌ 关闭所有通知'],
      success: () => wx.showToast({ title: '已更新', icon: 'success' })
    })
  },

  openAbout() {
    wx.showModal({
      title: 'Abdusalam 工具箱',
      content: '版本: ' + app.globalData.version + '\n\n一款专为日常需求打造的全能工具箱，包含' + TOOLS.length + '个实用工具。\n\n功能特点：\n· 暗色/亮色双主题\n· 真实使用统计\n· 本地数据持久化\n· 云端数据同步\n\n© 2024 Abdusalam Studio',
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#7c3aed'
    })
  },

  rateUs() {
    wx.showModal({
      title: '给个好评',
      content: '如果这个小程序对你有帮助，欢迎给个五星好评，感谢支持！',
      confirmText: '去好评',
      confirmColor: '#d97706',
      success: (res) => {
        if (res.confirm) wx.showToast({ title: '❤️ 感谢！', icon: 'none' })
      }
    })
  },

  openFeedback() {
    wx.showModal({
      title: '意见反馈',
      editable: true,
      placeholderText: '请输入你的建议或遇到的问题...',
      confirmText: '提交',
      confirmColor: '#7c3aed',
      success: (res) => {
        if (res.confirm && res.content) {
          wx.showToast({ title: '反馈已收到', icon: 'success' })
        }
      }
    })
  },

  shareApp() {
    wx.showToast({ title: '点击右上角分享', icon: 'none' })
  },

  goToTool(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/tool-detail/tool-detail?id=' + id })
  },

  clearHistoryItem(e) {
    const id = e.currentTarget.dataset.id
    const history = wx.getStorageSync('history') || []
    const newHistory = history.filter(h => h.id !== id)
    wx.setStorageSync('history', newHistory)
    this.loadData()
  },

  onShareAppMessage() {
    return {
      title: 'Abdusalam 工具箱 - ' + TOOLS.length + '个实用工具合集',
      path: '/pages/index/index'
    }
  }
})

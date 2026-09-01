const app = getApp()

Page({
  data: {
    userInfo: null,
    hasUserInfo: false,
    isVip: false,
    historyCount: 0,
    favoriteCount: 0,
    history: [],
    menuGroups: [
      {
        groupTitle: '数据管理',
        items: [
          { id: 'history', icon: '🕒', name: '使用历史', desc: '最近使用的工具记录', badge: '', action: 'toggleHistory' },
          { id: 'favorites', icon: '⭐', name: '我的收藏', desc: '收藏过的所有工具', badge: '', action: 'goFavorites' },
          { id: 'clear', icon: '🗑️', name: '清空缓存', desc: '清理本地数据和缓存', badge: '', action: 'clearCache' }
        ]
      },
      {
        groupTitle: '个性化',
        items: [
          { id: 'theme', icon: '🎨', name: '主题设置', desc: '切换主题风格与配色', badge: '暗色', action: 'openTheme' },
          { id: 'lang', icon: '🌐', name: '语言设置', desc: '简体中文 / English', badge: '中文', action: 'openLang' },
          { id: 'notify', icon: '🔔', name: '消息通知', desc: '工具提醒与推送', badge: '开', action: 'openNotify' }
        ]
      },
      {
        groupTitle: '关于',
        items: [
          { id: 'about', icon: 'ℹ️', name: '关于 Abdusalam', desc: '版本 1.0.0', badge: '', action: 'openAbout' },
          { id: 'rate', icon: '⭐', name: '给个好评', desc: '支持作者持续更新', badge: '', action: 'rateUs' },
          { id: 'share', icon: '📤', name: '分享给朋友', desc: '好工具值得被更多人知道', badge: '', action: 'shareApp' },
          { id: 'feedback', icon: '💬', name: '意见反馈', desc: '帮助我们变得更好', badge: '', action: 'openFeedback' }
        ]
      }
    ],
    showHistory: false
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    const userInfo = wx.getStorageSync('userInfo') || null
    const isVip = wx.getStorageSync('isVip') || false
    const history = wx.getStorageSync('history') || []
    const favorites = wx.getStorageSync('favorites') || []
    const menuGroups = this.data.menuGroups.map(g => {
      if (g.groupTitle === '数据管理') {
        g.items = g.items.map(it => {
          if (it.id === 'history') it.badge = history.length > 0 ? String(history.length) : ''
          if (it.id === 'favorites') it.badge = favorites.length > 0 ? String(favorites.length) : ''
          return it
        })
      }
      return g
    })
    this.setData({
      userInfo,
      hasUserInfo: !!userInfo,
      isVip,
      history,
      historyCount: history.length,
      favoriteCount: favorites.length,
      menuGroups
    })
  },

  // 获取用户信息（微信登录）
  onLogin() {
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        wx.setStorageSync('userInfo', res.userInfo)
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        })
        wx.showToast({ title: '登录成功', icon: 'success' })
      },
      fail: () => {
        // 用模拟数据兜底
        const mockUser = {
          nickName: 'Abdusalam 用户',
          avatarUrl: '',
          gender: 0
        }
        wx.setStorageSync('userInfo', mockUser)
        this.setData({
          userInfo: mockUser,
          hasUserInfo: true
        })
        wx.showToast({ title: '欢迎使用', icon: 'success' })
      }
    })
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？本地收藏和历史仍会保留。',
      confirmColor: '#f87171',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('userInfo')
          this.setData({
            userInfo: null,
            hasUserInfo: false
          })
          wx.showToast({ title: '已退出', icon: 'none' })
        }
      }
    })
  },

  // 菜单项点击分发
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
      content: '将清除使用历史。收藏数据将保留。确定继续？',
      confirmColor: '#f87171',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('history')
          wx.removeStorageSync('logs')
          wx.showToast({ title: '清理完成', icon: 'success' })
          this.loadData()
        }
      }
    })
  },

  openTheme() {
    wx.showActionSheet({
      itemList: ['🌙 暗色模式（当前）', '☀️ 浅色模式', '🌿 跟随系统'],
      success: (res) => {
        wx.showToast({ title: '已保存设置', icon: 'success' })
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
      content: '版本: 1.0.0\n\n一款专为你的日常需求打造的全能工具箱应用，包含20+实用工具，无需下载多个APP，一个就够。\n\n© 2024 Abdusalam Studio',
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#7c3aed'
    })
  },

  rateUs() {
    wx.showModal({
      title: '给个好评',
      content: '如果这个小程序对你有帮助，欢迎在微信小程序商店给个五星好评，感谢你的支持！',
      confirmText: '去好评',
      confirmColor: '#fbbf24',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: '❤️ 感谢！', icon: 'none' })
        }
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
    wx.navigateTo({
      url: `/pages/tool-detail/tool-detail?id=${id}`
    })
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
      title: 'Abdusalam 工具箱 - 20+ 实用工具合集',
      path: '/pages/index/index'
    }
  }
})

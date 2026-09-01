const app = getApp()
const { getToolById, TOOLS } = require('../../utils/tools-data.js')

Page({
  data: {
    favorites: [],
    isVip: false,
    vipPlans: [
      { id: 'month', name: '月度会员', price: '12', original: '18', unit: '/月', tag: '灵活', highlight: false },
      { id: 'year', name: '年度会员', price: '98', original: '216', unit: '/年', tag: '超值', highlight: true },
      { id: 'forever', name: '永久会员', price: '298', original: '598', unit: '元', tag: '划算', highlight: false }
    ],
    vipFeatures: [
      { icon: '🔓', title: '解锁全部VIP工具', desc: '10+ 高级工具免费使用' },
      { icon: '⚡', title: '优先体验新功能', desc: '内测新工具抢先体验' },
      { icon: '☁️', title: '云端数据同步', desc: '多设备数据无缝同步' },
      { icon: '🚫', title: '纯净无广告', desc: '去除所有广告打扰' },
      { icon: '💎', title: '专属客服支持', desc: '7x24小时VIP专属服务' },
      { icon: '🎁', title: '会员专属礼包', desc: '每月会员福利领取' }
    ],
    showVipModal: false
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    const favorites = wx.getStorageSync('favorites') || []
    const isVip = wx.getStorageSync('isVip') || false
    this.setData({
      favorites,
      isVip
    })
  },

  goToTool(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/tool-detail/tool-detail?id=${id}`
    })
  },

  removeFavorite(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '移除收藏',
      content: '确定要将该工具从收藏中移除吗？',
      confirmColor: '#7c3aed',
      success: (res) => {
        if (res.confirm) {
          const tool = getToolById(id)
          if (tool) {
            app.toggleFavorite(tool)
          }
          this.loadData()
          wx.showToast({ title: '已移除', icon: 'none' })
        }
      }
    })
  },

  openVipModal() {
    this.setData({ showVipModal: true })
  },

  closeVipModal() {
    this.setData({ showVipModal: false })
  },

  selectPlan(e) {
    const planId = e.currentTarget.dataset.id
    const plan = this.data.vipPlans.find(p => p.id === planId)
    wx.showModal({
      title: `开通${plan.name}`,
      content: `将支付 ¥${plan.price} 购买${plan.name}，是否继续？`,
      confirmColor: '#f59e0b',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '支付中...' })
          setTimeout(() => {
            wx.hideLoading()
            wx.setStorageSync('isVip', true)
            this.setData({
              isVip: true,
              showVipModal: false
            })
            wx.showToast({ title: '开通成功！', icon: 'success' })
          }, 1200)
        }
      }
    })
  },

  restoreVip() {
    wx.showModal({
      title: '恢复购买',
      content: '将检测之前的购买记录...',
      confirmColor: '#7c3aed',
      success: (res) => {
        if (res.confirm) {
          wx.setStorageSync('isVip', true)
          this.setData({ isVip: true })
          wx.showToast({ title: '已恢复会员', icon: 'success' })
        }
      }
    })
  },

  goExplore() {
    wx.switchTab({ url: '/pages/category/category' })
  }
})

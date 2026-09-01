// 工具数据定义（正式版 - 无虚标数据，使用次数全部实时统计）
const CATEGORIES = [
  {
    id: 'daily',
    name: '日常生活',
    icon: '🏠',
    desc: '日常生活必备小工具',
    color: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)'
  },
  {
    id: 'calculate',
    name: '计算换算',
    icon: '🧮',
    desc: '各类计算与单位换算',
    color: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'
  },
  {
    id: 'finance',
    name: '财务理财',
    icon: '💰',
    desc: '财务相关计算工具',
    color: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
  },
  {
    id: 'text',
    name: '文本处理',
    icon: '📝',
    desc: '文字与编码处理',
    color: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
  },
  {
    id: 'image',
    name: '图片工具',
    icon: '🖼️',
    desc: '图片处理与生成',
    color: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)'
  },
  {
    id: 'device',
    name: '设备功能',
    icon: '📱',
    desc: '利用设备能力的工具',
    color: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
  }
]

const TOOLS = [
  // 日常生活
  { id: 'calculator', name: '万能计算器', icon: '🧮', iconClass: 'icon-calc', category: 'calculate', desc: '基础+科学计算，一键解决', isVip: false, hot: true },
  { id: 'unit-convert', name: '单位换算', icon: '📐', iconClass: 'icon-convert', category: 'calculate', desc: '长度/重量/温度等20+种单位', isVip: false, hot: true },
  { id: 'bmi', name: 'BMI 健康计算器', icon: '⚖️', iconClass: 'icon-bmi', category: 'daily', desc: '输入身高体重，分析健康状态', isVip: false, hot: true },
  { id: 'notes', name: '随身备忘录', icon: '📝', iconClass: 'icon-note', category: 'text', desc: '轻量记录，本地加密存储', isVip: false },
  { id: 'countdown', name: '倒计时纪念日', icon: '⏱️', iconClass: 'icon-time', category: 'daily', desc: '重要日子，精准提醒', isVip: false },
  { id: 'weather', name: '天气查询', icon: '🌤️', iconClass: 'icon-weather', category: 'daily', desc: '实时天气，7天预报', isVip: false },
  { id: 'qr-code', name: '二维码生成器', icon: '📱', iconClass: 'icon-qr', category: 'image', desc: '文本/链接快速生成二维码', isVip: false, hot: true },
  { id: 'qr-scan', name: '扫码识别', icon: '🔍', iconClass: 'icon-qr', category: 'image', desc: '扫一扫，识别二维码/条形码', isVip: false },
  { id: 'random', name: '随机数生成器', icon: '🎲', iconClass: 'icon-random', category: 'calculate', desc: '抽奖/抽签/分组随机生成', isVip: false },
  { id: 'compass', name: '指南针', icon: '🧭', iconClass: 'icon-compass', category: 'device', desc: '精准定位方向与海拔', isVip: false },
  { id: 'flashlight', name: '手电筒', icon: '🔦', iconClass: 'icon-flash', category: 'device', desc: '一键开屏亮灯，黑夜好帮手', isVip: false },
  { id: 'id-query', name: '身份证信息查询', icon: '🪪', iconClass: 'icon-id', category: 'daily', desc: '查询归属地/性别/生日', isVip: true },
  { id: 'currency', name: '汇率换算', icon: '💱', iconClass: 'icon-money', category: 'finance', desc: '实时全球货币汇率', isVip: false },
  { id: 'loan', name: '房贷计算器', icon: '🏦', iconClass: 'icon-money', category: 'finance', desc: '等额本息/本金精准计算', isVip: false, hot: true },
  { id: 'tax', name: '个税计算器', icon: '🧾', iconClass: 'icon-money', category: 'finance', desc: '最新个税计算标准', isVip: false },
  { id: 'tip', name: '小费分摊计算', icon: '💵', iconClass: 'icon-money', category: 'finance', desc: '聚餐AA制与小费计算', isVip: false },
  { id: 'age', name: '年龄计算', icon: '🎂', iconClass: 'icon-default', category: 'daily', desc: '精确计算周岁/虚岁/天数', isVip: false },
  { id: 'timestamp', name: '时间戳转换', icon: '⏰', iconClass: 'icon-time', category: 'text', desc: 'Unix时间戳与日期互转', isVip: false },
  { id: 'base64', name: 'Base64 编码', icon: '🔐', iconClass: 'icon-default', category: 'text', desc: '文本 Base64 编码解码', isVip: false },
  { id: 'color', name: '颜色取色器', icon: '🎨', iconClass: 'icon-default', category: 'image', desc: '图片取色/RGB/HEX转换', isVip: false },
  { id: 'pomodoro', name: '番茄钟计时器', icon: '🍅', iconClass: 'icon-default', category: 'daily', desc: '25分钟专注工作法，高效提升', isVip: false },
  { id: 'base-convert', name: '进制转换器', icon: '🔢', iconClass: 'icon-convert', category: 'calculate', desc: '二进制/八进制/十进制/十六进制互转', isVip: false },
  { id: 'char-count', name: '字数统计器', icon: '📃', iconClass: 'icon-note', category: 'text', desc: '中英文字符/词数/段落一键统计', isVip: false },
  { id: 'discount', name: '折扣计算器', icon: '🏷️', iconClass: 'icon-money', category: 'finance', desc: '原价/折扣/满减一键算到手价', isVip: false }
]

// 获取工具的真实使用次数（本地）
function getUsageCount(toolId) {
  const app = getApp()
  return app ? app.getToolUsageCount(toolId) : 0
}

// 格式化使用次数为显示文本（真实数据，无虚标）
function formatUsage(count) {
  if (!count || count === 0) return '新工具'
  if (count < 100) return count + ' 次使用'
  if (count < 1000) return Math.floor(count / 100) * 100 + '+ 次使用'
  if (count < 10000) return Math.floor(count / 1000) + 'k+ 次使用'
  return Math.floor(count / 10000) + '万+ 次使用'
}

// 为工具列表注入实时使用次数文本（usageText 字段）
function enrichToolsWithUsage(tools, counts) {
  const usage = counts || (getApp() ? getApp().getAllUsageCounts() : {})
  return tools.map(t => Object.assign({}, t, {
    usageText: formatUsage(usage[t.id] || 0),
    usageCount: usage[t.id] || 0
  }))
}

// 获取热门工具（基于真实使用次数排序）
function getHotTools(limit = 6, counts) {
  const usage = counts || (getApp() ? getApp().getAllUsageCounts() : {})
  const sorted = TOOLS.slice().sort((a, b) => (usage[b.id] || 0) - (usage[a.id] || 0))
  const result = sorted.filter(t => (usage[t.id] || 0) > 0)
  if (result.length < limit) {
    TOOLS.filter(t => t.hot && !result.find(r => r.id === t.id)).forEach(t => {
      if (result.length < limit) result.push(t)
    })
  }
  return enrichToolsWithUsage(result.slice(0, limit), usage)
}

// 根据分类获取工具（已注入真实使用次数）
function getToolsByCategory(categoryId, counts) {
  const list = (!categoryId || categoryId === 'all') ? TOOLS : TOOLS.filter(t => t.category === categoryId)
  return enrichToolsWithUsage(list, counts)
}

// 根据ID获取工具（注入真实使用次数）
function getToolById(id, counts) {
  const t = TOOLS.find(t => t.id === id)
  if (!t) return null
  const usage = counts || (getApp() ? getApp().getAllUsageCounts() : {})
  return Object.assign({}, t, {
    usageText: formatUsage(usage[t.id] || 0),
    usageCount: usage[t.id] || 0
  })
}

// 搜索工具（注入真实使用次数）
function searchTools(keyword, counts) {
  if (!keyword) return []
  const kw = keyword.toLowerCase()
  const list = TOOLS.filter(t =>
    t.name.toLowerCase().includes(kw) ||
    t.desc.toLowerCase().includes(kw)
  )
  return enrichToolsWithUsage(list, counts)
}

// 获取分类信息
function getCategory(id) {
  return CATEGORIES.find(c => c.id === id)
}

module.exports = {
  CATEGORIES,
  TOOLS,
  getToolsByCategory,
  getHotTools,
  getToolById,
  searchTools,
  getCategory,
  getUsageCount,
  formatUsage,
  enrichToolsWithUsage
}

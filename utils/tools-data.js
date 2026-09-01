// 工具数据定义
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
  {
    id: 'calculator',
    name: '万能计算器',
    icon: '🧮',
    iconClass: 'icon-calc',
    category: 'calculate',
    desc: '基础+科学计算，一键解决',
    isVip: false,
    hot: true,
    users: '128万+'
  },
  {
    id: 'unit-convert',
    name: '单位换算',
    icon: '📐',
    iconClass: 'icon-convert',
    category: 'calculate',
    desc: '长度/重量/温度等20+种单位',
    isVip: false,
    hot: true,
    users: '98万+'
  },
  {
    id: 'bmi',
    name: 'BMI 健康计算器',
    icon: '⚖️',
    iconClass: 'icon-bmi',
    category: 'daily',
    desc: '输入身高体重，分析健康状态',
    isVip: false,
    hot: true,
    users: '76万+'
  },
  {
    id: 'notes',
    name: '随身备忘录',
    icon: '📝',
    iconClass: 'icon-note',
    category: 'text',
    desc: '轻量记录，本地加密存储',
    isVip: false,
    users: '65万+'
  },
  {
    id: 'countdown',
    name: '倒计时纪念日',
    icon: '⏱️',
    iconClass: 'icon-time',
    category: 'daily',
    desc: '重要日子，精准提醒',
    isVip: false,
    users: '54万+'
  },
  {
    id: 'weather',
    name: '天气查询',
    icon: '🌤️',
    iconClass: 'icon-weather',
    category: 'daily',
    desc: '实时天气，7天预报',
    isVip: false,
    users: '112万+'
  },
  {
    id: 'qr-code',
    name: '二维码生成器',
    icon: '📱',
    iconClass: 'icon-qr',
    category: 'image',
    desc: '文本/链接快速生成二维码',
    isVip: false,
    hot: true,
    users: '89万+'
  },
  {
    id: 'qr-scan',
    name: '扫码识别',
    icon: '🔍',
    iconClass: 'icon-qr',
    category: 'image',
    desc: '扫一扫，识别二维码/条形码',
    isVip: false,
    users: '82万+'
  },
  {
    id: 'random',
    name: '随机数生成器',
    icon: '🎲',
    iconClass: 'icon-random',
    category: 'calculate',
    desc: '抽奖/抽签/分组随机生成',
    isVip: false,
    users: '43万+'
  },
  {
    id: 'compass',
    name: '指南针',
    icon: '🧭',
    iconClass: 'icon-compass',
    category: 'device',
    desc: '精准定位方向与海拔',
    isVip: false,
    users: '38万+'
  },
  {
    id: 'flashlight',
    name: '手电筒',
    icon: '🔦',
    iconClass: 'icon-flash',
    category: 'device',
    desc: '一键开屏亮灯，黑夜好帮手',
    isVip: false,
    users: '57万+'
  },
  {
    id: 'id-query',
    name: '身份证信息查询',
    icon: '🪪',
    iconClass: 'icon-id',
    category: 'daily',
    desc: '查询归属地/性别/生日',
    isVip: true,
    users: '31万+'
  },
  {
    id: 'currency',
    name: '汇率换算',
    icon: '💱',
    iconClass: 'icon-money',
    category: 'finance',
    desc: '实时全球货币汇率',
    isVip: false,
    users: '47万+'
  },
  {
    id: 'loan',
    name: '房贷计算器',
    icon: '🏦',
    iconClass: 'icon-money',
    category: 'finance',
    desc: '等额本息/本金精准计算',
    isVip: false,
    hot: true,
    users: '62万+'
  },
  {
    id: 'tax',
    name: '个税计算器',
    icon: '🧾',
    iconClass: 'icon-money',
    category: 'finance',
    desc: '2024最新个税计算标准',
    isVip: false,
    users: '29万+'
  },
  {
    id: 'tip',
    name: '小费分摊计算',
    icon: '💵',
    iconClass: 'icon-money',
    category: 'finance',
    desc: '聚餐AA制与小费计算',
    isVip: false,
    users: '18万+'
  },
  {
    id: 'age',
    name: '年龄计算',
    icon: '🎂',
    iconClass: 'icon-default',
    category: 'daily',
    desc: '精确计算周岁/虚岁/天数',
    isVip: false,
    users: '24万+'
  },
  {
    id: 'timestamp',
    name: '时间戳转换',
    icon: '⏰',
    iconClass: 'icon-time',
    category: 'text',
    desc: 'Unix时间戳与日期互转',
    isVip: false,
    users: '37万+'
  },
  {
    id: 'base64',
    name: 'Base64 编码',
    icon: '🔐',
    iconClass: 'icon-default',
    category: 'text',
    desc: '文本 Base64 编码解码',
    isVip: false,
    users: '15万+'
  },
  {
    id: 'color',
    name: '颜色取色器',
    icon: '🎨',
    iconClass: 'icon-default',
    category: 'image',
    desc: '图片取色/RGB/HEX转换',
    isVip: false,
    users: '12万+'
  },
  {
    id: 'pomodoro',
    name: '番茄钟计时器',
    icon: '🍅',
    iconClass: 'icon-default',
    category: 'daily',
    desc: '25分钟专注工作法，高效提升',
    isVip: false,
    users: '44万+'
  },
  {
    id: 'base-convert',
    name: '进制转换器',
    icon: '🔢',
    iconClass: 'icon-convert',
    category: 'calculate',
    desc: '二进制/八进制/十进制/十六进制互转',
    isVip: false,
    users: '21万+'
  },
  {
    id: 'char-count',
    name: '字数统计器',
    icon: '📃',
    iconClass: 'icon-note',
    category: 'text',
    desc: '中英文字符/词数/段落一键统计',
    isVip: false,
    users: '33万+'
  },
  {
    id: 'discount',
    name: '折扣计算器',
    icon: '🏷️',
    iconClass: 'icon-money',
    category: 'finance',
    desc: '原价/折扣/满减一键算到手价',
    isVip: false,
    users: '28万+'
  }
]

// 根据分类获取工具
function getToolsByCategory(categoryId) {
  if (!categoryId || categoryId === 'all') return TOOLS
  return TOOLS.filter(t => t.category === categoryId)
}

// 获取热门工具
function getHotTools(limit = 8) {
  return TOOLS.filter(t => t.hot).slice(0, limit)
}

// 根据ID获取工具
function getToolById(id) {
  return TOOLS.find(t => t.id === id)
}

// 搜索工具
function searchTools(keyword) {
  if (!keyword) return []
  const kw = keyword.toLowerCase()
  return TOOLS.filter(t =>
    t.name.toLowerCase().includes(kw) ||
    t.desc.toLowerCase().includes(kw)
  )
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
  getCategory
}

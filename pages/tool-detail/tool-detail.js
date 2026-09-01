const app = getApp()
const { getToolById, getCategory } = require('../../utils/tools-data.js')

const UNIT_CATEGORIES = [
  { id: 'length', name: '长度', units: [
    { id: 'mm', name: '毫米(mm)', rate: 0.001 },
    { id: 'cm', name: '厘米(cm)', rate: 0.01 },
    { id: 'm', name: '米(m)', rate: 1 },
    { id: 'km', name: '千米(km)', rate: 1000 },
    { id: 'inch', name: '英寸(in)', rate: 0.0254 },
    { id: 'ft', name: '英尺(ft)', rate: 0.3048 }
  ]},
  { id: 'weight', name: '重量', units: [
    { id: 'mg', name: '毫克(mg)', rate: 0.000001 },
    { id: 'g', name: '克(g)', rate: 0.001 },
    { id: 'kg', name: '千克(kg)', rate: 1 },
    { id: 't', name: '吨(t)', rate: 1000 },
    { id: 'lb', name: '磅(lb)', rate: 0.453592 },
    { id: 'oz', name: '盎司(oz)', rate: 0.0283495 }
  ]},
  { id: 'temp', name: '温度', units: [
    { id: 'c', name: '摄氏度(°C)', rate: 'c' },
    { id: 'f', name: '华氏度(°F)', rate: 'f' },
    { id: 'k', name: '开尔文(K)', rate: 'k' }
  ]},
  { id: 'area', name: '面积', units: [
    { id: 'mm2', name: '平方毫米', rate: 0.000001 },
    { id: 'cm2', name: '平方厘米', rate: 0.0001 },
    { id: 'm2', name: '平方米', rate: 1 },
    { id: 'km2', name: '平方千米', rate: 1000000 },
    { id: 'mu', name: '亩', rate: 666.667 },
    { id: 'ha', name: '公顷(ha)', rate: 10000 }
  ]},
  { id: 'speed', name: '速度', units: [
    { id: 'mps', name: '米/秒(m/s)', rate: 1 },
    { id: 'kmph', name: '千米/时(km/h)', rate: 0.277778 },
    { id: 'mph', name: '英里/时(mph)', rate: 0.44704 },
    { id: 'kn', name: '节(kn)', rate: 0.514444 },
    { id: 'mach', name: '马赫(M)', rate: 340.29 }
  ]}
]

function pad(n) { return String(n).padStart(2, '0') }
function fmtTs(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fmtTsFull() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

Page({
  data: {
    tool: null,
    category: null,
    isFav: false,
    isVip: false,
    showVipBlock: false,
    // 计算器
    calcDisplay: '0',
    calcHistory: '',
    calcPrev: null,
    calcOp: null,
    calcWaiting: false,
    calcBtns: [
      ['C','±','%','÷'],
      ['7','8','9','×'],
      ['4','5','6','-'],
      ['1','2','3','+'],
      ['0','.','del','=']
    ],
    // BMI
    bmiHeight: '',
    bmiWeight: '',
    bmiResult: null,
    // 随机数
    randMin: 1,
    randMax: 100,
    randCount: 1,
    randResult: [],
    randAllowRepeat: true,
    // 单位换算
    unitCategory: 'length',
    unitFrom: 'm',
    unitTo: 'km',
    unitValue: '',
    unitResult: '',
    unitCategories: UNIT_CATEGORIES,
    unitCurCatUnits: UNIT_CATEGORIES[0].units,
    unitFromName: '米(m)',
    unitToName: '千米(km)',
    unitFromIndex: 2,
    unitToIndex: 3,
    // 房贷
    loanType: 'equal_payment',
    loanAmount: '',
    loanYears: 30,
    loanRate: 3.1,
    loanResult: null,
    yearOptions: [5, 10, 15, 20, 25, 30],
    loanYearIndex: 5,
    // 年龄
    ageBirthday: '',
    ageResult: null,
    // 小费
    tipAmount: '',
    tipPercent: 15,
    tipPeople: 2,
    tipResult: null,
    // 二维码
    qrText: '',
    // 备忘录
    notes: [],
    noteInput: '',
    // 倒计时
    countdownDays: [],
    // 手电筒
    flashlightOn: false,
    // 时间戳
    tsNow: 0,
    tsNowMs: 0,
    tsFull: '',
    // 汇率换算
    curFrom: 'CNY',
    curTo: 'USD',
    curValue: '',
    curResult: null,
    curFromIndex: 0,
    curToIndex: 1,
    curList: ['CNY','USD','EUR','JPY','GBP','KRW','HKD','AUD','CAD','SGD'],
    curNames: ['人民币 ¥','美元 $','欧元 €','日元 ¥','英镑 £','韩元 ₩','港币 HK$','澳元 A$','加元 C$','新加坡元 S$'],
    // Base64
    b64Mode: 'encode',
    b64Input: '',
    b64Result: null,
    b64Error: null,
    // 颜色取色器
    colorR: 124,
    colorG: 58,
    colorB: 237,
    colorHex: '#7C3AED',
    colorRgb: 'rgb(124, 58, 237)',
    colorHsl: 'hsl(255, 83%, 58%)',
    colorCmyk: 'cmyk(48%, 75%, 0%, 7%)',
    // 天气
    weatherData: null,
    // 指南针
    compassAngle: 0,
    compassDir: '北',
    // 个税
    taxIncome: '',
    taxSocIns: '',
    taxThreshold: 5000,
    taxResult: null,
    // 番茄钟
    pomoMode: 'work',
    pomoWorkMin: 25,
    pomoBreakMin: 5,
    pomoRemain: 25 * 60,
    pomoRunning: false,
    pomoCompleted: 0,
    pomoDisplay: '25:00',
    pomoPct: 0,
    // 进制转换
    baseValue: '',
    baseFrom: 10,
    baseResult: null,
    // 字数统计
    charText: '',
    charStats: null,
    // 折扣计算
    discPrice: '',
    discDiscount: 85,
    discCoupon: '',
    discFullCut: '',
    discResult: null
  },

  onLoad(options) {
    const id = options.id
    const tool = getToolById(id)
    if (!tool) {
      wx.showToast({ title: '工具不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }
    const category = getCategory(tool.category)
    const isVip = wx.getStorageSync('isVip') || false
    const showVipBlock = tool.isVip && !isVip

    wx.setNavigationBarTitle({ title: tool.name })
    app.addHistory(tool)
    this.initToolData(tool.id)

    this.setData({
      tool, category,
      isFav: app.isFavorite(tool.id),
      isVip, showVipBlock
    })

    // 时间戳工具实时时间
    if (tool.id === 'timestamp') {
      this.refreshTs()
      this._tsTimer = setInterval(() => this.refreshTs(), 1000)
    }
    // 番茄钟初始化
    if (tool.id === 'pomodoro') {
      this.updatePomoDisplay()
    }
    // 天气初始化
    if (tool.id === 'weather') {
      this.initWeather()
    }
    // 颜色初始化
    if (tool.id === 'color') {
      this.updateColor()
    }
  },

  onUnload() {
    if (this._tsTimer) clearInterval(this._tsTimer)
    if (this._pomoTimer) clearInterval(this._pomoTimer)
  },

  refreshTs() {
    const now = Date.now()
    this.setData({
      tsNow: Math.floor(now / 1000),
      tsNowMs: now,
      tsFull: fmtTsFull()
    })
  },

  initToolData(toolId) {
    switch(toolId) {
      case 'notes': {
        const raw = wx.getStorageSync('local_notes') || []
        const notes = raw.map(n => ({ ...n, timeStr: fmtTs(n.time) }))
        this.setData({ notes })
        break
      }
      case 'countdown': {
        const today = new Date()
        const y = today.getFullYear()
        function dt(m, d) {
          const x = new Date(y, m-1, d)
          if (x < new Date(today.getFullYear(), today.getMonth(), today.getDate())) x.setFullYear(y+1)
          return `${x.getFullYear()}-${pad(m)}-${pad(d)}`
        }
        let savedDays = wx.getStorageSync('countdown_days') || null
        if (!savedDays) {
          savedDays = [
            { id: 1, name: '元旦', date: dt(1,1), icon: '🎊' },
            { id: 2, name: '情人节', date: dt(2,14), icon: '💝' },
            { id: 3, name: '劳动节', date: dt(5,1), icon: '🎉' },
            { id: 4, name: '生日', date: dt(6,15), icon: '🎂' },
            { id: 5, name: '国庆节', date: dt(10,1), icon: '🇨🇳' },
            { id: 6, name: '圣诞节', date: dt(12,25), icon: '🎄' }
          ]
        }
        this.setData({ countdownDays: this.calcCountdown(savedDays) })
        break
      }
    }
  },

  calcCountdown(days) {
    const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return days.map(d => {
      const target = new Date(d.date + 'T00:00:00')
      const diffDays = Math.round((target - today) / 86400000)
      let status = '还有'
      if (diffDays === 0) status = '就是今天！'
      else if (diffDays < 0) status = '已过'
      return { ...d, daysLeft: Math.abs(diffDays), status, isPast: diffDays < 0, isToday: diffDays === 0 }
    }).sort((a, b) => {
      if (a.isPast && !b.isPast) return 1
      if (!a.isPast && b.isPast) return -1
      return a.daysLeft - b.daysLeft
    })
  },

  toggleFav() {
    const tool = this.data.tool
    const result = app.toggleFavorite(tool)
    this.setData({ isFav: result })
    wx.showToast({ title: result ? '已收藏 ⭐' : '已取消', icon: 'none' })
  },

  onShareAppMessage() {
    const t = this.data.tool
    return {
      title: `Abdusalam 工具箱 · ${t.name}`,
      path: `/pages/tool-detail/tool-detail?id=${t.id}`
    }
  },

  /* ============ 计算器 ============ */
  pressCalc(e) {
    const v = e.currentTarget.dataset.v
    const { calcDisplay, calcPrev, calcOp, calcWaiting } = this.data
    let d = calcDisplay
    if (v >= '0' && v <= '9') {
      d = (calcWaiting || d === '0') ? v : d + v
      this.setData({ calcDisplay: d, calcWaiting: false })
    } else if (v === '.') {
      if (!d.includes('.')) this.setData({ calcDisplay: d + '.' })
    } else if (v === 'C') {
      this.setData({ calcDisplay: '0', calcHistory: '', calcPrev: null, calcOp: null, calcWaiting: false })
    } else if (v === 'del') {
      this.setData({ calcDisplay: d.length > 1 ? d.slice(0, -1) : '0' })
    } else if (v === '=') {
      if (calcOp && calcPrev !== null) {
        const r = this.calc(calcPrev, parseFloat(d), calcOp)
        this.setData({
          calcDisplay: String(this.fmtNum(r)),
          calcHistory: `${calcPrev} ${calcOp} ${d} =`,
          calcPrev: null, calcOp: null, calcWaiting: true
        })
      }
    } else if (['+', '-', '×', '÷'].indexOf(v) > -1) {
      const cur = parseFloat(d)
      let prev = calcPrev, op = calcOp, history = this.data.calcHistory
      if (prev === null) {
        prev = cur
      } else if (op && !calcWaiting) {
        const r = this.calc(prev, cur, op)
        prev = r; d = String(this.fmtNum(r))
      }
      history = `${prev} ${v}`
      this.setData({ calcPrev: prev, calcOp: v, calcDisplay: d, calcHistory: history, calcWaiting: true })
    } else if (v === '%') {
      this.setData({ calcDisplay: String(this.fmtNum(parseFloat(d) / 100)) })
    } else if (v === '±') {
      this.setData({ calcDisplay: String(this.fmtNum(-parseFloat(d))) })
    }
  },
  calc(a, b, op) {
    if (op === '+') return a + b
    if (op === '-') return a - b
    if (op === '×') return a * b
    if (op === '÷') return b === 0 ? NaN : a / b
  },
  fmtNum(n) {
    if (isNaN(n) || !isFinite(n)) return 'Error'
    if (Math.abs(n) > 1e12 || (Math.abs(n) < 1e-6 && n !== 0)) return n.toExponential(6)
    return parseFloat(n.toPrecision(12))
  },

  /* ============ BMI ============ */
  bmiInput(e) { this.setData({ [e.currentTarget.dataset.type]: e.detail.value }) },
  calcBmi() {
    const h = parseFloat(this.data.bmiHeight)
    const w = parseFloat(this.data.bmiWeight)
    if (!h || !w || h <= 0 || w <= 0) {
      wx.showToast({ title: '请输入正确的身高体重', icon: 'none' }); return
    }
    const bmi = parseFloat((w / Math.pow(h/100, 2)).toFixed(1))
    let tag, tagCls, tip, advise, pct = 50
    if (bmi < 18.5) { tag='偏瘦'; tagCls='warn'; tip='建议适当增加营养摄入'; advise='多吃蛋白质+力量训练';
      pct = Math.max(2, bmi / 18.5 * 23)
    } else if (bmi < 24) { tag='正常'; tagCls='ok'; tip='非常棒的健康状态'; advise='继续保持均衡饮食+规律运动';
      pct = 25 + (bmi - 18.5) / 5.5 * 30
    } else if (bmi < 28) { tag='偏胖'; tagCls='warn'; tip='建议适当控制饮食与运动'; advise='健康减重: 热量缺口+有氧运动';
      pct = 55 + (bmi - 24) / 4 * 20
    } else { tag='肥胖'; tagCls='bad'; tip='建议咨询医生制定减重计划'; advise='综合饮食+运动+生活调整';
      pct = Math.min(97, 75 + Math.min((bmi - 28), 10) / 10 * 22)
    }
    this.setData({ bmiResult: { value: bmi, tag, tagCls, tip, advise, pct } })
  },

  /* ============ 随机数 ============ */
  randInput(e) { this.setData({ [e.currentTarget.dataset.type]: parseInt(e.detail.value) || 0 }) },
  toggleRepeat() { this.setData({ randAllowRepeat: !this.data.randAllowRepeat }) },
  genRandom() {
    let mn = parseInt(this.data.randMin) || 0
    let mx = parseInt(this.data.randMax) || 0
    let cnt = parseInt(this.data.randCount) || 1
    if (mx < mn) { const t = mx; mx = mn; mn = t }
    const range = mx - mn + 1
    if (!this.data.randAllowRepeat && cnt > range) {
      wx.showToast({ title: `不重复最多${range}个`, icon: 'none' }); cnt = range
    }
    const out = []
    if (this.data.randAllowRepeat) {
      for (let i = 0; i < cnt; i++) out.push(Math.floor(Math.random() * range) + mn)
    } else {
      const pool = []
      for (let i = mn; i <= mx; i++) pool.push(i)
      for (let i = 0; i < cnt; i++) {
        const idx = Math.floor(Math.random() * pool.length)
        out.push(pool.splice(idx, 1)[0])
      }
    }
    this.setData({ randResult: out })
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
  },

  /* ============ 单位换算 ============ */
  getCurCat() {
    return UNIT_CATEGORIES.find(c => c.id === this.data.unitCategory) || UNIT_CATEGORIES[0]
  },
  switchUnitCat(e) {
    const id = e.currentTarget.dataset.id
    const cat = UNIT_CATEGORIES.find(c => c.id === id) || UNIT_CATEGORIES[0]
    const units = cat.units
    const fromIdx = 0
    const toIdx = units.length > 1 ? 1 : 0
    this.setData({
      unitCategory: id,
      unitCurCatUnits: units,
      unitFrom: units[fromIdx].id, unitFromName: units[fromIdx].name, unitFromIndex: fromIdx,
      unitTo: units[toIdx].id, unitToName: units[toIdx].name, unitToIndex: toIdx,
      unitResult: ''
    })
  },
  pickUnitFrom(e) {
    const idx = parseInt(e.detail.value)
    const units = this.getCurCat().units
    const u = units[idx]
    this.setData({ unitFrom: u.id, unitFromName: u.name, unitFromIndex: idx })
    if (this.data.unitValue) this.doUnitConvert()
  },
  pickUnitTo(e) {
    const idx = parseInt(e.detail.value)
    const units = this.getCurCat().units
    const u = units[idx]
    this.setData({ unitTo: u.id, unitToName: u.name, unitToIndex: idx })
    if (this.data.unitValue) this.doUnitConvert()
  },
  unitValueInput(e) {
    this.setData({ unitValue: e.detail.value })
    this.doUnitConvert()
  },
  doUnitConvert() {
    const { unitCategory, unitFrom, unitTo, unitValue } = this.data
    const val = parseFloat(unitValue)
    if (isNaN(val)) { this.setData({ unitResult: '' }); return }
    const cat = this.getCurCat()
    const u1 = cat.units.find(u => u.id === unitFrom)
    const u2 = cat.units.find(u => u.id === unitTo)
    let base, out
    if (unitCategory === 'temp') {
      if (u1.id === 'c') base = val
      else if (u1.id === 'f') base = (val - 32) * 5 / 9
      else base = val - 273.15
      if (u2.id === 'c') out = base
      else if (u2.id === 'f') out = base * 9 / 5 + 32
      else out = base + 273.15
    } else {
      base = val * u1.rate
      out = base / u2.rate
    }
    const fmt = Math.abs(out) >= 1e6 || (Math.abs(out) < 1e-4 && out !== 0)
      ? out.toExponential(4) : parseFloat(out.toPrecision(10)).toString()
    this.setData({ unitResult: fmt })
  },
  swapUnits() {
    this.setData({
      unitFrom: this.data.unitTo,
      unitTo: this.data.unitFrom,
      unitFromName: this.data.unitToName,
      unitToName: this.data.unitFromName,
      unitFromIndex: this.data.unitToIndex,
      unitToIndex: this.data.unitFromIndex
    })
    if (this.data.unitValue) this.doUnitConvert()
  },

  /* ============ 房贷 ============ */
  loanInput(e) { this.setData({ [e.currentTarget.dataset.type]: e.detail.value }) },
  setLoanType(e) { this.setData({ loanType: e.currentTarget.dataset.type, loanResult: null }) },
  pickYear(e) {
    const idx = parseInt(e.detail.value)
    this.setData({ loanYears: this.data.yearOptions[idx], loanYearIndex: idx })
  },
  calcLoan() {
    const P = parseFloat(this.data.loanAmount) * 10000
    let r = parseFloat(this.data.loanRate)
    const n = parseInt(this.data.loanYears) * 12
    if (!P || !r || !n || P <= 0) { wx.showToast({ title: '请输入正确参数', icon: 'none' }); return }
    r = r / 100 / 12
    let res
    if (this.data.loanType === 'equal_payment') {
      const m = r === 0 ? P / n : (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
      const total = m * n, interest = total - P
      res = { type: '等额本息', monthly: m.toFixed(2), total: (total/10000).toFixed(2),
        principal: (P/10000).toFixed(2), interest: (interest/10000).toFixed(2), mode: 1 }
    } else {
      const mp = P / n, fm = mp + P * r, lm = mp + mp * r
      const interest = P * r * (n + 1) / 2, total = P + interest
      res = { type: '等额本金', fm: fm.toFixed(2), lm: lm.toFixed(2), total: (total/10000).toFixed(2),
        principal: (P/10000).toFixed(2), interest: (interest/10000).toFixed(2), mode: 2 }
    }
    this.setData({ loanResult: res })
  },

  /* ============ 年龄 ============ */
  pickBirthday(e) {
    this.setData({ ageBirthday: e.detail.value })
    this.calcAge()
  },
  calcAge() {
    const d = this.data.ageBirthday
    if (!d) return
    const b = new Date(d + 'T00:00:00')
    const now = new Date()
    let yrs = now.getFullYear() - b.getFullYear()
    let mos = now.getMonth() - b.getMonth()
    let dys = now.getDate() - b.getDate()
    if (dys < 0) { mos--; const pm = new Date(now.getFullYear(), now.getMonth(), 0); dys += pm.getDate() }
    if (mos < 0) { yrs--; mos += 12 }
    const totalDays = Math.floor((now - b) / 86400000)
    const weeks = Math.floor(totalDays / 7)
    const next = new Date(b); next.setFullYear(now.getFullYear())
    if (next < now) next.setFullYear(now.getFullYear() + 1)
    const toNext = Math.ceil((next - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000)
    const zodiacs = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪']
    const zodiac = zodiacs[(b.getFullYear() - 4) % 12]
    const stars = ['摩羯','水瓶','双鱼','白羊','金牛','双子','巨蟹','狮子','处女','天秤','天蝎','射手']
    const cut = [20,19,21,20,21,22,23,23,23,24,23,22]
    let si = b.getMonth()
    if (b.getDate() < cut[si]) si = (si + 11) % 12
    this.setData({ ageResult: { yrs, mos, dys, totalDays, weeks, toNext, zodiac, star: stars[si] } })
  },

  /* ============ 小费 ============ */
  tipInput(e) { this.setData({ [e.currentTarget.dataset.type]: e.detail.value }) },
  setTipPercent(e) {
    this.setData({ tipPercent: parseInt(e.detail.value) })
    this.calcTip()
  },
  calcTip() {
    const amt = parseFloat(this.data.tipAmount)
    const p = parseInt(this.data.tipPercent) || 0
    const n = Math.max(1, parseInt(this.data.tipPeople) || 1)
    if (!amt || amt <= 0) { this.setData({ tipResult: null }); return }
    const tip = amt * p / 100
    const total = amt + tip
    this.setData({
      tipResult: {
        tip: tip.toFixed(2), total: total.toFixed(2),
        each: (total / n).toFixed(2), eachTip: (tip / n).toFixed(2)
      }
    })
  },

  /* ============ 二维码 ============ */
  qrInput(e) { this.setData({ qrText: e.detail.value }) },
  copyQr() {
    if (!this.data.qrText) return
    wx.setClipboardData({ data: this.data.qrText })
  },

  /* ============ 备忘录 ============ */
  noteInput(e) { this.setData({ noteInput: e.detail.value }) },
  addNote() {
    const v = this.data.noteInput.trim()
    if (!v) { wx.showToast({ title: '写点什么吧~', icon: 'none' }); return }
    const now = Date.now()
    const list = [{ id: now, content: v, time: now, timeStr: fmtTs(now) }, ...this.data.notes]
    this.setData({ notes: list, noteInput: '' })
    wx.setStorageSync('local_notes', list.map(n => ({ id: n.id, content: n.content, time: n.time })))
  },
  deleteNote(e) {
    const id = e.currentTarget.dataset.id
    const list = this.data.notes.filter(n => n.id !== id)
    this.setData({ notes: list })
    wx.setStorageSync('local_notes', list.map(n => ({ id: n.id, content: n.content, time: n.time })))
  },
  copyNote(e) { wx.setClipboardData({ data: e.currentTarget.dataset.c }) },

  /* ============ 倒计时（只读展示，可扩展编辑）============ */

  /* ============ 手电筒 ============ */
  toggleFlash() {
    const on = !this.data.flashlightOn
    this.setData({ flashlightOn: on })
    wx.setNavigationBarColor({
      frontColor: on ? '#000000' : '#ffffff',
      backgroundColor: on ? '#ffffff' : '#0f0f1a'
    })
    wx.setBackgroundColor({ backgroundColor: on ? '#ffffff' : '#0f0f1a' })
  },

  /* ============ VIP ============ */
  goVip() { wx.switchTab({ url: '/pages/cart/cart' }) },

  /* ============ 汇率换算 ============ */
  curPickFrom(e) {
    const idx = parseInt(e.detail.value)
    this.setData({ curFrom: this.data.curList[idx], curFromIndex: idx })
    this.calcCurrency()
  },
  curPickTo(e) {
    const idx = parseInt(e.detail.value)
    this.setData({ curTo: this.data.curList[idx], curToIndex: idx })
    this.calcCurrency()
  },
  curInput(e) {
    this.setData({ curValue: e.detail.value })
    this.calcCurrency()
  },
  calcCurrency() {
    const v = parseFloat(this.data.curValue)
    if (!v) { this.setData({ curResult: null }); return }
    const rates = { CNY:1, USD:0.1398, EUR:0.1276, JPY:21.52, GBP:0.1098, KRW:186.5, HKD:1.087, AUD:0.2103, CAD:0.1901, SGD:0.1876 }
    const usd = v / (rates[this.data.curFrom] || 1)
    const out = usd * (rates[this.data.curTo] || 1)
    this.setData({ curResult: { value: out.toFixed(2), from: this.data.curFrom, to: this.data.curTo, rate: ((rates[this.data.curTo]||1) / (rates[this.data.curFrom]||1)).toFixed(4) } })
  },

  /* ============ Base64 ============ */
  setB64Mode(e) {
    this.setData({ b64Mode: e.currentTarget.dataset.type, b64Result: null, b64Error: null })
  },
  b64Input(e) {
    this.setData({ b64Input: e.detail.value, b64Result: null, b64Error: null })
  },
  runB64() {
    const v = this.data.b64Input.trim()
    if (!v) { this.setData({ b64Error: '请输入内容' }); return }
    try {
      let result
      if (this.data.b64Mode === 'encode') {
        // UTF-8 safe encode
        const bytes = []
        for (let i = 0; i < v.length; i++) {
          const c = v.charCodeAt(i)
          if (c < 128) bytes.push(c)
          else if (c < 2048) { bytes.push(192 | (c >> 6)); bytes.push(128 | (c & 63)) }
          else { bytes.push(224 | (c >> 12)); bytes.push(128 | ((c >> 6) & 63)); bytes.push(128 | (c & 63)) }
        }
        result = wx.arrayBufferToBase64(new Uint8Array(bytes).buffer)
      } else {
        const buf = wx.base64ToArrayBuffer(v)
        const bytes = new Uint8Array(buf)
        let result = ''
        for (let i = 0; i < bytes.length; i++) result += String.fromCharCode(bytes[i])
        result = decodeURIComponent(escape(result))
      }
      this.setData({ b64Result: result, b64Error: null })
    } catch(err) {
      this.setData({ b64Error: '操作失败，请检查输入', b64Result: null })
    }
  },
  copyB64() {
    if (this.data.b64Result) wx.setClipboardData({ data: this.data.b64Result })
  },

  /* ============ 颜色取色器 ============ */
  colorSlider(e) {
    const { r, g, b } = this.data
    const type = e.currentTarget.dataset.type
    const val = parseInt(e.detail.value)
    const data = {}
    if (type === 'r') data.colorR = val
    else if (type === 'g') data.colorG = val
    else data.colorB = val
    this.setData(data)
    this.updateColor()
  },
  updateColor() {
    const { colorR: r, colorG: g, colorB: b } = this.data
    const hex = '#' + [r, g, b].map(x => {
      const h = Math.round(x).toString(16)
      return h.length === 1 ? '0' + h : h
    }).join('').toUpperCase()
    // HSL
    const rr = r/255, gg = g/255, bb = b/255
    const mx = Math.max(rr, gg, bb), mn = Math.min(rr, gg, bb)
    let h, s, l = (mx + mn) / 2
    if (mx === mn) { h = 0; s = 0 }
    else {
      const d = mx - mn
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
      if (mx === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6
      else if (mx === gg) h = ((bb - rr) / d + 2) / 6
      else h = ((rr - gg) / d + 4) / 6
    }
    // CMYK
    const k = 1 - Math.max(rr, gg, bb)
    let c = 0, m = 0, y = 0
    if (k < 1) {
      c = Math.round(((1 - rr - k) / (1 - k)) * 100)
      m = Math.round(((1 - gg - k) / (1 - k)) * 100)
      y = Math.round(((1 - bb - k) / (1 - k)) * 100)
    }
    this.setData({
      colorHex: hex,
      colorRgb: `rgb(${r}, ${g}, ${b})`,
      colorHsl: `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`,
      colorCmyk: `cmyk(${c}%, ${m}%, ${y}%, ${Math.round(k * 100)}%)`
    })
  },
  copyColor(e) {
    wx.setClipboardData({ data: e.currentTarget.dataset.val })
  },

  /* ============ 天气 ============ */
  initWeather() {
    const days = [
      { day: '今天', icon: '☀️', temp: 28, desc: '晴', wind: '东南风 3级', humidity: '45%' },
      { day: '明天', icon: '⛅', temp: 26, desc: '多云转晴', wind: '东风 2级', humidity: '52%' },
      { day: '后天', icon: '🌧️', temp: 22, desc: '小雨', wind: '北风 4级', humidity: '78%' },
      { day: '周四', icon: '⛅', temp: 24, desc: '多云', wind: '南风 3级', humidity: '60%' },
      { day: '周五', icon: '☀️', temp: 30, desc: '晴朗', wind: '东南风 2级', humidity: '38%' },
      { day: '周六', icon: '🌩️', temp: 25, desc: '雷阵雨', wind: '西北风 4级', humidity: '82%' },
      { day: '周日', icon: '⛅', temp: 27, desc: '多云转晴', wind: '东风 3级', humidity: '50%' }
    ]
    const indices = [
      { label: '穿衣', value: '短袖短裤', icon: '👕' },
      { label: '紫外线', value: '中等', icon: '☀️' },
      { label: '运动', value: '适宜', icon: '🏃' },
      { label: '洗车', value: '适宜', icon: '🚿' },
      { label: '感冒', value: '少发', icon: '🤧' }
    ]
    this.setData({ weatherData: { today: days[0], forecast: days, indices } })
  },

  /* ============ 指南针 ============ */
  compassRandom() {
    const angle = Math.floor(Math.random() * 360)
    const dirs = ['北','东北','东','东南','南','西南','西','西北']
    const idx = Math.round(angle / 45) % 8
    this.setData({ compassAngle: angle, compassDir: dirs[idx] })
  },

  /* ============ 个税 ============ */
  taxInput(e) {
    this.setData({ [e.currentTarget.dataset.type]: e.detail.value })
  },
  calcTax() {
    const inc = parseFloat(this.data.taxIncome)
    const soc = parseFloat(this.data.taxSocIns) || 0
    const th = parseFloat(this.data.taxThreshold) || 5000
    if (!inc || inc <= 0) { wx.showToast({ title: '请输入正确的月薪', icon: 'none' }); return }
    const taxable = Math.max(0, inc - soc - th)
    let rate, deduct
    if (taxable <= 0) { rate = 0; deduct = 0 }
    else if (taxable <= 3000) { rate = 3; deduct = 0 }
    else if (taxable <= 12000) { rate = 10; deduct = 210 }
    else if (taxable <= 25000) { rate = 20; deduct = 1410 }
    else if (taxable <= 35000) { rate = 25; deduct = 2660 }
    else if (taxable <= 55000) { rate = 30; deduct = 4410 }
    else if (taxable <= 80000) { rate = 35; deduct = 7160 }
    else { rate = 45; deduct = 15160 }
    const taxAmt = Math.max(0, taxable * rate / 100 - deduct)
    this.setData({
      taxResult: {
        taxable: taxable.toFixed(2), rate, deduct: deduct.toFixed(2),
        tax: taxAmt.toFixed(2), net: (inc - soc - taxAmt).toFixed(2)
      }
    })
  },

  /* ============ 番茄钟 ============ */
  updatePomoDisplay() {
    const mm = String(Math.floor(this.data.pomoRemain / 60)).padStart(2, '0')
    const ss = String(this.data.pomoRemain % 60).padStart(2, '0')
    const total = this.data.pomoMode === 'work' ? this.data.pomoWorkMin * 60 : this.data.pomoBreakMin * 60
    const pct = total > 0 ? (1 - this.data.pomoRemain / total) : 0
    this.setData({ pomoDisplay: mm + ':' + ss, pomoPct: pct })
  },
  pomoStart() {
    if (this.data.pomoRunning) return
    this.setData({ pomoRunning: true })
    this._pomoTimer = setInterval(() => {
      let remain = this.data.pomoRemain - 1
      if (remain <= 0) {
        clearInterval(this._pomoTimer)
        if (this.data.pomoMode === 'work') {
          this.setData({
            pomoMode: 'break', pomoRemain: this.data.pomoBreakMin * 60,
            pomoRunning: false, pomoCompleted: this.data.pomoCompleted + 1
          })
          wx.vibrateShort && wx.vibrateShort({ type: 'heavy' })
          wx.showToast({ title: '🍅 专注完成！休息一下', icon: 'none' })
        } else {
          this.setData({ pomoMode: 'work', pomoRemain: this.data.pomoWorkMin * 60, pomoRunning: false })
          wx.showToast({ title: '☕ 休息结束，继续专注', icon: 'none' })
        }
      } else {
        this.setData({ pomoRemain: remain })
      }
      this.updatePomoDisplay()
    }, 1000)
    this.updatePomoDisplay()
  },
  pomoPause() {
    clearInterval(this._pomoTimer)
    this.setData({ pomoRunning: false })
    this.updatePomoDisplay()
  },
  pomoReset() {
    clearInterval(this._pomoTimer)
    this.setData({
      pomoMode: 'work', pomoRemain: this.data.pomoWorkMin * 60,
      pomoRunning: false
    })
    this.updatePomoDisplay()
  },
  pomoSetMin(e) {
    const m = parseInt(e.currentTarget.dataset.min)
    clearInterval(this._pomoTimer)
    this.setData({ pomoWorkMin: m, pomoRemain: m * 60, pomoRunning: false, pomoMode: 'work' })
    this.updatePomoDisplay()
  },

  /* ============ 进制转换 ============ */
  setBaseFrom(e) {
    this.setData({ baseFrom: parseInt(e.currentTarget.dataset.base), baseResult: null })
  },
  baseInput(e) {
    this.setData({ baseValue: e.detail.value })
    this.runBase()
  },
  runBase() {
    const v = this.data.baseValue.trim()
    if (!v) { this.setData({ baseResult: null }); return }
    let dec
    try {
      if (this.data.baseFrom === 16) dec = parseInt(v, 16)
      else if (this.data.baseFrom === 8) dec = parseInt(v, 8)
      else if (this.data.baseFrom === 2) dec = parseInt(v, 2)
      else dec = parseInt(v, 10)
      if (isNaN(dec)) throw 'err'
    } catch(e) { this.setData({ baseResult: null }); return }
    this.setData({
      baseResult: {
        b: dec.toString(2), o: dec.toString(8),
        d: dec.toString(10), h: dec.toString(16).toUpperCase()
      }
    })
  },
  copyBaseVal(e) {
    wx.setClipboardData({ data: e.currentTarget.dataset.val })
  },

  /* ============ 字数统计 ============ */
  charInput(e) {
    const text = e.detail.value
    this.setData({ charText: text })
    this.updateCharStats(text)
  },
  updateCharStats(text) {
    if (!text) { this.setData({ charStats: null }); return }
    const cn = (text.match(/[\u4e00-\u9fa5]/g) || []).length
    const en = (text.match(/[a-zA-Z]/g) || []).length
    const num = (text.match(/[0-9]/g) || []).length
    const space = (text.match(/\s/g) || []).length
    const punct = (text.match(/[，。！？、；：""''（）【】《》.,!?;:'"()\[\]<>]/g) || []).length
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    const lines = text ? text.split('\n').length : 0
    const para = text ? text.split(/\n\s*\n/).filter(p => p.trim()).length : 0
    // 字节计算（UTF-8）
    let bytes = 0
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i)
      if (c < 128) bytes += 1
      else if (c < 2048) bytes += 2
      else bytes += 3
    }
    this.setData({
      charStats: {
        total: text.length, cn, en, num, space, punct,
        words, lines, para, bytes
      }
    })
  },
  clearChar() {
    this.setData({ charText: '', charStats: null })
  },

  /* ============ 折扣计算 ============ */
  discInput(e) {
    this.setData({ [e.currentTarget.dataset.type]: e.detail.value })
    this.calcDisc()
  },
  discSlider(e) {
    this.setData({ discDiscount: parseInt(e.detail.value) })
    this.calcDisc()
  },
  calcDisc() {
    const p = parseFloat(this.data.discPrice)
    if (!p || p <= 0) { this.setData({ discResult: null }); return }
    const dp = p * this.data.discDiscount / 100
    const coupon = parseFloat(this.data.discCoupon) || 0
    let cutAmt = 0
    const m = this.data.discFullCut.match(/(\d+)-(\d+)/)
    if (m) { const full = +m[1], cut = +m[2]; if (dp >= full) cutAmt = cut }
    const final = Math.max(0, dp - coupon - cutAmt)
    const saved = p - final
    this.setData({
      discResult: {
        discPrice: dp.toFixed(2), couponAmt: coupon.toFixed(2),
        cutAmt: cutAmt.toFixed(2), totalOff: saved.toFixed(2),
        final: final.toFixed(2), offPct: Math.round(saved / p * 100)
      }
    })
  }
})

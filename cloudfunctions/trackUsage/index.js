// 工具使用统计云函数
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action, toolId } = event

  try {
    // 记录工具使用次数：自增计数，记录不存在则创建 count: 1
    if (action === 'use') {
      const updateRes = await db.collection('tool_usage').doc(toolId).update({
        data: { count: _.inc(1) }
      })

      if (updateRes.stats.updated === 0) {
        await db.collection('tool_usage').add({
          data: { _id: toolId, toolId, count: 1 }
        })
      }

      // 返回最新计数
      const record = await db.collection('tool_usage').doc(toolId).get()
      return { action, toolId, count: record.data.count }
    }

    // 记录日活：按今天日期自增计数
    if (action === 'active') {
      const now = new Date()
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

      const updateRes = await db.collection('daily_active').doc(dateStr).update({
        data: { count: _.inc(1) }
      })

      if (updateRes.stats.updated === 0) {
        await db.collection('daily_active').add({
          data: { _id: dateStr, date: dateStr, count: 1 }
        })
      }

      const record = await db.collection('daily_active').doc(dateStr).get()
      return { action, date: dateStr, count: record.data.count }
    }

    // 获取全部工具使用计数，返回为 map（实时聚合，跨用户）
    if (action === 'getCounts' || action === 'getAll') {
      const res = await db.collection('tool_usage').get()
      const counts = {}
      res.data.forEach(item => {
        counts[item.toolId || item._id] = item.count
      })
      // 累计用户数 = 去重活跃用户之和
      let totalUsers = 0
      try {
        const dauRes = await db.collection('daily_active').get()
        totalUsers = dauRes.data.reduce((sum, d) => sum + (d.count || 0), 0)
      } catch (e) {}
      return { action, counts, totalUsers }
    }

    return { action, error: 'unknown action' }
  } catch (err) {
    console.error('trackUsage error:', err)
    return { action, success: false, error: err.message }
  }
}

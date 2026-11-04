var store = require("../../utils/store.js");

Page({
  data: {
    dateText: "",
    greeting: "",
    streak: 0,
    today: 0,
    goal: store.GOAL,
    pct: 0,
    dueText: "",
    heroTitle: "",
    sub: "",
    startLabel: "",
    learned: 0,
    mastered: 0,
    fav: 0,
    totalWords: store.WORDS.length
  },

  onLoad: function () {
    this.refresh();
  },

  onShow: function () {
    this.refresh();
  },

  refresh: function () {
    var st = store.stats();
    var d = new Date();
    var week = "日一二三四五六";
    var hour = d.getHours();
    var greeting = "晚上好";
    if (hour < 5) greeting = "夜深了";
    else if (hour < 11) greeting = "早上好";
    else if (hour < 14) greeting = "中午好";
    else if (hour < 18) greeting = "下午好";

    var pct = Math.min(100, Math.round(st.today / store.GOAL * 100));
    var heroTitle = st.today >= store.GOAL ? "今日目标达成" : "还差 " + (store.GOAL - st.today) + " 词";
    var sub = "今日还没开始，先来一组闪卡吧。";
    if (st.today > 0 && st.today < store.GOAL) sub = "再学 " + (store.GOAL - st.today) + " 个词完成今日目标。";
    if (st.today >= store.GOAL) sub = "今日目标已达成，继续复习会更牢固。";

    this.setData({
      dateText: (d.getMonth() + 1) + "月" + d.getDate() + "日 · 星期" + week[d.getDay()],
      greeting: greeting,
      streak: st.streak,
      today: st.today,
      pct: pct,
      dueText: st.due ? st.due + " 个待复习" : "暂无待复习",
      heroTitle: heroTitle,
      sub: sub,
      startLabel: st.today > 0 ? "继续今日学习" : "开始今日学习",
      learned: st.learned,
      mastered: st.mastered,
      fav: st.fav
    });
  },

  startStudy: function () {
    wx.navigateTo({ url: "/pages/study/study" });
  },

  startQuiz: function () {
    wx.navigateTo({ url: "/pages/quiz/quiz" });
  },

  startSpell: function () {
    wx.navigateTo({ url: "/pages/spell/spell" });
  },

  goWords: function () {
    wx.switchTab({ url: "/pages/words/words" });
  }
});

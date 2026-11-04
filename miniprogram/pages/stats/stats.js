var store = require("../../utils/store.js");

Page({
  data: {
    streak: 0,
    today: 0,
    learned: 0,
    mastered: 0,
    due: 0,
    accuracy: 0,
    days: [],
    topics: [],
    favWords: []
  },

  onShow: function () {
    this.refresh();
  },

  refresh: function () {
    var st = store.stats();
    var days = store.last7();
    var max = 1;
    days.forEach(function (d) { if (d.count > max) max = d.count; });
    days = days.map(function (d) {
      return {
        key: d.key,
        label: d.label,
        count: d.count,
        isToday: d.isToday,
        height: d.count ? Math.max(16, Math.round(d.count / max * 148)) : 12,
        empty: !d.count
      };
    });

    var state = store.getState();
    var topics = store.TOPICS.map(function (t) {
      var list = store.WORDS.filter(function (w) { return w.topic === t; });
      var learned = list.filter(function (w) {
        return state.words[w.word] && state.words[w.word].seen > 0;
      }).length;
      return {
        name: t,
        learned: learned,
        total: list.length,
        pct: list.length ? Math.round(learned / list.length * 100) : 0
      };
    });

    var favWords = store.WORDS.filter(function (w) {
      var s = state.words[w.word];
      return s && s.fav;
    }).slice(0, 3).map(function (w) {
      return { word: w.word, meaning: w.meaning };
    });

    this.setData({
      streak: st.streak,
      today: st.today,
      learned: st.learned,
      mastered: st.mastered,
      due: st.due,
      accuracy: st.accuracy,
      days: days,
      topics: topics,
      favWords: favWords
    });
  },

  goWords: function () {
    wx.switchTab({ url: "/pages/words/words" });
  }
});

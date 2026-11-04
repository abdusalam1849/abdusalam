var store = require("../../utils/store.js");
var audio = require("../../utils/audio.js");

var BOX_DAYS = { 1: 1, 2: 3, 3: 7, 4: 15, 5: 30 };

Page({
  data: {
    done: false,
    i: 0,
    n: 0,
    pct: 0,
    word: null,
    flipped: false,
    fav: false,
    nextDays: 1,
    known: 0,
    fuzzy: 0,
    again: 0,
    total: 0
  },

  onLoad: function () {
    this.startSession();
  },

  startSession: function () {
    var queue = store.buildStudySession();
    if (!queue.length) {
      wx.showToast({ title: "词库里还没有可学习的单词", icon: "none" });
      setTimeout(function () { wx.navigateBack(); }, 1200);
      return;
    }
    this._queue = queue;
    this._index = 0;
    this._results = [];
    this.loadCard();
  },

  loadCard: function () {
    var w = this._queue[this._index];
    var state = store.getState();
    var st = state.words[w.word] || {};
    var box = st.box || 0;
    this.setData({
      done: false,
      i: this._index,
      n: this._queue.length,
      pct: Math.round((this._index + 1) / this._queue.length * 100),
      word: w,
      flipped: false,
      fav: !!st.fav,
      nextDays: BOX_DAYS[Math.min(5, box + 1)] || 30
    });
  },

  flip: function () {
    if (this.data.done) return;
    this.setData({ flipped: !this.data.flipped });
  },

  rate: function (e) {
    if (!this.data.flipped || this.data.done) return;
    var rating = e.currentTarget.dataset.rating;
    var w = this.data.word;
    store.recordRating(w.word, rating);
    this._results.push({ word: w.word, rating: rating });
    this._index += 1;
    if (this._index >= this._queue.length) {
      this.showSummary();
    } else {
      this.loadCard();
    }
  },

  showSummary: function () {
    var known = 0, fuzzy = 0, again = 0;
    this._results.forEach(function (r) {
      if (r.rating === "known") known += 1;
      else if (r.rating === "fuzzy") fuzzy += 1;
      else again += 1;
    });
    this.setData({
      done: true,
      known: known,
      fuzzy: fuzzy,
      again: again,
      total: this._results.length
    });
  },

  toggleFav: function () {
    if (!this.data.word) return;
    var fav = store.toggleFav(this.data.word.word);
    this.setData({ fav: fav });
    wx.showToast({ title: fav ? "已加入收藏" : "已取消收藏", icon: "none" });
  },

  speak: function () {
    if (this.data.word) audio.speak(this.data.word.word);
  },

  restart: function () {
    this.startSession();
  },

  goHome: function () {
    wx.switchTab({ url: "/pages/index/index" });
  }
});

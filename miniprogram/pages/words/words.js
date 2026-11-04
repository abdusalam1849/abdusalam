var store = require("../../utils/store.js");
var audio = require("../../utils/audio.js");

var FILTERS = [
  { key: "all", label: "全部" },
  { key: "due", label: "待复习" },
  { key: "new", label: "新词" },
  { key: "learning", label: "学习中" },
  { key: "mastered", label: "已掌握" },
  { key: "fav", label: "收藏" }
];

Page({
  data: {
    query: "",
    filter: "all",
    topic: "all",
    filters: FILTERS,
    topics: store.TOPICS,
    list: [],
    total: store.WORDS.length,
    showSheet: false,
    current: null,
    currentStatus: "",
    currentStatusCls: "",
    currentReview: "",
    currentFav: false
  },

  onLoad: function () {
    this.refreshList();
  },

  refreshList: function (overrides) {
    var o = overrides || {};
    var query = o.query !== undefined ? o.query : this.data.query;
    var filter = o.filter !== undefined ? o.filter : this.data.filter;
    var topic = o.topic !== undefined ? o.topic : this.data.topic;
    var q = String(query).trim().toLowerCase();
    var state = store.getState();
    var now = Date.now();

    var list = store.WORDS.filter(function (w) {
      var st = state.words[w.word];
      if (topic !== "all" && w.topic !== topic) return false;
      if (filter === "new" && st && st.seen > 0) return false;
      if (filter === "learning" && !(st && st.seen > 0 && st.box < 4)) return false;
      if (filter === "mastered" && !(st && st.box >= 4)) return false;
      if (filter === "due" && !(st && st.seen > 0 && st.next <= now)) return false;
      if (filter === "fav" && !(st && st.fav)) return false;
      if (q) {
        var hay = (w.word + " " + w.meaning + " " + w.example + " " + w.translation).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    }).map(function (w) {
      var st = state.words[w.word] || {};
      var status = store.statusOf(w.word, state);
      return {
        word: w.word,
        phonetic: w.phonetic,
        pos: w.pos,
        meaning: w.meaning,
        fav: !!st.fav,
        statusCls: status.cls
      };
    });

    this.setData({ list: list, query: query, filter: filter, topic: topic });
  },

  onSearch: function (e) {
    this.refreshList({ query: e.detail.value });
  },

  clearSearch: function () {
    this.refreshList({ query: "" });
  },

  setFilter: function (e) {
    this.refreshList({ filter: e.currentTarget.dataset.filter });
  },

  setTopic: function (e) {
    this.refreshList({ topic: e.currentTarget.dataset.topic });
  },

  toggleFav: function (e) {
    var word = e.currentTarget.dataset.word;
    var fav = store.toggleFav(word);
    if (this.data.current && this.data.current.word === word) {
      this.setData({ currentFav: fav });
    }
    this.refreshList();
    wx.showToast({ title: fav ? "已加入收藏" : "已取消收藏", icon: "none" });
  },

  openWord: function (e) {
    var word = e.currentTarget.dataset.word;
    var state = store.getState();
    var w = store.WORDS.filter(function (x) { return x.word === word; })[0];
    if (!w) return;
    var st = state.words[word] || {};
    var status = store.statusOf(word, state);
    this.setData({
      showSheet: true,
      current: w,
      currentStatus: status.label,
      currentStatusCls: status.cls,
      currentReview: store.reviewText(word, state),
      currentFav: !!st.fav
    });
  },

  closeSheet: function () {
    this.setData({ showSheet: false });
  },

  speakWord: function (e) {
    audio.speak(e.currentTarget.dataset.word);
  },

  speakCurrent: function () {
    if (this.data.current) audio.speak(this.data.current.word);
  },

  toggleCurrentFav: function () {
    if (!this.data.current) return;
    var word = this.data.current.word;
    var fav = store.toggleFav(word);
    this.setData({ currentFav: fav });
    this.refreshList();
    wx.showToast({ title: fav ? "已加入收藏" : "已取消收藏", icon: "none" });
  },

  noop: function () {}
});

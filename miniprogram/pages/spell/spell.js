var store = require("../../utils/store.js");
var audio = require("../../utils/audio.js");

function normalize(s) {
  return String(s || "").toLowerCase().replace(/[^a-z]/g, "");
}

Page({
  data: {
    done: false,
    i: 0,
    n: 0,
    pct: 0,
    score: 0,
    word: null,
    example: "",
    answer: "",
    value: "",
    answered: false,
    ok: false,
    hint: false,
    hintText: "",
    focus: false,
    accuracy: 0,
    wrong: 0
  },

  onLoad: function () {
    this.startSpell();
  },

  startSpell: function () {
    var pool = store.buildPracticePool().slice(0, 8);
    if (!pool.length) {
      wx.showToast({ title: "词库里还没有单词", icon: "none" });
      setTimeout(function () { wx.navigateBack(); }, 1200);
      return;
    }
    this._questions = pool;
    this._index = 0;
    this._score = 0;
    this.loadQuestion();
  },

  loadQuestion: function () {
    var w = this._questions[this._index];
    var self = this;
    this.setData({
      done: false,
      i: this._index,
      n: this._questions.length,
      pct: Math.round((this._index + 1) / this._questions.length * 100),
      word: w,
      example: store.blankExample(w),
      answer: w.word,
      value: "",
      answered: false,
      ok: false,
      hint: false,
      hintText: store.hintPattern(w.word),
      score: this._score,
      focus: false
    });
    setTimeout(function () {
      self.setData({ focus: true });
    }, 180);
  },

  onInput: function (e) {
    this.setData({ value: e.detail.value });
  },

  submit: function () {
    if (this.data.answered) return;
    var val = this.data.value;
    if (!val || !val.trim()) {
      wx.showToast({ title: "先输入你的答案", icon: "none" });
      return;
    }
    var w = this.data.word;
    var ok = normalize(val) === normalize(w.word);
    if (ok) this._score += 1;
    store.recordPractice(w.word, ok);
    this.setData({
      answered: true,
      ok: ok,
      score: this._score
    });
  },

  next: function () {
    if (this._index + 1 >= this._questions.length) {
      var total = this._questions.length;
      this.setData({
        done: true,
        accuracy: total ? Math.round(this._score / total * 100) : 0,
        wrong: total - this._score
      });
      return;
    }
    this._index += 1;
    this.loadQuestion();
  },

  showHint: function () {
    if (this.data.answered) return;
    this.setData({ hint: true });
  },

  speak: function () {
    if (this.data.word) audio.speak(this.data.word.word);
  },

  restart: function () {
    this.startSpell();
  },

  goHome: function () {
    wx.switchTab({ url: "/pages/index/index" });
  }
});

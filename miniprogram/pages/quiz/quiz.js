var store = require("../../utils/store.js");
var audio = require("../../utils/audio.js");

Page({
  data: {
    done: false,
    i: 0,
    n: 0,
    pct: 0,
    score: 0,
    question: null,
    answered: false,
    selected: -1,
    ok: false,
    correctText: "",
    last: false,
    letters: ["A", "B", "C", "D"],
    accuracy: 0,
    wrong: 0
  },

  onLoad: function () {
    this.startQuiz();
  },

  startQuiz: function () {
    var pool = store.buildPracticePool().slice(0, 10);
    if (!pool.length) {
      wx.showToast({ title: "词库里还没有单词", icon: "none" });
      setTimeout(function () { wx.navigateBack(); }, 1200);
      return;
    }
    this._questions = pool.map(function (w, i) { return store.makeQuestion(w, i); });
    this._index = 0;
    this._score = 0;
    this.loadQuestion();
  },

  loadQuestion: function () {
    var q = this._questions[this._index];
    this.setData({
      done: false,
      i: this._index,
      n: this._questions.length,
      pct: Math.round((this._index + 1) / this._questions.length * 100),
      question: q,
      answered: false,
      selected: -1,
      ok: false,
      correctText: "",
      last: this._index + 1 >= this._questions.length
    });
  },

  choose: function (e) {
    if (this.data.answered) return;
    var idx = Number(e.currentTarget.dataset.index);
    var q = this.data.question;
    if (!q.options[idx]) return;
    var ok = q.options[idx].correct;
    if (ok) this._score += 1;
    store.recordPractice(q.word.word, ok);
    this.setData({
      answered: true,
      selected: idx,
      ok: ok,
      score: this._score,
      correctText: q.type === "en2zh" ? q.word.meaning : q.word.word
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

  speak: function () {
    if (this.data.question) audio.speak(this.data.question.word.word);
  },

  restart: function () {
    this.startQuiz();
  },

  goHome: function () {
    wx.switchTab({ url: "/pages/index/index" });
  }
});

/* 学习数据与记忆曲线（本地存储） */
var WORDS = require("../data/words.js");
var TOPICS = ["教育", "环境", "科技", "健康", "社会", "经济", "出行", "传媒"];
var KEY = "ielts_vocab_v1";
var GOAL = 20;
var BOX_DAYS = { 1: 1, 2: 3, 3: 7, 4: 15, 5: 30 };
var DAY = 24 * 60 * 60 * 1000;
var SHORT10 = 10 * 60 * 1000;

function defaultStore() {
  return { words: {}, meta: { days: {} } };
}

function read() {
  try {
    var s = wx.getStorageSync(KEY);
    if (s && s.words && s.meta && s.meta.days) return s;
  } catch (e) { /* ignore */ }
  return defaultStore();
}

function save(s) {
  try {
    var keys = Object.keys(s.meta.days).sort();
    if (keys.length > 180) {
      keys.slice(0, keys.length - 180).forEach(function (k) { delete s.meta.days[k]; });
    }
    wx.setStorageSync(KEY, s);
  } catch (e) { /* ignore */ }
}

function ensure(s, word) {
  if (!s.words[word]) {
    s.words[word] = { box: 0, seen: 0, correct: 0, last: 0, next: 0, fav: false };
  }
  return s.words[word];
}

function dkey(d) {
  var x = d ? new Date(d) : new Date();
  return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
}

function todayKey() { return dkey(new Date()); }

function markToday(s, word) {
  var k = todayKey();
  if (!s.meta.days[k]) s.meta.days[k] = [];
  if (s.meta.days[k].indexOf(word) === -1) s.meta.days[k].push(word);
}

function daysForBox(box) {
  return BOX_DAYS[Math.min(5, Math.max(1, box))] || 30;
}

function recordRating(word, rating) {
  var s = read();
  var st = ensure(s, word);
  var now = Date.now();
  st.seen += 1;
  st.last = now;
  if (rating === "known") {
    st.box = Math.min(5, st.box + 1);
    st.correct += 1;
    st.next = now + daysForBox(st.box) * DAY;
  } else if (rating === "fuzzy") {
    st.next = now + DAY;
  } else {
    st.box = 0;
    st.next = now + SHORT10;
  }
  markToday(s, word);
  save(s);
}

function recordPractice(word, correct) {
  var s = read();
  var st = ensure(s, word);
  var now = Date.now();
  st.seen += 1;
  st.last = now;
  if (correct) {
    st.correct += 1;
    st.box = Math.min(5, st.box + 1);
    st.next = now + daysForBox(st.box) * DAY;
  } else {
    st.box = 0;
    st.next = now + SHORT10;
  }
  markToday(s, word);
  save(s);
}

function toggleFav(word) {
  var s = read();
  var st = ensure(s, word);
  st.fav = !st.fav;
  save(s);
  return st.fav;
}

function computeStreak(s) {
  var n = 0;
  var d = new Date();
  if (!(s.meta.days[dkey(d)] || []).length) d.setDate(d.getDate() - 1);
  while ((s.meta.days[dkey(d)] || []).length) {
    n += 1;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

function stats() {
  var s = read();
  var now = Date.now();
  var learned = 0, mastered = 0, due = 0, fav = 0, seen = 0, correct = 0;
  WORDS.forEach(function (w) {
    var st = s.words[w.word];
    if (!st) return;
    if (st.seen > 0) {
      learned += 1;
      if (st.box >= 4) mastered += 1;
      if (st.next <= now) due += 1;
    }
    if (st.fav) fav += 1;
    seen += st.seen;
    correct += st.correct;
  });
  return {
    learned: learned,
    mastered: mastered,
    due: due,
    fav: fav,
    today: (s.meta.days[todayKey()] || []).length,
    streak: computeStreak(s),
    accuracy: seen ? Math.round((correct / seen) * 100) : 0
  };
}

function last7() {
  var s = read();
  var out = [];
  for (var i = 6; i >= 0; i--) {
    var d = new Date();
    d.setDate(d.getDate() - i);
    var k = dkey(d);
    out.push({
      key: k,
      count: (s.meta.days[k] || []).length,
      label: "日一二三四五六"[d.getDay()],
      isToday: i === 0
    });
  }
  return out;
}

function statusOf(word, state) {
  var s = state || read();
  var st = s.words[word];
  if (!st || !st.seen) return { cls: "", label: "未学习" };
  if (st.box >= 4) return { cls: "mastered", label: "已掌握" };
  return { cls: "studying", label: "学习中" };
}

function reviewText(word, state) {
  var s = state || read();
  var st = s.words[word];
  if (!st || !st.seen) return "开始学习后自动安排复习";
  if (st.next <= Date.now()) return "现在可以复习了";
  var d = Math.ceil((st.next - Date.now()) / DAY);
  return d + " 天后复习 · 第 " + st.box + " 阶段";
}

function buildStudySession() {
  var s = read();
  var now = Date.now();
  var due = [];
  var fresh = [];
  WORDS.forEach(function (w) {
    var st = s.words[w.word];
    if (st && st.seen > 0) {
      if (st.next <= now) due.push(w);
    } else {
      fresh.push(w);
    }
  });
  due.sort(function (a, b) { return s.words[a.word].next - s.words[b.word].next; });
  var room = Math.max(0, GOAL - (s.meta.days[todayKey()] || []).length);
  var queue = due.slice(0, 12).concat(fresh.slice(0, room));
  if (!queue.length) {
    queue = shuffle(WORDS.filter(function (w) {
      return s.words[w.word] && s.words[w.word].seen > 0;
    })).slice(0, 10);
  }
  return queue.slice(0, GOAL);
}

function buildPracticePool() {
  var s = read();
  var now = Date.now();
  var pool = WORDS.filter(function (w) {
    var st = s.words[w.word];
    return !st || st.seen === 0 || st.next <= now || st.box < 3;
  });
  if (pool.length < 6) pool = WORDS.slice();
  return shuffle(pool);
}

function makeQuestion(w, index) {
  var type = index % 2 === 0 ? "en2zh" : "zh2en";
  var needText = type === "en2zh" ? w.meaning : w.word;
  var sameTopic = WORDS.filter(function (x) {
    if (x.word === w.word || x.topic !== w.topic) return false;
    if (type === "en2zh" && x.meaning === needText) return false;
    return true;
  });
  var others = WORDS.filter(function (x) {
    if (x.word === w.word || x.topic === w.topic) return false;
    if (type === "en2zh" && x.meaning === needText) return false;
    return true;
  });
  var picks = shuffle(sameTopic).slice(0, 3);
  if (picks.length < 3) picks = picks.concat(shuffle(others).slice(0, 3 - picks.length));
  var opts = picks.map(function (x) {
    return { text: type === "en2zh" ? x.meaning : x.word, correct: false };
  });
  opts.push({ text: needText, correct: true });
  return { word: w, type: type, options: shuffle(opts) };
}

function hintPattern(word) {
  return word.split(" ").map(function (part) {
    var rest = "";
    for (var i = 1; i < part.length; i++) rest += " _";
    return part.charAt(0) + rest;
  }).join("   ");
}

function blankExample(w) {
  var re = new RegExp("\\b" + escapeReg(w.word) + "(?:s|es|ed|d|ing)?\\b", "i");
  if (re.test(w.example)) return w.example.replace(re, "______");
  return w.example;
}

function escapeReg(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

module.exports = {
  WORDS: WORDS,
  TOPICS: TOPICS,
  GOAL: GOAL,
  getState: read,
  stats: stats,
  last7: last7,
  statusOf: statusOf,
  reviewText: reviewText,
  recordRating: recordRating,
  recordPractice: recordPractice,
  toggleFav: toggleFav,
  buildStudySession: buildStudySession,
  buildPracticePool: buildPracticePool,
  makeQuestion: makeQuestion,
  hintPattern: hintPattern,
  blankExample: blankExample,
  todayKey: todayKey
};

(function () {
  "use strict";

  var WORDS = (window.IELTS_WORDS || []).slice();
  var TOPICS = window.TOPICS || [];
  var STORE_KEY = "ielts_vocab_v1";
  var DAILY_GOAL = 20;
  var BOX_DAYS = { 1: 1, 2: 3, 3: 7, 4: 15, 5: 30 };
  var DAY = 24 * 60 * 60 * 1000;
  var SHORT10 = 10 * 60 * 1000;
  var WEEK = ["日", "一", "二", "三", "四", "五", "六"];
  var FILTERS = [
    { key: "all", label: "全部" },
    { key: "due", label: "待复习" },
    { key: "new", label: "新词" },
    { key: "learning", label: "学习中" },
    { key: "mastered", label: "已掌握" },
    { key: "fav", label: "收藏" }
  ];

  /* ----------------------------- 图标 ----------------------------- */
  var ICON_PATHS = {
    home: '<path d="M3 10.6 12 3.5l9 7.1"/><path d="M5.5 9.4v11.1h13V9.4"/><path d="M9.5 20.5V15h5v5.5"/>',
    book: '<path d="M4.5 5.2A2.2 2.2 0 0 1 6.7 3h12.8v15.6H6.7a2.2 2.2 0 0 0-2.2 2.2V5.2Z"/><path d="M8 7.2h7.6M8 10.6h5.4"/>',
    chart: '<path d="M4 20v-8.5"/><path d="M10 20V4.5"/><path d="M16 20v-6.2"/><path d="M2.5 20h19"/>',
    cards: '<rect x="3" y="6.5" width="12.5" height="13.5" rx="2.5"/><path d="M7 6.5V4.4A1.6 1.6 0 0 1 8.6 2.8H19a2 2 0 0 1 2 2v9.2a1.6 1.6 0 0 1-1.6 1.6H15.5"/>',
    quiz: '<circle cx="12" cy="12" r="9"/><path d="m8 12.2 2.7 2.7 5.6-6"/>',
    pencil: '<path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m13.5 6.5 4 4"/>',
    speaker: '<path d="M11 5 6.2 9H3v6h3.2L11 19V5Z"/><path d="M15.2 8.6a4.8 4.8 0 0 1 0 6.8"/><path d="M18.3 5.6a9 9 0 0 1 0 12.8"/>',
    star: '<path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L4.5 9.8l5.9-.9L12 3.6Z"/>',
    back: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
    flame: '<path d="M12 21c3.6 0 6.2-2.4 6.2-5.8 0-4.2-4-6.7-4-10.9-2.7 1.7-4.9 3.6-4.9 6.3 0-.9-.5-1.8-1.3-2.7-1.7 1.6-2.8 3.8-2.8 7.1C5.2 18.6 8.4 21 12 21Z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    arrow: '<path d="M4.5 12h14.5"/><path d="m13 6 6 6-6 6"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    check: '<path d="M4.5 12.4 9.3 17 19.5 6.8"/>',
    refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.8 4.2v4.6h-4.6"/>'
  };

  function icon(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON_PATHS[name] || "") + "</svg>";
  }

  /* ----------------------------- 工具 ----------------------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
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
  function dkey(d) {
    var x = d ? new Date(d) : new Date();
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
  }
  function todayKey() { return dkey(new Date()); }
  function dateText() {
    var d = new Date();
    return (d.getMonth() + 1) + "月" + d.getDate() + "日 · 星期" + WEEK[d.getDay()];
  }
  function greeting() {
    var h = new Date().getHours();
    if (h < 5) return "夜深了";
    if (h < 11) return "早上好";
    if (h < 14) return "中午好";
    if (h < 18) return "下午好";
    return "晚上好";
  }
  function daysForBox(box) { return BOX_DAYS[Math.min(5, Math.max(1, box))] || 30; }
  function normalizeWord(s) { return String(s || "").toLowerCase().replace(/[^a-z]/g, ""); }

  /* ----------------------------- 数据 ----------------------------- */
  function defaultStore() {
    return { words: {}, meta: { days: {} } };
  }
  var db = loadStore();

  function loadStore() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && s.words && s.meta && s.meta.days) return s;
      }
    } catch (e) { /* ignore */ }
    return defaultStore();
  }
  function save() {
    try {
      var keys = Object.keys(db.meta.days).sort();
      if (keys.length > 180) {
        keys.slice(0, keys.length - 180).forEach(function (k) { delete db.meta.days[k]; });
      }
      localStorage.setItem(STORE_KEY, JSON.stringify(db));
    } catch (e) { /* ignore */ }
  }
  function ensureWord(word) {
    if (!db.words[word]) {
      db.words[word] = { box: 0, seen: 0, correct: 0, last: 0, next: 0, fav: false };
    }
    return db.words[word];
  }
  function markToday(word) {
    var k = todayKey();
    if (!db.meta.days[k]) db.meta.days[k] = [];
    if (db.meta.days[k].indexOf(word) === -1) db.meta.days[k].push(word);
  }

  function recordRating(word, rating) {
    var st = ensureWord(word);
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
    markToday(word);
    save();
  }

  function recordPractice(word, correct) {
    var st = ensureWord(word);
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
    markToday(word);
    save();
  }

  function computeStreak() {
    var n = 0;
    var d = new Date();
    if (!(db.meta.days[dkey(d)] || []).length) d.setDate(d.getDate() - 1);
    while ((db.meta.days[dkey(d)] || []).length) {
      n += 1;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  function stats() {
    var now = Date.now();
    var learned = 0, mastered = 0, due = 0, fav = 0, seen = 0, correct = 0;
    WORDS.forEach(function (w) {
      var s = db.words[w.word];
      if (!s) return;
      if (s.seen > 0) {
        learned += 1;
        if (s.box >= 4) mastered += 1;
        if (s.next <= now) due += 1;
      }
      if (s.fav) fav += 1;
      seen += s.seen;
      correct += s.correct;
    });
    return {
      learned: learned,
      mastered: mastered,
      due: due,
      fav: fav,
      today: (db.meta.days[todayKey()] || []).length,
      streak: computeStreak(),
      accuracy: seen ? Math.round((correct / seen) * 100) : 0
    };
  }

  function last7() {
    var out = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var k = dkey(d);
      out.push({ key: k, count: (db.meta.days[k] || []).length, label: WEEK[d.getDay()], date: d });
    }
    return out;
  }

  function statusOf(word) {
    var s = db.words[word];
    if (!s || !s.seen) return { cls: "", label: "未学习" };
    if (s.box >= 4) return { cls: "mastered", label: "已掌握" };
    return { cls: "studying", label: "学习中" };
  }

  function reviewText(word) {
    var s = db.words[word];
    if (!s || !s.seen) return "开始学习后自动安排复习";
    if (s.next <= Date.now()) return "现在可以复习了";
    var d = Math.ceil((s.next - Date.now()) / DAY);
    return d + " 天后复习 · 第 " + s.box + " 阶段";
  }

  function hintPattern(word) {
    return word.split(" ").map(function (part) {
      return part[0] + " _" + (part.length > 1 ? " _".repeat(part.length - 1) : "");
    }).join("   ");
  }

  function blankExample(w) {
    var safe = esc(w.example);
    var re = new RegExp("\\b" + escapeReg(w.word) + "(?:s|es|ed|d|ing)?\\b", "i");
    if (re.test(safe)) {
      return safe.replace(re, '<span class="blank">______</span>');
    }
    return safe;
  }

  /* ----------------------------- 状态 ----------------------------- */
  var state = {
    view: "home",
    study: null,
    quiz: null,
    spell: null,
    modal: null,
    wordsFilter: { q: "", filter: "all", topic: "all" }
  };

  var viewEl = document.getElementById("view");
  var tabbarEl = document.getElementById("tabbar");
  var overlayEl = document.getElementById("overlay");
  var toastEl = document.getElementById("toast");
  var toastTimer = null;

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 1900);
  }

  function speak(text) {
    if (!text) return;
    if (!("speechSynthesis" in window)) {
      toast("当前浏览器不支持语音朗读");
      return;
    }
    try {
      var u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      u.rate = 0.88;
      u.pitch = 1;
      var voices = window.speechSynthesis.getVoices() || [];
      var v = voices.find(function (x) { return /en[-_]US/i.test(x.lang); }) ||
              voices.find(function (x) { return /^en/i.test(x.lang); });
      if (v) u.voice = v;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) {
      toast("发音失败，请检查浏览器语音设置");
    }
  }

  /* ----------------------------- 会话构建 ----------------------------- */
  function buildStudySession() {
    var now = Date.now();
    var due = [];
    var fresh = [];
    WORDS.forEach(function (w) {
      var s = db.words[w.word];
      if (s && s.seen > 0) {
        if (s.next <= now) due.push(w);
      } else {
        fresh.push(w);
      }
    });
    due.sort(function (a, b) { return db.words[a.word].next - db.words[b.word].next; });
    var room = Math.max(0, DAILY_GOAL - (db.meta.days[todayKey()] || []).length);
    var queue = due.slice(0, 12).concat(fresh.slice(0, room));
    if (!queue.length) {
      queue = shuffle(WORDS.filter(function (w) {
        return db.words[w.word] && db.words[w.word].seen > 0;
      })).slice(0, 10);
    }
    return queue.slice(0, DAILY_GOAL);
  }

  function buildPracticePool() {
    var now = Date.now();
    var pool = WORDS.filter(function (w) {
      var s = db.words[w.word];
      return !s || s.seen === 0 || s.next <= now || s.box < 3;
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

  function startStudy() {
    var queue = buildStudySession();
    if (!queue.length) {
      toast("词库里还没有可学习的单词");
      return;
    }
    state.study = { queue: queue, i: 0, flipped: false, results: [], done: false };
    go("study");
  }

  function startQuiz() {
    var pool = buildPracticePool().slice(0, 10);
    state.quiz = {
      questions: pool.map(function (w, i) { return makeQuestion(w, i); }),
      i: 0, score: 0, answered: false, selected: -1, done: false
    };
    go("quiz");
  }

  function startSpell() {
    var pool = buildPracticePool().slice(0, 8);
    state.spell = {
      questions: pool.map(function (w) { return { word: w }; }),
      i: 0, score: 0, answered: false, ok: false, hint: false, value: "", done: false
    };
    go("spell");
  }

  /* ----------------------------- 视图渲染 ----------------------------- */
  function renderHome() {
    var st = stats();
    var p = Math.min(1, st.today / DAILY_GOAL);
    var sub = st.today === 0
      ? "今日还没开始，先来一组闪卡吧。"
      : (st.today >= DAILY_GOAL ? "今日目标已达成，继续复习会让记忆更牢。" : "再学 " + (DAILY_GOAL - st.today) + " 个词就完成今日目标。");
    var heroTitle = st.today >= DAILY_GOAL ? "今日目标达成" : "还差 " + (DAILY_GOAL - st.today) + " 词";
    var startLabel = st.today > 0 ? "继续今日学习" : "开始今日学习";

    return '' +
      '<div class="page home">' +
        '<header class="home-head">' +
          '<div><p class="date">' + dateText() + '</p><h1 class="greeting">' + greeting() + '，<br>今天背几个词？</h1></div>' +
          '<div class="streak-pill">' + icon("flame") + '<span>' + st.streak + ' 天</span></div>' +
        '</header>' +
        '<section class="hero">' +
          '<div class="hero-top"><span class="eyebrow">TODAY\'S PLAN</span><span class="chip-lite">' + (st.due ? st.due + " 个待复习" : "暂无待复习") + '</span></div>' +
          '<div class="hero-main">' +
            '<div class="ring" style="--p:' + p.toFixed(3) + '"><div class="ring-inner"><strong>' + st.today + '</strong><span>/ ' + DAILY_GOAL + ' 词</span></div></div>' +
            '<div class="hero-text"><span>今日进度</span><strong>' + heroTitle + '<small> · 连续 ' + st.streak + ' 天</small></strong><p>' + sub + '</p></div>' +
          '</div>' +
          '<button class="btn btn-primary btn-block" data-action="start-study">' + startLabel + icon("arrow") + '</button>' +
        '</section>' +
        '<section class="actions">' +
          '<button class="action" data-action="start-study" style="--tint:#e9efff;--accent:#2f5bea">' +
            '<span class="action-ico">' + icon("cards") + '</span>' +
            '<div><h3>闪卡记忆</h3><p>翻卡记忆，按熟练度安排复习</p></div></button>' +
          '<button class="action" data-action="start-quiz" style="--tint:#fdf0d9;--accent:#c9821b">' +
            '<span class="action-ico">' + icon("quiz") + '</span>' +
            '<div><h3>选择题</h3><p>四选一，快速检测掌握度</p></div></button>' +
          '<button class="action" data-action="start-spell" style="--tint:#e4f5ec;--accent:#1f9d63">' +
            '<span class="action-ico">' + icon("pencil") + '</span>' +
            '<div><h3>拼写听音</h3><p>听发音，把单词拼出来</p></div></button>' +
          '<button class="action" data-action="tab" data-view="words" style="--tint:#efeaff;--accent:#7a5af5">' +
            '<span class="action-ico">' + icon("book") + '</span>' +
            '<div><h3>全部词库</h3><p>' + WORDS.length + ' 个雅思核心词</p></div></button>' +
        '</section>' +
        '<div class="mini-stats">' +
          '<div><strong>' + st.learned + '</strong><span>已学单词</span></div>' +
          '<div><strong>' + st.mastered + '</strong><span>已掌握</span></div>' +
          '<div><strong>' + st.fav + '</strong><span>收藏</span></div>' +
        '</div>' +
        '<div class="quote-card"><strong>小提示</strong> · 认识不等于记住，能拼出来的词才算真正掌握。每天 20 词，30 天就是 600 词。</div>' +
      '</div>';
  }

  function renderStudy() {
    var s = state.study;
    if (!s) return renderHome();
    if (s.done) {
      var known = s.results.filter(function (r) { return r.rating === "known"; }).length;
      var fuzzy = s.results.filter(function (r) { return r.rating === "fuzzy"; }).length;
      var again = s.results.filter(function (r) { return r.rating === "again"; }).length;
      return '' +
        '<div class="page"><div class="summary">' +
          '<div class="summary-badge">' + icon("check") + '</div>' +
          '<h2>这一组完成啦</h2>' +
          '<p>共复习 ' + s.results.length + ' 个词，系统已按记忆曲线安排好下次复习。</p>' +
          '<div class="summary-chips">' +
            '<div><strong>' + known + '</strong><span>认识</span></div>' +
            '<div><strong>' + fuzzy + '</strong><span>模糊</span></div>' +
            '<div><strong>' + again + '</strong><span>不熟</span></div>' +
          '</div>' +
          '<div class="summary-actions">' +
            '<button class="btn btn-primary" data-action="restart-study">' + icon("refresh") + '再来一组</button>' +
            '<button class="btn btn-ghost" data-action="back">回到首页</button>' +
          '</div>' +
        '</div></div>';
    }

    var w = s.queue[s.i];
    var st = db.words[w.word] || {};
    var n = s.queue.length;
    var pct = ((s.i + 1) / n) * 100;
    var fav = !!st.fav;
    var nextDays = daysForBox((st.box || 0) + 1);

    return '' +
      '<div class="page study">' +
        '<header class="sub-head">' +
          '<button class="icon-btn" data-action="back" aria-label="返回">' + icon("back") + '</button>' +
          '<div class="sub-title"><span>闪卡记忆</span><small>' + (s.i + 1) + ' / ' + n + '</small></div>' +
          '<button class="icon-btn ' + (fav ? "is-fav" : "") + '" data-action="toggle-fav" data-word="' + esc(w.word) + '" aria-label="收藏">' + icon("star") + '</button>' +
        '</header>' +
        '<div class="progress-line"><i style="width:' + pct + '%"></i></div>' +
        '<div class="flash-card" data-action="flip">' +
          '<div class="flash-inner">' +
            '<div class="face front">' +
              '<span class="topic-chip">' + w.topic + '</span>' +
              '<h2 class="word">' + esc(w.word) + '</h2>' +
              '<button class="speak" data-action="speak" data-text="' + esc(w.word) + '" aria-label="发音">' + icon("speaker") + '</button>' +
              '<p class="phonetic">' + esc(w.phonetic) + '</p>' +
              '<span class="tap-hint">轻点卡片查看释义</span>' +
            '</div>' +
            '<div class="face back">' +
              '<span class="topic-chip">' + w.topic + '</span>' +
              '<h2 class="back-meaning">' + esc(w.meaning) + '</h2>' +
              '<span class="back-pos">' + esc(w.pos) + '</span>' +
              '<button class="speak" data-action="speak" data-text="' + esc(w.word) + '" aria-label="发音">' + icon("speaker") + '</button>' +
              '<div class="example-box"><p class="example">' + esc(w.example) + '</p><p class="example-cn">' + esc(w.translation) + '</p></div>' +
              '<span class="back-hint">轻点卡片翻回正面</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="study-controls">' +
          (s.flipped
            ? '<div class="rating">' +
                '<button class="rate-btn rate-again" data-action="rate" data-rating="again">不熟<small>10 分钟后</small></button>' +
                '<button class="rate-btn rate-fuzzy" data-action="rate" data-rating="fuzzy">模糊<small>明天再复习</small></button>' +
                '<button class="rate-btn rate-known" data-action="rate" data-rating="known">认识<small>' + nextDays + ' 天后</small></button>' +
              '</div><p class="study-note">如实选择，系统会按记忆曲线安排复习</p>'
            : '<button class="btn btn-soft btn-block" style="margin-top:0" data-action="flip">显示释义</button>') +
        '</div>' +
      '</div>';
  }

  function renderQuiz() {
    var s = state.quiz;
    if (!s) return renderHome();
    var total = s.questions.length;
    if (s.done) {
      var acc = total ? Math.round((s.score / total) * 100) : 0;
      return '' +
        '<div class="page"><div class="summary">' +
          '<div class="summary-badge">' + icon("quiz") + '</div>' +
          '<h2>测验完成</h2>' +
          '<p>答对 ' + s.score + ' / ' + total + ' 题，错题已加入短期复习队列。</p>' +
          '<div class="summary-chips">' +
            '<div><strong>' + s.score + '</strong><span>答对题数</span></div>' +
            '<div><strong>' + acc + '%</strong><span>正确率</span></div>' +
            '<div><strong>' + (total - s.score) + '</strong><span>需要巩固</span></div>' +
          '</div>' +
          '<div class="summary-actions">' +
            '<button class="btn btn-primary" data-action="restart-quiz">' + icon("refresh") + '再来一组</button>' +
            '<button class="btn btn-ghost" data-action="back">回到首页</button>' +
          '</div>' +
        '</div></div>';
    }

    var q = s.questions[s.i];
    var answered = s.answered;
    var correctText = q.type === "en2zh" ? q.word.meaning : q.word.word;

    return '' +
      '<div class="page quiz">' +
        '<header class="sub-head">' +
          '<button class="icon-btn" data-action="back" aria-label="返回">' + icon("back") + '</button>' +
          '<div class="sub-title"><span>选择题测验</span><small>' + (s.i + 1) + ' / ' + total + '</small></div>' +
          '<div class="score-pill">' + s.score + ' 分</div>' +
        '</header>' +
        '<div class="progress-line"><i style="width:' + (((s.i + 1) / total) * 100) + '%"></i></div>' +
        '<section class="question-card">' +
          '<p class="q-label">' + (q.type === "en2zh" ? "选出正确的中文释义" : "选出对应的英文单词") + '</p>' +
          '<h2 class="' + (q.type === "en2zh" ? "q-word" : "q-meaning") + '">' + esc(q.type === "en2zh" ? q.word.word : q.word.meaning) + '</h2>' +
          (q.type === "en2zh"
            ? '<p class="q-extra">' + esc(q.word.phonetic) + '<button class="mini-speak" data-action="speak" data-text="' + esc(q.word.word) + '" aria-label="发音">' + icon("speaker") + '</button></p>'
            : '<p class="q-extra">' + esc(q.word.pos) + '</p>') +
        '</section>' +
        '<div class="options">' +
          q.options.map(function (o, i) {
            var cls = "";
            if (answered) cls = o.correct ? "correct" : (i === s.selected ? "wrong" : "dim");
            return '<button class="option ' + cls + '" data-action="quiz-option" data-index="' + i + '"' + (answered ? " disabled" : "") + '>' +
              '<span class="opt-tag">' + "ABCD"[i] + '</span><span>' + esc(o.text) + '</span>' +
              (answered && o.correct ? '<span class="opt-mark">' + icon("check") + '</span>' : "") +
              (answered && !o.correct && i === s.selected ? '<span class="opt-mark">×</span>' : "") +
            '</button>';
          }).join("") +
        '</div>' +
        (answered
          ? '<div class="feedback ' + (q.options[s.selected].correct ? "ok" : "bad") + '">' +
              '<strong>' + (q.options[s.selected].correct ? "回答正确" : "正确答案：" + esc(correctText)) + '</strong>' +
              (q.options[s.selected].correct ? "记忆很稳，继续保持。" : "别急，读一遍例句再记一次。") +
              '<p class="fx-en">' + esc(q.word.example) + '</p>' +
            '</div>' +
            '<div class="after-answer"><button class="btn btn-primary" data-action="quiz-next">' + (s.i + 1 >= total ? "查看结果" : "下一题") + icon("arrow") + '</button></div>'
          : "") +
      '</div>';
  }

  function renderSpell() {
    var s = state.spell;
    if (!s) return renderHome();
    var total = s.questions.length;
    if (s.done) {
      var acc = total ? Math.round((s.score / total) * 100) : 0;
      return '' +
        '<div class="page"><div class="summary">' +
          '<div class="summary-badge">' + icon("pencil") + '</div>' +
          '<h2>拼写练习完成</h2>' +
          '<p>拼对 ' + s.score + ' / ' + total + ' 个词，拼错的词会很快再次出现。</p>' +
          '<div class="summary-chips">' +
            '<div><strong>' + s.score + '</strong><span>拼写正确</span></div>' +
            '<div><strong>' + acc + '%</strong><span>正确率</span></div>' +
            '<div><strong>' + (total - s.score) + '</strong><span>需要巩固</span></div>' +
          '</div>' +
          '<div class="summary-actions">' +
            '<button class="btn btn-primary" data-action="restart-spell">' + icon("refresh") + '再来一组</button>' +
            '<button class="btn btn-ghost" data-action="back">回到首页</button>' +
          '</div>' +
        '</div></div>';
    }

    var w = s.questions[s.i].word;
    var answered = s.answered;

    return '' +
      '<div class="page spell">' +
        '<header class="sub-head">' +
          '<button class="icon-btn" data-action="back" aria-label="返回">' + icon("back") + '</button>' +
          '<div class="sub-title"><span>拼写听音</span><small>' + (s.i + 1) + ' / ' + total + '</small></div>' +
          '<div class="score-pill">' + s.score + ' 分</div>' +
        '</header>' +
        '<div class="progress-line"><i style="width:' + (((s.i + 1) / total) * 100) + '%"></i></div>' +
        '<section class="spell-card">' +
          '<button class="audio-big" data-action="speak" data-text="' + esc(w.word) + '" aria-label="播放发音">' + icon("speaker") + '</button>' +
          '<h2 class="spell-meaning">' + esc(w.meaning) + '</h2>' +
          '<p class="spell-pos">' + esc(w.pos) + ' · ' + esc(w.phonetic) + '</p>' +
          '<p class="spell-example">' + blankExample(w) + '</p>' +
          '<p class="spell-cn">' + esc(w.translation) + '</p>' +
        '</section>' +
        '<div class="spell-input-wrap">' +
          '<input id="spellInput" class="spell-input" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="输入英文单词" value="' + esc(s.value || "") + '"' + (answered ? " disabled" : "") + '>' +
          '<button class="btn btn-primary" data-action="spell-submit"' + (answered ? " disabled" : "") + '>提交</button>' +
        '</div>' +
        '<div class="spell-tools">' +
          '<button class="text-btn" data-action="spell-hint"' + (s.hint || answered ? " disabled" : "") + '>提示：首字母</button>' +
          '<span class="spell-tip">' + w.word.length + ' 个字母</span>' +
        '</div>' +
        (!answered && s.hint ? '<p class="hint-line">' + hintPattern(w.word) + '</p>' : "") +
        (answered
          ? '<div class="feedback ' + (s.ok ? "ok" : "bad") + '">' +
              '<strong>' + (s.ok ? "拼写正确" : "正确拼写：" + esc(w.word)) + '</strong>' +
              (s.ok ? "这个词已加入记忆曲线。" : "再读一遍例句，注意拼写细节。") +
              '<p class="fx-en">' + esc(w.example) + '</p>' +
            '</div>' +
            '<div class="after-answer"><button class="btn btn-primary" data-action="spell-next">' + (s.i + 1 >= total ? "查看结果" : "下一题") + icon("arrow") + '</button></div>'
          : '<p class="spell-tip">听不清可以多点几次发音，先想再拼。</p>') +
      '</div>';
  }

  function renderStats() {
    var st = stats();
    var days = last7();
    var max = Math.max.apply(null, [1].concat(days.map(function (d) { return d.count; })));

    var bars = days.map(function (d) {
      var h = d.count ? Math.max(10, Math.round((d.count / max) * 74)) : 6;
      var isToday = d.key === todayKey();
      return '<div class="bar-item ' + (d.count ? "" : "is-empty ") + (isToday ? "today" : "") + '">' +
        '<span class="bar-val">' + (d.count || "") + '</span>' +
        '<div class="bar" style="height:' + h + 'px"></div>' +
        '<span class="bar-label">' + d.label + '</span>' +
      '</div>';
    }).join("");

    var topicRows = TOPICS.map(function (t) {
      var list = WORDS.filter(function (w) { return w.topic === t; });
      var learned = list.filter(function (w) { return db.words[w.word] && db.words[w.word].seen > 0; }).length;
      var pct = list.length ? Math.round((learned / list.length) * 100) : 0;
      return '<div class="topic-row">' +
        '<span class="topic-name">' + esc(t) + '</span>' +
        '<div class="topic-bar"><i style="width:' + pct + '%"></i></div>' +
        '<span class="topic-count">' + learned + "/" + list.length + '</span>' +
      '</div>';
    }).join("");

    var favWords = WORDS.filter(function (w) {
      var s = db.words[w.word];
      return s && s.fav;
    }).slice(0, 3);

    var favHTML = favWords.length
      ? '<div class="fav-preview">' + favWords.map(function (w) {
          return '<div class="fav-row" data-action="open-word" data-word="' + esc(w.word) + '">' +
            '<span class="fw">' + esc(w.word) + '</span><span class="fm">' + esc(w.meaning) + '</span></div>';
        }).join("") + '</div>'
      : '<div class="empty" style="padding:18px 10px 8px"><p>还没有收藏的单词，去词库点一颗星吧。</p></div>';

    return '' +
      '<div class="page stats">' +
        '<header class="page-head">' +
          '<p class="eyebrow-line">YOUR PROGRESS</p>' +
          '<h1 class="page-title">学习统计</h1>' +
        '</header>' +
        '<section class="streak-card">' +
          '<div class="streak-main">' +
            '<div class="streak-flame">' + icon("flame") + '</div>' +
            '<div><div class="streak-num">' + st.streak + ' 天</div><div class="streak-label">连续学习 · 今日已学 ' + st.today + ' 词</div></div>' +
          '</div>' +
          '<div class="week-dots">' + days.map(function (d) {
            return '<div class="week-dot ' + (d.count ? "on" : "") + ' ' + (d.key === todayKey() ? "today" : "") + '"><i></i><span>' + d.label + '</span></div>';
          }).join("") + '</div>' +
        '</section>' +
        '<div class="metric-grid">' +
          '<div class="metric"><div class="metric-value">' + st.learned + '<small>词</small></div><div class="metric-label">已学单词</div></div>' +
          '<div class="metric"><div class="metric-value">' + st.mastered + '<small>词</small></div><div class="metric-label">已掌握 · 第 4 阶段以上</div></div>' +
          '<div class="metric"><div class="metric-value">' + st.due + '<small>词</small></div><div class="metric-label">待复习</div></div>' +
          '<div class="metric"><div class="metric-value">' + st.accuracy + '<small>%</small></div><div class="metric-label">整体正确率</div></div>' +
        '</div>' +
        '<section class="card">' +
          '<div class="card-head"><h3>最近 7 天</h3><span>学习词数</span></div>' +
          '<div class="bars">' + bars + '</div>' +
        '</section>' +
        '<section class="card">' +
          '<div class="card-head"><h3>主题掌握度</h3><span>已学 / 总数</span></div>' +
          topicRows +
        '</section>' +
        '<section class="card">' +
          '<div class="card-head"><h3>我的收藏</h3><button class="text-btn" data-action="go-fav">查看全部</button></div>' +
          favHTML +
        '</section>' +
      '</div>';
  }

  function filterWords() {
    var f = state.wordsFilter;
    var q = f.q.trim().toLowerCase();
    var now = Date.now();
    return WORDS.filter(function (w) {
      var s = db.words[w.word];
      if (f.topic !== "all" && w.topic !== f.topic) return false;
      if (f.filter === "new" && s && s.seen > 0) return false;
      if (f.filter === "learning" && !(s && s.seen > 0 && s.box < 4)) return false;
      if (f.filter === "mastered" && !(s && s.box >= 4)) return false;
      if (f.filter === "due" && !(s && s.seen > 0 && s.next <= now)) return false;
      if (f.filter === "fav" && !(s && s.fav)) return false;
      if (q) {
        var hay = (w.word + " " + w.meaning + " " + w.example + " " + w.translation).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function wordItems(list) {
    if (!list.length) {
      return '<div class="empty"><div class="empty-ico">' + icon("search") + '</div><p>没有找到匹配的单词<br>换个关键词或筛选条件试试</p></div>';
    }
    return list.map(function (w) {
      var s = db.words[w.word] || {};
      var status = statusOf(w.word);
      return '<div class="word-item" data-action="open-word" data-word="' + esc(w.word) + '" role="button" tabindex="0">' +
        '<span class="status-dot ' + status.cls + '"></span>' +
        '<div class="word-main">' +
          '<div class="word-title"><span class="w">' + esc(w.word) + '</span><span class="p">' + esc(w.phonetic) + '</span></div>' +
          '<div class="word-meaning">' + esc(w.pos) + ' ' + esc(w.meaning) + '</div>' +
        '</div>' +
        '<button class="word-star ' + (s.fav ? "on" : "") + '" data-action="toggle-fav" data-word="' + esc(w.word) + '" aria-label="收藏">' + icon("star") + '</button>' +
      '</div>';
    }).join("");
  }

  function renderWords() {
    var f = state.wordsFilter;
    var list = filterWords();
    return '' +
      '<div class="page words">' +
        '<header class="page-head">' +
          '<p class="eyebrow-line">WORD BANK</p>' +
          '<h1 class="page-title">词库 <span class="count">' + WORDS.length + '</span></h1>' +
        '</header>' +
        '<div class="search">' + icon("search") +
          '<input id="wordSearch" type="search" placeholder="搜索单词、释义或例句" autocomplete="off" value="' + esc(f.q) + '">' +
          '<button class="search-clear ' + (f.q ? "" : "hidden") + '" data-action="clear-search" aria-label="清空">' + icon("close") + '</button>' +
        '</div>' +
        '<div class="chips">' + FILTERS.map(function (x) {
          return '<button class="chip-btn ' + (f.filter === x.key ? "on" : "") + '" data-action="filter" data-filter="' + x.key + '">' + x.label + '</button>';
        }).join("") + '</div>' +
        '<div class="topic-scroll">' +
          '<button class="topic-btn ' + (f.topic === "all" ? "on" : "") + '" data-action="topic" data-topic="all">全部主题</button>' +
          TOPICS.map(function (t) {
            return '<button class="topic-btn ' + (f.topic === t ? "on" : "") + '" data-action="topic" data-topic="' + t + '">' + t + '</button>';
          }).join("") +
        '</div>' +
        '<div class="word-list" id="wordListBody">' + wordItems(list) + '</div>' +
      '</div>';
  }

  function renderOverlay() {
    if (!state.modal) { overlayEl.innerHTML = ""; return; }
    var w = WORDS.find(function (x) { return x.word === state.modal; });
    if (!w) { overlayEl.innerHTML = ""; return; }
    var s = db.words[w.word] || {};
    var status = statusOf(w.word);
    var fav = !!s.fav;
    overlayEl.innerHTML = '' +
      '<div class="sheet-backdrop" data-action="close-sheet"></div>' +
      '<div class="sheet">' +
        '<div class="sheet-handle"></div>' +
        '<button class="sheet-close" data-action="close-sheet" aria-label="关闭">' + icon("close") + '</button>' +
        '<div class="sheet-word-row">' +
          '<h2 class="sheet-word">' + esc(w.word) + '</h2>' +
          '<button class="sheet-speak" data-action="speak" data-text="' + esc(w.word) + '" aria-label="发音">' + icon("speaker") + '</button>' +
        '</div>' +
        '<p class="sheet-phon">' + esc(w.phonetic) + ' · ' + esc(w.topic) + '</p>' +
        '<p class="sheet-meaning"><span class="sheet-pos">' + esc(w.pos) + '</span>' + esc(w.meaning) + '</p>' +
        '<div class="sheet-example"><p class="en">' + esc(w.example) + '</p><p class="cn">' + esc(w.translation) + '</p></div>' +
        '<div class="sheet-status"><span class="status-dot ' + status.cls + '"></span>' + status.label + ' · ' + reviewText(w.word) + '</div>' +
        '<div class="sheet-actions">' +
          '<button class="btn ' + (fav ? "btn-fav-on" : "btn-soft") + '" data-action="toggle-fav" data-word="' + esc(w.word) + '">' + icon("star") + (fav ? "已收藏" : "收藏") + '</button>' +
          '<button class="btn btn-ghost" data-action="speak" data-text="' + esc(w.word) + '">' + icon("speaker") + '发音</button>' +
        '</div>' +
      '</div>';
  }

  function openSheet(word) {
    state.modal = word;
    renderOverlay();
  }
  function closeSheet() {
    state.modal = null;
    overlayEl.innerHTML = "";
  }

  function toggleFav(word) {
    var st = ensureWord(word);
    st.fav = !st.fav;
    save();
    if (st.fav) toast("已加入收藏");
    if (state.modal === word) renderOverlay();
    if (state.view === "study") {
      var starBtn = document.querySelector(".sub-head .icon-btn:last-child");
      if (starBtn) starBtn.classList.toggle("is-fav", st.fav);
    } else {
      render();
    }
  }

  /* ----------------------------- 路由 ----------------------------- */
  var viewRenderers = {
    home: renderHome,
    study: renderStudy,
    quiz: renderQuiz,
    spell: renderSpell,
    stats: renderStats,
    words: renderWords
  };

  function render() {
    viewEl.innerHTML = viewRenderers[state.view]();
    var learning = state.view === "study" || state.view === "quiz" || state.view === "spell";
    tabbarEl.classList.toggle("hidden", learning);
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) {
      t.classList.toggle("is-active", t.dataset.view === state.view);
    });
    if (state.view === "study" && state.study && state.study.flipped && !state.study.done) {
      var card = viewEl.querySelector(".flash-card");
      if (card) {
        void card.offsetWidth;
        card.classList.add("flipped");
      }
    }
    if (state.view === "spell") {
      var inp = document.getElementById("spellInput");
      if (inp && !inp.disabled) {
        inp.focus();
        try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (e) { /* ignore */ }
      }
    }
  }

  function go(view) {
    state.view = view;
    window.scrollTo(0, 0);
    closeSheet();
    render();
  }

  /* ----------------------------- 交互 ----------------------------- */
  function rateStudy(rating) {
    var s = state.study;
    if (!s || !s.flipped) return;
    var w = s.queue[s.i];
    recordRating(w.word, rating);
    s.results.push({ word: w.word, rating: rating });
    s.i += 1;
    s.flipped = false;
    if (s.i >= s.queue.length) s.done = true;
    render();
  }

  function answerQuiz(index) {
    var s = state.quiz;
    if (!s || s.answered || s.done) return;
    var q = s.questions[s.i];
    if (!q.options[index]) return;
    s.selected = index;
    s.answered = true;
    var ok = q.options[index].correct;
    if (ok) s.score += 1;
    recordPractice(q.word.word, ok);
    render();
  }

  function nextQuiz() {
    var s = state.quiz;
    if (!s) return;
    if (s.i + 1 >= s.questions.length) {
      s.done = true;
    } else {
      s.i += 1;
      s.answered = false;
      s.selected = -1;
    }
    render();
  }

  function submitSpell() {
    var s = state.spell;
    if (!s || s.answered) return;
    var inp = document.getElementById("spellInput");
    var val = inp ? inp.value : s.value;
    if (!val || !val.trim()) {
      toast("先输入你的答案");
      if (inp) inp.focus();
      return;
    }
    var w = s.questions[s.i].word;
    var ok = normalizeWord(val) === normalizeWord(w.word);
    s.value = val;
    s.answered = true;
    s.ok = ok;
    if (ok) s.score += 1;
    recordPractice(w.word, ok);
    render();
  }

  function nextSpell() {
    var s = state.spell;
    if (!s) return;
    if (s.i + 1 >= s.questions.length) {
      s.done = true;
    } else {
      s.i += 1;
      s.answered = false;
      s.ok = false;
      s.hint = false;
      s.value = "";
    }
    render();
  }

  function renderWordListOnly() {
    var body = document.getElementById("wordListBody");
    if (body) body.innerHTML = wordItems(filterWords());
  }

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-action]");
    if (!el) return;
    var action = el.dataset.action;

    if (action === "speak") {
      e.stopPropagation();
      speak(el.dataset.text);
      return;
    }

    switch (action) {
      case "tab": go(el.dataset.view); break;
      case "back": go("home"); break;
      case "start-study": startStudy(); break;
      case "start-quiz": startQuiz(); break;
      case "start-spell": startSpell(); break;
      case "restart-study": startStudy(); break;
      case "restart-quiz": startQuiz(); break;
      case "restart-spell": startSpell(); break;
      case "flip":
        if (state.study) {
          state.study.flipped = !state.study.flipped;
          render();
        }
        break;
      case "rate": rateStudy(el.dataset.rating); break;
      case "quiz-option": answerQuiz(Number(el.dataset.index)); break;
      case "quiz-next": nextQuiz(); break;
      case "spell-submit": submitSpell(); break;
      case "spell-next": nextSpell(); break;
      case "spell-hint":
        if (state.spell) {
          state.spell.hint = true;
          render();
        }
        break;
      case "open-word": openSheet(el.dataset.word); break;
      case "close-sheet": closeSheet(); break;
      case "toggle-fav": toggleFav(el.dataset.word); break;
      case "clear-search":
        state.wordsFilter.q = "";
        render();
        break;
      case "filter":
        state.wordsFilter.filter = el.dataset.filter;
        render();
        break;
      case "topic":
        state.wordsFilter.topic = el.dataset.topic;
        render();
        break;
      case "go-fav":
        state.wordsFilter.filter = "fav";
        state.wordsFilter.q = "";
        state.wordsFilter.topic = "all";
        go("words");
        break;
      default: break;
    }
  });

  document.addEventListener("input", function (e) {
    if (e.target.id === "wordSearch") {
      state.wordsFilter.q = e.target.value;
      renderWordListOnly();
      var clearBtn = document.querySelector(".search-clear");
      if (clearBtn) clearBtn.classList.toggle("hidden", !e.target.value);
    } else if (e.target.id === "spellInput") {
      if (state.spell) state.spell.value = e.target.value;
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && state.modal) {
      closeSheet();
      return;
    }
    if (e.key === "Enter" && state.view === "spell") {
      var active = document.activeElement;
      if (active && active.id === "spellInput") {
        e.preventDefault();
        if (state.spell && !state.spell.answered) submitSpell();
        else if (state.spell && state.spell.answered) nextSpell();
      }
    }
  });

  /* ----------------------------- 启动 ----------------------------- */
  Array.prototype.forEach.call(document.querySelectorAll("[data-icon]"), function (el) {
    el.innerHTML = icon(el.dataset.icon);
  });

  if (!WORDS.length) {
    viewEl.innerHTML = '<div class="empty"><p>词库加载失败，请确认 js/words.js 已正确引入。</p></div>';
  } else {
    render();
  }
})();

/* =========================================================
   حسابان ۱ — core: state, sound, theme, router, effects
   ========================================================= */
(function () {
  'use strict';

  const AWG = (window.AWG = window.AWG || {});
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const fa = (n) => String(n).replace(/[0-9]/g, (d) => FA_DIGITS[+d]);
  const faNum = (n) => fa(Number(n).toLocaleString('en-US'));

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function dateKey(d) {
    const dt = d || new Date();
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function yesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return dateKey(d);
  }

  function relTime(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'همین حالا';
    if (min < 60) return `${fa(min)} دقیقه پیش`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${fa(h)} ساعت پیش`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${fa(d)} روز پیش`;
    return new Date(iso).toLocaleDateString('fa-IR');
  }

  /* ---------- KaTeX ---------- */
  function renderMath(el) {
    if (!el || !window.renderMathInElement) return;
    try {
      renderMathInElement(el, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false }
        ],
        throwOnError: false,
        strict: false,
        trust: false,
        ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
      });
    } catch (e) { /* never break the page for a formula */ }
  }

  function tex(tex, display) {
    if (window.katex) {
      try { return katex.renderToString(tex, { displayMode: !!display, throwOnError: false, strict: false }); }
      catch (e) { /* fall through */ }
    }
    return `<span class="math-fallback">${esc(tex)}</span>`;
  }

  /* ---------- Levels ---------- */
  const LEVELS = [
    { min: 0, name: 'تازه‌کار', icon: '✦' },
    { min: 80, name: 'کنجکاو', icon: '✧' },
    { min: 200, name: 'دنباله‌دون', icon: '∑' },
    { min: 400, name: 'معادله‌ساز', icon: '⌁' },
    { min: 700, name: 'ریشه‌باز', icon: '√' },
    { min: 1100, name: 'سهمی‌سرا', icon: '⌒' },
    { min: 1600, name: 'قدرمطلق', icon: '|x|' },
    { min: 2300, name: 'هندسه‌دان', icon: '△' },
    { min: 3200, name: 'حسابان‌کار', icon: '∞' }
  ];

  function levelFor(xp) {
    let idx = 0;
    for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i].min) idx = i;
    return idx;
  }

  function levelInfo(xp) {
    const idx = levelFor(xp);
    const cur = LEVELS[idx];
    const next = LEVELS[idx + 1] || null;
    const span = next ? next.min - cur.min : 1;
    const into = xp - cur.min;
    return {
      index: idx, ...cur, next,
      progress: next ? clamp(into / span, 0, 1) : 1,
      toNext: next ? next.min - xp : 0
    };
  }

  /* ---------- Badges ---------- */
  const BADGES = [
    { id: 'first', icon: '🌱', name: 'اولین قدم', desc: 'اولین سؤال را جواب بزن', check: (s) => s.stats.answered >= 1 },
    { id: 'ten', icon: '🔥', name: 'ده‌تایی', desc: '۱۰ پاسخ درست ثبت کن', check: (s) => s.stats.correct >= 10 },
    { id: 'streak5', icon: '⚡', name: 'زنجیره ۵', desc: '۵ پاسخ درست پشت‌سرهم', check: (s) => s.stats.bestStreak >= 5 },
    { id: 'streak10', icon: '🌪️', name: 'زنجیره ۱۰', desc: '۱۰ پاسخ درست پشت‌سرهم', check: (s) => s.stats.bestStreak >= 10 },
    { id: 'perfect', icon: '💎', name: 'بی‌نقص', desc: 'یک تمرین کامل بدون خطا', check: (s) => s.stats.perfect >= 1 },
    { id: 'l1', icon: '📈', name: 'دنباله‌باز', desc: 'درس ۱ را به ۸۰٪ برسان', check: (s) => Store.masteryOf('1') >= 80 },
    { id: 'l2', icon: '🧮', name: 'ریشه‌یاب', desc: 'درس ۲ را به ۸۰٪ برسان', check: (s) => Store.masteryOf('2') >= 80 },
    { id: 'l3', icon: '🧪', name: 'گویا و گنگ', desc: 'درس ۳ را به ۸۰٪ برسان', check: (s) => Store.masteryOf('3') >= 80 },
    { id: 'l4', icon: '📏', name: 'قدر‌مطلق', desc: 'درس ۴ را به ۸۰٪ برسان', check: (s) => Store.masteryOf('4') >= 80 },
    { id: 'l5', icon: '📐', name: 'هندسه‌دان', desc: 'درس ۵ را به ۸۰٪ برسان', check: (s) => Store.masteryOf('5') >= 80 },
    { id: 'all', icon: '🏆', name: 'فاتح فصل', desc: 'هر ۵ درس را بالای ۷۰٪ ببر', check: () => [1, 2, 3, 4, 5].every((i) => Store.masteryOf(String(i)) >= 70) },
    { id: 'exam', icon: '🎓', name: 'آزمون‌شکن', desc: 'در آزمون نهایی بالای ۷۰٪ بگیر', check: (s) => s.stats.examBest >= 70 },
    { id: 'daily', icon: '📅', name: 'روزانه', desc: 'چالش روزانه را کامل کن', check: (s) => s.stats.dailyDone >= 1 },
    { id: 'night', icon: '🌙', name: 'شب‌امتحان', desc: 'بعد از نیمه‌شب هم تمرین کن', check: (s) => s.stats.nightOwl >= 1 }
  ];

  /* ---------- Store ---------- */
  const DEFAULTS = {
    version: 1,
    xp: 0,
    streak: 0,
    lastActive: null,
    history: [],
    lessons: {},
    stats: { answered: 0, correct: 0, perfect: 0, quizzes: 0, bestStreak: 0, examBest: 0, dailyDone: 0, nightOwl: 0 },
    badges: {},
    settings: {
      theme: 'dark', font: 'medium', reduceMotion: false,
      sound: true, volume: 0.6, music: false, musicVolume: 0.22
    },
    daily: { date: null, done: false, score: 0, total: 0 }
  };

  const Store = {
    key: 'hesaban-lab-v1',
    legacyKey: 'hesaban-settings',
    state: null,
    storageOK: true,
    load() {
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(this.key) || 'null'); } catch (e) { saved = null; }
      this.state = this.normalize(saved || {});
      this.migrateLegacy();
      this.touchStreak(false);
      this.save();
      this.bindStorage();
      return this.state;
    },
    // Another tab wrote a newer state: adopt it instead of overwriting it later with our stale copy.
    // XP is merged to the larger value so points earned in either tab are never lost.
    bindStorage() {
      if (this._storageBound || typeof window === 'undefined' || !window.addEventListener) return;
      this._storageBound = true;
      window.addEventListener('storage', (e) => {
        if (!e || e.key !== this.key || !e.newValue) return;
        try {
          const incoming = JSON.parse(e.newValue);
          if (!incoming || typeof incoming !== 'object') return;
          const keepXP = Math.max(this.state.xp || 0, typeof incoming.xp === 'number' && isFinite(incoming.xp) ? Math.floor(incoming.xp) : 0);
          this.state = this.normalize(incoming);
          if (keepXP > this.state.xp) this.state.xp = keepXP;
          if (typeof AWG.onStateSync === 'function') AWG.onStateSync();
        } catch (err) { /* ignore malformed writes */ }
      });
    },
    normalize(raw) {
      const s = JSON.parse(JSON.stringify(DEFAULTS));
      if (raw && typeof raw === 'object') {
        const rawXP = typeof raw.xp === 'string' && raw.xp.trim() !== '' ? Number(raw.xp) : raw.xp;
        if (typeof rawXP === 'number' && isFinite(rawXP)) s.xp = Math.max(0, Math.floor(rawXP));
        if (typeof raw.streak === 'number') s.streak = Math.max(0, Math.floor(raw.streak));
        if (typeof raw.lastActive === 'string') s.lastActive = raw.lastActive;
        if (Array.isArray(raw.history)) s.history = raw.history.slice(0, 80);
        if (raw.lessons && typeof raw.lessons === 'object') s.lessons = raw.lessons;
        if (raw.stats && typeof raw.stats === 'object') s.stats = Object.assign(s.stats, raw.stats);
        if (raw.badges && typeof raw.badges === 'object') s.badges = raw.badges;
        if (raw.settings && typeof raw.settings === 'object') s.settings = Object.assign(s.settings, raw.settings);
        if (raw.daily && typeof raw.daily === 'object') s.daily = Object.assign(s.daily, raw.daily);
      }
      return s;
    },
    migrateLegacy() {
      try {
        const raw = localStorage.getItem(this.legacyKey);
        if (!raw) return;
        const old = JSON.parse(raw);
        if (old && typeof old.theme === 'string' && !localStorage.getItem(this.key + '.migrated')) {
          if (['dark', 'light', 'system'].includes(old.theme)) this.state.settings.theme = old.theme;
          if (['small', 'medium', 'large'].includes(old.fontSize)) this.state.settings.font = old.fontSize;
          if (typeof old.enabled === 'boolean') this.state.settings.sound = old.enabled;
          if (typeof old.reduceMotion === 'boolean') this.state.settings.reduceMotion = old.reduceMotion;
          localStorage.setItem(this.key + '.migrated', '1');
        }
      } catch (e) { /* ignore */ }
    },
    save() {
      try {
        localStorage.setItem(this.key, JSON.stringify(this.state));
        this.storageOK = true;
      } catch (e) {
        this.storageOK = false; /* storage unavailable (private mode / sandboxed frame): keep in memory */
      }
    },
    resetProgress() {
      const settings = JSON.parse(JSON.stringify(this.state.settings));
      this.state = JSON.parse(JSON.stringify(DEFAULTS));
      this.state.settings = settings;
      this.save();
    },
    resetAll() {
      this.state = JSON.parse(JSON.stringify(DEFAULTS));
      this.save();
    },
    touchStreak(mark) {
      const today = dateKey();
      const st = this.state;
      if (st.lastActive === today) return st.streak;
      if (st.lastActive === yesterdayKey()) st.streak += 1;
      else st.streak = 1;
      st.lastActive = today;
      if (mark !== false) this.save();
      return st.streak;
    },
    lesson(id) {
      const key = String(id);
      if (!this.state.lessons[key]) {
        this.state.lessons[key] = { attempts: 0, correct: 0, recent: [], best: 0, bestTotal: 0 };
      }
      return this.state.lessons[key];
    },
    masteryOf(id) {
      const l = this.state.lessons[String(id)];
      if (!l || !l.attempts) return 0;
      const overall = l.correct / l.attempts;
      const recent = l.recent && l.recent.length ? l.recent.reduce((a, b) => a + b, 0) / l.recent.length : overall;
      return Math.round((overall * 0.45 + recent * 0.55) * 100);
    },
    recordAnswer(lessonId, correct, level) {
      const st = this.state;
      const l = this.lesson(lessonId);
      l.attempts += 1;
      if (correct) l.correct += 1;
      l.recent.push(correct ? 1 : 0);
      if (l.recent.length > 20) l.recent = l.recent.slice(-20);
      st.stats.answered += 1;
      if (correct) st.stats.correct += 1;
      this.touchStreak();
      const hour = new Date().getHours();
      if (hour >= 0 && hour < 5) st.stats.nightOwl += 1;
      this.save();
      return this.masteryOf(lessonId);
    },
    recordQuiz(lessonId, score, total, mode, xpEarned) {
      const st = this.state;
      st.stats.quizzes += 1;
      if (score === total) st.stats.perfect += 1;
      if (mode === 'exam' || mode === 'final') st.stats.examBest = Math.max(st.stats.examBest, Math.round((score / total) * 100));
      if (lessonId && lessonId !== 'mixed') {
        const l = this.lesson(lessonId);
        if (score / total > l.best) { l.best = score / total; l.bestTotal = total; }
      }
      st.history.unshift({
        date: new Date().toISOString(),
        source: lessonId || 'mixed',
        mode: mode || 'practice',
        score, total,
        pct: Math.round((score / total) * 100),
        xp: xpEarned || 0
      });
      if (st.history.length > 80) st.history = st.history.slice(0, 80);
      this.save();
    },
    addXP(amount, reason) {
      const before = levelFor(this.state.xp);
      this.state.xp = Math.max(0, this.state.xp + Math.round(amount));
      const after = levelFor(this.state.xp);
      this.save();
      const leveled = after > before;
      if (leveled) {
        Sound.play('level');
        Confetti.celebrate(90);
        Toast.show(`ارتقای سطح! به «${LEVELS[after].name}» رسیدی`, 'good', 3600);
      }
      if (reason) {
        // small floating xp indicator near the chip
        const chip = $('#xpChip');
        if (chip && amount > 0) {
          chip.classList.remove('xp-pop');
          void chip.offsetWidth;
          chip.classList.add('xp-pop');
        }
      }
      return { leveled, level: after, xp: this.state.xp };
    },
    checkBadges() {
      const st = this.state;
      const unlocked = [];
      BADGES.forEach((b) => {
        if (!st.badges[b.id]) {
          let ok = false;
          try { ok = !!b.check(st); } catch (e) { ok = false; }
          if (ok) {
            st.badges[b.id] = new Date().toISOString();
            unlocked.push(b);
          }
        }
      });
      if (unlocked.length) {
        this.save();
        unlocked.forEach((b, i) => {
          setTimeout(() => {
            Toast.show(`${b.icon} نشان جدید: «${b.name}»`, 'good', 3600);
            Sound.play('achievement');
          }, i * 500);
        });
        Confetti.celebrate(70);
      }
      return unlocked;
    }
  };

  /* ---------- Sound ---------- */
  const Sound = {
    ctx: null, master: null, fx: null, musicGain: null,
    musicTimer: null, musicPlaying: false, unlocked: false,
    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        return true;
      }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.fx = this.ctx.createGain();
        this.fx.connect(this.master);
        this.musicGain = this.ctx.createGain();
        this.musicGain.connect(this.master);
        this.applyVolumes();
        return true;
      } catch (e) { return false; }
    },
    unlock() {
      if (!this.init()) return;
      this.unlocked = true;
      const s = Store.state.settings;
      if (s.music && !this.musicPlaying) this.startMusic();
    },
    applyVolumes() {
      if (!this.ctx) return;
      const s = Store.state.settings;
      const t = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(s.sound ? 1 : 0, t, 0.03);
      this.fx.gain.setTargetAtTime(s.volume, t, 0.03);
      this.musicGain.gain.setTargetAtTime(s.musicVolume * 0.55, t, 0.08);
    },
    tone(freq, dur, type, gain, delay, dest) {
      if (!this.ctx || !Store.state.settings.sound) return;
      const t = this.ctx.currentTime + (delay || 0);
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain || 0.08), t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(dest || this.fx);
      osc.start(t);
      osc.stop(t + dur + 0.03);
    },
    play(name) {
      if (!this.init()) return;
      if (!Store.state.settings.sound) return;
      switch (name) {
        case 'click': this.tone(720, 0.055, 'sine', 0.035); break;
        case 'tap': this.tone(560, 0.06, 'triangle', 0.04); break;
        case 'correct':
          [523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, 0.28, 'sine', 0.075, i * 0.075));
          break;
        case 'wrong':
          [392, 293.66, 196].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.055, i * 0.09));
          break;
        case 'achievement':
          [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.tone(f, 0.4, 'sine', 0.065, i * 0.09));
          break;
        case 'level':
          [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.07, i * 0.11));
          break;
        case 'tick': this.tone(1040, 0.03, 'square', 0.018); break;
        case 'whoosh': this.tone(220, 0.12, 'sine', 0.03); break;
        default: this.tone(660, 0.06, 'sine', 0.03);
      }
    },
    startMusic() {
      if (!this.init() || this.musicPlaying) return;
      if (!Store.state.settings.music) return;
      this.musicPlaying = true;
      const chords = [
        [261.63, 329.63, 392.0],
        [220.0, 261.63, 329.63],
        [174.61, 220.0, 261.63],
        [196.0, 246.94, 293.66]
      ];
      const melody = [523.25, 587.33, 659.25, 783.99, 659.25, 587.33];
      let step = 0;
      const playChord = () => {
        if (!this.musicPlaying || !this.ctx) return;
        const chord = chords[step % chords.length];
        const t = this.ctx.currentTime;
        chord.forEach((f, i) => {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = f;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.05, t + 1.1);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 4.1);
          osc.connect(g); g.connect(this.musicGain);
          osc.start(t); osc.stop(t + 4.2);
        });
        if (step % 2 === 1) {
          const m = melody[step % melody.length];
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'triangle'; osc.frequency.value = m;
          g.gain.setValueAtTime(0.0001, t + 0.9);
          g.gain.exponentialRampToValueAtTime(0.018, t + 1.05);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
          osc.connect(g); g.connect(this.musicGain);
          osc.start(t + 0.9); osc.stop(t + 2.3);
        }
        step++;
      };
      playChord();
      this.musicTimer = setInterval(playChord, 4200);
    },
    stopMusic() {
      this.musicPlaying = false;
      if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
    },
    setMusic(on) {
      if (on) { this.unlock(); this.startMusic(); }
      else this.stopMusic();
    }
  };

  /* ---------- Theme ---------- */
  const Theme = {
    mq: window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null,
    resolved() {
      const pref = Store.state.settings.theme;
      if (pref === 'system') return this.mq && this.mq.matches ? 'dark' : 'light';
      return pref === 'light' ? 'light' : 'dark';
    },
    apply() {
      const t = this.resolved();
      document.documentElement.setAttribute('data-theme', t);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', t === 'dark' ? '#0d1512' : '#f4f1e6');
      document.documentElement.setAttribute('data-font', Store.state.settings.font);
      document.documentElement.classList.toggle('reduce-motion', !!Store.state.settings.reduceMotion);
      if (window.AWG && AWG.onThemeChange) AWG.onThemeChange(t);
    },
    init() {
      this.apply();
      if (this.mq) {
        const handler = () => { if (Store.state.settings.theme === 'system') this.apply(); };
        if (this.mq.addEventListener) this.mq.addEventListener('change', handler);
        else if (this.mq.addListener) this.mq.addListener(handler);
      }
    },
    cycle() {
      const order = ['dark', 'light', 'system'];
      const cur = Store.state.settings.theme;
      const next = order[(order.indexOf(cur) + 1) % order.length];
      Store.state.settings.theme = next;
      Store.save();
      this.apply();
      Toast.show(next === 'system' ? 'حالت نمایش: هماهنگ با سیستم' : next === 'light' ? 'حالت نمایش: دفتر' : 'حالت نمایش: تخته‌سیاه', 'good');
    }
  };

  /* ---------- Toast ---------- */
  const Toast = {
    el: null, timer: null,
    show(msg, type, dur) {
      this.el = this.el || document.getElementById('toast');
      if (!this.el) return;
      this.el.textContent = msg;
      this.el.className = 'toast show' + (type ? ' ' + type : '');
      clearTimeout(this.timer);
      this.timer = setTimeout(() => { this.el.classList.remove('show'); }, dur || 2600);
    },
    init() {
      this.el = document.getElementById('toast');
    }
  };

  /* ---------- Confetti ---------- */
  const Confetti = {
    canvas: null, ctx: null, parts: [], raf: null, colors: ['#f2e85c', '#ff8a70', '#7fe7c4', '#8ab4ff', '#ffffff'],
    init() {
      this.canvas = document.getElementById('confetti');
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');
      if (!this.ctx) return;
      this.resize();
      window.addEventListener('resize', () => this.resize());
    },
    resize() {
      if (!this.canvas || !this.ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = window.innerWidth * dpr;
      this.canvas.height = window.innerHeight * dpr;
      this.canvas.style.width = window.innerWidth + 'px';
      this.canvas.style.height = window.innerHeight + 'px';
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },
    burst(x, y, count) {
      if (Store.state.settings.reduceMotion) return;
      if (!this.ctx) this.init();
      if (!this.ctx) return;
      const n = count || 40;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 2 + Math.random() * 7;
        this.parts.push({
          x, y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 3,
          g: 0.14 + Math.random() * 0.12,
          w: 4 + Math.random() * 6,
          h: 3 + Math.random() * 5,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.25,
          life: 1,
          decay: 0.008 + Math.random() * 0.012,
          color: pick(this.colors)
        });
      }
      if (!this.raf) this.loop();
    },
    celebrate(count) {
      if (Store.state.settings.reduceMotion) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.burst(w * 0.5, h * 0.32, count || 80);
      setTimeout(() => this.burst(w * 0.2, h * 0.28, Math.round((count || 80) * 0.55)), 180);
      setTimeout(() => this.burst(w * 0.8, h * 0.3, Math.round((count || 80) * 0.55)), 320);
    },
    loop() {
      this.raf = requestAnimationFrame(() => this.loop());
      if (!this.ctx) return;
      this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      this.parts = this.parts.filter((p) => p.life > 0 && p.y < window.innerHeight + 40);
      if (!this.parts.length) {
        cancelAnimationFrame(this.raf);
        this.raf = null;
        this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        return;
      }
      this.parts.forEach((p) => {
        p.vy += p.g;
        p.vx *= 0.995;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= p.decay;
        this.ctx.save();
        this.ctx.globalAlpha = Math.max(0, p.life);
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate(p.rot);
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        this.ctx.restore();
      });
    }
  };

  /* ---------- Icons ---------- */
  const ICONS = {
    arrow: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    arrowLeft: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="m5 13 4 4L19 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    play: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 5h4v14H7zM14 5h4v14h-4z" fill="currentColor"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 6.3M20 4v7h-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    flame: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 3c1 3-2 4-2 7a4 4 0 0 0 8 0c0-2-1-3-1-5-1 1-2 2-2 3 0-2-1-4-3-5z" fill="currentColor"/></svg>',
    book: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 0 4 23V5.5z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 5.5A2.5 2.5 0 0 0 6.5 8H20" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    target: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M8 4h8v4a4 4 0 0 1-8 0V4zM8 5H5a3 3 0 0 0 3 4M16 5h3a3 3 0 0 1-3 4M12 12v4m-4 4h8m-7 0 1-4h4l1 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    spark: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 2l1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6z" fill="currentColor"/></svg>',
    drag: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M9 11V6a1.5 1.5 0 0 1 3 0v5m0-3a1.5 1.5 0 0 1 3 0v3m0-1a1.5 1.5 0 0 1 3 0v4a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-3.4L3 14a1.5 1.5 0 0 1 2.5-1.6L7 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  /* ---------- Router ---------- */
  const Router = {
    handlers: [],
    current: null,
    parse() {
      const raw = (location.hash || '#/').replace(/^#\/?/, '');
      const parts = raw.split('/').filter(Boolean).map(decodeURIComponent);
      if (!parts.length) return { name: 'home' };
      if (parts[0] === 'lesson' && parts[1]) return { name: 'lesson', id: parts[1] };
      if (parts[0] === 'quiz') {
        return { name: 'quiz', source: parts[1] || 'l1', count: +(parts[2] || 10), level: +(parts[3] || 0) || 0 };
      }
      if (parts[0] === 'lessons') return { name: 'lessons' };
      if (parts[0] === 'practice') return { name: 'practice' };
      if (parts[0] === 'exam') return { name: 'exam' };
      if (parts[0] === 'progress') return { name: 'progress' };
      if (parts[0] === 'about') return { name: 'about' };
      return { name: 'home' };
    },
    go(path) {
      const target = path.startsWith('#') ? path : '#/' + path.replace(/^\//, '');
      if (location.hash === target) this.emit();
      else location.hash = target;
    },
    onChange(fn) { this.handlers.push(fn); },
    emit() {
      const route = this.parse();
      this.current = route;
      this.handlers.forEach((fn) => { try { fn(route); } catch (e) { console.error(e); } });
    },
    start() {
      if (!location.hash) location.hash = '#/';
      window.addEventListener('hashchange', () => this.emit());
      this.emit();
    }
  };

  /* ---------- Misc ---------- */
  function updateReadProgress() {
    const el = document.getElementById('readProgress');
    if (!el) return;
    const st = window.scrollY;
    const dh = document.documentElement.scrollHeight - window.innerHeight;
    el.style.width = (dh > 0 ? clamp((st / dh) * 100, 0, 100) : 0) + '%';
  }

  function scrollToTop(behavior) {
    window.scrollTo({ top: 0, behavior: behavior || 'auto' });
  }

  function setActiveNav(route) {
    $$('[data-route]').forEach((a) => {
      let active = false;
      if (route.name === 'home') active = a.dataset.route === 'home';
      else if (route.name === 'lesson') active = a.dataset.route === 'lessons';
      else if (route.name === 'quiz') active = a.dataset.route === 'practice';
      else active = a.dataset.route === route.name;
      a.classList.toggle('active', active);
      if (active) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  AWG.util = { $, $$, esc, shuffle, pick, clamp, dateKey, yesterdayKey, relTime, fa, faNum };
  AWG.renderMath = renderMath;
  AWG.tex = tex;
  AWG.LEVELS = LEVELS;
  AWG.levelInfo = levelInfo;
  AWG.levelFor = levelFor;
  AWG.BADGES = BADGES;
  AWG.Store = Store;
  AWG.Sound = Sound;
  AWG.Theme = Theme;
  AWG.Toast = Toast;
  AWG.Confetti = Confetti;
  AWG.Icons = ICONS;
  AWG.Router = Router;
  AWG.updateReadProgress = updateReadProgress;
  AWG.scrollToTop = scrollToTop;
  AWG.setActiveNav = setActiveNav;
  AWG.onThemeChange = null;
})();

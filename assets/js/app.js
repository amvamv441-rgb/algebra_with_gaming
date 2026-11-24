/* =========================================================
   حسابان ۱ — app shell, views, quiz engine
   ========================================================= */
(function () {
  'use strict';
  const AWG = window.AWG;
  const U = AWG.util;
  const { $, $$, esc, fa, faNum, shuffle, clamp } = U;
  const Store = AWG.Store;
  const Sound = AWG.Sound;
  const Theme = AWG.Theme;
  const Router = AWG.Router;
  const Toast = AWG.Toast;
  const Confetti = AWG.Confetti;
  const Icons = AWG.Icons;
  const T = String.raw;
  const LETTERS = ['الف', 'ب', 'پ', 'ت'];

  let activeSession = null;
  let currentRoute = null;

  /* =========================================================
     Helpers
     ========================================================= */
  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function ringSVG(pct, size, stroke, color) {
    size = size || 120; stroke = stroke || 6;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const off = c * (1 - clamp(pct, 0, 100) / 100);
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color || 'var(--accent)'}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"/>
    </svg>`;
  }

  function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${fa(String(m).padStart(2, '0'))}:${fa(String(s).padStart(2, '0'))}`;
  }

  function safe(fn) {
    try { return fn(); } catch (e) { console.error(e); return undefined; }
  }

  function updateXPChip() {
    const info = AWG.levelInfo(Store.state.xp);
    const v = document.getElementById('xpValue');
    if (v) v.textContent = faNum(Store.state.xp);
    const l = document.getElementById('xpLevel');
    if (l) l.textContent = info.name;
    const chip = document.getElementById('xpChip');
    if (chip) chip.title = `${info.name} — ${faNum(Store.state.xp)} امتیاز`;
  }

  function revealInit(root) {
    const els = root.querySelectorAll('.reveal');
    if (!els.length) return;
    if (!('IntersectionObserver' in window) || Store.state.settings.reduceMotion) {
      els.forEach((e) => e.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -30px 0px' });
    els.forEach((e) => io.observe(e));
  }

  function pageTitle(sub) {
    document.title = sub ? `حسابان ۱ — ${sub}` : 'حسابان ۱ — آزمایشگاه فصل اول';
  }

  function lessonColor(id) {
    const l = AWG.lessonById(id);
    return l ? l.color : 'var(--accent)';
  }

  function isLessonSource(s) {
    return ['1', '2', '3', '4', '5'].includes(String(s));
  }

  function bankCount(id) {
    const b = AWG.BANKS['lesson' + id];
    return b ? b.length : 0;
  }

  /* =========================================================
     Shared pieces
     ========================================================= */
  function lessonCard(l, index) {
    const m = Store.masteryOf(l.id);
    const done = Store.state.lessons[l.id] && Store.state.lessons[l.id].attempts > 0;
    return `<a class="lesson-card card-hover reveal" href="#/lesson/${l.id}" style="--lesson-color:${l.color};--d:${index * 50}ms">
      <span class="lesson-num">${l.num}</span>
      <span class="lesson-body">
        <span class="lesson-title">${l.short} <span class="go">←</span></span>
        <span class="lesson-desc">${l.desc}</span>
        <span class="lesson-meta">
          <span class="chip">${fa(l.minutes)} دقیقه</span>
          <span class="chip">${fa(bankCount(l.id) || l.questions)} سؤال</span>
          <span class="chip chip-mint">آزمایشگاه 3D</span>
        </span>
        <span class="mastery">
          <span class="mastery-bar"><span style="width:${m}%"></span></span>
          <span class="mastery-label">${done ? fa(m) + '٪' : 'تازه'}</span>
        </span>
      </span>
    </a>`;
  }

  function examCard() {
    const best = Store.state.stats.examBest || 0;
    return `<a class="lesson-card exam-card card-hover reveal" href="#/exam" style="--d:250ms">
      <span class="lesson-num">♣</span>
      <span class="lesson-body">
        <span class="lesson-title">آزمون جامع فصل <span class="go">←</span></span>
        <span class="lesson-desc">امتحان نهایی و سبک کنکور، با تایمر و تحلیل موضوعی. خودت را محک بزن.</span>
        <span class="lesson-meta">
          <span class="chip">۵۰ سؤال نهایی</span>
          <span class="chip">۷۰ سؤال کنکوری</span>
          <span class="chip chip-coral">تایمر</span>
        </span>
        <span class="mastery">
          <span class="mastery-bar"><span style="width:${best}%"></span></span>
          <span class="mastery-label">${best ? fa(best) + '٪' : 'آماده‌ای؟'}</span>
        </span>
      </span>
    </a>`;
  }

  function sectionHead(label, title, sub) {
    return `<div class="section-head reveal">
      <span class="eyebrow">${label}</span>
      <h2 class="section-title display">${title}</h2>
      ${sub ? `<p class="section-sub">${sub}</p>` : ''}
    </div>`;
  }

  function footer() {
    return `<footer class="footer">
      <div class="wrap footer-inner">
        <div class="brand">
          <svg class="brand-mark" viewBox="0 0 48 48" aria-hidden="true"><path d="M6 40 Q24 -4 42 40" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/><circle cx="24" cy="18" r="3.2" fill="var(--accent-2)"/></svg>
          <span class="brand-text"><strong>حسابان ۱</strong><small>آزمایشگاه فصل اول</small></span>
        </div>
        <p class="footer-note">برای دانش‌آموزان پایه یازدهم ریاضی و فیزیک — بر اساس سرفصل رسمی فصل اول حسابان (۱). نسخه ۱۴۰۴.</p>
        <div class="footer-links">
          <a href="#/lessons">درس‌ها</a>
          <a href="#/practice">تمرین</a>
          <a href="#/exam">آزمون</a>
          <a href="#/progress">پیشرفت</a>
        </div>
      </div>
    </footer>`;
  }

  /* =========================================================
     HOME
     ========================================================= */
  function renderHome(main) {
    const stats = Store.state.stats;
    const streak = Store.state.streak;
    const info = AWG.levelInfo(Store.state.xp);
    const daily = Store.state.daily;
    const today = U.dateKey();
    const dailyDone = daily.date === today && daily.done;
    const accuracy = stats.answered ? Math.round((stats.correct / stats.answered) * 100) : 0;

    main.innerHTML = `
      <section class="hero">
        <div class="wrap hero-grid">
          <div class="hero-copy">
            <span class="eyebrow">پایه یازدهم · ریاضی و فیزیک</span>
            <h1 class="hero-title">
              <span class="row">فصل اول</span>
              <span class="row"><span class="hl">حسابان ۱</span></span>
              <span class="small-row">جبر و معادله — این‌بار با دست‌های خودت</span>
            </h1>
            <p class="hero-sub">پنج درس، شش آزمایشگاه سه‌بعدی و ${faNum(AWG.totalQuestions())} سؤال با پاسخ تشریحی. به‌جای حفظ کردن فرمول، آن را ببین، بچرخان و با دست‌های خودت بساز.</p>
            <div class="hero-actions">
              <a class="btn btn-primary btn-lg" href="#/lesson/1">شروع درس اول <span class="arr">←</span></a>
              <a class="btn btn-lg" href="#/practice">تمرین سریع</a>
            </div>
            <div class="hero-facts">
              <div class="fact"><span class="fact-num">۵</span><span class="fact-label">درس کامل</span></div>
              <div class="fact"><span class="fact-num">${faNum(AWG.totalQuestions())}</span><span class="fact-label">سؤال تشریحی</span></div>
              <div class="fact"><span class="fact-num">۶</span><span class="fact-label">آزمایشگاه 3D</span></div>
              <div class="fact"><span class="fact-num">∞</span><span class="fact-label">تمرین بی‌پایان</span></div>
            </div>
          </div>
          <div class="hero-visual reveal">
            <canvas id="heroCanvas" class="hero-canvas" aria-label="نمای سه‌بعدی یک سهمی‌گون؛ برای چرخاندن بکشید"></canvas>
            <div class="hero-frame"></div>
            <span class="hero-chip c1">∑ aₙ</span>
            <span class="hero-chip c2">x² − 4x + 3</span>
            <span class="hero-chip c3">|x − 3|</span>
            <span class="sticker sticker-mint hero-sticker">ویرایش ۱۴۰۴</span>
            <div class="hero-caption">${Icons.drag} بگیر و بچرخون</div>
          </div>
        </div>
      </section>

      <div class="formula-marquee" aria-hidden="true">
        <div class="marquee-track">
          <span>Sₙ = n/2 [2a + (n−1)d]</span><span>x = (−b ± √Δ) / 2a</span><span>|x − a| &lt; c</span><span>√(x+2) = x − 4</span><span>d = |ax₀ + by₀ + c| / √(a²+b²)</span><span>S = x₁ + x₂ = −b/a</span>
          <span>Sₙ = n/2 [2a + (n−1)d]</span><span>x = (−b ± √Δ) / 2a</span><span>|x − a| &lt; c</span><span>√(x+2) = x − 4</span><span>d = |ax₀ + by₀ + c| / √(a²+b²)</span><span>S = x₁ + x₂ = −b/a</span>
        </div>
      </div>

      <section class="section">
        <div class="wrap">
          ${sectionHead('مسیر یادگیری', 'پنج درس، یک فصل', 'هر درس یک آزمایشگاه سه‌بعدی، یک درس‌نامه و یک بانک سؤال دارد. از هر جا که خواستی شروع کن؛ پیشرفتت ذخیره می‌شود.')}
          <div class="lesson-grid">
            ${AWG.LESSONS.map((l, i) => lessonCard(l, i)).join('')}
            ${examCard()}
          </div>
        </div>
      </section>

      <section class="section section-tight">
        <div class="wrap">
          <div class="home-split">
            <div class="daily-card reveal">
              <div class="daily-badge">${dailyDone ? '✓' : '●'}</div>
              <div class="daily-info">
                <span class="eyebrow">چالش روزانه</span>
                <h3 class="daily-title">${dailyDone ? 'چالش امروز را انجام دادی' : '۶ سؤال، ۲ دقیقه، ۵۰ امتیاز'}</h3>
                <p class="daily-sub">${dailyDone ? `نتیجه امروز: ${fa(daily.score)} از ${fa(daily.total)} — فردا دوباره سر بزن.` : 'هر روز یک ست تازه از کل فصل؛ برای گرم نگه داشتن ذهن.'}</p>
              </div>
              <div class="daily-meta">
                <span class="chip chip-accent">+۵۰ XP</span>
                <span class="chip">${fa(streak)} روز زنجیره</span>
              </div>
              <a class="btn ${dailyDone ? '' : 'btn-primary'} btn-sm" href="${dailyDone ? '#/progress' : '#/quiz/daily/6/0'}">${dailyDone ? 'دیدن پیشرفت' : 'شروع چالش'}</a>
            </div>

            <div class="home-stats reveal" style="--d:80ms">
              <div class="home-stat"><span class="n">${faNum(Store.state.xp)}</span><span class="l">امتیاز کل</span></div>
              <div class="home-stat"><span class="n">${fa(streak)}</span><span class="l">روز زنجیره</span></div>
              <div class="home-stat"><span class="n">${fa(accuracy)}٪</span><span class="l">دقت پاسخ‌ها</span></div>
              <div class="home-stat"><span class="n">${info.name}</span><span class="l">سطح فعلی</span></div>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          ${sectionHead('چرا این‌جا؟', 'ریاضی را ببین، لمس کن، بشکن', 'سه چیز که این آزمایشگاه را از یک PDF خشک جدا می‌کند.')}
          <div class="feature-grid">
            <div class="feature reveal">
              <div class="feature-icon">⬡</div>
              <h3>آزمایشگاه سه‌بعدی</h3>
              <p>سهمی را بچرخان، ریشه‌ها را ببین، جواب اضافی را روی نمودار لمس کن. هر درس یک صحنه زنده دارد.</p>
            </div>
            <div class="feature reveal" style="--d:60ms">
              <div class="feature-icon">✎</div>
              <h3>پاسخ تشریحی گام‌به‌گام</h3>
              <p>${faNum(AWG.totalQuestions())} سؤال با راه‌حل کامل؛ نه فقط گزینه درست. اگر اشتباه زدی، دقیقاً می‌بینی کجا راه را گم کردی.</p>
            </div>
            <div class="feature reveal" style="--d:120ms">
              <div class="feature-icon">◉</div>
              <h3>پیشرفت واقعی</h3>
              <p>XP، زنجیره روزانه، نشان‌ها و درصد تسلط هر درس. همه‌چیز روی دستگاه خودت ذخیره می‌شود.</p>
            </div>
          </div>
        </div>
      </section>
      ${footer()}
    `;

    requestAnimationFrame(() => {
      const c = document.getElementById('heroCanvas');
      if (c && document.body.contains(c)) AWG.Scenes.mount(c, 'hero');
    });
    pageTitle();
  }

  /* =========================================================
     LESSONS INDEX
     ========================================================= */
  function renderLessons(main) {
    main.innerHTML = `
      <section class="page-hero">
        <div class="wrap">
          <span class="eyebrow">فصل اول · جبر و معادله</span>
          <h1 class="page-title display">پنج درس، پنج آزمایشگاه</h1>
          <p class="page-lead">از مجموع دنباله‌ها تا هندسه تحلیلی. هر درس را که باز کنی، درس‌نامه، آزمایشگاه سه‌بعدی و تمرین همان درس را می‌بینی.</p>
        </div>
      </section>
      <section class="section section-tight">
        <div class="wrap">
          <div class="lesson-grid">
            ${AWG.LESSONS.map((l, i) => lessonCard(l, i)).join('')}
            ${examCard()}
          </div>
        </div>
      </section>
      ${footer()}
    `;
    pageTitle('درس‌ها');
  }

  /* =========================================================
     LESSON
     ========================================================= */
  function renderBlocks(blocks) {
    return blocks.map((b) => {
      switch (b.type) {
        case 'p':
          return `<p>${b.text}</p>`;
        case 'formula':
          return `<div class="formula-box">$$${b.tex}$$${b.cap ? `<span class="formula-cap">${b.cap}</span>` : ''}</div>`;
        case 'example':
          return `<div class="example">
            <div class="example-title">${Icons.spark} ${b.title}</div>
            <div class="example-problem">${b.problem}</div>
            <div class="example-solution">${renderSolution(b.solution)}</div>
          </div>`;
        case 'note':
          return `<div class="note ${b.tone === 'warn' ? 'note-warn' : ''}"><div class="note-title">${b.tone === 'warn' ? '!' : '✦'} ${b.title}</div><p>${b.text}</p></div>`;
        case 'story':
          return `<div class="story"><div class="story-quote">${b.quote}</div><span class="story-who">${b.who}</span></div>`;
        case 'steps':
          return `<div class="steps">${b.items.map((it, i) => `<div class="step"><span class="step-num">${fa(i + 1)}</span><div class="step-body">${it}</div></div>`).join('')}</div>`;
        case 'list':
          return `<ul class="check-list">${b.items.map((it) => `<li>${it}</li>`).join('')}</ul>`;
        case 'table':
          return `<div class="table-wrap"><table class="data-table"><thead><tr>${b.head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
        case 'mistakes':
          return `<div class="mistakes">${b.items.map((it) => `<div class="mistake"><span class="x">×</span><div>${it}</div></div>`).join('')}</div>`;
        case 'summary':
          return `<div class="summary-grid">${b.items.map((it) => `<div class="summary-item">$$${it.tex}$$<span class="cap">${it.cap}</span></div>`).join('')}</div>`;
        case 'visual':
          return `<div class="visual-box" data-visual="${b.name}"><div class="visual-inner"></div><span class="visual-cap">${b.caption || ''}</span></div>`;
        case 'lab':
          return labHTML(b);
        default:
          return '';
      }
    }).join('');
  }

  function renderSolution(sol) {
    if (typeof sol === 'string') return sol;
    return (sol || []).map((s) => {
      if (typeof s === 'string') return s;
      if (s.type === 'p') return `<p>${s.text}</p>`;
      if (s.type === 'formula') return `<div class="formula-box" style="margin:10px 0;padding:14px 16px">$$${s.tex}$$</div>`;
      return '';
    }).join('');
  }

  function labHTML(b) {
    return `<div class="lab reveal" data-lab="${b.name}">
      <div class="lab-head">
        <span class="lab-badge">LAB 3D</span>
        <span class="lab-title">${b.title}</span>
        <span class="lab-sub">${b.sub || 'بگیر و بچرخون'}</span>
      </div>
      <div class="lab-stage">
        <canvas class="lab-canvas" aria-label="آزمایشگاه سه‌بعدی ${b.title}"></canvas>
        <span class="lab-corner tl"></span><span class="lab-corner tr"></span>
        <span class="lab-corner bl"></span><span class="lab-corner br"></span>
        <div class="lab-hint">${Icons.drag} بگیر و بچرخون · Ctrl + اسکرول برای زوم</div>
        <div class="lab-zoom"><button type="button" data-zoom="in" aria-label="بزرگ‌نمایی">+</button><button type="button" data-zoom="out" aria-label="کوچک‌نمایی">−</button></div>
      </div>
      <div class="lab-readout" data-readout aria-live="polite"></div>
      <div class="lab-controls" data-controls>${labControls(b.name)}</div>
    </div>`;
  }

  function controlHTML(id, label, min, max, step, value) {
    return `<div class="control"><div class="control-label"><span>${label}</span><span class="control-value" data-val="${id}">${value}</span></div><input class="range" type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}"></div>`;
  }

  function labControls(name) {
    if (name === 'sequence') {
      return `${controlHTML('a', 'جمله اول a', -5, 5, 1, 2)}
        ${controlHTML('d', 'قدر نسبت d', -5, 5, 1, 3)}
        ${controlHTML('q', 'قدر نسبت q', 0.5, 4, 0.5, 2)}
        ${controlHTML('n', 'تعداد جملات n', 3, 10, 1, 7)}
        <div class="lab-actions"><button class="lab-btn active" data-mode="arith" type="button">حسابی</button><button class="lab-btn" data-mode="geo" type="button">هندسی</button></div>`;
    }
    if (name === 'parabola') {
      return `${controlHTML('a', 'a', -3, 3, 0.1, 1)}
        ${controlHTML('b', 'b', -6, 6, 0.5, -4)}
        ${controlHTML('c', 'c', -6, 6, 0.5, 3)}`;
    }
    if (name === 'radical') {
      return `${controlHTML('speed', 'سرعت اسکن', 0.05, 0.6, 0.05, 0.22)}
        <div class="lab-actions"><button class="lab-btn" data-pause type="button">${Icons.pause} توقف</button></div>`;
    }
    if (name === 'absolute') {
      return `${controlHTML('fold', 'میزان تا شدن', 0, 100, 1, 0)}
        ${controlHTML('a', 'a', -3, 3, 0.1, 1)}
        ${controlHTML('b', 'b', -6, 6, 0.5, 0)}
        ${controlHTML('c', 'c', -6, 6, 0.5, -4)}
        <div class="lab-actions"><button class="lab-btn active" data-auto type="button">پخش خودکار</button></div>`;
    }
    if (name === 'geometry') {
      return `${controlHTML('x1', 'x₁', -6, 6, 1, -2)}${controlHTML('y1', 'y₁', -6, 6, 1, 1)}
        ${controlHTML('x2', 'x₂', -6, 6, 1, 3)}${controlHTML('y2', 'y₂', -6, 6, 1, 4)}`;
    }
    return '';
  }

  const LAB_DEFAULTS = {
    sequence: { a: 2, d: 3, q: 2, n: 7, mode: 'arith' },
    parabola: { a: 1, b: -4, c: 3 },
    radical: { speed: 0.22 },
    absolute: { a: 1, b: 0, c: -4 },
    geometry: { x1: -2, y1: 1, x2: 3, y2: 4 }
  };

  function readParams(lab) {
    const p = {};
    lab.querySelectorAll('input[type=range]').forEach((i) => { p[i.id] = parseFloat(i.value); });
    return p;
  }

  function fmtVal(v) {
    if (!isFinite(v)) return '—';
    const r = Math.round(v * 100) / 100;
    return (r < 0 ? '−' : '') + String(Math.abs(r));   // Persian minus, never "-0"
  }

  function roRow(k, v) {
    return `<div class="ro-row"><span class="k">${k}</span><span class="v" dir="ltr">${v}</span></div>`;
  }

  function updateReadout(lab, p) {
    const out = lab.querySelector('[data-readout]');
    if (!out) return;
    const name = lab.dataset.lab;
    const nv = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
    let html = '';
    if (name === 'sequence') {
      const mode = lab.querySelector('[data-mode].active')?.dataset.mode || 'arith';
      const a = nv(p.a, 0), d = nv(p.d, 0), q = nv(p.q, 1), n = Math.round(nv(p.n, 7));
      const terms = Array.from({ length: n }, (_, i) => (mode === 'geo' ? a * Math.pow(q, i) : a + i * d));
      const chips = `<div class="ro-terms" dir="ltr">${terms.map((v, i) => `<span class="ro-term"><b>${fmtVal(v)}</b><i>a<sub>${i + 1}</sub></i></span>`).join('')}</div>`;
      if (mode === 'geo') {
        const S = q === 1 ? a * n : a * (Math.pow(q, n) - 1) / (q - 1);
        html = roRow('دنباله هندسی', `a = ${fmtVal(a)}, q = ${fmtVal(q)}, n = ${n}`) +
          chips + roRow('مجموع <span dir="ltr">S<sub>n</sub></span>', fmtVal(S));
      } else {
        const S = n / 2 * (2 * a + (n - 1) * d);
        html = roRow('دنباله حسابی', `a = ${fmtVal(a)}, d = ${fmtVal(d)}, n = ${n}`) +
          chips + roRow('مجموع <span dir="ltr">S<sub>n</sub></span>', fmtVal(S));
      }
    } else if (name === 'parabola') {
      const a = nv(p.a, 0.1) || 0.1, b = nv(p.b, 0), c = nv(p.c, 0);
      const d = b * b - 4 * a * c;
      let roots = 'بدون ریشه حقیقی';
      if (d >= 0) {
        const r1 = (-b + Math.sqrt(d)) / (2 * a), r2 = (-b - Math.sqrt(d)) / (2 * a);
        roots = d === 0 ? `x = ${fmtVal(r1)} (مضاعف)` : `x₁ = ${fmtVal(r1)}, x₂ = ${fmtVal(r2)}`;
      }
      const xv = -b / (2 * a), yv = a * xv * xv + b * xv + c;
      html = roRow('دلتا', `Δ = ${fmtVal(d)}`) +
        roRow('ریشه‌ها', roots) +
        roRow('رأس سهمی', `(${fmtVal(xv)}, ${fmtVal(yv)})`);
    } else if (name === 'radical') {
      html = roRow('تقاطع واقعی', '(7, 3) ✓') + roRow('جواب خارجی', '(2, 2) ✗');
    } else if (name === 'absolute') {
      const sign = (v) => (v >= 0 ? '+ ' : '− ') + fmtVal(Math.abs(v));
      html = roRow('میزان تا شدن', `${Math.round(p.fold)}٪`) +
        roRow('تابع', `f(x) = ${fmtVal(p.a)}x² ${sign(p.b)}x ${sign(p.c)}`);
    } else if (name === 'geometry') {
      const dx = p.x2 - p.x1, dy = p.y2 - p.y1;
      const d = Math.sqrt(dx * dx + dy * dy);
      const mx = (p.x1 + p.x2) / 2, my = (p.y1 + p.y2) / 2;
      html = roRow('طول پاره‌خط', `AB = ${fmtVal(d)}`) +
        roRow('وسط', `M = (${fmtVal(mx)}, ${fmtVal(my)})`);
    }
    out.innerHTML = html;
  }

  /* =========================================================
     2D lab fallback: when WebGL / the 3D scene is unavailable the lab must still
     be usable, so the same parameters are drawn as a live SVG chart.
     ========================================================= */
  function chartSVG(kind, p) {
    const W = 460, H = 240;
    const axis = (x0, x1, y0, y1) => {
      const X = (v) => 26 + ((v - x0) / (x1 - x0)) * (W - 52);
      const Y = (v) => H - 26 - ((v - y0) / (y1 - y0)) * (H - 52);
      return { X, Y };
    };
    const curve = (fn, a, b, n, X, Y) => 'M' + Array.from({ length: n + 1 }, (_, i) => {
      const x = a + (b - a) * i / n; return `${X(x).toFixed(1)} ${Y(fn(x)).toFixed(1)}`;
    }).join(' L');
    if (kind === 'sequence') {
      const n = clamp(Math.round(p.n || 7), 3, 10);
      const geo = p.mode === 'geo';
      const a = typeof p.a === 'number' ? p.a : 1, d = typeof p.d === 'number' ? p.d : 1, q = typeof p.q === 'number' ? p.q : 2;
      const vals = Array.from({ length: n }, (_, i) => (geo ? a * Math.pow(q, i) : a + i * d));
      const lo = Math.min(0, ...vals) * 1.2, hi = Math.max(0, ...vals) * 1.2;
      const top = 46, bottom = H - 34;                       // room for the a₁ / aₙ row
      const X = (i) => W - 42 - i * ((W - 96) / Math.max(1, n - 1));   // RTL: a₁ sits on the right
      const Y = (v) => bottom - ((v - lo) / ((hi - lo) || 1)) * (bottom - top);
      const zero = Y(0), bw = Math.min(34, (W - 100) / n * 0.62);
      return `<svg viewBox="0 0 ${W} ${H}" class="lab2d-svg" role="img" aria-label="نمودار دنباله">
        <text x="${X(0).toFixed(1)}" y="16" class="lab2d-lab gold" text-anchor="middle">a₁ = ${fmtVal(vals[0])}</text>
        <text x="${X(n - 1).toFixed(1)}" y="16" class="lab2d-lab gold" text-anchor="middle">aₙ = ${fmtVal(vals[n - 1])}</text>
        <line x1="24" y1="${zero.toFixed(1)}" x2="${W - 18}" y2="${zero.toFixed(1)}" stroke="var(--line-strong)" stroke-width="1.4"/>
        ${vals.map((v, i) => {
          const y = Y(v), h = Math.abs(zero - y);
          const labelY = v >= 0 ? y - 9 : y + 16;
          return `<rect x="${(X(i) - bw / 2).toFixed(1)}" y="${Math.min(y, zero).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(2, h).toFixed(1)}" rx="4" fill="${geo ? '#ff8a70' : '#7fe7c4'}" opacity=".92"/>
            <circle cx="${X(i).toFixed(1)}" cy="${y.toFixed(1)}" r="3.4" fill="#f2e85c"/>
            <text x="${X(i).toFixed(1)}" y="${labelY.toFixed(1)}" class="lab2d-val" text-anchor="middle">${fmtVal(v)}</text>`;
        }).join('')}
        <text x="${W - 20}" y="${(zero + 16).toFixed(1)}" class="lab2d-lab" text-anchor="end">n</text>
      </svg>`;
    }
    if (kind === 'parabola' || kind === 'absolute') {
      const a = typeof p.a === 'number' ? p.a : 1, b = typeof p.b === 'number' ? p.b : 0, c = typeof p.c === 'number' ? p.c : 0;
      const f = (x) => a * x * x + b * x + c;
      const x0 = -6, x1 = 6, { X, Y } = axis(x0, x1, -6, 8);
      const sgn = (v) => (v >= 0 ? '+' : '−') + Math.abs(v);
      return `<svg viewBox="0 0 ${W} ${H}" class="lab2d-svg" role="img" aria-label="نمودار سهمی">
        <line x1="20" y1="${Y(0).toFixed(1)}" x2="${W - 16}" y2="${Y(0).toFixed(1)}" stroke="var(--line-strong)" stroke-width="1.4"/>
        <line x1="${X(0).toFixed(1)}" y1="16" x2="${X(0).toFixed(1)}" y2="${H - 16}" stroke="var(--line-strong)" stroke-width="1.4"/>
        <path d="${curve(f, x0, x1, 90, X, Y)}" fill="none" stroke="#7fe7c4" stroke-width="3" stroke-linecap="round"/>
        <circle cx="${X(-b / (2 * a)).toFixed(1)}" cy="${Y(f(-b / (2 * a))).toFixed(1)}" r="4.5" fill="#f2e85c"/>
        <text x="${W - 24}" y="32" class="lab2d-lab" text-anchor="end">f(x) = ${fmtVal(a)}x² ${sgn(b)}x ${sgn(c)}</text>
      </svg>`;
    }
    if (kind === 'geometry') {
      const { X, Y } = axis(-7, 7, -7, 7);
      const x1 = p.x1 || 0, y1 = p.y1 || 0, x2 = p.x2 || 0, y2 = p.y2 || 0;
      const dx = x2 - x1, dy = y2 - y1;
      return `<svg viewBox="0 0 ${W} ${H}" class="lab2d-svg" role="img" aria-label="نمودار پاره‌خط">
        <line x1="20" y1="${Y(0).toFixed(1)}" x2="${W - 16}" y2="${Y(0).toFixed(1)}" stroke="var(--line-strong)" stroke-width="1.2"/>
        <line x1="${X(0).toFixed(1)}" y1="16" x2="${X(0).toFixed(1)}" y2="${H - 16}" stroke="var(--line-strong)" stroke-width="1.2"/>
        <line x1="${X(x1).toFixed(1)}" y1="${Y(y1).toFixed(1)}" x2="${X(x2).toFixed(1)}" y2="${Y(y2).toFixed(1)}" stroke="#7fe7c4" stroke-width="3" stroke-linecap="round"/>
        <circle cx="${X(x1).toFixed(1)}" cy="${Y(y1).toFixed(1)}" r="5" fill="#f2e85c"/><text x="${(X(x1) + 9).toFixed(1)}" y="${(Y(y1) - 8).toFixed(1)}" class="lab2d-lab">A</text>
        <circle cx="${X(x2).toFixed(1)}" cy="${Y(y2).toFixed(1)}" r="5" fill="#ff8a70"/><text x="${(X(x2) + 9).toFixed(1)}" y="${(Y(y2) - 8).toFixed(1)}" class="lab2d-lab">B</text>
        <text x="${(X((x1 + x2) / 2) + 8).toFixed(1)}" y="${(Y((y1 + y2) / 2) - 8).toFixed(1)}" class="lab2d-lab">${fmtVal(Math.sqrt(dx * dx + dy * dy))}</text>
      </svg>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" class="lab2d-svg" role="img" aria-label="نمودار تابع رادیکالی">
      <line x1="20" y1="${(H / 2).toFixed(1)}" x2="${W - 16}" y2="${(H / 2).toFixed(1)}" stroke="var(--line-strong)" stroke-width="1.4"/>
      <line x1="60" y1="16" x2="60" y2="${H - 16}" stroke="var(--line-strong)" stroke-width="1.4"/>
      <path d="M60 ${(H / 2).toFixed(1)} Q200 30 420 40" fill="none" stroke="#7fe7c4" stroke-width="3" stroke-linecap="round"/>
      <circle cx="330" cy="46" r="5" fill="#f2e85c"/><text x="342" y="42" class="lab2d-lab">(7, 3)</text>
      <circle cx="150" cy="118" r="5" fill="#ff8a70" opacity=".7"/><text x="162" y="132" class="lab2d-lab">(2, 2) ✗</text>
    </svg>`;
  }

  function paint2D(lab, name, p) {
    const box = lab.querySelector('.lab-2d');
    if (box) box.innerHTML = chartSVG(name, p);
  }

  function mountLabs(root) {
    root.querySelectorAll('[data-lab]').forEach((lab) => {
      const name = lab.dataset.lab;
      const canvas = lab.querySelector('canvas');
      if (!canvas) return;
      const params = Object.assign({}, LAB_DEFAULTS[name] || {});
      let scene = null;
      try { scene = AWG.Scenes.mount(canvas, name, params); } catch (e) { scene = null; }

      // one code path for 3D (WebGL) and 2D (SVG fallback): every control redraws the lab
      const apply = (p) => {
        const full = Object.assign({}, p, { mode: lab.querySelector('[data-mode].active')?.dataset.mode || 'arith' });
        // the 2D chart always mirrors the live parameters, so it is never stale
        paint2D(lab, name, full);
        if (scene) {
          if (name === 'sequence') scene.setParams(full);
          else if (name === 'parabola' || name === 'absolute') scene.setParams({ a: p.a === 0 ? 0.1 : p.a, b: p.b, c: p.c });
          else if (name === 'geometry') scene.setParams(p);
          else if (name === 'radical' && typeof p.speed === 'number') scene.speed = p.speed;
          if (typeof scene.drawNow === 'function') scene.drawNow();
        }
        updateReadout(lab, p);
      };

      {
        const stage = lab.querySelector('.lab-stage');
        if (stage) {
          const box = document.createElement('div');
          box.className = 'lab-2d';
          stage.insertBefore(box, stage.firstChild);
        }
        paint2D(lab, name, Object.assign({}, params, { mode: 'arith' }));
      }
      if (!scene) {
        lab.dataset.mode2d = '1';
        const hint = lab.querySelector('.lab-hint');
        if (hint) hint.innerHTML = `${Icons.spark} نسخه‌ی دوبعدی؛ با اسلایدرها زنده تغییر می‌کند`;
      } else {
        lab._scene = scene;
        if (name === 'absolute') {
          scene.onFold = (t) => {
            if (!scene.holdFold) {
              const fold = lab.querySelector('#fold');
              if (fold) fold.value = Math.round(t * 100);
              const val = lab.querySelector('[data-val="fold"]');
              if (val) val.textContent = fa(Math.round(t * 100));
            }
          };
        }
      }

      lab.querySelectorAll('input[type=range]').forEach((input) => {
        const onChange = () => {
          const p = readParams(lab);
          const cv = lab.querySelector(`[data-val="${input.id}"]`);
          if (cv) cv.textContent = fa(fmtVal(parseFloat(input.value)));
          if (scene && name === 'absolute' && input.id === 'fold') {
            scene.holdFold = true;
            scene.setFold(input.value / 100);
            const auto = lab.querySelector('[data-auto]');
            if (auto) auto.classList.remove('active');
          }
          apply(p);
        };
        input.addEventListener('input', onChange);
        input.addEventListener('change', onChange);
      });

      lab.querySelectorAll('[data-mode]').forEach((btn) => {
        btn.addEventListener('click', () => {
          lab.querySelectorAll('[data-mode]').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          apply(readParams(lab));
        });
      });

      const pause = lab.querySelector('[data-pause]');
      if (pause && scene) pause.addEventListener('click', () => {
        scene.paused = !scene.paused;
        pause.innerHTML = scene.paused ? `${Icons.play} پخش` : `${Icons.pause} توقف`;
      });
      if (pause && !scene) pause.hidden = true;

      const auto = lab.querySelector('[data-auto]');
      if (auto && scene) auto.addEventListener('click', () => {
        scene.holdFold = !scene.holdFold;
        auto.classList.toggle('active', !scene.holdFold);
      });
      if (auto && !scene) auto.hidden = true;

      lab.querySelectorAll('[data-zoom]').forEach((b) => {
        if (!scene) { b.hidden = true; return; }
        b.addEventListener('click', () => scene.zoom(b.dataset.zoom === 'in' ? 0.25 : -0.25));
      });

      updateReadout(lab, readParams(lab));
    });
  }

  // The header always states which build the browser is really running: if the chip shows an
  // older tag than the deployed one, the page (or a proxy) is serving a stale copy.
  function stampBuild() {
    const BUILD = '2026-11-24b';
    const chip = document.getElementById('buildChip');
    if (chip) chip.textContent = `build ${BUILD}`;
    return BUILD;
  }

  function renderVisuals(root) {
    root.querySelectorAll('[data-visual]').forEach((box) => {
      const name = box.dataset.visual;
      const inner = box.querySelector('.visual-inner');
      if (name === 'gauss') inner.innerHTML = gaussVisual();
      else if (name === 'discriminant') inner.innerHTML = discriminantVisual();
      else if (name === 'vieta') inner.innerHTML = vietaVisual();
      else if (name === 'numberline') inner.innerHTML = numberlineVisual();
      else if (name === 'absfold') inner.innerHTML = absfoldVisual();
      else if (name === 'coordinate') inner.innerHTML = coordinateVisual();
    });
  }

  function gaussVisual() {
    const rows = [];
    for (let i = 1; i <= 10; i++) {
      const blue = 11 - i;
      let dots = '';
      for (let j = 1; j <= 10; j++) dots += `<span class="gdot ${j <= blue ? 'blue' : 'red'}" style="--i:${i * 10 + j}"></span>`;
      rows.push(`<div class="grow">${dots}</div>`);
    }
    return `<div class="gauss-grid">${rows.join('')}</div>
      <div class="gauss-legend">
        <span class="lg"><i class="red"></i>مثلث اصلی: <span dir="ltr">$1+2+\\dots+10$</span></span>
        <span class="lg"><i class="blue"></i>کپی قرینه‌شده (همان ۵۵ نقطه)</span>
      </div>
      <div class="gauss-total">با هم: <span dir="ltr">$10\\times 11=110$</span> نقطه ← <span dir="ltr">$S=\\dfrac{110}{2}=55$</span></div>`;
  }

  function discriminantVisual() {
    // Exact parabolas in a 160×112 box. Screen y grows downward.
    const sample = (fn, x0, x1, n) => {
      const pts = [];
      for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; pts.push([x, fn(x)]); }
      return pts;
    };
    const path = (pts) => 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L');
    const cases = [
      { t: 'Δ > 0', s: 'دو ریشه‌ی متمایز', c: '#7fe7c4', AX: 74, A: 0.020, h: 80, r: 28, gap: 0, roots: [52, 108] },
      { t: 'Δ = 0', s: 'ریشه‌ی تکراری', c: '#f2e85c', AX: 74, A: 0.013, h: 80, r: 0, gap: 0, roots: [80] },
      { t: 'Δ < 0', s: 'بدون ریشه‌ی حقیقی', c: '#ff8a70', AX: 100, A: 0.014, h: 80, r: 0, gap: 40, roots: [] }
    ];
    return `<div class="disc-grid">
      ${cases.map((k, ci) => {
        const fn = (x) => k.AX + k.A * ((x - k.h) * (x - k.h) - k.r * k.r) - k.gap;
        const pts = sample(fn, 36, 124, 72).filter(([, y]) => y <= 106);
        const roots = k.roots.map((x) => `<circle cx="${x}" cy="${k.AX}" r="4.5" fill="${k.c}" stroke="var(--surface)" stroke-width="1.5"/>`).join('');
        const drop = k.gap ? `<line x1="${k.h}" y1="${(k.AX - k.gap - k.A * k.r * k.r).toFixed(1)}" x2="${k.h}" y2="${k.AX - 4}" stroke="${k.c}" stroke-width="1.2" stroke-dasharray="3 3" opacity=".7"/>` : '';
        const rootLabels = k.roots.length === 2
          ? `<text x="52" y="${k.AX - 12}" text-anchor="middle" class="d-lab">x<tspan class="sub">1</tspan></text><text x="108" y="${k.AX - 12}" text-anchor="middle" class="d-lab">x<tspan class="sub">2</tspan></text>`
          : k.roots.length === 1 ? `<text x="${k.h + 12}" y="${k.AX - 7}" class="d-lab">x</text>` : '';
        return `<div class="disc-item">
          <svg viewBox="0 0 160 112" aria-hidden="true">
            <line x1="14" y1="${k.AX}" x2="146" y2="${k.AX}" stroke="var(--line-strong)" stroke-width="1.5"/>
            <path d="M146 ${k.AX} l-6 -3.5 v7 z" fill="var(--line-strong)"/>
            <text x="147" y="${k.AX - 5}" class="d-lab">x</text>
            ${drop}
            <path d="${path(pts)}" fill="none" stroke="${k.c}" stroke-width="3" stroke-linecap="round" style="animation-delay:${ci * 0.15}s"/>
            ${roots}${rootLabels}
          </svg>
          <strong>${k.t}</strong><span>${k.s}</span>
        </div>`;
      }).join('')}
    </div>`;
  }

  function vietaVisual() {
    // y = x² − 4x + 3 on a real coordinate mapping (no Bézier approximation)
    const W = 440, H = 260;
    const x0 = -1.5, x1 = 5.5, y0 = -2.6, y1 = 7.6;
    const sx = (x) => 40 + ((x - x0) / (x1 - x0)) * (W - 56);
    const sy = (y) => H - 28 - ((y - y0) / (y1 - y0)) * (H - 48);
    const f = (x) => x * x - 4 * x + 3;
    const P = (x, y) => `${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`;
    const curve = [];
    for (let i = 0; i <= 160; i++) {
      const x = x0 + (x1 - x0) * i / 160;
      if (f(x) > y1) continue;
      curve.push(P(x, f(x)));
    }
    const curveD = 'M' + curve.join(' L');
    // region between the roots (where the parabola is negative)
    const neg = [];
    for (let i = 0; i <= 60; i++) { const x = 1 + 2 * i / 60; neg.push(P(x, f(x))); }
    const negD = `M${neg.join(' L')} L${P(3, 0)} L${P(1, 0)} Z`;
    let gridV = '', gridH = '', ticksX = '', ticksY = '';
    for (let x = Math.ceil(x0); x <= Math.floor(x1); x++) {
      if (x === 0) continue;
      gridV += `<line x1="${sx(x).toFixed(1)}" y1="${sy(0).toFixed(1)}" x2="${sx(x).toFixed(1)}" y2="${sy(y1).toFixed(1)}"/>`;
      ticksX += `<text x="${sx(x).toFixed(1)}" y="${(sy(0) + 14).toFixed(1)}" text-anchor="middle">${x < 0 ? '−' + (-x) : x}</text>`;
    }
    for (let y = Math.ceil(y0); y <= Math.floor(y1); y++) {
      if (y === 0) continue;
      gridH += `<line x1="${sx(x0).toFixed(1)}" y1="${sy(y).toFixed(1)}" x2="${sx(x1).toFixed(1)}" y2="${sy(y).toFixed(1)}"/>`;
      ticksY += `<text x="${(sx(0) - 7).toFixed(1)}" y="${(sy(y) + 3.5).toFixed(1)}" text-anchor="end">${y < 0 ? '−' + (-y) : y}</text>`;
    }
    return `<div class="vieta-wrap">
      <svg viewBox="0 0 ${W} ${H}" class="vieta-svg" role="img" aria-label="نمودار y = x² − 4x + 3 با ریشه‌های ۱ و ۳ و رأس (۲، −۱)">
        <defs>
          <linearGradient id="vCurve" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7fe7c4"/><stop offset=".5" stop-color="#f2e85c"/><stop offset="1" stop-color="#7fe7c4"/></linearGradient>
          <linearGradient id="vNeg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a70" stop-opacity=".35"/><stop offset="1" stop-color="#ff8a70" stop-opacity=".05"/></linearGradient>
          <filter id="vGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <marker id="vArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--line-strong)"/></marker>
        </defs>
        <g class="vgrid">${gridH}${gridV}</g>
        <line x1="${sx(x0).toFixed(1)}" y1="${sy(0).toFixed(1)}" x2="${sx(x1).toFixed(1)}" y2="${sy(0).toFixed(1)}" class="vaxis" marker-end="url(#vArrow)"/>
        <line x1="${sx(0).toFixed(1)}" y1="${sy(y0).toFixed(1)}" x2="${sx(0).toFixed(1)}" y2="${sy(y1).toFixed(1)}" class="vaxis" marker-end="url(#vArrow)"/>
        <text x="${(sx(x1) - 6).toFixed(1)}" y="${(sy(0) - 8).toFixed(1)}" class="vtick-strong">x</text>
        <text x="${(sx(0) + 8).toFixed(1)}" y="${(sy(y1) + 14).toFixed(1)}" class="vtick-strong">y</text>
        <g class="vticks">${ticksX}${ticksY}</g>
        <path d="${negD}" fill="url(#vNeg)"/>
        <line x1="${sx(2).toFixed(1)}" y1="${sy(y1).toFixed(1)}" x2="${sx(2).toFixed(1)}" y2="${sy(y0).toFixed(1)}" class="vsym"/>
        <text x="${(sx(2) + 6).toFixed(1)}" y="${(sy(y1) + 12).toFixed(1)}" class="vsym-label">x = 2</text>
        <path d="${curveD}" fill="none" stroke="url(#vCurve)" stroke-width="3.2" stroke-linecap="round" filter="url(#vGlow)" class="vcurve"/>
        <g class="vpts">
          <circle cx="${sx(1).toFixed(1)}" cy="${sy(0).toFixed(1)}" r="10" class="vhalo r"/><circle cx="${sx(1).toFixed(1)}" cy="${sy(0).toFixed(1)}" r="5.5" class="vdot r"/>
          <circle cx="${sx(3).toFixed(1)}" cy="${sy(0).toFixed(1)}" r="10" class="vhalo r"/><circle cx="${sx(3).toFixed(1)}" cy="${sy(0).toFixed(1)}" r="5.5" class="vdot r"/>
          <circle cx="${sx(2).toFixed(1)}" cy="${sy(-1).toFixed(1)}" r="11" class="vhalo v"/><circle cx="${sx(2).toFixed(1)}" cy="${sy(-1).toFixed(1)}" r="6" class="vdot v"/>
        </g>
        <g class="vlabels">
          <text x="${sx(1).toFixed(1)}" y="${(sy(0) + 30).toFixed(1)}" text-anchor="middle" class="lab r">x<tspan class="sub">1</tspan> = 1</text>
          <text x="${sx(3).toFixed(1)}" y="${(sy(0) + 30).toFixed(1)}" text-anchor="middle" class="lab r">x<tspan class="sub">2</tspan> = 3</text>
          <text x="${sx(2).toFixed(1)}" y="${(sy(-0.3)).toFixed(1)}" text-anchor="middle" class="lab v">V(2, −1)</text>
          <text x="${sx(2.85).toFixed(1)}" y="${(sy(6.4)).toFixed(1)}" class="lab eq">y = x² − 4x + 3</text>
          <text x="${sx(2).toFixed(1)}" y="${(sy(-2.15)).toFixed(1)}" text-anchor="middle" class="lab neg">بین دو ریشه: منفی</text>
        </g>
      </svg>
      <div class="vieta-eq">
        <div class="veq-row"><span class="k">مجموع ریشه‌ها</span><span class="v" dir="ltr">S = 1 + 3 = 4</span></div>
        <div class="veq-row"><span class="k">حاصل‌ضرب ریشه‌ها</span><span class="v" dir="ltr">P = 1 × 3 = 3</span></div>
        <div class="veq-row"><span class="k">رأس سهمی</span><span class="v" dir="ltr">x_v = S/2 = 2</span></div>
        <div class="veq-note" dir="ltr">x² − Sx + P = 0</div>
        <div class="veq-note" dir="ltr">x² − 4x + 3 = 0 ✓</div>
      </div>
    </div>`;
  }

  function numberlineVisual() {
    // |x − 3| = 7  →  x = 10 or x = −4  (distance 7 on both sides of 3)
    const W = 560, H = 190;
    const lo = -5, hi = 11;
    const X = (v) => 24 + ((v - lo) / (hi - lo)) * (W - 48);
    const baseY = 78;
    let ticks = '', labels = '';
    for (let v = -4; v <= 10; v++) {
      const major = v % 2 === 0;
      ticks += `<line x1="${X(v).toFixed(1)}" y1="${baseY - (major ? 7 : 4)}" x2="${X(v).toFixed(1)}" y2="${baseY + (major ? 7 : 4)}" class="nl-tick${major ? ' major' : ''}"/>`;
      const hot = v === 3 ? ' hot a' : v === -4 ? ' hot b' : v === 10 ? ' hot c' : '';
      labels += `<text x="${X(v).toFixed(1)}" y="${baseY + 24}" text-anchor="middle" class="nl-num${hot}">${v < 0 ? '−' + fa(-v) : fa(v)}</text>`;
    }
    const pts = [[-4, 'b'], [3, 'a'], [10, 'c']];
    const dots = pts.map(([v, c]) => `
      <circle cx="${X(v).toFixed(1)}" cy="${baseY}" r="13" class="nl-halo ${c}"/>
      <circle cx="${X(v).toFixed(1)}" cy="${baseY}" r="7" class="nl-dot ${c}"/>`).join('');
    const brace = (from, to, label) => {
      const x1 = X(from), x2 = X(to), y = baseY + 42, mid = (x1 + x2) / 2;
      return `<path d="M${x1.toFixed(1)} ${y} q0 9 9 9 H${(mid - 6).toFixed(1)} q6 0 6 7 q0 -7 6 -7 H${(x2 - 9).toFixed(1)} q9 0 9 -9" class="nl-brace"/>
        <text x="${mid.toFixed(1)}" y="${y + 28}" text-anchor="middle" class="nl-blabel">${label}</text>`;
    };
    return `<div class="numberline">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="محور اعداد: نقاط ۳، منفی ۴ و ۱۰؛ فاصله هر دو نقطه‌ی نارنجی و آبی از ۳ برابر ۷ است">
        <line x1="${X(lo).toFixed(1)}" y1="${baseY}" x2="${X(hi).toFixed(1)}" y2="${baseY}" class="nl-line"/>
        <g>${ticks}</g>
        <g>${labels}</g>
        <g>${dots}</g>
        ${brace(-4, 3, '۷ واحد')}${brace(3, 10, '۷ واحد')}
      </svg>
      <div class="nl-caption">هر نقطه‌ای که فاصله‌اش از <b>۳</b> برابر <b>۷</b> باشد، جواب معادله است: <span dir="ltr">$|x-3|=7$</span></div>
    </div>`;
  }

  function absfoldVisual() {
    // y = x² − 4x + 3  (roots 1 and 3, vertex (2, −1)).
    // Above the axis: solid teal. Under the axis: dashed grey, and its mirror is drawn solid above the axis.
    // On first view a gold ghost of the negative part folds up over the axis and fades onto that mirror.
    const W = 440, H = 250;
    const x0 = -0.7, x1 = 4.7, y0 = -2.3, y1 = 5.3;
    const sx = (x) => 28 + ((x - x0) / (x1 - x0)) * (W - 56);
    const sy = (y) => H - 28 - ((y - y0) / (y1 - y0)) * (H - 56);
    const f = (x) => x * x - 4 * x + 3;
    const P = (x, y) => `${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`;
    const sample = (fn, a, b, n) => { const o = []; for (let i = 0; i <= n; i++) { const x = a + (b - a) * i / n; o.push(P(x, fn(x))); } return o; };
    const line = (pts) => 'M' + pts.join(' L');
    const still = Store.state.settings.reduceMotion;
    const AY = sy(0);
    const leftArm = line(sample(f, -0.45, 1, 26));
    const rightArm = line(sample(f, 3, 4.45, 26));
    const under = line(sample(f, 1, 3, 48));                       // the part below the axis
    const mirror = line(sample((x) => -f(x), 1, 3, 48));           // its reflection above the axis
    // matrix(1,0,0,k,0,(1-k)·AY):  k = 1 → as it is (under the axis), k = -1 → mirrored above it
    const mat = (k) => `matrix(1,0,0,${k},0,${((1 - k) * AY).toFixed(2)})`;
    const ghost = still ? '' : `<g class="af-ghost">
          <path d="${under}" fill="none" stroke="#f2e85c" stroke-width="3.4" stroke-linecap="round">
            <animateTransform attributeName="transform" type="matrix" additive="replace" begin="0.5s" dur="2.4s" fill="freeze"
              calcMode="spline" keyTimes="0;0.5;1" keySplines=".5 0 .4 1;.5 0 .4 1"
              values="${mat(1)};${mat(-1)};${mat(-1)}"/>
            <animate attributeName="opacity" begin="0.5s" dur="2.4s" fill="freeze" values="1;1;0" keyTimes="0;0.72;1"/>
          </path>
        </g>`;
    return `<div class="absfold">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="نمودار y = x² − 4x + 3؛ بخش زیر محور خط‌چین و قرینه‌ی آن بالای محور ممتد است">
        <defs>
          <marker id="afArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--line-strong)"/></marker>
        </defs>
        <line x1="${sx(x0).toFixed(1)}" y1="${AY.toFixed(1)}" x2="${sx(x1).toFixed(1)}" y2="${AY.toFixed(1)}" stroke="var(--line-strong)" stroke-width="1.6" marker-end="url(#afArrow)"/>
        <line x1="${sx(0).toFixed(1)}" y1="${sy(y0).toFixed(1)}" x2="${sx(0).toFixed(1)}" y2="${sy(y1).toFixed(1)}" stroke="var(--line-strong)" stroke-width="1.6" marker-end="url(#afArrow)"/>
        <text x="${(sx(x1) - 4).toFixed(1)}" y="${(AY - 8).toFixed(1)}" class="d-lab">x</text>
        <text x="${(sx(0) + 7).toFixed(1)}" y="${(sy(y1) + 13).toFixed(1)}" class="d-lab">y</text>

        <!-- above the axis: solid; under the axis: dashed + grey -->
        <path d="${leftArm}" fill="none" stroke="#7fe7c4" stroke-width="3.2" stroke-linecap="round"/>
        <path d="${rightArm}" fill="none" stroke="#7fe7c4" stroke-width="3.2" stroke-linecap="round"/>
        <path d="${under}" fill="none" stroke="var(--muted)" stroke-width="2.4" stroke-dasharray="6 6" opacity=".9"/>
        <!-- the reflection of that dashed part, folded up -->
        <path d="${mirror}" fill="none" stroke="#7fe7c4" stroke-width="3.2" stroke-linecap="round"/>
        ${ghost}

        <circle cx="${sx(2).toFixed(1)}" cy="${sy(-1).toFixed(1)}" r="4" fill="var(--muted)" opacity=".85"/>
        <circle cx="${sx(1).toFixed(1)}" cy="${AY.toFixed(1)}" r="5.5" fill="#f2e85c"/>
        <circle cx="${sx(3).toFixed(1)}" cy="${AY.toFixed(1)}" r="5.5" fill="#f2e85c"/>

        <text x="${sx(4.62).toFixed(1)}" y="${(sy(4.35)).toFixed(1)}" class="af-lab muted" text-anchor="end">y = f(x)</text>
        <text x="${sx(2).toFixed(1)}" y="${(sy(1) - 16).toFixed(1)}" class="af-lab teal" text-anchor="middle">قرینه بالا می‌آید ← |f(x)|</text>
        <text x="${sx(2).toFixed(1)}" y="${(sy(-1) + 24).toFixed(1)}" class="af-lab muted" text-anchor="middle">بخش زیر محور (خط‌چین)</text>
        <text x="${sx(1).toFixed(1)}" y="${(AY + 20).toFixed(1)}" class="af-lab gold" text-anchor="middle">۱</text>
        <text x="${sx(3).toFixed(1)}" y="${(AY + 20).toFixed(1)}" class="af-lab gold" text-anchor="middle">۳</text>
      </svg>
      <div class="af-caption">بخش <b>خط‌چین خاکستری</b> زیر محور می‌ماند و <b>قرینه‌اش بالای محور</b> کشیده می‌شود؛ منحنی کامل، همان <span dir="ltr">y = |x² − 4x + 3|</span> است.</div>
    </div>`;
  }

  function coordinateVisual() {
    return `<div class="coord">
      <svg viewBox="0 0 420 260" aria-hidden="true">
        <line x1="30" y1="210" x2="390" y2="210" stroke="var(--line-strong)" stroke-width="1.5"/>
        <line x1="210" y1="20" x2="210" y2="250" stroke="var(--line-strong)" stroke-width="1.5"/>
        ${[1,2,3,4,5].map(i => `<line x1="${210 + i * 30}" y1="207" x2="${210 + i * 30}" y2="213" stroke="var(--line-strong)"/>`).join('')}
        ${[1,2,3,4,5].map(i => `<line x1="207" y1="${210 - i * 30}" x2="213" y2="${210 - i * 30}" stroke="var(--line-strong)"/>`).join('')}
        <line x1="270" y1="210" x2="270" y2="120" stroke="#7fe7c4" stroke-dasharray="4 5"/>
        <line x1="210" y1="120" x2="270" y2="120" stroke="#7fe7c4" stroke-dasharray="4 5"/>
        <line x1="270" y1="120" x2="360" y2="30" stroke="#f2e85c" stroke-width="3"/>
        <circle cx="270" cy="120" r="6" fill="#7fe7c4"/><circle cx="360" cy="30" r="6" fill="#ff8a70"/>
        <text x="270" y="145" text-anchor="middle" fill="#7fe7c4" font-size="14">A(2,3)</text>
        <text x="360" y="20" text-anchor="middle" fill="#ff8a70" font-size="14">B(5,6)</text>
      </svg>
    </div>`;
  }

  function renderLesson(main, id) {
    const l = AWG.lessonById(id);
    if (!l) {
      main.innerHTML = `<section class="section"><div class="wrap"><div class="empty-state"><span class="big">؟</span>این درس پیدا نشد.<p><a class="btn btn-primary" href="#/lessons" style="margin-top:12px">بازگشت به درس‌ها</a></p></div></div></section>`;
      return;
    }
    const m = Store.masteryOf(l.id);
    const nav = AWG.lessonNav(l.id);
    const masteryColor = l.color;
    const qCount = bankCount(l.id) || l.questions;

    main.innerHTML = `
      <section class="lesson-hero">
        <div class="wrap">
          <div class="lesson-watermark">${l.num}</div>
          <div class="lesson-head">
            <div>
              <div class="lesson-kicker">
                <span class="chip chip-accent">درس ${fa(l.id)}</span>
                <span class="chip">${l.tags[0]}</span>
                <span class="chip">${l.tags[1] || ''}</span>
              </div>
              <h1 class="lesson-h1 display">${l.title}</h1>
              <p class="lesson-lead">${l.lead}</p>
              <div class="lesson-meta">
                <span class="chip">${Icons.clock} ${fa(l.minutes)} دقیقه</span>
                <span class="chip">${fa(bankCount(l.id) || l.questions)} سؤال</span>
                <span class="chip chip-mint">آزمایشگاه 3D</span>
              </div>
            </div>
            <div class="lesson-side">
              <div class="lesson-progress-ring">
                ${ringSVG(m, 104, 6, masteryColor)}
                <div style="text-align:center"><div class="ring-num">${fa(m)}٪</div><div class="ring-label">تسلط</div></div>
              </div>
              <div class="lesson-nav">
                ${nav.prev ? `<a class="btn btn-sm" href="#/lesson/${nav.prev.id}">→ قبلی</a>` : ''}
                ${nav.next ? `<a class="btn btn-sm btn-primary" href="#/lesson/${nav.next.id}">بعدی ←</a>` : `<a class="btn btn-sm btn-primary" href="#/exam">آزمون ←</a>`}
              </div>
            </div>
          </div>
          <div class="lesson-toc" aria-label="فهرست درس">
            ${l.sections.map((s) => `<button type="button" class="toc-btn" data-scroll="s-${s.id}">${s.label}</button>`).join('')}
          </div>
        </div>
      </section>

      <div class="wrap-read">
        <div class="content">
          ${l.sections.map((s, i) => `
            <section class="block reveal" id="s-${s.id}" style="--d:${i * 35}ms">
              <div class="block-label"><span class="num">${fa(i + 1)}</span>${s.label}</div>
              <h2 class="block-title">${s.title}</h2>
              ${renderBlocks(s.blocks)}
            </section>`).join('')}

          <section class="block reveal" id="s-keypoints">
            <div class="block-label"><span class="num">✦</span>جمع‌بندی</div>
            <h2 class="block-title">چهار چیزی که باید از این درس ببری</h2>
            <div class="keypoints">
              ${l.keyPoints.map((k, i) => `<div class="keypoint"><span class="kp-num">${fa(i + 1)}</span><div>${k}</div></div>`).join('')}
            </div>
          </section>

          <section class="lesson-cta reveal">
            <div class="cta-left">
              <span class="eyebrow">حالا نوبت توست</span>
              <h2 class="display">خودت را محک بزن</h2>
              <p>${fa(qCount)} سؤال از همین درس، با پاسخ تشریحی. سطح را انتخاب کن و شروع کن.</p>
            </div>
            <div class="cta-actions">
              <a class="btn btn-primary btn-lg" href="#/quiz/${l.id}/10/0">۱۰ سؤال <span class="arr">←</span></a>
              <a class="btn btn-lg" href="#/quiz/${l.id}/10/2">سطح متوسط</a>
              <a class="btn btn-ghost" href="#/practice">تمرین سفارشی</a>
            </div>
          </section>
        </div>
      </div>
      ${footer()}
    `;

    main.querySelectorAll('[data-scroll]').forEach((b) => {
      b.addEventListener('click', () => {
        const t = document.getElementById(b.dataset.scroll);
        if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    renderVisuals(main);
    AWG.renderMath(main);
    mountLabs(main);
    pageTitle(l.short);
  }

  /* =========================================================
     PRACTICE SETUP
     ========================================================= */
  function renderPractice(main) {
    let source = '1';
    let level = 0;
    let count = 10;

    main.innerHTML = `
      <section class="page-hero">
        <div class="wrap">
          <span class="eyebrow">تمرین</span>
          <h1 class="page-title display">تمرین سفارشی</h1>
          <p class="page-lead">درس، سطح و تعداد سؤال را انتخاب کن. اگر بانک سؤال تمام شد، آزمایشگاه خودش سؤال تازه می‌سازد؛ پس عملاً بی‌پایان است.</p>
        </div>
      </section>
      <section class="section section-tight">
        <div class="wrap">
          <div class="setup-card">
            <div class="field">
              <span class="field-label">کدام درس؟</span>
              <div class="choice-grid" id="srcGrid">
                ${AWG.LESSONS.map((l) => `<button type="button" class="choice ${l.id === source ? 'active' : ''}" data-src="${l.id}"><span class="t">${l.short}</span><span class="s">${fa(Store.masteryOf(l.id))}٪ تسلط</span></button>`).join('')}
                <button type="button" class="choice" data-src="mixed"><span class="t">مرور ترکیبی</span><span class="s">از کل فصل</span></button>
              </div>
            </div>
            <div class="field">
              <span class="field-label">سطح سؤال</span>
              <div class="seg" id="levelSeg">
                <button type="button" class="seg-btn active" data-level="0">همه</button>
                <button type="button" class="seg-btn" data-level="1">آسان</button>
                <button type="button" class="seg-btn" data-level="2">متوسط</button>
                <button type="button" class="seg-btn" data-level="3">سخت</button>
              </div>
            </div>
            <div class="field">
              <span class="field-label">تعداد سؤال</span>
              <div class="seg" id="countSeg">
                ${[5, 10, 15, 20].map((n) => `<button type="button" class="seg-btn ${n === count ? 'active' : ''}" data-count="${n}">${fa(n)}</button>`).join('')}
              </div>
            </div>
            <div class="setup-actions">
              <button type="button" class="btn btn-primary btn-lg" id="startPractice">شروع تمرین <span class="arr">←</span></button>
              <a class="btn btn-lg" href="#/exam">آزمون جامع</a>
            </div>
          </div>
        </div>
      </section>
      ${footer()}
    `;

    const sync = () => {
      main.querySelectorAll('[data-src]').forEach((b) => b.classList.toggle('active', b.dataset.src === source));
      main.querySelectorAll('[data-level]').forEach((b) => b.classList.toggle('active', +b.dataset.level === level));
      main.querySelectorAll('[data-count]').forEach((b) => b.classList.toggle('active', +b.dataset.count === count));
    };
    main.querySelectorAll('[data-src]').forEach((b) => b.addEventListener('click', () => { source = b.dataset.src; sync(); Sound.play('tap'); }));
    main.querySelectorAll('[data-level]').forEach((b) => b.addEventListener('click', () => { level = +b.dataset.level; sync(); Sound.play('tap'); }));
    main.querySelectorAll('[data-count]').forEach((b) => b.addEventListener('click', () => { count = +b.dataset.count; sync(); Sound.play('tap'); }));
    main.querySelector('#startPractice').addEventListener('click', () => {
      Sound.play('click');
      Router.go(`/quiz/${source}/${count}/${level}`);
    });
    pageTitle('تمرین');
  }

  /* =========================================================
     EXAM SETUP
     ========================================================= */
  function renderExam(main) {
    const best = Store.state.stats.examBest || 0;
    main.innerHTML = `
      <section class="page-hero">
        <div class="wrap">
          <span class="eyebrow">آزمون</span>
          <h1 class="page-title display">خودت را محک بزن</h1>
          <p class="page-lead">دو آزمون با تایمر و بدون پاسخ فوری. در پایان، تحلیل موضوعی و مرور کامل پاسخ‌ها را می‌بینی.</p>
        </div>
      </section>
      <section class="section section-tight">
        <div class="wrap">
          <div class="exam-grid">
            <div class="exam-option reveal">
              <span class="chip chip-accent">امتحان نهایی</span>
              <h2 class="display">۵۰ سؤال · ۳۰ دقیقه</h2>
              <p>سبک امتحان پایانی، از همه پنج درس. بهترین نمره تا الان: <strong>${fa(best)}٪</strong></p>
              <div class="exam-start">
                <label class="field-label" for="finalCount">تعداد سؤال</label>
                <select id="finalCount" class="select">
                  <option value="10">۱۰ سؤال</option>
                  <option value="20" selected>۲۰ سؤال</option>
                  <option value="30">۳۰ سؤال</option>
                  <option value="50">۵۰ سؤال</option>
                </select>
                <button class="btn btn-primary btn-lg" id="startFinal" type="button">شروع آزمون نهایی <span class="arr">←</span></button>
              </div>
            </div>
            <div class="exam-option reveal" style="--d:80ms">
              <span class="chip chip-coral">سبک کنکور</span>
              <h2 class="display">۷۰ سؤال · ۴۵ دقیقه</h2>
              <p>سؤال‌های ترکیبی و کمی سخت‌تر، شبیه آزمون‌های سراسری. بهترین نمره: <strong>${fa(best)}٪</strong></p>
              <div class="exam-start">
                <label class="field-label" for="konkoorCount">تعداد سؤال</label>
                <select id="konkoorCount" class="select">
                  <option value="10">۱۰ سؤال</option>
                  <option value="20" selected>۲۰ سؤال</option>
                  <option value="40">۴۰ سؤال</option>
                  <option value="70">۷۰ سؤال</option>
                </select>
                <button class="btn btn-primary btn-lg" id="startKonkoor" type="button">شروع آزمون کنکوری <span class="arr">←</span></button>
              </div>
            </div>
          </div>
          <div class="exam-note">${Icons.target} در آزمون، پاسخ درست تا پایان نمایش داده نمی‌شود. می‌توانی بین سؤال‌ها جابه‌جا شوی و در پایان تحلیل کامل ببینی.</div>
        </div>
      </section>
      ${footer()}
    `;
    main.querySelector('#startFinal').addEventListener('click', () => {
      const n = +main.querySelector('#finalCount').value;
      Sound.play('click');
      Router.go(`/quiz/final/${n}/0`);
    });
    main.querySelector('#startKonkoor').addEventListener('click', () => {
      const n = +main.querySelector('#konkoorCount').value;
      Sound.play('click');
      Router.go(`/quiz/konkoor/${n}/0`);
    });
    pageTitle('آزمون');
  }

  /* =========================================================
     QUIZ
     ========================================================= */
  function createSession(route) {
    const source = route.source || '1';
    const count = clamp(route.count || 10, 1, 70);
    const level = route.level || 0;
    const questions = AWG.prepareQuestions(source, count, level);
    const mode = (source === 'final' || source === 'konkoor') ? 'exam' : 'practice';
    const timeLimit = source === 'final' ? 30 * 60 : source === 'konkoor' ? 45 * 60 : 0;
    return {
      source, count, level, questions, mode, timeLimit,
      index: 0, answers: [], correct: 0, streak: 0, bestStreak: 0,
      xp: 0, startedAt: Date.now(), timer: null, autoTimer: null
    };
  }

  function renderQuiz(main, route) {
    const s = createSession(route);
    if (!s.questions.length) {
      main.innerHTML = `<section class="section"><div class="wrap"><div class="empty-state"><span class="big">∅</span>سؤالی برای این تنظیمات پیدا نشد.</div></div></section>`;
      return;
    }
    activeSession = s;
    main.innerHTML = `<div class="quiz" id="quizRoot"></div>`;
    const root = document.getElementById('quizRoot');
    s.keyHandler = (e) => {
      const ae = document.activeElement;
      if (ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) return;
      if (document.querySelector('.modal.open')) return;
      const options = root.querySelectorAll('.option');
      let digit = -1;
      if (e.key >= '1' && e.key <= '4') digit = +e.key - 1;
      else if ('۰۱۲۳۴۵۶۷۸۹'.includes(e.key)) digit = '۰۱۲۳۴۵۶۷۸۹'.indexOf(e.key) - 1;
      if (digit >= 0 && digit < 4) {
        const btn = options[digit];
        if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
        return;
      }
      if (e.key === 'Enter' && s.mode !== 'exam') {
        const next = root.querySelector('.next-btn');
        if (next) next.click();
      } else if (e.key === 'Enter' && s.mode === 'exam' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (s.index === s.questions.length - 1) submitExam(root, s);
        else { s.index++; renderQuestion(root, s); }
      } else if (e.key === 'ArrowLeft' && s.mode === 'exam') {
        const nx = root.querySelector('#nextQ');
        if (nx) nx.click();
      } else if (e.key === 'ArrowRight' && s.mode === 'exam') {
        const pv = root.querySelector('#prevQ');
        if (pv && !pv.disabled) pv.click();
      }
    };
    document.addEventListener('keydown', s.keyHandler);
    renderQuestion(root, s);
    startTimer(root, s);
    pageTitle(modeLabel(s));
  }

  function releaseSession(s) {
    if (!s) return;
    if (s.timer) clearInterval(s.timer);
    if (s.autoTimer) clearTimeout(s.autoTimer);
    if (s.keyHandler) document.removeEventListener('keydown', s.keyHandler);
    s.keyHandler = null;
  }

  function modeLabel(s) {
    return s.mode === 'exam' ? (s.source === 'konkoor' ? 'آزمون کنکوری' : 'آزمون نهایی') : 'تمرین';
  }

  function progressSegments(s) {
    return s.questions.map((_, i) => {
      let cls = '';
      if (i < s.index) cls = 'done';
      else if (i === s.index) cls = 'now';
      return `<span class="qp-seg ${cls}"></span>`;
    }).join('');
  }

  function paletteHTML(s) {
    if (s.mode !== 'exam') return '';
    return `<div class="exam-palette" aria-label="پالت سؤال‌ها">
      ${s.questions.map((_, i) => {
        const a = s.answers[i];
        const cls = a ? (a.correct === undefined ? 'answered' : (a.correct ? 'correct' : 'wrong')) : '';
        return `<button type="button" class="palette-btn ${i === s.index ? 'current' : ''} ${cls}" data-jump="${i}">${fa(i + 1)}</button>`;
      }).join('')}
    </div>`;
  }

  function renderQuestion(root, s) {
    if (s.index >= s.questions.length) { renderResults(root, s); return; }
    const q = s.questions[s.index];
    const isExam = s.mode === 'exam';
    const prev = s.answers[s.index];
    const elapsed = Math.floor((Date.now() - s.startedAt) / 1000);
    const timeText = isExam ? formatTime(Math.max(0, s.timeLimit - elapsed)) : formatTime(elapsed);

    root.innerHTML = `
      <div class="quiz-head">
        <div class="quiz-progress" aria-hidden="true">${progressSegments(s)}</div>
        <div class="quiz-meta">
          <span class="timer">${Icons.clock} ${timeText}</span>
          ${!isExam ? `<span class="streak">${Icons.flame} ${fa(s.streak)}</span>` : ''}
          <span class="chip">${AWG.sourceLabel(s.source)}</span>
        </div>
      </div>
      ${paletteHTML(s)}
      <div class="qcard">
        <div class="q-top">
          <span class="qnum">${fa(s.index + 1)}</span>
          <span class="qsource">${AWG.sourceLabel(s.source)} · سؤال ${fa(s.index + 1)} از ${fa(s.questions.length)}</span>
          ${q.level ? `<span class="chip">${AWG.LEVEL_NAMES[q.level] || ''}</span>` : ''}
        </div>
        <div class="qtext">${q.q}</div>
        <div class="options" role="group" aria-label="گزینه‌ها">
          ${q.choices.map((opt, i) => `<button type="button" class="option ${prev && prev.chosen === i ? 'selected' : ''}" data-i="${i}" aria-pressed="${!!(prev && prev.chosen === i)}">
            <span class="opt-letter">${LETTERS[i]}</span><span class="opt-text">${opt.text}</span>
          </button>`).join('')}
        </div>
        <div class="feedback" id="feedback"></div>
        ${isExam ? `<div class="exam-actions">
          <button type="button" class="btn btn-sm" id="prevQ" ${s.index === 0 ? 'disabled' : ''}>→ قبلی</button>
          <span class="spacer"></span>
          ${s.index === s.questions.length - 1
            ? `<button type="button" class="btn btn-primary" id="submitExam">پایان و تحلیل</button>`
            : `<button type="button" class="btn btn-primary" id="nextQ">سؤال بعدی ←</button>`}
        </div>` : ''}
      </div>
      <div class="quiz-foot">
        <span>${isExam ? 'پاسخ‌ها تا پایان آزمون مخفی می‌مانند' : `${fa(s.correct)} پاسخ درست از ${fa(s.index + 1)}`}</span>
        <span>${isExam ? 'Ctrl + Enter برای ثبت' : 'کلیدهای ۱ تا ۴ برای پاسخ'}</span>
      </div>
    `;

    AWG.renderMath(root);

    const options = root.querySelectorAll('.option');
    options.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (isExam) answerExam(root, s, q, btn);
        else answerPractice(root, s, q, btn);
      });
    });

    if (isExam) {
      const prevBtn = root.querySelector('#prevQ');
      if (prevBtn) prevBtn.addEventListener('click', () => {
        if (s.index > 0) { s.index--; renderQuestion(root, s); }
      });
      const nextBtn = root.querySelector('#nextQ');
      if (nextBtn) nextBtn.addEventListener('click', () => {
        if (s.index < s.questions.length - 1) { s.index++; renderQuestion(root, s); }
      });
      const submit = root.querySelector('#submitExam');
      if (submit) submit.addEventListener('click', () => {
        if (confirm('آزمون را پایان می‌دهی؟ بعد از ثبت، امکان تغییر پاسخ نیست.')) submitExam(root, s);
      });
      root.querySelectorAll('[data-jump]').forEach((b) => {
        b.addEventListener('click', () => {
          s.index = +b.dataset.jump;
          renderQuestion(root, s);
        });
      });
    }

  }

  function answerPractice(root, s, q, btn) {
    if (btn.disabled) return;           // options are disabled right after answering
    const chosen = +btn.dataset.i;
    const isCorrect = q.choices[chosen].correct;
    const options = root.querySelectorAll('.option');
    options.forEach((o, i) => {
      o.disabled = true;
      if (q.choices[i].correct) o.classList.add('correct');
      if (i === chosen && !isCorrect) o.classList.add('wrong');
      if (i !== chosen && !q.choices[i].correct) o.classList.add('dim');
    });

    s.answers.push({ q, chosen, correct: isCorrect });
    if (isCorrect) {
      s.correct++; s.streak++;
      s.bestStreak = Math.max(s.bestStreak, s.streak);
    } else {
      s.streak = 0;
    }
    const lessonId = isLessonSource(s.source) ? s.source : 'mixed';
    const base = q.level === 1 ? 10 : q.level === 2 ? 20 : 30;
    const bonus = isCorrect ? Math.min(s.streak * 5, 25) : 0;
    const gain = isCorrect ? base + bonus : 2;
    s.xp += gain;
    // effects & persistence are side effects: a failure here must never hide the feedback
    safe(() => Sound.play(isCorrect ? 'correct' : 'wrong'));
    if (isCorrect) safe(() => {
      const r = btn.getBoundingClientRect();
      Confetti.burst(r.left + r.width / 2, r.top + r.height / 2, 26);
    });
    safe(() => { Store.recordAnswer(lessonId, isCorrect, q.level); Store.addXP(gain, true); });
    safe(updateXPChip);
    safe(() => Store.checkBadges());

    const fb = root.querySelector('#feedback');
    const isLast = s.index === s.questions.length - 1;
    fb.innerHTML = `<div class="fb-head ${isCorrect ? 'fb-correct' : 'fb-wrong'}">
        ${isCorrect ? Icons.check : Icons.x}
        <span>${isCorrect ? 'درست بود! ' + (bonus ? `+${fa(bonus)} XP زنجیره` : '') : 'اشتباه بود؛ ولی حالا یاد می‌گیری'}</span>
      </div>
      <div class="fb-body">
        ${isCorrect ? '' : `<p>جواب درست: <strong>${q.choices[q.correctIndex].text}</strong></p>`}
        <div class="fb-solution">${q.solution}</div>
        <button type="button" class="next-btn">${isLast ? 'دیدن نتیجه' : 'سؤال بعدی'} <span>←</span></button>
      </div>`;
    fb.classList.add('show');
    AWG.renderMath(fb);
    fb.querySelector('.next-btn').addEventListener('click', () => {
      Sound.play('tap');
      s.index++;
      if (s.index >= s.questions.length) renderResults(root, s);
      else renderQuestion(root, s);
    });
    fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function answerExam(root, s, q, btn) {
    const chosen = +btn.dataset.i;
    s.answers[s.index] = { q, chosen, correct: q.choices[chosen].correct };
    root.querySelectorAll('.option').forEach((o, i) => {
      o.classList.toggle('selected', i === chosen);
      o.setAttribute('aria-pressed', i === chosen ? 'true' : 'false');
    });
    root.querySelectorAll('[data-jump]').forEach((b) => {
      b.classList.toggle('answered', +b.dataset.jump === s.index);
    });
    Sound.play('tap');
    clearTimeout(s.autoTimer);
    s.autoTimer = setTimeout(() => {
      if (s.index < s.questions.length - 1) {
        s.index++;
        renderQuestion(root, s);
      }
    }, 260);
  }

  function submitExam(root, s) {
    if (s.mode !== 'exam') return;
    clearInterval(s.timer);
    clearTimeout(s.autoTimer);
    const total = s.questions.length;
    let correct = 0;
    let xpEarned = 0;
    const lessonId = isLessonSource(s.source) ? s.source : 'mixed';
    s.answers.forEach((a) => {
      if (!a) return;
      if (a.correct) {
        correct++;
        xpEarned += a.q.level === 1 ? 15 : a.q.level === 2 ? 25 : 35;
      }
      Store.recordAnswer(lessonId, !!a.correct, a.q.level);
    });
    s.correct = correct;
    if (xpEarned) Store.addXP(xpEarned);
    Store.checkBadges();
    Store.recordQuiz(lessonId, correct, total, 'exam', xpEarned);
    updateXPChip();
    renderResults(root, s, xpEarned);
  }

  function startTimer(root, s) {
    clearInterval(s.timer);
    const tick = () => {
      if (s.mode !== 'exam' && s.index >= s.questions.length) { clearInterval(s.timer); return; }
      const elapsed = Math.floor((Date.now() - s.startedAt) / 1000);
      const el = root.querySelector('.timer');
      if (!el) return;
      if (s.mode === 'exam') {
        const left = Math.max(0, s.timeLimit - elapsed);
        el.innerHTML = `${Icons.clock} ${formatTime(left)}`;
        el.classList.toggle('warn', left < 60);
        if (left <= 0) {
          clearInterval(s.timer);
          Toast.show('زمان تمام شد؛ آزمون ثبت شد', 'bad', 3000);
          submitExam(root, s);
        }
      } else {
        el.innerHTML = `${Icons.clock} ${formatTime(elapsed)}`;
      }
    };
    tick();
    s.timer = setInterval(tick, 1000);
  }

  /* =========================================================
     RESULTS
     ========================================================= */
  function topicStats(s) {
    const map = {};
    s.questions.forEach((q, i) => {
      const a = s.answers[i];
      if (!a) return;
      const key = q.topic || 'سایر';
      if (!map[key]) map[key] = { correct: 0, total: 0 };
      map[key].total++;
      if (a.correct) map[key].correct++;
    });
    return Object.keys(map).map((k) => ({ name: k, ...map[k], pct: map[k].total ? Math.round(map[k].correct / map[k].total * 100) : 0 }));
  }

  function radarSVG(stats, size) {
    size = size || 280;
    const n = stats.length;
    if (n < 3) return '';
    const cx = size / 2, cy = size / 2, R = size * 0.34;
    const angle = (i) => -Math.PI / 2 + i * 2 * Math.PI / n;
    const pt = (i, r) => [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r];
    let grid = '';
    [0.25, 0.5, 0.75, 1].forEach((f) => {
      const pts = stats.map((_, i) => pt(i, R * f).join(',')).join(' ');
      grid += `<polygon points="${pts}" fill="none" stroke="var(--line)" stroke-width="1"/>`;
    });
    let axes = '';
    stats.forEach((_, i) => {
      const [x, y] = pt(i, R);
      axes += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--line)" stroke-width="1"/>`;
    });
    const dataPts = stats.map((st, i) => pt(i, R * (st.pct / 100)).join(',')).join(' ');
    let labels = '';
    stats.forEach((st, i) => {
      const [x, y] = pt(i, R + 24);
      labels += `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="var(--muted)" font-size="11">${esc(st.name)}</text>`;
    });
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="نمودار دقت به تفکیک موضوع">
      ${grid}${axes}
      <polygon points="${dataPts}" fill="var(--accent)" fill-opacity=".18" stroke="var(--accent)" stroke-width="2"/>
      ${stats.map((st, i) => { const [x, y] = pt(i, R * (st.pct / 100)); return `<circle cx="${x}" cy="${y}" r="4" fill="var(--accent-2)"/>`; }).join('')}
      ${labels}
    </svg>`;
  }

  // Roadmap of the five lessons: done ones ticked, the next one glowing, an animated flow toward it
  function lessonPathHTML(currentId) {
    const lessons = AWG.LESSONS.slice().sort((a, b) => +a.id - +b.id);
    const isDone = (id) => { const st = Store.state.lessons[id]; return !!(st && st.attempts && st.best >= 0.6); };
    let nextId = currentId && +currentId < lessons.length ? String(+currentId + 1) : null;
    if (!nextId) { const firstOpen = lessons.find((l) => !isDone(l.id)); nextId = firstOpen ? firstOpen.id : null; }
    const node = (l) => {
      const done = isDone(l.id);
      const cls = ['lp-node', done ? 'done' : '', l.id === currentId ? 'current' : '', l.id === nextId ? 'next' : ''].filter(Boolean).join(' ');
      return `<a class="${cls}" href="#/lesson/${l.id}" style="--c:${l.color}">
        <span class="lp-dot">${done ? '✓' : l.icon}</span>
        <span class="lp-txt"><b>درس ${fa(l.num)}</b><small>${esc(l.short)}</small></span>
      </a>`;
    };
    let track = '';
    lessons.forEach((l, i) => {
      track += node(l);
      if (i < lessons.length - 1) {
        const prevDone = isDone(l.id);
        const flow = prevDone && l.id === currentId;   // link right after the lesson just finished
        track += `<span class="lp-link ${prevDone ? 'done' : ''} ${flow ? 'flow' : ''}" style="--c:${l.color}"><i></i></span>`;
      }
    });
    const finished = isLessonSource(currentId) && isDone(currentId);
    const head = isLessonSource(currentId)
      ? (finished ? `درس ${fa(currentId)} تمام شد!` : `درس ${fa(currentId)} را ادامه بده`)
      : 'کدام درس را قوی‌تر کنیم؟';
    const remaining = lessons.filter((l) => !isDone(l.id)).length;
    const sub = isLessonSource(currentId)
      ? (remaining > 0 ? `${fa(remaining)} درس تا پایان فصل اول مانده` : 'هر پنج درس را کامل کردی؛ نوبت آزمون جامع است')
      : 'روی هر درس بزن تا مرور کنی، یا از دکمه‌ی پایین شروع کن';
    const sparks = finished ? `<span class="lp-sparks" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<i style="--a:${i * 36}deg;--d:${(i % 3) * 0.12}s"></i>`).join('')}</span>` : '';
    return `<section class="lesson-path ${finished ? 'is-finished' : ''}" style="--c:${(AWG.lessonById(currentId) || {}).color || 'var(--accent)'}" aria-label="مسیر درس‌ها">
      ${sparks}
      <div class="lp-head">
        <div>
          <span class="eyebrow">${finished ? 'درس ثبت شد' : 'مسیر فصل'}</span>
          <h2 class="display">${head}</h2>
          <p class="lp-sub">${sub}</p>
        </div>
        ${finished ? `<span class="lp-check" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="22"/><path d="M15 27l8 8 15-16"/></svg></span>` : ''}
      </div>
      <div class="lp-track">${track}</div>
    </section>`;
  }

  // Bottom of the results page: "درس ۱ تمام شد → درس ۲" with a bold, animated next button
  function lessonFinishHTML(currentId) {
    const lessons = AWG.LESSONS.slice().sort((a, b) => +a.id - +b.id);
    const next = currentId && +currentId < lessons.length ? AWG.lessonById(String(+currentId + 1)) : null;
    const done = lessons.filter((l) => { const st = Store.state.lessons[l.id]; return !!(st && st.attempts && st.best >= 0.6); }).length;
    const pctDone = Math.round((done / lessons.length) * 100);
    const title = currentId ? `درس ${fa(currentId)} تمام شد` : 'مسیرت را انتخاب کن';
    const sub = next
      ? 'برو سراغ درس بعدی؛ همین‌جا ادامه بده.'
      : (currentId ? 'پنج درس کامل شد؛ حالا آزمون جامع فصل اول.' : 'نتیجه‌ات ثبت شد. یک درس را انتخاب کن و ادامه بده.');
    const btn = next
      ? `<a class="finish-next" href="#/lesson/${next.id}" style="--c:${next.color}">
           <span class="fn-badge"><svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="22"/><path d="M15 27l8 8 15-16"/></svg></span>
           <span class="fn-text"><b>${title}</b><small>درس ${fa(next.id)} · ${esc(next.short)}</small></span>
           <span class="fn-cta">درس بعدی ${Icons.arrow || '←'}</span>
         </a>`
      : `<a class="finish-next finish-final" href="#/exam" style="--c:var(--accent)">
           <span class="fn-badge"><svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="22"/><path d="M15 27l8 8 15-16"/></svg></span>
           <span class="fn-text"><b>${title}</b><small>همه‌ی درس‌ها را پاس کردی</small></span>
           <span class="fn-cta">آزمون جامع ${Icons.arrow || '←'}</span>
         </a>`;
    return `<section class="lesson-finish" aria-label="پایان درس">
      <div class="lf-track" aria-hidden="true">
        ${lessons.map((l) => {
          const st = Store.state.lessons[l.id];
          const ok = !!(st && st.attempts && st.best >= 0.6);
          return `<span class="lf-step ${ok ? 'ok' : ''} ${l.id === currentId ? 'now' : ''}" style="--c:${l.color}"><i></i><em>${fa(l.num)}</em></span>`;
        }).join('')}
        <span class="lf-fill" style="width:${pctDone}%"></span>
      </div>
      ${btn}
      <p class="lf-note">${sub}</p>
    </section>`;
  }

  function renderResults(root, s, examXP) {
    releaseSession(s);
    const total = s.questions.length;
    let correct, xpEarned;
    if (s.mode === 'exam') {
      correct = s.correct;
      xpEarned = examXP || 0;
    } else {
      correct = s.correct;
      xpEarned = s.xp;
    }
    const pct = Math.round((correct / total) * 100);
    const isDaily = s.source === 'daily';
    if (isDaily) {
      const today = U.dateKey();
      const d = Store.state.daily;
      if (!(d.date === today && d.done)) {
        Store.state.daily = { date: today, done: true, score: correct, total };
        Store.state.stats.dailyDone = (Store.state.stats.dailyDone || 0) + 1;
        Store.save();
        xpEarned += 50;
        Store.addXP(50);
      }
    }
    if (s.mode === 'practice') {
      Store.recordQuiz(isLessonSource(s.source) ? s.source : 'mixed', correct, total, 'practice', xpEarned);
    }
    Store.checkBadges();

    let stamp = 'تلاش کن';
    let title = 'ادامه بده!';
    let msg = 'هر اشتباه، یک جای خالی است که حالا می‌دانی کجاست. درس را مرور کن و دوباره امتحان بده.';
    if (pct === 100) { stamp = 'بی‌نقص'; title = 'همه را درست زدی!'; msg = 'این درس را واقعاً تسلط داری. سراغ درس بعدی برو یا آزمون جامع را امتحان کن.'; }
    else if (pct >= 80) { stamp = 'عالی'; title = 'کارت فوق‌العاده بود'; msg = 'فقط چند جزئیات کوچک مانده. مرور پاسخ‌های اشتباه را ببین و دوباره بزن.'; }
    else if (pct >= 60) { stamp = 'خوب'; title = 'مسیر درستی داری'; msg = 'پایه‌ات خوب است؛ با یک مرور کوتاه روی سؤال‌های اشتباه، به سطح بالاتر می‌رسی.'; }
    else if (pct >= 40) { stamp = 'قابل قبول'; title = 'نیاز به مرور داری'; msg = 'درس‌نامه و آزمایشگاه را دوباره ببین، بعد این تمرین را تکرار کن.'; }

    if (pct >= 80) Confetti.celebrate(110);
    if (pct >= 60) Sound.play('achievement');

    const elapsed = Math.floor((Date.now() - s.startedAt) / 1000);
    const stats = topicStats(s);
    const lessonId = isLessonSource(s.source) ? s.source : null;
    const nextId = lessonId && +lessonId < 5 ? String(+lessonId + 1) : null;
    const nextHref = nextId ? `#/lesson/${nextId}` : '#/exam';
    // the roadmap + "next lesson" belong to lesson practice and the two big exams (not the daily challenge)
    const showPath = !!lessonId || s.source === 'final' || s.source === 'konkoor';
    const dailyRun = s.source === 'daily';
    const showPathSafe = showPath && !dailyRun;
    // finishing a lesson (a pass) is worth its own celebration
    const finishedLesson = !!(lessonId && pct >= 60);
    if (finishedLesson && pct < 80) Confetti.celebrate(90);   // the 80%+ case already celebrates above

    const review = s.questions.map((q, i) => {
      const a = s.answers[i];
      const ok = a && a.correct;
      const chosen = a ? q.choices[a.chosen] : null;
      return `<details class="review-item">
        <summary class="review-head">
          <span class="mark ${ok ? 'ok' : 'bad'}">${ok ? '✓' : '×'}</span>
          <span class="review-q">${fa(i + 1)}. ${q.q}</span>
        </summary>
        <div class="review-body">
          ${chosen ? `<p>پاسخ تو: <strong>${chosen.text}</strong></p>` : '<p>بدون پاسخ</p>'}
          <p>جواب درست: <strong>${q.choices[q.correctIndex].text}</strong></p>
          <div class="fb-solution">${q.solution}</div>
        </div>
      </details>`;
    }).join('');

    root.innerHTML = `<div class="results">
      <div class="result-hero">
        <div class="stamp">${stamp}</div>
        <div class="score-ring">
          ${ringSVG(pct, 168, 10, pct >= 60 ? 'var(--success)' : 'var(--accent-2)')}
          <div><div class="score-num">${fa(correct)}<small> / ${fa(total)}</small></div></div>
        </div>
        <h1 class="result-title">${title}</h1>
        <p class="result-sub">${msg}</p>
        <div class="result-actions">
          <button type="button" class="btn" id="retryBtn">${Icons.refresh} تمرین دوباره</button>
          ${showPath ? '' : `<a class="btn btn-primary" href="${nextHref}">آزمون جامع</a>`}
          <a class="btn btn-ghost" href="#/">خانه</a>
        </div>
      </div>
      ${showPathSafe ? lessonPathHTML(lessonId) : ''}

      <div class="results-grid">
        <div class="stat"><div class="stat-num">${fa(correct)}</div><div class="stat-label">پاسخ درست</div></div>
        <div class="stat"><div class="stat-num">${fa(total - correct)}</div><div class="stat-label">پاسخ اشتباه</div></div>
        <div class="stat"><div class="stat-num">${fa(pct)}٪</div><div class="stat-label">درصد</div></div>
        <div class="stat"><div class="stat-num">${fa(xpEarned)}</div><div class="stat-label">امتیاز</div></div>
      </div>

      <div class="radar-wrap">
        <div>${stats.length >= 3 ? radarSVG(stats, 280) : `<div class="topic-bars">${stats.map((st) => `<div class="topic-bar"><span>${esc(st.name)}</span><div class="bar"><i style="width:${st.pct}%"></i></div><b>${fa(st.pct)}٪</b></div>`).join('')}</div>`}</div>
        <div class="radar-legend">
          <h3 class="display" style="font-size:1.05rem;margin-bottom:6px">تحلیل موضوعی</h3>
          ${stats.map((st) => `<div class="row"><span class="dot"></span><span>${esc(st.name)}</span><span class="val">${fa(st.correct)}/${fa(st.total)}</span></div>`).join('')}
          <p class="muted" style="font-size:.72rem;margin-top:8px">هر چه نقطه‌ها به مرکز نزدیک‌تر باشند، آن موضوع نیاز به مرور بیشتری دارد.</p>
        </div>
      </div>

      <h2 class="block-title" style="margin-top:28px">مرور پاسخ‌ها</h2>
      <div class="review">${review}</div>
      ${showPathSafe ? lessonFinishHTML(lessonId) : ''}
    </div>`;

    AWG.renderMath(root);
    updateXPChip();
    const retry = root.querySelector('#retryBtn');
    if (retry) retry.addEventListener('click', () => {
      Sound.play('click');
      Router.go(`/quiz/${s.source}/${s.count}/${s.level}`);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* =========================================================
     PROGRESS
     ========================================================= */
  function renderProgress(main) {
    const st = Store.state.stats;
    const info = AWG.levelInfo(Store.state.xp);
    const accuracy = st.answered ? Math.round((st.correct / st.answered) * 100) : 0;
    const avgMastery = Math.round([1, 2, 3, 4, 5].reduce((a, id) => a + Store.masteryOf(id), 0) / 5);
    const unlocked = AWG.BADGES.filter((b) => Store.state.badges[b.id]);
    const history = Store.state.history || [];

    main.innerHTML = `
      <section class="page-hero">
        <div class="wrap">
          <span class="eyebrow">پیشرفت</span>
          <h1 class="page-title display">دفتر پیشرفت تو</h1>
          <p class="page-lead">هر پاسخ، هر زنجیره و هر نشان اینجا ذخیره می‌شود. این صفحه مال خودت است؛ با آن مسیرت را ببین.</p>
        </div>
      </section>
      <section class="section section-tight">
        <div class="wrap">
          <div class="progress-hero">
            <div class="level-badge">
              <div class="level-ring">${ringSVG(info.progress * 100, 92, 6)}<div class="lv">${fa(info.index + 1)}<small>سطح</small></div></div>
              <div>
                <span class="eyebrow">${info.icon} سطح فعلی</span>
                <h2 class="display" style="font-size:1.7rem">${info.name}</h2>
                <p class="muted" style="font-size:.82rem">${info.next ? `${faNum(info.toNext)} امتیاز تا سطح «${info.next.name}»` : 'بالاترین سطح!'}</p>
              </div>
            </div>
            <div class="stat-grid">
              <div class="stat-card"><div class="n">${faNum(Store.state.xp)}</div><div class="l">امتیاز</div></div>
              <div class="stat-card"><div class="n">${fa(accuracy)}٪</div><div class="l">دقت کل</div></div>
              <div class="stat-card"><div class="n">${fa(st.answered)}</div><div class="l">پاسخ داده‌شده</div></div>
              <div class="stat-card"><div class="n">${fa(Store.state.streak)}</div><div class="l">روز زنجیره</div></div>
            </div>
          </div>

          <div class="progress-grid">
            <div class="card">
              <h3 class="display" style="font-size:1.1rem;margin-bottom:12px">تسلط درس‌ها</h3>
              <div class="mastery-list">
                ${AWG.LESSONS.map((l) => {
                  const m = Store.masteryOf(l.id);
                  return `<div class="mastery-row"><span class="name">${l.num} · ${l.short}</span><span class="bar"><span style="width:${m}%;background:${l.color}"></span></span><span class="pct">${fa(m)}٪</span></div>`;
                }).join('')}
              </div>
              <p class="muted" style="font-size:.72rem;margin-top:10px">میانگین تسلط کل فصل: <strong>${fa(avgMastery)}٪</strong></p>
            </div>

            <div class="card">
              <h3 class="display" style="font-size:1.1rem;margin-bottom:12px">نشان‌ها <span class="muted" style="font-size:.7rem">${fa(unlocked.length)} از ${fa(AWG.BADGES.length)}</span></h3>
              <div class="badge-grid">
                ${AWG.BADGES.map((b) => {
                  const on = !!(Store.state.badges[b.id]);
                  return `<div class="badge ${on ? 'unlocked' : ''}" title="${esc(b.desc)}"><span class="ico">${b.icon}</span><span class="nm">${b.name}</span><span class="ds">${on ? 'باز شده' : b.desc}</span></div>`;
                }).join('')}
              </div>
            </div>
          </div>

          <div class="card" style="margin-top:14px">
            <h3 class="display" style="font-size:1.1rem;margin-bottom:10px">تاریخچه اخیر</h3>
            ${history.length ? `<div class="history">${history.slice(0, 10).map((h) => `<div class="history-row"><span class="who">${AWG.sourceLabel(h.source)} · ${h.mode === 'exam' ? 'آزمون' : 'تمرین'}</span><span class="meta">${U.relTime(h.date)}</span><span class="score ${h.pct >= 60 ? 'good' : 'bad'}">${fa(h.score)}/${fa(h.total)}</span></div>`).join('')}</div>` : `<div class="empty-state"><span class="big">◎</span>هنوز تمرینی ثبت نشده. اولین سؤال را جواب بزن!</div>`}
          </div>

          <div class="card" style="margin-top:14px">
            <h3 class="display" style="font-size:1.1rem;margin-bottom:8px">تنظیمات پیشرفت</h3>
            <p class="muted" style="font-size:.8rem;margin-bottom:14px">اگر می‌خواهی از صفر شروع کنی، پیشرفت را پاک کن. تنظیمات ظاهر و صدا دست‌نخورده می‌مانند.</p>
            <button type="button" class="btn btn-danger" id="resetProgress">${Icons.refresh} پاک کردن پیشرفت</button>
          </div>
        </div>
      </section>
      ${footer()}
    `;
    const reset = main.querySelector('#resetProgress');
    if (reset) reset.addEventListener('click', () => {
      if (confirm('همه امتیازها، نشان‌ها و تاریخچه پاک شوند؟ این کار برگشت‌پذیر نیست.')) {
        Store.resetProgress();
        updateXPChip();
        Toast.show('پیشرفت پاک شد', 'good');
        renderProgress(main);
      }
    });
    pageTitle('پیشرفت');
  }

  /* =========================================================
     SETTINGS
     ========================================================= */
  function openSettings() {
    const s = Store.state.settings;
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="modal open" role="dialog" aria-modal="true" aria-label="تنظیمات">
      <div class="modal-panel">
        <div class="modal-head"><h2>تنظیمات</h2><button type="button" class="icon-btn" data-close aria-label="بستن">${Icons.x}</button></div>
        <div class="modal-body">
          <div class="modal-section">
            <h3>${Icons.spark} ظاهر</h3>
            <div class="setting-row">
              <div><div class="setting-label">حالت نمایش</div><div class="setting-desc">تخته‌سیاه، دفتر یا هماهنگ با سیستم</div></div>
              <div class="seg" id="themeSeg">
                <button type="button" class="seg-btn ${s.theme === 'dark' ? 'active' : ''}" data-theme="dark">شب</button>
                <button type="button" class="seg-btn ${s.theme === 'light' ? 'active' : ''}" data-theme="light">روز</button>
                <button type="button" class="seg-btn ${s.theme === 'system' ? 'active' : ''}" data-theme="system">سیستم</button>
              </div>
            </div>
            <div class="setting-row">
              <div><div class="setting-label">اندازه متن</div><div class="setting-desc">برای خوانایی بهتر روی موبایل</div></div>
              <div class="seg" id="fontSeg">
                <button type="button" class="seg-btn ${s.font === 'small' ? 'active' : ''}" data-font="small">کوچک</button>
                <button type="button" class="seg-btn ${s.font === 'medium' ? 'active' : ''}" data-font="medium">متوسط</button>
                <button type="button" class="seg-btn ${s.font === 'large' ? 'active' : ''}" data-font="large">بزرگ</button>
              </div>
            </div>
            <div class="setting-row">
              <div><div class="setting-label">کاهش حرکت</div><div class="setting-desc">انیمیشن‌ها و ذرات را کم می‌کند</div></div>
              <label class="switch"><input type="checkbox" id="reduceMotion" ${s.reduceMotion ? 'checked' : ''}><span class="track"></span></label>
            </div>
          </div>

          <div class="modal-section">
            <h3>${Icons.spark} صدا</h3>
            <div class="setting-row">
              <div><div class="setting-label">صدای افکت‌ها</div><div class="setting-desc">پاسخ درست، اشتباه و ارتقای سطح</div></div>
              <label class="switch"><input type="checkbox" id="soundOn" ${s.sound ? 'checked' : ''}><span class="track"></span></label>
            </div>
            <div class="slider-row"><span class="muted" style="font-size:.72rem;min-width:48px">صدای افکت</span><input class="range" type="range" id="fxVol" min="0" max="100" value="${Math.round(s.volume * 100)}"><span class="slider-val" id="fxVolVal">${fa(Math.round(s.volume * 100))}٪</span></div>
            <div class="setting-row">
              <div><div class="setting-label">موسیقی پس‌زمینه</div><div class="setting-desc">یک پد آرام تولیدشده با Web Audio</div></div>
              <label class="switch"><input type="checkbox" id="musicOn" ${s.music ? 'checked' : ''}><span class="track"></span></label>
            </div>
            <div class="slider-row"><span class="muted" style="font-size:.72rem;min-width:48px">صدای موسیقی</span><input class="range" type="range" id="musicVol" min="0" max="100" value="${Math.round(s.musicVolume * 100)}"><span class="slider-val" id="musicVolVal">${fa(Math.round(s.musicVolume * 100))}٪</span></div>
          </div>

          <div class="modal-section">
            <h3>${Icons.target} داده‌ها</h3>
            <div class="setting-row">
              <div><div class="setting-label">پاک کردن پیشرفت</div><div class="setting-desc">امتیاز، نشان‌ها و تاریخچه حذف می‌شوند</div></div>
              <button type="button" class="btn btn-sm btn-danger" id="resetProgressModal">پاک کن</button>
            </div>
          </div>

          <div class="modal-section">
            <h3>${Icons.book} درباره</h3>
            <p class="muted" style="font-size:.76rem;line-height:2">حسابان ۱ — آزمایشگاه فصل اول، نسخه ۱۴۰۴ (build 2026-11-24b). محتوا بر اساس سرفصل رسمی فصل اول حسابان (۱) پایه یازدهم ریاضی و فیزیک تهیه شده است. همه داده‌ها روی دستگاه خودت ذخیره می‌شود.</p>
          </div>
        </div>
        <div class="modal-foot"><button type="button" class="btn btn-primary" data-close>بستن</button></div>
      </div>
    </div>`;
    document.body.style.overflow = 'hidden';

    const close = () => closeModal();
    root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
    root.querySelector('.modal').addEventListener('click', (e) => { if (e.target.classList.contains('modal')) close(); });

    const syncSeg = () => {
      root.querySelectorAll('[data-theme]').forEach((b) => b.classList.toggle('active', b.dataset.theme === Store.state.settings.theme));
      root.querySelectorAll('[data-font]').forEach((b) => b.classList.toggle('active', b.dataset.font === Store.state.settings.font));
    };
    root.querySelectorAll('[data-theme]').forEach((b) => b.addEventListener('click', () => {
      Store.state.settings.theme = b.dataset.theme; Store.save(); Theme.apply(); syncSeg(); Sound.play('tap');
    }));
    root.querySelectorAll('[data-font]').forEach((b) => b.addEventListener('click', () => {
      Store.state.settings.font = b.dataset.font; Store.save(); Theme.apply(); syncSeg(); Sound.play('tap');
    }));

    const rm = root.querySelector('#reduceMotion');
    if (rm) rm.addEventListener('change', () => {
      Store.state.settings.reduceMotion = rm.checked; Store.save(); Theme.apply();
      Toast.show(rm.checked ? 'انیمیشن‌ها کم شدند' : 'انیمیشن‌ها فعال شدند', 'good');
    });
    const so = root.querySelector('#soundOn');
    if (so) so.addEventListener('change', () => {
      Store.state.settings.sound = so.checked; Store.save(); Sound.applyVolumes(); Sound.play('tap');
    });
    const fv = root.querySelector('#fxVol');
    if (fv) fv.addEventListener('input', () => {
      Store.state.settings.volume = fv.value / 100; Store.save(); Sound.applyVolumes();
      const lab = root.querySelector('#fxVolVal'); if (lab) lab.textContent = fa(fv.value) + '٪';
    });
    const mo = root.querySelector('#musicOn');
    if (mo) mo.addEventListener('change', () => {
      Store.state.settings.music = mo.checked; Store.save();
      if (mo.checked) { Sound.unlock(); Sound.setMusic(true); } else Sound.setMusic(false);
    });
    const mv = root.querySelector('#musicVol');
    if (mv) mv.addEventListener('input', () => {
      Store.state.settings.musicVolume = mv.value / 100; Store.save(); Sound.applyVolumes();
      const lab = root.querySelector('#musicVolVal'); if (lab) lab.textContent = fa(mv.value) + '٪';
    });
    const rp = root.querySelector('#resetProgressModal');
    if (rp) rp.addEventListener('click', () => {
      if (confirm('همه امتیازها، نشان‌ها و تاریخچه پاک شوند؟')) {
        Store.resetProgress(); updateXPChip(); closeModal(); Toast.show('پیشرفت پاک شد', 'good');
      }
    });

    setTimeout(() => { const f = root.querySelector('[data-close]'); if (f) f.focus(); }, 50);
  }

  function closeModal() {
    const root = document.getElementById('modal-root');
    if (root) root.innerHTML = '';
    document.body.style.overflow = '';
  }

  /* =========================================================
     ROUTER
     ========================================================= */
  function handleRoute(route) {
    releaseSession(activeSession);
    activeSession = null;
    AWG.Scenes.disposeAll();
    closeModal();
    currentRoute = route;
    AWG.setActiveNav(route);
    const main = document.getElementById('main');
    main.innerHTML = '';

    if (route.name === 'lesson') renderLesson(main, route.id);
    else if (route.name === 'lessons') renderLessons(main);
    else if (route.name === 'practice') renderPractice(main);
    else if (route.name === 'quiz') renderQuiz(main, route);
    else if (route.name === 'exam') renderExam(main);
    else if (route.name === 'progress') renderProgress(main);
    else renderHome(main);

    updateXPChip();
    AWG.renderMath(main);
    revealInit(main);
    window.scrollTo({ top: 0, behavior: 'auto' });
    AWG.updateReadProgress();
  }

  /* =========================================================
     GLOBAL BINDINGS
     ========================================================= */
  function bindGlobal() {
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) settingsBtn.addEventListener('click', () => { Sound.play('click'); openSettings(); });

    const themeBtn = document.getElementById('themeQuick');
    if (themeBtn) themeBtn.addEventListener('click', () => { Sound.play('click'); Theme.cycle(); });

    const soundBtn = document.getElementById('soundQuick');
    if (soundBtn) soundBtn.addEventListener('click', () => {
      const on = !Store.state.settings.sound;
      Store.state.settings.sound = on; Store.save(); Sound.applyVolumes();
      if (on) { Sound.unlock(); Sound.play('tap'); }
      Toast.show(on ? 'صدا روشن شد' : 'صدا خاموش شد', 'good');
    });

    const xpChip = document.getElementById('xpChip');
    if (xpChip) xpChip.addEventListener('click', () => { Sound.play('tap'); Router.go('/progress'); });

    window.addEventListener('scroll', AWG.updateReadProgress, { passive: true });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    const unlock = () => Sound.unlock();
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
  }

  /* =========================================================
     BOOT
     ========================================================= */
  function boot() {
    stampBuild();
    Store.load();
    Theme.init();
    Toast.init();
    const report = (msg) => Toast.show('خطای فنی: ' + String(msg).slice(0, 90), 'bad', 4500);
    window.addEventListener('error', (e) => { if (e && e.message && !/ResizeObserver|Script error/.test(e.message)) report(e.message); });
    window.addEventListener('unhandledrejection', (e) => { if (e && e.reason) report(e.reason.message || e.reason); });
    Confetti.init();
    if (!Store.storageOK) {
      setTimeout(() => Toast.show('حافظه‌ی مرورگر در این محیط در دسترس نیست؛ امتیازها فقط تا بستن صفحه می‌مانند', 'warn', 5200), 600);
    }
    AWG.onStateSync = () => {
      updateXPChip();
      if (Router.current && Router.current.name === 'progress') Router.emit();
    };
    bindGlobal();
    Router.onChange(handleRoute);
    Router.start();
    updateXPChip();
    setTimeout(() => {
      const b = document.getElementById('boot');
      if (b) b.classList.add('hide');
    }, 220);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

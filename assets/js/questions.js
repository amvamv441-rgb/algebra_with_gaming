/* =========================================================
   حسابان ۱ — question engine + procedural generators
   ========================================================= */
(function () {
  'use strict';
  const AWG = window.AWG;
  const U = AWG.util;
  const T = String.raw;

  AWG.BANKS = {};
  AWG.addBank = function (name, arr) {
    AWG.BANKS[name] = Array.isArray(arr) ? arr : [];
  };

  const LEVEL_NAMES = { 1: 'آسان', 2: 'متوسط', 3: 'سخت' };

  function normalize(raw) {
    const choices = (raw.a || []).map((text, i) => ({ text, correct: i === raw.c }));
    const order = U.shuffle(choices.map((_, i) => i));
    const shuffled = order.map((i) => choices[i]);
    return {
      q: raw.q || '',
      choices: shuffled,
      correctIndex: shuffled.findIndex((c) => c.correct),
      solution: raw.s || '',
      level: raw.lv || 2,
      topic: raw.tp || '',
      source: raw.src || '',
      generated: !!raw.gen
    };
  }

  function bankFor(source) {
    if (source === 'final') return AWG.BANKS.final || [];
    if (source === 'konkoor') return AWG.BANKS.konkoor || [];
    if (source === 'mixed') return ['1', '2', '3', '4', '5'].flatMap((id) => AWG.BANKS['lesson' + id] || []);
    return AWG.BANKS['lesson' + source] || [];
  }

  function byLevel(arr, level) {
    if (!level) return arr;
    const filtered = arr.filter((q) => (q.lv || 2) === level);
    return filtered.length >= 4 ? filtered : arr;
  }

  function deterministicPick(arr, count, seed) {
    const a = arr.slice();
    let s = seed >>> 0;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, count);
  }

  AWG.prepareQuestions = function (source, count, level) {
    const n = Math.max(1, Math.min(80, count || 10));
    let pool;
    if (source === 'daily') {
      const all = bankFor('mixed');
      const seed = parseInt(U.dateKey().replace(/-/g, ''), 10) || 1;
      pool = deterministicPick(all, Math.max(24, n * 3), seed);
      pool = pool.filter((q) => (q.lv || 2) >= 2).slice(0, Math.max(n * 2, n));
    } else {
      pool = byLevel(bankFor(source), level);
    }
    let picked = U.shuffle(pool).slice(0, n);
    if (picked.length < n && source !== 'final' && source !== 'konkoor') {
      const lessonId = ['1', '2', '3', '4', '5'].includes(String(source)) ? String(source) : '1';
      const need = n - picked.length;
      for (let i = 0; i < need; i++) {
        const g = AWG.generate(lessonId, level || 0);
        if (g) picked.push(g);
      }
      picked = U.shuffle(picked).slice(0, n);
    }
    return picked.map(normalize);
  };

  AWG.sourceLabel = function (source) {
    if (source === 'final') return 'امتحان نهایی';
    if (source === 'konkoor') return 'سبک کنکور';
    if (source === 'mixed') return 'مرور ترکیبی';
    if (source === 'daily') return 'چالش روزانه';
    const l = AWG.lessonById(source);
    return l ? `درس ${U.fa(l.id)}` : 'تمرین';
  };

  /* ---------- Procedural generators ---------- */
  function num(a, b, step) {
    const s = step || 1;
    return a + Math.floor(Math.random() * Math.floor((b - a) / s + 1)) * s;
  }
  function choose(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function uniqBy(a, key) {
    const seen = new Set();
    return a.filter((x) => { const k = key(x); if (seen.has(k)) return false; seen.add(k); return true; });
  }
  const TRIPLES = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [12, 16, 20], [7, 24, 25], [20, 21, 29]];

  /* ---------- formatting helpers ---------- */
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a || 1; }
  // exact rational → LaTeX (integer stays plain)
  function frac(n, d) {
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d); n /= g; d /= g;
    if (d === 1) return `${n}`;
    return n < 0 ? `-\\frac{${-n}}{${d}}` : `\\frac{${n}}{${d}}`;
  }
  function fracAdd(f, k) { return frac(f[0] + k * f[1], f[1]); }
  function fracMul(f, k) { return frac(f[0] * k, f[1]); }
  function parenNeg(v) { return v < 0 ? `(${v})` : `${v}`; }
  // signed term: coef(3,'x',false) → "+ 3x"; coef(-1,'x',true) → "-x"; coef(0,..) → ""
  function coef(v, sym, first) {
    if (v === 0) return '';
    const abs = Math.abs(v);
    const body = sym ? (abs === 1 ? sym : `${abs}${sym}`) : `${abs}`;
    if (first) return v < 0 ? `-${body}` : body;
    return `${v < 0 ? '-' : '+'} ${body}`;
  }
  // quadratic in standard form with tidy signs: "x^2 - 3x + 4 = 0"
  function quad(a, b, c) {
    const parts = [coef(a, 'x^2', true)];
    const tb = coef(b, 'x', false); if (tb) parts.push(tb);
    const tc = coef(c, '', false); if (tc) parts.push(tc);
    return `${parts.join(' ')} = 0`;
  }
  // linear factor: lin(-3) → "(x+3)", lin(2) → "(x-2)", lin(0) → "x"
  function lin(r) { return r === 0 ? 'x' : r < 0 ? `(x+${-r})` : `(x-${r})`; }
  // |x - a| written naturally: absExpr(-3) → "|x+3|", absExpr(0) → "|x|"
  function absExpr(a) { return a === 0 ? '|x|' : `|x ${a < 0 ? '+' : '-'} ${Math.abs(a)}|`; }
  function numStr(v) { return Number.isInteger(v) ? `${v}` : frac(Math.round(v * 100), 100); }
  const FILLERS = ['$0$', '$1$', '$-1$', '$2$', '$\\frac{1}{2}$', '$10$'];

  function choicesFrom(correct, wrongs) {
    const set = [];
    [correct, ...wrongs].forEach((v) => {
      if (v != null && v !== '' && !set.some((x) => String(x) === String(v))) set.push(v);
    });
    let k = 0;
    while (set.length < 4 && k < FILLERS.length) {
      if (!set.includes(FILLERS[k])) set.push(FILLERS[k]);
      k++;
    }
    while (set.length < 4) set.push(`$${100 + set.length * 7}$`);
    return set.slice(0, 4);
  }
  function makeQ(q, correct, wrongs, solution, lv, tp) {
    const a = choicesFrom(correct, wrongs);
    return { q, a, c: 0, s: solution, lv: lv || 2, tp: tp || '', gen: true };
  }

  const GENERATORS = {
    '1': {
      1: function arithmeticSum() {
        const a = num(-5, 5);
        const d = num(1, 5);
        const n = num(5, 20);
        const S = (n / 2) * (2 * a + (n - 1) * d);
        const q = `مجموع ${U.fa(n)} جمله اول دنباله حسابی با جمله اول $${a}$ و قدر نسبت $${d}$ چند است؟`;
        return makeQ(q, `$${S}$`, [`$${S + n * d}$`, `$${S - n * d}$`, `$${S + n}$`],
          `$S_n = \\frac{n}{2}[2a+(n-1)d] = \\frac{${n}}{2}[${2 * a}+${(n - 1) * d}] = ${S}$`, 1, 'مجموع حسابی');
      },
      2: function geometricSum() {
        const a = num(1, 6);
        const pick = choose([[2, 1], [3, 1], [4, 1], [1, 2], [1, 3]]);
        const p = pick[0], dd = pick[1];
        const n = p === 4 ? num(3, 5) : dd === 1 ? num(4, 7) : num(4, 6);
        // S = a (q^n - 1)/(q - 1) with q = p/d  →  a (p^n - d^n) / (d^(n-1) (p - d))
        const numer = a * (Math.pow(p, n) - Math.pow(dd, n));
        const denom = Math.pow(dd, n - 1) * (p - dd);
        const Ss = frac(numer, denom);
        const qs = frac(p, dd);
        const q = `مجموع ${U.fa(n)} جمله اول دنباله هندسی با جمله اول $${a}$ و قدر نسبت $${qs}$ چند است؟`;
        return makeQ(q, `$${Ss}$`,
          [`$${frac(numer * 2, denom)}$`, `$${frac(numer + a * denom, denom)}$`, `$${frac(numer - a * denom, denom)}$`],
          `$S_n = a\\cdot\\frac{q^n-1}{q-1} = ${a}\\cdot\\frac{${qs}^{${n}}-1}{${qs}-1} = ${Ss}$`, 2, 'مجموع هندسی');
      },
      3: function findN() {
        const a = num(1, 6);
        const d = num(1, 5);
        const n = num(5, 15);
        const S = (n / 2) * (2 * a + (n - 1) * d);
        const q = `مجموع چند جمله اول دنباله حسابی با جمله اول $${a}$ و قدر نسبت $${d}$ برابر $${S}$ می‌شود؟`;
        return makeQ(q, `$${n}$ جمله`, [`$${n + 1}$ جمله`, `$${n - 1}$ جمله`, `$${n + 2}$ جمله`],
          `$\\frac{n}{2}[${2 * a}+${(n - 1) * d}] = ${S}$ را حل می‌کنیم؛ $n=${n}$`, 3, 'پیدا کردن n');
      }
    },
    '2': {
      1: function solveQuadratic() {
        const r1 = num(-6, 6);
        let r2 = num(-6, 6);
        if (r2 === r1) r2 += 2;
        const b = -(r1 + r2), c = r1 * r2;
        const q = `ریشه‌های معادله $${quad(1, b, c)}$ کدام‌اند؟`;
        const correct = `$${r1}$ و $${r2}$`;
        const cands = [`$${r1}$ و $${-r2}$`, `$${-r1}$ و $${r2}$`, `$${r1 + 1}$ و $${r2}$`, `$${r1}$ و $${r2 + 1}$`,
          `$${-r1}$ و $${-r2}$`, `$${r1 + 2}$ و $${r2 - 1}$`].filter((v) => v !== correct);
        return makeQ(q, correct, uniqBy(cands, (v) => v).slice(0, 3),
          `تجزیه: $${lin(r1)}${lin(r2)} = 0$ پس $x=${r1}$ یا $x=${r2}$.`, 1, 'حل معادله');
      },
      2: function vieta() {
        const a = num(1, 4);
        const b = num(-8, 8);
        const c = num(-8, 8);
        const S = frac(-b, a), P = frac(c, a), sym = frac(b * b - 2 * a * c, a * a);
        const S2 = frac(b * b, a * a);
        const eq = quad(a, b, c);
        const which = choose(['S', 'P', 'sym']);
        let q, correct, wrongs, sol;
        if (which === 'S') {
          q = `مجموع ریشه‌های معادله $${eq}$ چند است؟`;
          correct = `$${S}$`; wrongs = [`$${frac(b, a)}$`, `$${P}$`, `$${frac(-b + a, a)}$`];
          sol = `$S=-\\frac{b}{a}=-\\frac{${parenNeg(b)}}{${a}}=${S}$`;
        } else if (which === 'P') {
          q = `حاصل‌ضرب ریشه‌های معادله $${eq}$ چند است؟`;
          correct = `$${P}$`; wrongs = [`$${frac(-c, a)}$`, `$${S}$`, `$${frac(c + a, a)}$`];
          sol = `$P=\\frac{c}{a}=\\frac{${parenNeg(c)}}{${a}}=${P}$`;
        } else {
          q = `اگر $x_1,x_2$ ریشه‌های $${eq}$ باشند، $x_1^2+x_2^2$ چند است؟`;
          correct = `$${sym}$`; wrongs = [`$${S2}$`, `$${P}$`, `$${frac(b * b - 2 * a * c + a * a, a * a)}$`];
          sol = `$S=${S}$ و $P=${P}$، پس $x_1^2+x_2^2=S^2-2P=${S2}-${fracMul([2 * c, a], 1) === '0' ? '0' : frac(2 * c, a)}=${sym}$.`;
        }
        return makeQ(q, correct, wrongs, sol, 2, 'روابط ویت');
      },
      3: function buildEquation() {
        const r1 = num(-5, 5);
        let r2 = num(-5, 5);
        if (r2 === r1) r2 += 3;
        const S = r1 + r2, P = r1 * r2;
        const q = `معادله درجه دومی که ریشه‌هایش $${r1}$ و $${r2}$ باشند کدام است؟`;
        const correct = `$${quad(1, -S, P)}$`;
        return makeQ(q, correct,
          [`$${quad(1, S, P)}$`, `$${quad(1, -S, -P)}$`, `$${quad(1, -(S + 1), P)}$`],
          `$S=${S}$ و $P=${P}$؛ معادله $x^2-Sx+P=0$ یعنی $${quad(1, -S, P)}$.`, 3, 'ساخت معادله');
      }
    },
    '3': {
      1: function radicalLinear() {
        const r = num(2, 9);
        const b = num(1, 8);
        const minus = Math.random() < 0.5;
        // sqrt(x ± b) = r  →  x = r^2 ∓ b
        const x = minus ? r * r + b : r * r - b;
        const q = `حل معادله $\\sqrt{x${minus ? '-' : '+'}${b}} = ${r}$ کدام است؟`;
        return makeQ(q, `$x=${x}$`, [`$x=${minus ? x - 2 * b : x + 2 * b}$`, `$x=${r * r}$`, `$x=${r - b}$`],
          `طرفین را به توان ۲ می‌رسانیم: $x${minus ? '-' : '+'}${b}=${r * r}$ پس $x=${x}$.`, 1, 'معادله گنگ');
      },
      2: function radicalTwo() {
        const r = num(2, 7);
        const b = num(1, 6);
        const c = num(1, 5);
        const x = r * r - b;
        const q = `حل معادله $\\sqrt{x+${b}} + ${c} = ${r + c}$ کدام است؟`;
        return makeQ(q, `$x=${x}$`, [`$x=${x + c}$`, `$x=${x - c}$`, `$x=${r * r}$`],
          `$\\sqrt{x+${b}}=${r + c - c}$، توان ۲: $x+${b}=${r * r}$ پس $x=${x}$.`, 2, 'معادله گنگ');
      },
      3: function rational() {
        const c = num(2, 4);
        const k = num(1, 8);
        let m = num(0, 3);
        if (m === k) m = 0;
        const a = (c - 1) * k - c * m;
        const q = `حل معادله $\\frac{x${coef(a, '', false).replace(' ', '')}}{x${m ? '-' + m : ''}} = ${c}$ کدام است؟`;
        return makeQ(q, `$x=${k}$`, [`$x=${k + 1}$`, `$x=${k - 1}$`, `$x=${-k}$`],
          `با شرط $x \\neq ${m}$: $x${coef(a, '', false).replace(' ', '')} = ${c}(${m ? `x-${m}` : 'x'})$ پس ${c - 1 === 1 ? `$x=${k}$.` : `$${c - 1}x=${a + c * m}$ و $x=${k}$.`}`, 3, 'معادله گویا');
      }
    },
    '4': {
      1: function absSimple() {
        const a = num(-6, 6);
        const c = num(1, 8);
        const x1 = a + c, x2 = a - c;
        const q = `حل معادله $${absExpr(a)} = ${c}$ کدام است؟`;
        return makeQ(q, `$x=${x1}$ یا $x=${x2}$`,
          [`$x=${x1}$ یا $x=${-x2}$`, `$x=${x1}$ فقط`, `$x=${x2}$ فقط`],
          `$${absExpr(a)} = ${c}$ یعنی $x = ${a} \\pm ${c}$، پس $x=${x1}$ یا $x=${x2}$.`, 1, 'معادله قدر مطلقی');
      },
      2: function absInequality() {
        const a = num(-4, 4);
        const c = num(1, 6);
        const q = `حل نامعادله $${absExpr(a)} \\lt ${c}$ کدام است؟`;
        const inner = a === 0 ? 'x' : `x ${a < 0 ? '+' : '-'} ${Math.abs(a)}`;
        return makeQ(q, `$${a - c} \\lt x \\lt ${a + c}$`,
          [`$x \\lt ${a - c}$ یا $x \\gt ${a + c}$`, `$${a - c} \\leq x \\leq ${a + c}$`, `$x \\gt ${a + c}$`],
          `$-${c} \\lt ${inner} \\lt ${c}$ پس $${a - c} \\lt x \\lt ${a + c}$.`, 2, 'نامعادله قدر مطلقی');
      },
      3: function absTwo() {
        const a = num(-4, 4);
        const c = num(1, 5);
        const q = `حل معادله $${absExpr(a)} + ${c} = ${2 * c}$ کدام است؟`;
        return makeQ(q, `$x=${a + c}$ یا $x=${a - c}$`,
          [`$x=${a + c}$ فقط`, `$x=${a - c}$ فقط`, `$x=${a}$`],
          `$${absExpr(a)} = ${c}$، پس $x = ${a} \\pm ${c}$ یعنی $x=${a + c}$ یا $x=${a - c}$.`, 3, 'معادله قدر مطلقی');
      }
    },
    '5': {
      1: function distance() {
        const t = choose(TRIPLES);
        const x1 = num(-5, 5), y1 = num(-5, 5);
        const x2 = x1 + t[0], y2 = y1 + t[1];
        const q = `فاصله نقاط $A(${x1},${y1})$ و $B(${x2},${y2})$ چند است؟`;
        return makeQ(q, `$${t[2]}$`, [`$${t[0]}$`, `$${t[1]}$`, `$${t[2] + 1}$`],
          `$AB=\\sqrt{${t[0]}^2+${t[1]}^2}=\\sqrt{${t[0] * t[0] + t[1] * t[1]}}=${t[2]}$.`, 1, 'فاصله دو نقطه');
      },
      2: function midpoint() {
        const x1 = num(-8, 8), y1 = num(-8, 8);
        const x2 = num(-8, 8), y2 = num(-8, 8);
        const fmt = (v) => (Number.isInteger(v) ? `${v}` : frac(2 * v, 2));
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        const q = `نقطه وسط پاره‌خط $AB$ با $A(${x1},${y1})$ و $B(${x2},${y2})$ کدام است؟`;
        return makeQ(q, `$(${fmt(mx)},${fmt(my)})$`,
          [`$(${fmt(mx + 1)},${fmt(my)})$`, `$(${fmt(x1)},${fmt(y2)})$`, `$(${fmt(mx - 1)},${fmt(my + 1)})$`],
          `$M=\\left(\\frac{${x1}+${parenNeg(x2)}}{2},\\frac{${y1}+${parenNeg(y2)}}{2}\\right)=(${fmt(mx)},${fmt(my)})$.`, 1, 'نقطه وسط');
      },
      3: function slope() {
        const m = choose([[1, 1], [2, 1], [3, 1], [-1, 1], [-2, 1], [-3, 1], [1, 2], [-1, 2], [3, 2]]);
        const x1 = num(-4, 4), y1 = num(-4, 4);
        const dx = m[1] === 2 ? 2 : 1;
        const x2 = x1 + dx, y2 = y1 + (m[0] * dx) / m[1];
        const ms = frac(m[0], m[1]);
        const q = `شیب خط گذرنده از $A(${x1},${y1})$ و $B(${x2},${y2})$ چند است؟`;
        return makeQ(q, `$${ms}$`, [`$${frac(-m[0], m[1])}$`, `$${frac(m[0] + m[1], m[1])}$`, `$${frac(m[0] - m[1], m[1])}$`],
          `$m=\\frac{${parenNeg(y2)}-${parenNeg(y1)}}{${parenNeg(x2)}-${parenNeg(x1)}}=${ms}$.`, 2, 'شیب');
      },
      4: function lineDistance() {
        const t = choose(TRIPLES);
        let a = t[0], b = t[1];
        const x = num(-3, 3), y = num(-3, 3);
        const val = a * x + b * y;
        let c = t[2] * t[2] - val; // so that distance = t[2]
        const g = gcd(gcd(a, b), Math.abs(c)); // primitive form: same line, same distance
        a /= g; b /= g; c /= g;
        const q = `فاصله نقطه $A(${x},${y})$ از خط $${coef(a, 'x', true)}${coef(b, 'y', false).replace(' ', '')}${coef(c, '', false).replace(' ', '')} = 0$ چند است؟`;
        return makeQ(q, `$${t[2]}$`, [`$${t[0] / g}$`, `$${t[1] / g}$`, `$${t[2] + 1}$`],
          `$d=\\frac{|${a}(${x})+${b}(${y})${coef(c, '', false).replace(' ', '')}|}{\\sqrt{${a * a}+${b * b}}}=\\frac{${Math.abs(a * x + b * y + c)}}{${Math.round(Math.sqrt(a * a + b * b))}}=${t[2]}$.`, 3, 'فاصله نقطه از خط');
      }
    }
  };

  AWG.generate = function (lessonId, level) {
    const set = GENERATORS[String(lessonId)];
    if (!set) return null;
    const lv = level && set[level] ? level : choose(Object.keys(set));
    const fn = set[lv];
    if (!fn) return null;
    try {
      const q = fn();
      q.lv = +lv;
      return q;
    } catch (e) { return null; }
  };

  AWG.totalQuestions = function () {
    return Object.keys(AWG.BANKS).reduce((sum, k) => sum + (AWG.BANKS[k] || []).length, 0);
  };
  AWG.LEVEL_NAMES = LEVEL_NAMES;
  AWG.normalizeQuestion = normalize;
})();

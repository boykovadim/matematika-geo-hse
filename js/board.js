/* board.js — «доска» для motion-объяснений.
   Мини-TeX с морфингом формул по токенам, гэпы, графики, числовые фишки, рамки, склейки. */
(function (g) {
  const M = g.Motion, E = M.ease;
  const B = (g.Board = {});
  const lerp = M.lerp;

  /* ---------- мини-TeX: разбор ---------- */
  const SYM = { lambda: 'λ', mu: 'μ', ldots: '…', cdots: '⋯', vdots: '⋮', ddots: '⋱', Delta: 'Δ', to: '→', cdot: '·', ne: '≠', infty: '∞', approx: '≈', pi: 'π', leq: '≤', geq: '≥', times: '×', pm: '±' };
  const COL = { I: 'indigo', O: 'orange', R: 'red', V: 'violet', G: 'green', M: 'mute', T: 'teal' };
  const FN = ['ln', 'sin', 'cos', 'tg', 'ctg', 'log', 'arctg', 'arcsin', 'arccos', 'exp'];

  function parse(src) {
    let p = 0;
    const ws = () => { while (src[p] === ' ') p++; };
    const raw = () => { ws(); p++; let s = ''; while (p < src.length && src[p] !== '}') s += src[p++]; p++; return s; };
    const group = () => {
      ws();
      if (src[p] === '{') { p++; const r = row('}'); p++; return r; }
      return atom();
    };
    function atom() {
      ws();
      const c = src[p];
      if (c === '\\') {
        p++;
        if (src[p] === ',' || src[p] === ';') { p++; return [{ t: 'space' }]; }
        const m = /^[a-zA-Z]+/.exec(src.slice(p));
        const name = m ? m[0] : src[p];
        p += name.length;
        if (name === 'frac') { const n = group(), d = group(); return [{ t: 'frac', n, d }]; }
        if (name === 'sqrt') return [{ t: 'sqrt', row: group() }];
        if (name === 'mat') {
          let mname = '';
          ws();
          if (src[p] === '[') { p++; while (src[p] !== ']') mname += src[p++]; p++; }
          ws(); p++;
          let depth = 0, body = '';
          while (p < src.length && !(src[p] === '}' && depth === 0)) { if (src[p] === '{') depth++; if (src[p] === '}') depth--; body += src[p++]; }
          p++;
          const split = (s, sep) => { const out = []; let d = 0, cur = ''; for (let q = 0; q < s.length; q++) { if (s[q] === '{') d++; if (s[q] === '}') d--; if (d === 0 && s.startsWith(sep, q)) { out.push(cur); cur = ''; q += sep.length - 1; } else cur += s[q]; } out.push(cur); return out; };
          return [{ t: 'mat', name: mname, rows: split(body, '\\\\').map((r) => split(r, '&').map((cell) => parse(cell))) }];
        }
        if (name === 'sum') {
          let below = [], above = [];
          for (let r = 0; r < 2; r++) { ws(); if (src[p] === '_') { p++; below = group(); } else if (src[p] === '^') { p++; above = group(); } }
          return [{ t: 'under', top: '∑', below, above, big: true }];
        }
        if (name === 'lim') { let below = []; ws(); if (src[p] === '_') { p++; below = group(); } return [{ t: 'under', top: 'lim', below }]; }
        if (name === 'gap') { const id = raw(); let val = null; if (src[p] === '{') val = group(); return [{ t: 'gap', id, val }]; }
        if (name === 'k') { const [key, src] = raw().split('|'); return [{ t: 'key', key, src, row: group() }]; }
        if (name === 't') return [{ t: 'text', s: raw() }];
        if (COL[name]) return [{ t: 'color', color: COL[name], row: group() }];
        if (FN.includes(name)) return [{ t: 'fn', s: name }];
        return [{ t: 'sym', s: SYM[name] || name }];
      }
      const num = /^\d+(?:[.,]\d+)?/.exec(src.slice(p));
      if (num) { p += num[0].length; return [{ t: 'num', s: num[0] }]; }
      p++;
      if (/[a-zA-Z]/.test(c)) return [{ t: 'var', s: c }];
      if ('+-=<>'.includes(c)) return [{ t: 'op', s: c === '-' ? '−' : c }];
      if ("'′".includes(c)) return [{ t: 'prime', s: '′' }];
      return [{ t: 'sym', s: c }];
    }
    function row(end) {
      const out = [];
      for (;;) {
        ws();
        if (p >= src.length || src[p] === end) break;
        const c = src[p];
        if (c === '^' || c === '_') { p++; out.push({ t: c === '^' ? 'sup' : 'sub', row: group() }); continue; }
        out.push(...atom());
      }
      return out;
    }
    return row();
  }

  /* ---------- мини-TeX: отрисовка ---------- */
  function span(parent, cls, txt) {
    const e = document.createElement('span');
    e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    parent.appendChild(e);
    return e;
  }
  function leaf(parent, ctx, cls, txt) {
    const e = span(parent, (ctx.plain ? '' : 't ') + cls, txt);
    if (ctx.color) e.style.color = `var(--${ctx.color})`;
    e.dataset.w = cls.includes('mp') ? 'matparen' : txt || (cls.includes('sb') ? 'rad' : cls.includes('bar') ? 'bar' : 'gap');
    if (!ctx.plain) {
      const grp = ctx.key || (cls.includes('bar') ? 'bar' : cls.includes('mp') ? cls.replace(' ', '') : txt);
      const n = (ctx.cnt[grp] = (ctx.cnt[grp] || 0) + 1) - 1;
      e.dataset.g = grp;
      e.dataset.k = grp + '#' + n;
      if (ctx.src) e.dataset.s = ctx.src;
    }
    return e;
  }
  function renderRow(nodes, parent, ctx) {
    nodes.forEach((n, i) => {
      const prev = nodes[i - 1];
      switch (n.t) {
        case 'num': leaf(parent, ctx, 'num', n.s); break;
        case 'var': leaf(parent, ctx, 'var', n.s); break;
        case 'prime': leaf(parent, ctx, 'prime', n.s); break;
        case 'fn': leaf(parent, ctx, 'fn', n.s); break;
        case 'text': leaf(parent, ctx, 'txt', n.s); break;
        case 'space': span(parent, 'thin'); break;
        case 'sym': leaf(parent, ctx, 'sym' + (/[≠≈≤≥→×±]/.test(n.s) ? ' op' : ''), n.s); break;
        case 'op': {
          const unary = (n.s === '−' || n.s === '+') && (!prev || prev.t === 'op' || (prev.t === 'sym' && prev.s === '('));
          leaf(parent, ctx, unary ? 'un' : 'op', n.s);
          break;
        }
        case 'color': renderRow(n.row, parent, { ...ctx, color: n.color }); break;
        case 'key': renderRow(n.row, parent, { ...ctx, key: n.key, src: n.src }); break;
        case 'sup': renderRow(n.row, span(parent, 'sup'), ctx); break;
        case 'sub': renderRow(n.row, span(parent, 'sub'), ctx); break;
        case 'frac': {
          const f = span(parent, 'frac');
          renderRow(n.n, span(f, 'num-r'), ctx);
          leaf(f, ctx, 'bar', '');
          renderRow(n.d, span(f, 'den-r'), ctx);
          break;
        }
        case 'sqrt': {
          const s = span(parent, 'sqrt');
          const r = leaf(s, ctx, 'rad', '√');
          r.textContent = '';
          r.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M2 58 L20 50 L44 94 L74 4 L100 4" fill="none" stroke="currentColor" stroke-width="7"/></svg>';
          const inner = span(s, 'radc');
          leaf(inner, ctx, 'bar sb', '');
          renderRow(n.row, inner, ctx);
          break;
        }
        case 'mat': {
          const m = span(parent, 'mat');
          const base = n.name.replace('^T', ''), tr = n.name.endsWith('^T');
          if (n.name) m.dataset.n = n.name;
          const paren = (side) => { const l = leaf(m, ctx, 'mp ' + side, ''); l.innerHTML = side === 'l' ? '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M88 0C28 22 28 78 88 100C46 74 46 26 88 0Z" fill="currentColor"/></svg>' : '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M12 0C72 22 72 78 12 100C54 74 54 26 12 0Z" fill="currentColor"/></svg>'; };
          paren('l');
          const grid = span(m, 'mg');
          grid.style.gridTemplateColumns = `repeat(${Math.max(...n.rows.map((r) => r.length))},auto)`;
          n.rows.forEach((row, r) => row.forEach((cell, q) => {
            const s = span(grid, 'mc');
            s.dataset.rc = `${r + 1},${q + 1}`;
            const key = base && !ctx.key ? (tr ? `${base}${q + 1}${r + 1}` : `${base}${r + 1}${q + 1}`) : ctx.key;
            renderRow(cell, s, key ? { ...ctx, key } : ctx);
          }));
          paren('r');
          break;
        }
        case 'under': {
          const u = span(parent, 'under' + (n.above && n.above.length ? ' has-above' : ''));
          if (n.above && n.above.length) renderRow(n.above, span(u, 'above'), ctx);
          leaf(u, ctx, n.big ? 'fn big' : 'fn', n.top);
          renderRow(n.below, span(u, 'below'), ctx);
          break;
        }
        case 'gap': {
          const gp = leaf(parent, { ...ctx, key: 'gap.' + n.id }, 'gap' + (n.val ? ' filled' : ''), '');
          if (n.val) renderRow(n.val, span(gp, 'gv'), { ...ctx, plain: true });
          break;
        }
      }
    });
  }
  function buildTex(tex, plain) {
    const e = document.createElement('span');
    e.className = 'f';
    renderRow(parse(tex), e, { cnt: {}, plain: !!plain });
    return e;
  }
  /* статичная формула для текста, теста, подписей */
  B.tex = (tex) => buildTex(tex, true);
  /* текст с вставками $формула$ */
  B.rich = function (el, str) {
    el.textContent = '';
    str.split('$').forEach((part, i) => {
      if (!part) return;
      if (i % 2) el.appendChild(B.tex(part));
      else el.appendChild(document.createTextNode(part));
    });
    return el;
  };

  /* ---------- формула, которая морфится ---------- */
  const trail = (e, vx, vy) => {
    const sp = Math.hypot(vx, vy);
    if (sp < 3) { e.style.textShadow = ''; return; }
    const parts = [];
    for (let i = 1; i <= 5; i++) parts.push(`${(-vx * i * .5).toFixed(1)}px ${(-vy * i * .5).toFixed(1)}px 0 color-mix(in srgb,currentColor ${Math.round(46 * (1 - i / 6))}%,transparent)`);
    e.style.textShadow = parts.join(',');
  };

  B.formula = function (c, tex, o = {}) {
    const size = o.size || 64;
    const host = M.el(c.root, 'div', 'fhost' + (o.anchor === 'l' ? ' left' : ''), '', `left:${o.x}px;top:${o.y}px;font-size:${size}px;`);
    if (o.c) host.dataset.c = o.c;
    let cur = '', inner = null;

    const metrics = () => {
      const R = c.root.getBoundingClientRect();
      return { R, k: R.width / c.W || 1 };
    };
    const rectOf = (e, m) => {
      const r = e.getBoundingClientRect();
      return { x: (r.left - m.R.left) / m.k, y: (r.top - m.R.top) / m.k, w: r.width / m.k, h: r.height / m.k };
    };
    function snap(root) {
      const m = metrics();
      return [...root.querySelectorAll('.t')].map((e) => ({ ...rectOf(e, m), fs: parseFloat(getComputedStyle(e).fontSize), e, k: e.dataset.k, g: e.dataset.g, s: e.dataset.s }));
    }
    function fit() {
      host.style.fontSize = size + 'px';
      if (o.maxW && inner.offsetWidth > o.maxW) host.style.fontSize = (size * o.maxW) / inner.offsetWidth + 'px';
    }
    function fly(to, from, i, opt) {
      const e = to.e, bar = e.classList.contains('bar'), tall = e.classList.contains('mp');
      const dx = bar ? from.x - to.x : from.x + from.w / 2 - (to.x + to.w / 2);
      const dy = from.y + from.h / 2 - (to.y + to.h / 2);
      const s = from.fs / to.fs, sw = bar && to.w ? from.w / to.w : 1, sh = tall && to.h ? from.h / to.h : 1;
      if (Math.abs(dx) < .6 && Math.abs(dy) < .6 && Math.abs(s - 1) < .01 && Math.abs(sw - 1) < .01 && Math.abs(sh - 1) < .01) return;
      /* дуга только у токенов, которые реально меняют место; общий сдвиг формулы идёт по прямой */
      const arc = Math.min(120, Math.hypot(dx - (opt.mx || 0), dy - (opt.my || 0)) * (opt.arc ?? .28)) * (i % 2 ? 1 : -1);
      if (bar) e.style.transformOrigin = '0 50%';
      const place = (v) => {
        const x = dx * (1 - v), y = dy * (1 - v) - Math.sin(Math.PI * v) * arc;
        e.style.transform = bar ? `translate(${x}px,${y}px) scaleX(${lerp(sw, 1, v)})` : tall ? `translate(${x}px,${y}px) scaleY(${lerp(sh, 1, v)})` : `translate(${x}px,${y}px) scale(${lerp(s, 1, v)})`;
        return [x, y];
      };
      let [lx, ly] = place(0);
      c.S.anim({
        delay: i * (opt.stagger ?? 12), dur: opt.dur || 880, ease: E.inOut3,
        on(v) { const [x, y] = place(v); if (!bar && !tall) trail(e, x - lx, y - ly); lx = x; ly = y; },
        done() { e.style.transform = ''; e.style.textShadow = ''; e.style.transformOrigin = ''; },
      });
    }
    function pop(to, i, opt) {
      const e = to.e;
      e.style.opacity = 0;
      c.S.anim({
        delay: (opt.popDelay ?? 300) + i * 34, dur: 620, ease: (t) => E.back(t, 2.2),
        start() { e.style.opacity = 1; },
        on(v) { e.style.transform = `translateY(${(1 - v) * 26}px) scale(${lerp(.15, 1, v)})`; },
        done() { e.style.transform = ''; e.style.opacity = ''; },
      });
    }
    function leave(from, i, opt) {
      const cs = getComputedStyle(from.e);
      const clone = M.el(c.root, 'span', 'gleaf', from.e.innerHTML,
        `left:${from.x}px;top:${from.y}px;width:${from.w}px;height:${from.h}px;font:${cs.font};color:${opt.strike ? 'var(--red)' : cs.color};${from.e.classList.contains('bar') ? 'background:currentColor;' : ''}`);
      const r = (i % 2 ? 1 : -1) * 18;
      c.S.anim({
        delay: i * 22, dur: 460, ease: E.in3,
        on(v) { clone.style.transform = `translateY(${v * 130}px) rotate(${v * r}deg) scale(${1 - v * .35})`; clone.style.opacity = 1 - v * v; },
        done() { clone.remove(); },
      });
    }
    function drop(to, gi, opt) {
      const gv = to.e.querySelector('.gv');
      if (!gv) return;
      const m = metrics(), r = rectOf(gv, m);
      let dx = 0, dy = -300;
      if (opt.from) { const f = rectOf(opt.from, m); dx = f.x + f.w / 2 - (r.x + r.w / 2); dy = f.y + f.h / 2 - (r.y + r.h / 2); }
      const delay = gi * 240, arc = opt.from ? 90 : 0;
      gv.style.opacity = 0;
      let lx = dx, ly = dy;
      c.S.anim({
        delay, dur: opt.from ? 720 : 860, ease: opt.from ? E.inOut3 : E.bounce,
        start() { gv.style.opacity = 1; },
        on(v) {
          const x = dx * (1 - v), y = dy * (1 - v) - Math.sin(Math.PI * v) * arc;
          gv.style.transform = `translate(${x}px,${y}px)`;
          trail(gv, x - lx, y - ly); lx = x; ly = y;
        },
        done() { gv.style.transform = ''; gv.style.textShadow = ''; gv.style.opacity = ''; },
      });
      /* удар: ячейка проседает, когда в неё приземлилось число */
      c.S.anim({
        delay: delay + (opt.from ? 700 : 300), dur: 520, ease: E.linear,
        on(_, p) { const q = Math.exp(-5 * p) * Math.cos(16 * p) * .2; to.e.style.transform = `scale(${1 + q},${1 - q})`; },
        done() { to.e.style.transform = ''; },
      });
    }

    function set(tex2, opt = {}) {
      const next = buildTex(tex2);
      const old = inner ? snap(inner) : null;
      if (inner) inner.remove();
      host.appendChild(next);
      inner = next; cur = tex2; fit();
      if (M.fast) return api;
      const now = snap(next);
      if (!old) {
        now.forEach((t, i) => pop(t, i, { popDelay: opt.delay ?? 60 }));
        return api;
      }
      const usedOld = new Set(), matched = new Map();
      now.forEach((t) => { const f = old.find((a) => a.k === t.k); if (f) { matched.set(t, f); usedOld.add(f); } });
      /* копия: новый токен рождается из такого же старого */
      /* opt.src: другие формулы на доске, из которых числа могут прилететь копией */
      const pool = old.concat(...(opt.src || []).map((F) => F.snapshot()));
      now.forEach((t) => { if (!matched.has(t)) { const f = pool.find((a) => a.g === (t.s || t.g) && a.e.textContent === t.e.textContent && !t.e.classList.contains('bar') && !t.e.classList.contains('mp')); if (f) matched.set(t, f); } });
      const med = (arr) => arr.sort((p, q) => p - q)[arr.length >> 1] || 0;
      const pairs = [...matched];
      opt = { ...opt,
        mx: med(pairs.map(([t, f]) => f.x + f.w / 2 - t.x - t.w / 2)),
        my: med(pairs.map(([t, f]) => f.y + f.h / 2 - t.y - t.h / 2)) };
      let i = 0, gi = 0, pi = 0;
      now.forEach((t) => {
        const f = matched.get(t);
        if (f) {
          fly(t, f, i++, opt);
          if (t.e.classList.contains('filled') && !f.e.classList.contains('filled')) drop(t, gi++, opt);
        } else pop(t, pi++, opt);
      });
      old.filter((a) => !usedOld.has(a)).forEach((a, j) => leave(a, j, opt));
      return api;
    }
    function fill(map, opt) {
      let t = cur;
      for (const id in map) t = t.replace(new RegExp('\\\\gap\\{' + id + '\\}(?!\\{)'), () => `\\gap{${id}}{${map[id]}}`);
      return set(t, opt);
    }
    function rect(grp) {
      const m = metrics();
      const gs = Array.isArray(grp) ? grp : grp ? [grp] : null;
      const els = [...inner.querySelectorAll('.t')].filter((e) => !gs || gs.includes(e.dataset.g));
      const rs = els.map((e) => rectOf(e, m));
      const x = Math.min(...rs.map((r) => r.x)), y = Math.min(...rs.map((r) => r.y));
      return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y };
    }
    const api = {
      host, set, fill, rect, tex: () => cur,
      snapshot: () => (inner ? snap(inner) : []),
      at(x, y) { host.style.left = x + 'px'; host.style.top = y + 'px'; return api; },
      show(v) { host.style.visibility = v ? '' : 'hidden'; return api; },
    };
    if (tex) set(tex, { delay: o.delay });
    return api;
  };

  /* ---------- кинетический текст ---------- */
  B.text = function (c, html, o = {}) {
    const e = M.el(c.root, 'div', 'kin ' + (o.font || 'wide') + (o.anchor === 'l' ? ' left' : ''), html,
      `left:${o.x}px;top:${o.y}px;font-size:${o.size || 48}px;${o.color ? `color:${o.color};` : ''}${o.w ? `width:${o.w}px;white-space:normal;` : ''}`);
    e.dataset.w = e.textContent.trim().toLowerCase();
    M.type(c.S, e, o.kind || 'rise', { delay: o.delay || 0, stagger: o.stagger, dur: o.dur, dir: o.dir });
    return e;
  };

  /* большой светящийся счётчик */
  B.counter = function (c, o = {}) {
    const e = M.el(c.root, 'div', 'glow-num' + (o.anchor === 'l' ? ' left' : ''), '', `left:${o.x}px;top:${o.y}px;font-size:${o.size || 110}px;`);
    e.dataset.w = 'counter';
    if (o.to !== undefined) M.count(c.S, e, o.to, { from: o.from || 0, dec: o.dec || 0, dur: o.dur || 1500, delay: o.delay || 0, suffix: o.suffix || '' });
    return e;
  };

  /* уход со сцены: с разгоном и шлейфом */
  B.gone = function (c, x, o = {}) {
    const e = x.host || x, dir = o.dir || -1;
    c.S.anim({
      delay: o.delay || 0, dur: o.dur || 420, ease: E.in3,
      on(v) { e.style.translate = `${dir * v * 1700}px 0`; },
      done() { e.remove(); },
    });
  };

  /* рамка выделения с квадратными уголками: появляется без кривой, щелчком */
  B.box = function (c, r, o = {}) {
    const pad = o.pad ?? 14, color = o.color || 'var(--violet)';
    const e = M.el(c.root, 'div', 'selbox', '', `left:${r.x - pad}px;top:${r.y - pad}px;width:${r.w + pad * 2}px;height:${r.h + pad * 2}px;color:${color};`);
    ['tl', 'tr', 'bl', 'br'].forEach((p) => M.el(e, 'i', p));
    if (o.label) M.el(e, 'span', 'sel-label', o.label);
    e.style.opacity = 0;
    const d = o.delay || 0;
    c.S.after(d, () => { e.style.opacity = 1; e.style.transform = 'scale(1.08) rotate(.8deg)'; });
    c.S.after(d + 84, () => { e.style.transform = ''; });
    return e;
  };

  /* подпись-комментарий: приходит после события */
  B.note = function (c, o) {
    const n = M.note(c.S, c.root, { size: 30, color: 'var(--indigo)', rot: -2, delay: 320, ...o });
    n.dataset.w = o.text.toLowerCase();
    return n;
  };

  /* ряд фишек с вариантами чисел, как варианты ответа */
  B.rack = function (c, vals, o = {}) {
    const host = M.el(c.root, 'div', 'rack', '', `left:${o.x}px;top:${o.y}px;font-size:${o.size || 40}px;`);
    const chips = vals.map((v, i) => {
      const e = M.el(host, 'div', 'chip');
      e.appendChild(B.tex(v));
      e.dataset.v = v;
      M.pop(c.S, e, { delay: 120 + i * 70, from: .3, y: 30 });
      return e;
    });
    return {
      host,
      pick(v) { const e = chips.find((x) => x.dataset.v === v); if (e) e.classList.add('picked'); return e; },
    };
  };

  /* ячейки живых значений */
  B.cells = function (c, cells, o = {}) {
    const host = M.el(c.root, 'div', 'cells', '', `left:${o.x}px;top:${o.y}px;font-size:${o.size || 34}px;`);
    const vals = cells.map((cl, i) => {
      const e = M.el(host, 'div', 'cell' + (cl.hot ? ' hot' : ''));
      e.appendChild(B.tex(cl.label)).classList.add('cell-l');
      const v = M.el(e, 'b', 'cell-v', cl.val || '');
      if (cl.w) v.dataset.w = cl.w;
      M.pop(c.S, e, { delay: i * 90, from: .5, y: 24 });
      return v;
    });
    return { host, set(i, s) { vals[i].textContent = s; } };
  };

  /* ---------- график ---------- */
  B.graph = function (c, o) {
    const { x, y, w, h, xr, yr } = o;
    const svg = M.svg(c.root, 'svg', { width: c.W, height: c.H, viewBox: `0 0 ${c.W} ${c.H}`, class: 'gsvg' });
    const X = (v) => x + ((v - xr[0]) / (xr[1] - xr[0])) * w;
    const Y = (v) => y + h - ((v - yr[0]) / (yr[1] - yr[0])) * h;
    const G = {
      svg, X, Y,
      axes(a = {}) {
        const col = 'var(--ink)';
        const ax = M.svg(svg, 'path', { d: `M${x} ${Y(0)} L${x + w} ${Y(0)}`, stroke: col, 'stroke-width': 2.5, fill: 'none', 'data-w': 'ось x' });
        const ay = M.svg(svg, 'path', { d: `M${X(0)} ${y + h} L${X(0)} ${y}`, stroke: col, 'stroke-width': 2.5, fill: 'none', 'data-w': 'ось y' });
        M.draw(c.S, ax, { dur: 800 }); M.draw(c.S, ay, { dur: 800, delay: 120 });
        const head = (d, delay) => { const p = M.svg(svg, 'path', { d, stroke: col, 'stroke-width': 2.5, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }); p.style.opacity = 0; c.S.after(delay, () => (p.style.opacity = 1)); };
        head(`M${x + w - 11} ${Y(0) - 7} L${x + w} ${Y(0)} L${x + w - 11} ${Y(0) + 7}`, 800);
        head(`M${X(0) - 7} ${y + 11} L${X(0)} ${y} L${X(0) + 7} ${y + 11}`, 900);
        (a.xt || []).forEach((v, i) => {
          const t = M.svg(svg, 'path', { d: `M${X(v)} ${Y(0) - 6} L${X(v)} ${Y(0) + 6}`, stroke: col, 'stroke-width': 2 });
          t.style.opacity = 0; c.S.after(500 + i * 60, () => (t.style.opacity = 1));
          B.formula(c, String(v), { x: X(v), y: Y(0) + 26, size: 22, delay: 500 + i * 60, c: 'tick' });
        });
        (a.yt || []).forEach((v, i) => {
          const t = M.svg(svg, 'path', { d: `M${X(0) - 6} ${Y(v)} L${X(0) + 6} ${Y(v)}`, stroke: col, 'stroke-width': 2 });
          t.style.opacity = 0; c.S.after(500 + i * 60, () => (t.style.opacity = 1));
          B.formula(c, String(v), { x: X(0) - 22, y: Y(v), size: 22, delay: 500 + i * 60, c: 'tick' });
        });
        return G;
      },
      plot(fn, p = {}) {
        let d = '', on = false;
        const n = 160;
        for (let i = 0; i <= n; i++) {
          const v = lerp(xr[0], xr[1], i / n), f = fn(v);
          if (f < yr[0] || f > yr[1]) { on = false; continue; }
          d += `${on ? 'L' : 'M'}${X(v).toFixed(1)} ${Y(f).toFixed(1)}`; on = true;
        }
        const path = M.svg(svg, 'path', { d, stroke: p.color || 'var(--indigo)', 'stroke-width': p.width || 5, fill: 'none', 'stroke-linecap': 'round', ...(p.w ? { 'data-w': p.w } : {}) });
        M.draw(c.S, path, { dur: p.dur || 1400, delay: p.delay || 0 });
        return path;
      },
      seg(p = {}) {
        const l = M.svg(svg, 'line', { stroke: p.color || 'var(--violet)', 'stroke-width': p.width || 3.5, 'stroke-linecap': 'round', ...(p.dash ? { 'stroke-dasharray': p.dash } : {}), ...(p.w ? { 'data-w': p.w } : {}) });
        return { el: l, set(x1, y1, x2, y2) { l.setAttribute('x1', X(x1)); l.setAttribute('y1', Y(y1)); l.setAttribute('x2', X(x2)); l.setAttribute('y2', Y(y2)); } };
      },
      dot(px, py, p = {}) {
        const gEl = M.svg(svg, 'g', p.w ? { 'data-w': p.w } : {});
        const halo = M.svg(gEl, 'circle', { r: 0, fill: p.color || 'var(--orange)', opacity: .22 });
        const core = M.svg(gEl, 'circle', { r: 0, fill: p.color || 'var(--orange)', stroke: '#fff', 'stroke-width': 3 });
        const R = p.r || 10;
        const move = (a, b) => gEl.setAttribute('transform', `translate(${X(a)},${Y(b)})`);
        move(px, py);
        c.S.anim({ delay: p.delay || 0, dur: 700, ease: E.spring, on(v) { core.setAttribute('r', Math.max(0, R * v)); } });
        c.S.loop((t) => halo.setAttribute('r', R * (1.8 + .55 * Math.sin(t * 3))));
        return { move, el: gEl };
      },
    };
    return G;
  };

  /* ---------- фон сцены: четырёхконечные звёзды и дуги-параболы ---------- */
  const STAR = 'M50 0C54 34 66 46 100 50C66 54 54 66 50 100C46 66 34 54 0 50C34 46 46 34 50 0Z';
  B.ambient = function (c, o = {}) {
    const svg = M.svg(c.root, 'svg', { width: c.W, height: c.H, viewBox: `0 0 ${c.W} ${c.H}`, class: 'gsvg amb' });
    const W = c.W, H = c.H;
    const arc1 = M.svg(svg, 'path', { d: `M${-80} ${H * .1} Q${W * .55} ${H * 1.9} ${W + 80} ${H * .1}`, stroke: 'var(--swoosh)', 'stroke-width': 46, fill: 'none', 'stroke-linecap': 'round' });
    M.draw(c.S, arc1, { dur: 1600, ease: E.out5 });
    const stars = (o.stars || [[W - 90, 80, 120], [70, H - 90, 74]]).map(([x, y, s], i) => {
      const gEl = M.svg(svg, 'g', {});
      M.svg(gEl, 'path', { d: STAR, fill: 'url(#gStar)', transform: `translate(${-s / 2},${-s / 2}) scale(${s / 100})` });
      return { gEl, x, y, ph: i * 2.1, s };
    });
    c.S.anim({
      dur: 1100, ease: E.out5,
      on(v) { stars.forEach((st) => (st.scale = v, st.spin = (1 - v) * 270)); },
    });
    stars.forEach((st) => { if (st.scale === undefined) { st.scale = 0; st.spin = 0; } });
    c.S.loop((t) => stars.forEach((st) => {
      st.gEl.setAttribute('transform', `translate(${st.x},${st.y + Math.sin(t * .9 + st.ph) * 9}) rotate(${st.spin + Math.sin(t * .5 + st.ph) * 9}) scale(${st.scale})`);
    }));
    if (M.fast) stars.forEach((st) => st.gEl.setAttribute('transform', `translate(${st.x},${st.y}) scale(1)`));
    return svg;
  };

  /* ---------- склейки: панели закрывают кадр, сцена меняется под ними ---------- */
  B.cut = function (host, kind, color, mid, done) {
    const S = M.scope();
    const IN = 420, OUT = 520;
    const finish = () => { host.textContent = ''; S.kill(); done && done(); };
    host.textContent = '';
    if (kind === 'shutter') {
      const n = 7, bars = [];
      for (let i = 0; i < n; i++) {
        const b = M.el(host, 'div', '', '', `position:absolute;left:${(i / n) * 100}%;width:${100 / n + .3}%;top:0;bottom:0;background:${color};transform:scaleY(0);transform-origin:${i % 2 ? 'top' : 'bottom'}`);
        bars.push(b);
        S.anim({ delay: i * 28, dur: IN, ease: E.inOut5, on(t) { b.style.transform = `scaleY(${t})`; } });
      }
      S.after(IN + n * 28 + 20, () => {
        mid();
        bars.forEach((b, i) => {
          b.style.transformOrigin = i % 2 ? 'bottom' : 'top';
          S.anim({ delay: i * 28, dur: OUT, ease: E.inOut5, on(t) { b.style.transform = `scaleY(${1 - t})`; } });
        });
        S.after(OUT + n * 28 + 20, finish);
      });
    } else if (kind === 'iris') {
      const e = M.el(host, 'div', '', '', `position:absolute;inset:0;background:${color};clip-path:circle(0% at 50% 50%)`);
      S.anim({ dur: IN + 120, ease: E.inOut5, on(t) { e.style.clipPath = `circle(${t * 75}% at 50% 50%)`; } });
      S.after(IN + 140, () => {
        mid();
        S.anim({ dur: OUT, ease: E.inOut5, on(t) { e.style.clipPath = `circle(${(1 - t) * 75}% at 100% 0%)`; } });
        S.after(OUT + 20, finish);
      });
    } else {
      const e = M.el(host, 'div', '', '', `position:absolute;inset:0;background:${color}`);
      S.anim({ dur: IN + 80, ease: E.inOut5, on(t) { const a = lerp(-40, 120, t), b = a + 30; e.style.clipPath = `polygon(0 0,${b}% 0,${a}% 100%,0 100%)`; } });
      S.after(IN + 100, () => {
        mid();
        S.anim({ dur: OUT, ease: E.inOut5, on(t) { const a = lerp(-40, 120, t), b = a + 30; e.style.clipPath = `polygon(${b}% 0,100% 0,100% 100%,${a}% 100%)`; } });
        S.after(OUT + 20, finish);
      });
    }
    return S;
  };
})(window);

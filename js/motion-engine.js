/* motion-engine.js — zero-dependency motion kit for HTML decks & landing pages.
   Ticker · scoped tweens · kinetic type with ghost motion blur · hand annotations ·
   path drawing · counters · particle swarm with morphing · wipes · keyboard deck. */
(function (g) {
  const M = (g.Motion = {});
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  M.clamp = clamp; M.lerp = lerp; M.fast = false;

  /* ---------- easing: each motion type gets its own curve ---------- */
  const bounceOut = (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  };
  const E = (M.ease = {
    linear: (t) => t,
    in3: (t) => t * t * t,
    in5: (t) => t ** 5,
    out3: (t) => 1 - (1 - t) ** 3,
    out5: (t) => 1 - (1 - t) ** 5,
    expo: (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
    inOut3: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
    inOut5: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2),
    back: (t, o = 1.7) => 1 + (o + 1) * (t - 1) ** 3 + o * (t - 1) ** 2,
    bounce: bounceOut,
    elastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 2 ** (-9 * t) * Math.sin(((t * 10 - 0.75) * 2 * Math.PI) / 3) + 1),
    spring: (t) => (t >= 1 ? 1 : 1 - Math.exp(-6.5 * t) * Math.cos(11 * t)),
  });

  /* ---------- ticker & scopes: everything dies with its scene ---------- */
  const tasks = new Set();
  let last = performance.now();
  M.now = () => last;
  function tick(now) {
    last = now;
    for (const t of [...tasks]) if (t(now) === false) tasks.delete(t);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  M.scope = function () {
    const own = new Set();
    const add = (fn) => {
      const wrapped = (now) => { const r = fn(now); if (r === false) own.delete(wrapped); return r; };
      own.add(wrapped); tasks.add(wrapped); return wrapped;
    };
    return {
      anim(o) {
        const { from = 0, to = 1, dur = 600, delay = 0, ease = E.out3, on, done } = o;
        if (M.fast) { o.start && o.start(); on && on(to, 1); done && done(); return; }
        const t0 = performance.now() + delay;
        let started = false;
        return add((now) => {
          if (now < t0) return;
          if (!started) { started = true; o.start && o.start(); }
          const p = clamp((now - t0) / dur);
          on && on(lerp(from, to, ease(p)), p);
          if (p >= 1) { done && done(); return false; }
        });
      },
      after(ms, fn) {
        if (M.fast) { fn(); return; }
        const t0 = performance.now() + ms;
        return add((now) => { if (now >= t0) { fn(); return false; } });
      },
      /* a constant "alive" loop: fn(timeSeconds) */
      loop(fn) { const t0 = performance.now(); return add((now) => { fn((now - t0) / 1000); }); },
      kill() { own.forEach((t) => tasks.delete(t)); own.clear(); },
    };
  };

  /* ---------- DOM helpers ---------- */
  M.el = function (parent, tag = 'div', cls = '', html = '', style = '') {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    if (style) e.style.cssText = style;
    if (parent) parent.appendChild(e);
    return e;
  };
  M.svg = function (parent, tag, attrs = {}) {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  /* ---------- kinetic type ---------- */
  M.split = function (el) {
    const chars = [];
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((w) => {
            if (!w) return;
            if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(' ')); return; }
            const word = document.createElement('span');
            word.style.cssText = 'display:inline-block;white-space:nowrap';
            [...w].forEach((c) => {
              const s = document.createElement('span');
              s.className = 'ch'; s.textContent = c;
              s.style.cssText = 'display:inline-block;will-change:transform';
              word.appendChild(s); chars.push(s);
            });
            frag.appendChild(word);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      });
    };
    walk(el);
    el._chars = chars;
    return chars;
  };

  /* banded ghost copies along velocity: the "smear" look of hand-made motion blur */
  function ghost(ch, vx, vy) {
    const sp = Math.hypot(vx, vy);
    if (sp < 2) { if (ch._g) { ch.style.textShadow = ''; ch._g = 0; } return; }
    const n = 6, parts = [];
    for (let i = 1; i <= n; i++) {
      const a = Math.round(55 * (1 - i / (n + 1)));
      parts.push(`${(-vx * i * 0.42).toFixed(1)}px ${(-vy * i * 0.42).toFixed(1)}px 0 color-mix(in srgb,currentColor ${a}%,transparent)`);
    }
    ch.style.textShadow = parts.join(','); ch._g = 1;
  }
  function pose(ch, s) {
    ch.style.transform = `translate(${s.x || 0}px,${s.y || 0}px) rotate(${s.r || 0}deg) rotateY(${s.ry || 0}deg) skewX(${s.k || 0}deg) scale(${s.sx ?? 1},${s.sy ?? 1})`;
    if (s.o !== undefined) ch.style.opacity = s.o;
  }
  function chTween(S, ch, from, to, opt) {
    let lx = from.x || 0, ly = from.y || 0;
    pose(ch, from);
    S.anim({
      ...opt,
      on(v, p) {
        const s = {};
        for (const k of new Set([...Object.keys(from), ...Object.keys(to)])) {
          const dflt = k === 'sx' || k === 'sy' || k === 'o' ? 1 : 0;
          const a = from[k] ?? dflt, b = to[k] ?? dflt;
          s[k] = k === 'o' ? clamp(lerp(a, b, Math.min(1, p * (opt.oSpeed || 8)))) : lerp(a, b, v);
        }
        pose(ch, s);
        ghost(ch, (s.x || 0) - lx, (s.y || 0) - ly);
        lx = s.x || 0; ly = s.y || 0;
        if (p >= 1) { ch.style.textShadow = ''; ch._g = 0; if (opt.clean !== false) ch.style.willChange = 'auto'; }
      },
    });
  }

  /* kinds: rise | fall | stretch | spin | snap | whip */
  M.type = function (S, el, kind = 'rise', opts = {}) {
    const chars = el._chars || M.split(el);
    const { delay = 0 } = opts;
    const H = el.offsetHeight || 100;
    const lineH = parseFloat(getComputedStyle(el).fontSize) || H;
    const center = chars.length / 2;
    chars.forEach((ch, i) => {
      const st = opts.stagger ?? { rise: 45, fall: 62, stretch: 0, spin: 70, snap: 0, whip: 26 }[kind] ?? 40;
      const d = delay + i * st;
      const P = { delay: d };
      if (kind === 'rise') chTween(S, ch, { y: lineH * 1.05, r: 7, o: 0 }, { y: 0, r: 0, o: 1 }, { ...P, dur: opts.dur || 720, ease: (t) => E.back(t, 1.25) });
      else if (kind === 'fall') chTween(S, ch, { y: -1000 - (i % 3) * 120, sy: 1.25, sx: 0.9, o: 0 }, { y: 0, sy: 1, sx: 1, o: 1 }, { ...P, dur: opts.dur || 980, ease: E.bounce, oSpeed: 40 });
      else if (kind === 'stretch') chTween(S, ch, { x: (center - i) * (lineH * 0.42), sx: 0.05, sy: 1.25, o: 0 }, { x: 0, sx: 1, sy: 1, o: 1 }, { ...P, dur: opts.dur || 1150, ease: E.elastic, oSpeed: 30 });
      else if (kind === 'spin') chTween(S, ch, { ry: 450, o: 0 }, { ry: 0, o: 1 }, { ...P, dur: opts.dur || 1050, ease: E.out5, oSpeed: 12 });
      else if (kind === 'whip') chTween(S, ch, { x: (opts.dir || 1) * 1500, k: -28 * (opts.dir || 1), o: 0 }, { x: 0, k: 0, o: 1 }, { ...P, dur: opts.dur || 640, ease: E.expo, oSpeed: 30 });
      else if (kind === 'snap') {
        const j = { x: (i % 2 ? 1 : -1) * 26, y: (i % 3) * 9 - 9, r: i % 2 ? -3 : 3 };
        pose(ch, { ...j, o: 0 });
        S.after(d, () => pose(ch, { ...j, o: 1 }));
        S.after(d + 84, () => pose(ch, { o: 1 }));
      }
    });
    if (kind === 'spin') el.style.perspective = '900px';
    return chars;
  };

  M.typeOut = function (S, el, kind = 'whip', opts = {}) {
    const chars = el._chars || M.split(el);
    const dir = opts.dir || -1;
    chars.forEach((ch, i) => {
      const d = (opts.delay || 0) + (opts.stagger ?? 14) * i;
      if (kind === 'whip') chTween(S, ch, { x: 0, k: 0, o: 1 }, { x: dir * 1700, k: 26 * -dir, o: 1 }, { delay: d, dur: opts.dur || 460, ease: E.in3, clean: false });
      else if (kind === 'drop') chTween(S, ch, { y: 0, r: 0, o: 1 }, { y: 1200, r: i % 2 ? 14 : -14, o: 1 }, { delay: d, dur: opts.dur || 560, ease: E.in3, clean: false });
    });
  };

  /* ---------- pop for cards: spring scale ---------- */
  M.pop = function (S, el, opts = {}) {
    const { delay = 0, dur = 900, from = 0.72, y = 40, done } = opts;
    el.style.opacity = 0;
    S.anim({
      delay, dur, ease: E.spring,
      start() { el.style.opacity = 1; },
      on(v) { const s = lerp(from, 1, v); el.style.transform = `translateY(${lerp(y, 0, v)}px) scale(${s})`; },
      done() { el.style.opacity = 1; el.style.transform = ''; done && done(); },
    });
  };

  /* ---------- line drawing ---------- */
  M.draw = function (S, path, opts = {}) {
    const L = path.getTotalLength();
    path.style.strokeDasharray = `${L} ${L}`;
    path.style.strokeDashoffset = L;
    S.anim({
      dur: opts.dur || 1200, delay: opts.delay || 0, ease: opts.ease || E.inOut3,
      on(v) { path.style.strokeDashoffset = L * (1 - v); },
      done() { if (!opts.keepDash) { path.style.strokeDasharray = 'none'; path.style.strokeDashoffset = 0; } opts.done && opts.done(); },
    });
    return L;
  };

  /* ---------- hand-written annotation: arrives AFTER the event it explains ---------- */
  M.note = function (S, parent, o) {
    const { x, y, text, color = 'currentColor', size = 36, rot = -3, delay = 0, arrow, cls = '' } = o;
    const n = M.el(parent, 'div', 'hand ' + cls, text, `position:absolute;left:${x}px;top:${y}px;color:${color};font-size:${size}px;transform:rotate(${rot}deg);white-space:nowrap;line-height:1.15`);
    n.style.clipPath = 'inset(-30% 100% -30% -2%)';
    S.anim({
      delay, dur: Math.max(380, text.length * 34), ease: E.linear,
      on(v) { n.style.clipPath = `inset(-30% ${(1 - v) * 100}% -30% -2%)`; },
      done() { n.style.clipPath = 'none'; },
    });
    if (arrow) {
      const [ax, ay] = arrow.from, [bx, by] = arrow.to, bend = arrow.bend ?? 0.25;
      const mx = (ax + bx) / 2 - (by - ay) * bend, my = (ay + by) / 2 + (bx - ax) * bend;
      const svg = M.svg(parent, 'svg', { style: 'position:absolute;left:0;top:0;width:1920px;height:1080px;overflow:visible;pointer-events:none' });
      const common = { fill: 'none', stroke: color, 'stroke-width': arrow.width || 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
      const p = M.svg(svg, 'path', { ...common, d: `M${ax} ${ay} Q${mx} ${my} ${bx} ${by}` });
      const ang = Math.atan2(by - my, bx - mx), h = 16;
      const head = M.svg(svg, 'path', { ...common, d: `M${bx - h * Math.cos(ang - 0.5)} ${by - h * Math.sin(ang - 0.5)} L${bx} ${by} L${bx - h * Math.cos(ang + 0.5)} ${by - h * Math.sin(ang + 0.5)}` });
      head.style.opacity = 0;
      M.draw(S, p, { delay: delay + 180, dur: 460, ease: E.inOut3, done() { head.style.opacity = 1; } });
    }
    return n;
  };

  /* ---------- counters ---------- */
  M.fmt = (v, dec = 0) => v.toLocaleString('ru-RU', { minimumFractionDigits: dec, maximumFractionDigits: dec }).replace(/ /g, ' ');
  M.count = function (S, el, to, opts = {}) {
    const { from = 0, dec = 0, dur = 1500, delay = 0, suffix = '', prefix = '' } = opts;
    el.textContent = prefix + M.fmt(from, dec) + suffix;
    S.anim({ delay, dur, from, to, ease: E.out5, on(v) { el.textContent = prefix + M.fmt(v, dec) + suffix; } });
  };

  /* ---------- swarm: persistent particles that morph across scenes ---------- */
  M.swarm = function (canvas, n, palette) {
    const ctx = canvas.getContext('2d');
    const f = () => new Float32Array(n);
    const x = f(), y = f(), ax = f(), ay = f(), bx = f(), by = f(), t0 = f(), du = f(), s = f(), sa = f(), sb = f(), ph = f(), arc = f(), lx = f(), ly = f();
    const pal = new Uint8Array(n);
    const base = performance.now();
    const clock = () => performance.now() - base;
    for (let i = 0; i < n; i++) {
      x[i] = ax[i] = bx[i] = lx[i] = Math.random() * 1920;
      y[i] = ay[i] = by[i] = ly[i] = Math.random() * 1080;
      du[i] = 1; ph[i] = Math.random() * 6.283; arc[i] = Math.random() - 0.5;
    }
    const sw = {
      n, x, y, palette: palette.map((c) => ({ ...c })), wander: 2.2, live: null, ease: E.inOut3, arcAmt: 0.35,
      /* fn(i) -> {x,y,s,p} — any field may be omitted */
      morph(fn, o = {}) {
        const { dur = 1200, stagger = 0, jitter = 0.35, ease } = o;
        if (ease) sw.ease = ease;
        if (o.arc !== undefined) sw.arcAmt = o.arc;
        const now = clock();
        for (let i = 0; i < n; i++) {
          const t = fn(i) || {};
          ax[i] = x[i]; ay[i] = y[i]; sa[i] = s[i];
          if (t.x !== undefined) bx[i] = t.x;
          if (t.y !== undefined) by[i] = t.y;
          if (t.s !== undefined) sb[i] = t.s;
          if (t.p !== undefined) pal[i] = t.p;
          const st = typeof stagger === 'function' ? stagger(i) : stagger * Math.random();
          t0[i] = now + st;
          du[i] = dur * (1 + jitter * (ph[i] / 6.283 - 0.5));
          if (M.fast) { t0[i] = now - 1e5; x[i] = ax[i] = lx[i] = bx[i]; y[i] = ay[i] = ly[i] = by[i]; s[i] = sa[i] = sb[i]; }
        }
      },
      /* retune a palette colour smoothly */
      tint(idx, c, S, dur = 900) {
        const p = sw.palette[idx], from = { ...p };
        S.anim({ dur, ease: E.inOut3, on(v) { for (const k in c) p[k] = lerp(from[k] ?? c[k], c[k], v); } });
      },
      resize() {
        const v = M.view, d = Math.min(2, devicePixelRatio || 1);
        canvas.width = innerWidth * d; canvas.height = innerHeight * d;
        canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
        sw._m = [v.k * d, 0, 0, v.k * d, v.ox * d, v.oy * d];
      },
    };
    const offs = [0, 0];
    (function draw() {
      const now = clock(), sec = now / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (sw._m) ctx.setTransform(...sw._m);
      const P = sw.palette, ease = sw.ease, wa = sw.wander, live = sw.live;
      const paths = P.map(() => new Path2D()), streaks = P.map(() => new Path2D()), glows = P.map(() => new Path2D());
      for (let i = 0; i < n; i++) {
        const p = clamp((now - t0[i]) / du[i]), e = ease(p);
        let nx = ax[i] + (bx[i] - ax[i]) * e, ny = ay[i] + (by[i] - ay[i]) * e;
        if (p < 1 && sw.arcAmt) {
          const dx = bx[i] - ax[i], dy = by[i] - ay[i], m = Math.sin(Math.PI * e) * arc[i] * sw.arcAmt;
          nx += -dy * m; ny += dx * m;
        }
        s[i] = sa[i] + (sb[i] - sa[i]) * e;
        x[i] = nx; y[i] = ny;
        if (s[i] < 0.05) { lx[i] = nx; ly[i] = ny; continue; }
        let dxx = wa * Math.sin(sec * 0.9 + ph[i] * 3), dyy = wa * Math.cos(sec * 0.7 + ph[i] * 5);
        if (live) { live(i, sec, offs); dxx += offs[0]; dyy += offs[1]; }
        const px = nx + dxx, py = ny + dyy, vx = px - lx[i], vy = py - ly[i], q = pal[i], r = s[i];
        if (vx * vx + vy * vy > 30) { streaks[q].moveTo(px - vx * 1.4, py - vy * 1.4); streaks[q].lineTo(px, py); }
        else { paths[q].moveTo(px + r, py); paths[q].arc(px, py, r, 0, 6.2832); }
        if (P[q].glow) { glows[q].moveTo(px + r * 3, py); glows[q].arc(px, py, r * 3, 0, 6.2832); }
        lx[i] = px; ly[i] = py;
      }
      P.forEach((c, q) => {
        const col = `rgba(${c.r | 0},${c.g | 0},${c.b | 0},`;
        if (c.glow) { ctx.fillStyle = col + c.a * c.glow + ')'; ctx.fill(glows[q]); }
        ctx.fillStyle = col + c.a + ')'; ctx.fill(paths[q]);
        ctx.strokeStyle = col + c.a * 0.75 + ')'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.stroke(streaks[q]);
      });
      requestAnimationFrame(draw);
    })();
    return sw;
  };

  /* ---------- colour wipes: the wipe lives UNDER the particles, so objects survive the cut ---------- */
  M.wipe = function (S, host, kind, o) {
    const { color, dur = 760, done } = o;
    if (M.fast) { done && done(); return; }
    const v = M.view, W = innerWidth, H = innerHeight;
    const cx = (o.x ?? 960) * v.k + v.ox, cy = (o.y ?? 540) * v.k + v.oy;
    if (kind === 'iris') {
      const e = M.el(host, 'div', '', '', `position:absolute;inset:0;background:${color}`);
      const R = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + 10;
      e.style.clipPath = `circle(0px at ${cx}px ${cy}px)`;
      S.anim({ dur, ease: E.inOut5, on(t) { e.style.clipPath = `circle(${t * R}px at ${cx}px ${cy}px)`; }, done() { done && done(); e.remove(); } });
    } else if (kind === 'shutter') {
      const n = o.n || 9, bars = [];
      for (let i = 0; i < n; i++) {
        const b = M.el(host, 'div', '', '', `position:absolute;left:${(i / n) * 100}%;width:${100 / n + 0.2}%;top:0;bottom:0;background:${color};transform:scaleY(0);transform-origin:${i % 2 ? 'top' : 'bottom'}`);
        bars.push(b);
        S.anim({ delay: i * 42, dur, ease: E.inOut5, on(t) { b.style.transform = `scaleY(${t})`; } });
      }
      S.after(dur + n * 42, () => { done && done(); bars.forEach((b) => b.remove()); });
    } else if (kind === 'slash') {
      const e = M.el(host, 'div', '', '', `position:absolute;inset:0;background:${color}`);
      const dir = o.dir || 1;
      S.anim({
        dur, ease: E.inOut5,
        on(t) {
          const a = lerp(-40, 120, t), b = a + 30;
          e.style.clipPath = dir > 0 ? `polygon(0 0,${b}% 0,${a}% 100%,0 100%)` : `polygon(100% 0,${100 - b}% 0,${100 - a}% 100%,100% 100%)`;
        },
        done() { done && done(); e.remove(); },
      });
    }
  };

  /* ---------- stage fit: fixed 1920×1080 logic, full-bleed canvas ---------- */
  M.fit = function (stages, swarm) {
    const go = () => {
      const k = Math.min(innerWidth / 1920, innerHeight / 1080);
      const ox = (innerWidth - 1920 * k) / 2, oy = (innerHeight - 1080 * k) / 2;
      M.view = { k, ox, oy };
      stages.forEach((s) => { s.style.transform = `translate(${ox}px,${oy}px) scale(${k})`; });
      swarm && swarm.resize();
    };
    addEventListener('resize', go); go();
  };

  /* ---------- deck: → ↓ Space PgDn next · ← ↑ PgUp back · F fullscreen · Home/End ---------- */
  M.deck = function ({ scenes, layer, onShow }) {
    let i = -1, k = 0, cur = null;
    function build(idx, upto, instant, dir) {
      const scene = scenes[idx];
      const c = { S: M.scope(), root: M.el(layer, 'div', 'scene', '', 'position:absolute;inset:0'), scene, i: idx, dir };
      const old = cur;
      if (old) {
        if (instant) { old.S.kill(); old.root.remove(); }
        else {
          old.scene.leave && old.scene.leave(old);
          old.root.style.pointerEvents = 'none';
          setTimeout(() => { old.S.kill(); old.root.remove(); }, old.scene.leaveMs || 800);
        }
      }
      cur = c;
      M.fast = !!instant;
      scene.enter && scene.enter(c);
      for (let s = 0; s < upto; s++) scene.steps[s] && scene.steps[s](c);
      M.fast = false;
      i = idx; k = upto;
      show();
    }
    function show() {
      history.replaceState(null, '', `#${i}.${k}`);
      onShow && onShow(i, k, scenes[i]);
    }
    function next() {
      const sc = scenes[i];
      if (k < (sc.steps || []).length) { sc.steps[k](cur); k++; show(); }
      else if (i < scenes.length - 1) build(i + 1, 0, false, 1);
    }
    function prev() {
      if (k > 0) build(i, k - 1, true, -1);
      else if (i > 0) build(i - 1, (scenes[i - 1].steps || []).length, true, -1);
    }
    function full() {
      const d = document, r = d.documentElement;
      if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else (r.requestFullscreen || r.webkitRequestFullscreen).call(r);
    }
    addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key;
      if (key === 'ArrowRight' || key === 'ArrowDown' || key === ' ' || key === 'PageDown' || key === 'Enter') { e.preventDefault(); next(); }
      else if (key === 'ArrowLeft' || key === 'ArrowUp' || key === 'PageUp' || key === 'Backspace') { e.preventDefault(); prev(); }
      else if (key === 'f' || key === 'F' || key === 'а' || key === 'А') { e.preventDefault(); full(); }
      else if (key === 'Home') build(0, 0, true, -1);
      else if (key === 'End') build(scenes.length - 1, (scenes[scenes.length - 1].steps || []).length, true, 1);
    });
    let idle;
    addEventListener('mousemove', () => {
      document.body.style.cursor = '';
      clearTimeout(idle);
      idle = setTimeout(() => (document.body.style.cursor = 'none'), 1800);
    });
    const m = location.hash.match(/#(\d+)\.(\d+)/);
    if (m) build(clamp(+m[1], 0, scenes.length - 1), +m[2], true, 1);
    else build(0, 0, false, 1);
    return { next, prev, go: (a, b = 0) => build(a, b, true, 1), get pos() { return [i, k]; } };
  };
})(window);

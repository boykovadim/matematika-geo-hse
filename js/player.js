/* player.js — проигрыватель лекции: сцены, реплики, озвучка, таймлайн. */
(function (g) {
  const M = g.Motion, B = g.Board;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- озвучка через голос браузера ---------- */
  const Voice = (g.Voice = {
    ok: 'speechSynthesis' in g && 'SpeechSynthesisUtterance' in g,
    voice: null, token: 0, keep: null,
    pick() {
      if (!this.ok) return;
      const ru = speechSynthesis.getVoices().filter((v) => /^ru/i.test(v.lang));
      const score = (v) => (/enhanced|premium|neural|natural|online/i.test(v.name) ? 4 : 0) + (/google|milena|svetlana|dariya|yuri/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
      this.voice = ru.sort((a, b) => score(b) - score(a))[0] || null;
    },
    get ready() { return this.ok && !!this.voice; },
    stop() { this.token++; if (this.ok) speechSynthesis.cancel(); },
    /* cb вызывается один раз: когда реплика закончилась или голос завис */
    speak(text, rate, cb) {
      const my = ++this.token;
      let fired = false;
      const est = estimate(text, rate);
      const finish = () => { if (fired || my !== this.token) return; fired = true; clearTimeout(dog); cb(); };
      const dog = setTimeout(finish, est * 2.4 + 2500);
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ru-RU'; u.voice = this.voice; u.rate = rate;
      u.onend = finish;
      u.onerror = (e) => { if (e.error !== 'interrupted' && e.error !== 'canceled') finish(); };
      this.keep = u; /* иначе Chrome может собрать объект и не вызвать onend */
      speechSynthesis.speak(u);
    },
  });
  if (Voice.ok) { Voice.pick(); speechSynthesis.addEventListener('voiceschanged', () => Voice.pick()); }
  const estimate = (text, rate) => Math.max(1700, (text.length * 66) / rate);

  /* ---------- озвучка из готовых mp3: один и тот же живой голос на всех устройствах ---------- */
  const Speaker = {
    el: new Audio(), next: new Audio(), token: 0, active: false, finish: null,
    play(url, rate, est, cb, fail) {
      const my = ++this.token, el = this.el;
      let fired = false;
      this.active = true;
      const done = (fn) => () => { if (fired || my !== this.token) return; fired = true; this.active = false; clearTimeout(this.dog); fn(); };
      this.finish = done(cb);
      const bad = done(fail);
      el.onended = this.finish; el.onerror = bad;
      el.src = url; el.defaultPlaybackRate = rate; el.playbackRate = rate;
      this.dog = setTimeout(this.finish, est * 3 + 8000);
      el.play().catch((e) => { if (e.name !== 'AbortError') bad(); });
    },
    pause() { this.el.pause(); clearTimeout(this.dog); },
    resume(rate) { this.el.playbackRate = rate; this.el.play().catch(() => this.finish && this.finish()); },
    stop() { this.token++; this.active = false; clearTimeout(this.dog); this.el.pause(); },
    preload(url) { this.next.preload = 'auto'; this.next.src = url; },
  };

  const ICON = {
    play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4.4" height="16" rx="1.2" fill="currentColor"/><rect x="13.6" y="4" width="4.4" height="16" rx="1.2" fill="currentColor"/></svg>',
    prev: '<svg viewBox="0 0 24 24"><path d="M19 5.5v13a.8.8 0 0 1-1.25.66L8.5 12.66a.8.8 0 0 1 0-1.32l9.25-6.5A.8.8 0 0 1 19 5.5Z" fill="currentColor"/><rect x="4.5" y="5" width="2.6" height="14" rx="1" fill="currentColor"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M5 5.5v13a.8.8 0 0 0 1.25.66l9.25-6.5a.8.8 0 0 0 0-1.32l-9.25-6.5A.8.8 0 0 0 5 5.5Z" fill="currentColor"/><rect x="16.9" y="5" width="2.6" height="14" rx="1" fill="currentColor"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h9M18 7h2M4 17h2M11 17h9"/><circle cx="15.5" cy="7" r="2.5"/><circle cx="8.5" cy="17" r="2.5"/></svg>',
    on: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.5a8 8 0 0 1 0 11"/></svg>',
    off: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" fill="currentColor"/><path d="m16 9.5 5 5M21 9.5l-5 5"/></svg>',
  };
  g.ICON = ICON;
  const RATES = [.85, 1, 1.25, 1.5];

  g.Player = function (mount, L, store, hooks) {
    const scenes = L.scenes;
    const saved = store.lecture(L.id);
    const prefs = store.prefs();
    const total = scenes.reduce((a, s) => a + s.lines.length, 0);
    const offset = (i) => scenes.slice(0, i).reduce((a, s) => a + s.lines.length, 0);

    mount.innerHTML = `
      <div class="lesson">
        <div class="stage-wrap" id="wrap">
          <div class="stage-root" id="roots"></div>
          <div class="fx" id="fx"></div>
          <div class="inspect-hint" id="hint">Пауза. Нажми на любой символ или линию, объясню, что это</div>
          <div class="poster" id="poster"></div>
        </div>
        <aside class="explain glass">
          <div class="ex-head">
            <span class="ex-kicker" id="exK"></span>
            <h2 id="exT"></h2>
          </div>
          <div class="ex-lines" id="exL"></div>
          <div class="ex-next" id="exN"></div>
        </aside>
        <div class="dock glass" data-lens="1">
          <button class="ic" id="bPrev" aria-label="Предыдущая реплика">${ICON.prev}</button>
          <button class="ic main" id="bPlay" aria-label="Воспроизвести">${ICON.play}</button>
          <button class="ic" id="bNext" aria-label="Следующая реплика">${ICON.next}</button>
          <div class="timeline" id="tl"></div>
          <button class="set-btn" id="bSet" aria-label="Голос и скорость"></button>
        </div>
        <div class="sound glass" id="sound" hidden></div>
      </div>`;
    const $ = (id) => mount.querySelector('#' + id);
    const wrap = $('wrap'), roots = $('roots'), fx = $('fx'), poster = $('poster');

    let cur = null, i = 0, k = 0, playing = false, timer = null, cutS = null, cutting = false, started = false, ended = false, destroyed = false;
    let portrait = false, W = 1280, H = 720;
    const manifest = g.AudioManifest && g.AudioManifest[L.id];
    const VOICE_NAMES = { dmitry: 'Дмитрий', svetlana: 'Светлана' };
    let voice = prefs.voiceName || 'dmitry', rate = prefs.rate || 1, heard = false;
    const audioUrl = (a, b) => {
      const h = manifest && manifest.lines[`${a}.${b}`];
      return h && voice !== 'off' ? `audio/${L.id}/${voice}/${h}.mp3` : null;
    };
    const hush = () => { Voice.stop(); Speaker.stop(); };

    /* ---------- размер сцены ---------- */
    function measure() {
      const r = wrap.getBoundingClientRect();
      const dockOverlap = innerWidth > 900 ? 78 : 0;
      const availH = r.height - dockOverlap;
      const p = r.width / availH < 1.08;
      const changed = p !== portrait;
      portrait = p; W = p ? 720 : 1280; H = p ? 800 : 720;
      const s = Math.min(r.width / W, availH / H);
      roots.style.width = W + 'px'; roots.style.height = H + 'px';
      roots.style.transform = `translate(${(r.width - W * s) / 2}px,${(availH - H * s) / 2}px) scale(${s})`;
      return changed;
    }
    const onResize = () => { if (measure() && cur) { const applied = cur.applied; build(i, applied, true); } };
    const ro = new ResizeObserver(onResize);

    /* ---------- сборка сцены ---------- */
    function build(idx, upto, instant) {
      if (cur) { cur.S.kill(); cur.root.remove(); }
      const scene = scenes[idx];
      const root = M.el(roots, 'div', 'scene');
      root.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px`;
      wrap.classList.toggle('dark', !!scene.dark);
      const c = { S: M.scope(), root, scene, W, H, portrait, v: {}, applied: upto };
      cur = c; i = idx; k = upto;
      M.fast = !!instant || reduce;
      scene.enter && scene.enter(c);
      M.fast = true;
      for (let s = 0; s < upto; s++) scene.lines[s].do && scene.lines[s].do(c);
      M.fast = false;
      renderPanel(); renderTimeline();
    }

    function runLine(line, opts = {}) {
      k = line; ended = false;
      const l = cur.scene.lines[k];
      M.fast = reduce;
      l.do && l.do(cur);
      M.fast = false;
      cur.applied = k + 1;
      save(); renderPanel(); renderTimeline();
      if (playing && !opts.silent) narrate();
    }

    function narrate() {
      clearTimeout(timer);
      const l = cur.scene.lines[k];
      const say = l.say || l.t.replace(/\$/g, '');
      const t0 = performance.now(), minHold = l.hold || 1400;
      heard = false;
      const advance = () => {
        heard = true;
        const rest = Math.max(280, minHold - (performance.now() - t0));
        clearTimeout(timer);
        timer = setTimeout(() => { if (playing) step(); }, rest);
      };
      const url = audioUrl(i, k), est = estimate(say, rate);
      const silent = () => { timer = setTimeout(advance, est); };
      if (url) {
        Speaker.play(url, rate, est, advance, silent);
        const nk = k + 1 < scenes[i].lines.length ? [i, k + 1] : [i + 1, 0];
        const nu = audioUrl(nk[0], nk[1]);
        if (nu) Speaker.preload(nu);
      } else if (voice !== 'off' && Voice.ready) Voice.speak(say, rate, advance);
      else silent();
    }

    function step() {
      if (k + 1 < cur.scene.lines.length) return runLine(k + 1);
      if (i + 1 < scenes.length) return toScene(i + 1);
      finish();
    }
    function finish() {
      playing = false; ended = true;
      store.update(L.id, { watched: true, max: total });
      hush(); clearTimeout(timer);
      renderPanel(); syncButtons();
      hooks.onProgress && hooks.onProgress();
    }

    function toScene(idx, line = 0) {
      hush(); clearTimeout(timer);
      if (cutS) { cutS.kill(); fx.textContent = ''; cutting = false; }
      const sc = scenes[idx];
      const go = () => { build(idx, line, false); runLine(line); };
      if (reduce || !sc.cut) { go(); return; }
      cutting = true;
      const color = sc.cutColor || (sc.cut === 'iris' ? 'var(--orange)' : sc.cut === 'slash' ? 'var(--violet)' : 'var(--indigo)');
      cutS = B.cut(fx, sc.cut, color, go, () => { cutting = false; cutS = null; });
    }

    function jump(idx, line) {
      hush(); clearTimeout(timer);
      if (cutS) { cutS.kill(); fx.textContent = ''; cutting = false; cutS = null; }
      hidePoster();
      build(idx, line, true);
      runLine(line);
    }

    function next() {
      hidePoster();
      hush(); clearTimeout(timer);
      if (cutting) return;
      if (!cur.applied) return runLine(0);
      if (k + 1 < cur.scene.lines.length) runLine(k + 1);
      else if (i + 1 < scenes.length) toScene(i + 1);
      else finish();
    }
    function prev() {
      hidePoster();
      if (cutting) return;
      if (k > 0) jump(i, k - 1);
      else if (i > 0) jump(i - 1, scenes[i - 1].lines.length - 1);
      else jump(0, 0);
    }
    function toggle() {
      if (playing) {
        pause(); return;
      }
      playing = true; syncButtons();
      if (ended) { ended = false; jump(0, 0); return; }
      if (!started) { hidePoster(); }
      if (cur.applied === 0 || (cur.applied <= k)) runLine(k);
      else if (Speaker.active) Speaker.resume(rate);
      else if (heard) step();
      else narrate();
    }

    function pause() {
      playing = false;
      if (Speaker.active) Speaker.pause(); else Voice.stop();
      clearTimeout(timer); syncButtons();
    }

    /* ---------- «Что это?»: нажатие на символ останавливает рассказ ---------- */
    const touch = matchMedia('(pointer: coarse)').matches;
    function pick(x, y) {
      const reach = touch ? 18 : 5;
      let best = null, bd = 1e9, ba = 1e9;
      roots.querySelectorAll('.f [data-w],.kin[data-w],.hand[data-w],.chip,.cell-v[data-w],.glow-num[data-w]').forEach((e) => {
        const r = e.getBoundingClientRect();
        if (!r.width) return;
        const d = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
        const a = r.width * r.height;
        if (d <= reach && (d < bd - .5 || (Math.abs(d - bd) <= .5 && a < ba))) { best = e; bd = d; ba = a; }
      });
      if (best) return best;
      for (const [dx, dy] of [[0, 0], [6, 0], [-6, 0], [0, 6], [0, -6], [10, 10], [-10, -10], [10, -10], [-10, 10], [14, 0], [-14, 0], [0, 14], [0, -14]]) {
        const hit = document.elementsFromPoint(x + dx, y + dy).find((e) => e instanceof SVGElement && e.closest('[data-w]'));
        if (hit) return hit.closest('[data-w]');
      }
      return null;
    }
    function inspect(el, line = k) {
      const was = playing;
      if (playing) pause();
      g.WhatIs.show(el, { L, i, k: line }, { resume: was, onClose() { if (was && !destroyed) toggle(); } });
    }
    wrap.addEventListener('click', (e) => {
      if (!started || cutting || e.target.closest('.poster')) return;
      const el = pick(e.clientX, e.clientY);
      if (el) inspect(el);
    });
    let hotEl = null;
    if (!touch) wrap.addEventListener('mousemove', (e) => {
      if (!started) return;
      const el = pick(e.clientX, e.clientY);
      if (el === hotEl) return;
      if (hotEl) hotEl.classList.remove('hot');
      hotEl = el;
      if (el) el.classList.add('hot');
      wrap.style.cursor = el ? 'help' : '';
    });

    /* ---------- заставка ---------- */
    function showPoster() {
      const back = saved.pos && (saved.pos.i > 0 || saved.pos.k > 0);
      poster.innerHTML = `
        <div class="p-in">
          <div class="p-date" id="pDate"></div>
          <h1 class="p-title" id="pTitle"></h1>
          <button class="bigplay glass" id="bBig" data-lens="1">${ICON.play}<span>${back ? 'Продолжить' : 'Смотреть'}</span></button>
          <p class="p-hint">${manifest || Voice.ready ? 'со звуком. Любой символ на доске можно нажать' : 'голос недоступен, текст пойдёт сам'}</p>
        </div>`;
      const S = (poster._S = M.scope());
      const pd = poster.querySelector('#pDate'), pt = poster.querySelector('#pTitle');
      pd.textContent = `Лекция ${L.n} · ${hooks.fmtDate(L.date)}`;
      pt.textContent = L.title;
      if (!reduce) {
        M.type(S, pt, 'rise', { stagger: 16, dur: 620, delay: 120 });
        M.pop(S, poster.querySelector('#bBig'), { delay: 620 });
      }
      poster.querySelector('#bBig').onclick = toggle;
    }
    function hidePoster() {
      if (started) return;
      started = true;
      poster.classList.add('gone');
      setTimeout(() => { poster._S && poster._S.kill(); poster.remove(); }, 460);
    }

    /* ---------- панель текста ---------- */
    let panelScene = -1;
    function renderPanel() {
      const sc = scenes[i];
      $('exK').textContent = `Глава ${i + 1} из ${scenes.length}`;
      $('exT').textContent = sc.title;
      const box = $('exL');
      if (panelScene !== i) {
        panelScene = i;
        box.textContent = '';
        sc.lines.forEach((l, n) => {
          const p = M.el(box, 'button', 'ln');
          B.rich(p, l.t);
          p.onclick = (e) => { const t = e.target.closest('.f [data-w]'); if (t) inspect(t, n); else jump(i, n); };
        });
      }
      const live = started || cur.applied > 0;
      [...box.children].forEach((p, n) => {
        p.classList.toggle('now', live && n === k);
        p.classList.toggle('past', live && n < k);
      });
      const now = box.children[k];
      if (now && live) box.scrollTo({ top: now.offsetTop - box.offsetTop - 8, behavior: reduce ? 'auto' : 'smooth' });
      const atEnd = ended || (i === scenes.length - 1 && k === sc.lines.length - 1 && cur.applied === sc.lines.length);
      $('exN').innerHTML = atEnd ? `<a class="cta" href="#/lecture/${L.id}/test">Перейти к тесту</a>` : '';
    }

    /* ---------- таймлайн ---------- */
    const tl = $('tl');
    scenes.forEach((s, n) => {
      const b = M.el(tl, 'button', 'seg');
      b.style.flexGrow = s.lines.length;
      b.setAttribute('aria-label', `Глава ${n + 1}: ${s.title}`);
      b.title = s.title;
      M.el(b, 'i');
      b.onclick = () => jump(n, 0);
    });
    function renderTimeline() {
      [...tl.children].forEach((b, n) => {
        const f = n < i ? 1 : n > i ? 0 : (cur.applied || 0) / scenes[i].lines.length;
        b.firstChild.style.transform = `scaleX(${f})`;
        b.classList.toggle('cur', n === i);
      });
    }

    function syncButtons() {
      $('bPlay').innerHTML = playing ? ICON.pause : ICON.play;
      $('bPlay').setAttribute('aria-label', playing ? 'Пауза' : 'Воспроизвести');
      $('bSet').innerHTML = `${voice === 'off' ? ICON.off : ICON.on}<span class="long">${VOICE_NAMES[voice] || (voice === 'off' ? 'Без звука' : 'Голос')} ·</span><span>${String(rate).replace('.', ',')}×</span>`;
      $('hint').classList.toggle('in', started && !playing && !ended);
      wrap.classList.toggle('inspect', started && !playing);
      renderSound();
    }

    /* ---------- голос и скорость ---------- */
    function renderSound() {
      const box = $('sound');
      const voices = manifest && manifest.voices.length ? [...manifest.voices, 'off'] : ['system', 'off'];
      const label = (v) => (v === 'off' ? 'Без звука' : v === 'system' ? 'Браузер' : VOICE_NAMES[v] || v);
      const isOn = (v) => v === voice || (v === 'system' && voice !== 'off');
      box.innerHTML = `<b>Голос</b><div class="opts">${voices.map((v) => `<button data-v="${v}" class="${isOn(v) ? 'on' : ''}">${label(v)}</button>`).join('')}</div>
        <b>Скорость</b><div class="opts">${RATES.map((r) => `<button data-r="${r}" class="${r === rate ? 'on' : ''}">${String(r).replace('.', ',')}×</button>`).join('')}</div>`;
      box.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => {
        voice = b.dataset.v === 'system' ? 'dmitry' : b.dataset.v;
        store.setPrefs({ voiceName: voice }); syncButtons();
        if (playing) { hush(); clearTimeout(timer); narrate(); }
      }));
      box.querySelectorAll('[data-r]').forEach((b) => (b.onclick = () => {
        rate = +b.dataset.r; store.setPrefs({ rate }); Speaker.el.playbackRate = rate; syncButtons();
      }));
    }

    function save() {
      const pos = offset(i) + k + 1;
      const st = store.lecture(L.id);
      store.update(L.id, { pos: { i, k }, max: Math.max(st.max || 0, pos) });
      hooks.onProgress && hooks.onProgress();
    }

    $('bPlay').onclick = toggle;
    $('bNext').onclick = next;
    $('bPrev').onclick = prev;
    $('bSet').onclick = (e) => { e.stopPropagation(); $('sound').hidden = !$('sound').hidden; };
    const closeSound = (e) => { if (!e.target.closest('#sound')) $('sound').hidden = true; };
    document.addEventListener('click', closeSound);

    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA/.test(e.target.tagName) || document.querySelector('.wi-layer')) return;
      if (e.key === ' ') { e.preventDefault(); toggle(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    };
    addEventListener('keydown', onKey);
    const onVoices = () => { if (!destroyed) syncButtons(); };
    if (Voice.ok) speechSynthesis.addEventListener('voiceschanged', onVoices);

    /* ---------- старт: шрифты могут менять размеры токенов ---------- */
    const start = () => {
      if (destroyed) return;
      measure();
      const p = saved.pos && scenes[saved.pos.i] ? saved.pos : { i: 0, k: 0 };
      const line = Math.min(p.k, scenes[p.i].lines.length - 1);
      build(p.i, line, true);
      showPoster();
      syncButtons();
      ro.observe(wrap);
    };
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]).then(start);

    return {
      destroy() {
        destroyed = true; playing = false;
        hush(); clearTimeout(timer); ro.disconnect();
        g.WhatIs.close();
        document.removeEventListener('click', closeSound);
        removeEventListener('keydown', onKey);
        if (Voice.ok) speechSynthesis.removeEventListener('voiceschanged', onVoices);
        if (cutS) cutS.kill();
        if (cur) cur.S.kill();
        if (poster._S) poster._S.kill();
      },
      debug: { jump, get pos() { return [i, k]; }, get audio() { return { t: Speaker.el.currentTime, paused: Speaker.el.paused, src: Speaker.el.src.split('/').slice(-2).join('/') }; } },
    };
  };
})(window);

/* app.js — страницы сайта, сохранение прогресса, тест. */
(function (g) {
  const M = g.Motion, B = g.Board, L = g.Lectures, SITE = g.SITE;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const fmtDate = (d) => { const [, m, day] = d.split('-'); return `${day}.${m}`; };

  /* ---------- прогресс: хранится в браузере этого устройства ---------- */
  const KEY = 'naglyadno.v1';
  let mem = {};
  const load = () => { try { mem = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { mem = {}; } };
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* приватный режим */ } };
  load();
  const store = {
    lecture(id) { return (mem.lectures && mem.lectures[id]) || {}; },
    update(id, patch) { mem.lectures = mem.lectures || {}; mem.lectures[id] = { ...this.lecture(id), ...patch }; persist(); },
    prefs() { return mem.prefs || {}; },
    setPrefs(p) { mem.prefs = { ...this.prefs(), ...p }; persist(); },
  };
  const percent = (l) => {
    const st = store.lecture(l.id);
    const lines = l.scenes.reduce((a, s) => a + s.lines.length, 0);
    const watch = Math.min(1, (st.max || 0) / lines);
    const answered = st.quiz ? Object.keys(st.quiz.answers || {}).length / l.test.length : 0;
    return Math.round((watch * .6 + answered * .4) * 100);
  };

  const view = document.getElementById('view');
  const top = document.getElementById('topbar');
  let active = null;

  const ring = (pc) => {
    const R = 19, C = 2 * Math.PI * R;
    return `<div class="ring"><svg viewBox="0 0 46 46"><circle cx="23" cy="23" r="${R}" class="r0"/><circle cx="23" cy="23" r="${R}" class="r1" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pc / 100)}"/></svg><b>${pc}</b></div>`;
  };
  const lectureCard = (l) => {
    const st = store.lecture(l.id), pc = percent(l);
    const status = st.quiz && st.quiz.done ? `Тест: ${st.quiz.score} из ${l.test.length}` : pc ? 'Продолжить' : 'Не начата';
    return `<a class="lcard glass" href="#/lecture/${l.id}">
      <span class="l-n">${String(l.n).padStart(2, '0')}</span>
      <span class="l-body">
        <span class="l-date">лекция ${fmtDate(l.date)}${l.demo ? '<em>пробная тема</em>' : ''}</span>
        <span class="l-title">${l.title}</span>
        <span class="l-status">${status}</span>
      </span>
      ${ring(pc)}
    </a>`;
  };

  /* ---------- шапка, меню, создатель ---------- */
  function renderTop() {
    top.innerHTML = `
      <a class="brand" href="#/" aria-label="${SITE.name}"><svg viewBox="0 0 32 32"><rect width="32" height="32" rx="9.5" fill="#2a1fb0"/><path d="M7 8.5C9.5 20 12.5 24 16 24s6.5-4 9-15.5" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/><circle cx="22.4" cy="17.2" r="3.4" fill="#ef8f1c" stroke="#2a1fb0" stroke-width="1.4"/></svg><span>${SITE.name}</span></a>
      <span class="crumb" id="crumb"></span>
      <nav class="tabs glass" id="tabs" hidden></nav>
      <button class="pill glass" id="menuBtn" data-lens="1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg>Лекции</button>`;
    document.getElementById('menuBtn').onclick = openMenu;
  }
  function sheet(cls, html) {
    const o = M.el(document.body, 'div', 'overlay');
    const p = M.el(o, 'div', 'sheet glass ' + cls, html);
    requestAnimationFrame(() => o.classList.add('in'));
    const close = () => { o.classList.remove('in'); removeEventListener('keydown', esc); setTimeout(() => o.remove(), 340); };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    addEventListener('keydown', esc);
    o.addEventListener('click', (e) => { if (e.target === o || e.target.closest('[data-close]')) close(); });
    return { p, close };
  }
  const closeIcon = '<button class="x" data-close aria-label="Закрыть"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg></button>';
  function openMenu() {
    const { p } = sheet('drawer', `${closeIcon}<h2>Лекции</h2><div class="dlist">${L.all.map(lectureCard).join('')}</div>`);
    p.querySelectorAll('a').forEach((a) => a.setAttribute('data-close', ''));
  }
  function openCreator() {
    const c = SITE.creator;
    sheet('creator', `${closeIcon}
      <span class="kick">Создатель</span>
      <h2>${c.name}</h2>
      <p>${c.about}</p>
      ${c.url ? `<a class="cta" href="${c.url}" target="_blank" rel="noopener">${c.urlLabel}</a>` : `<span class="cta off">${c.urlLabel}: ссылка скоро</span>`}`);
  }
  const footer = () => `<footer class="foot"><button id="creatorBtn">Создатель: ${SITE.creator.name}</button></footer>`;

  /* ---------- главная ---------- */
  function home() {
    document.getElementById('crumb').textContent = '';
    view.innerHTML = `
      <div class="home">
        <section class="hero">
          <div class="hero-copy">
            <div class="h-top" id="hTop">Высшая</div>
            <div class="h-big" id="hBig">математика</div>
            <div class="h-it" id="hIt">которую видно</div>
            <div class="h-org">
              <img src="img/hse.svg" alt="НИУ ВШЭ" width="46" height="46">
              <img src="img/fggt.jpg" alt="ФГГТ" width="46" height="46">
              <span>для студентов <b>${SITE.course.faculty}</b></span>
            </div>
            <p class="h-lead">Лекции по высшей математике для студентов ФГГТ. Каждая лекция превращается в ролик: формулы двигаются, голос объясняет, в конце короткий тест.</p>
            <p class="h-teacher">Преподаватель: <b>${SITE.course.teacher}</b></p>
          </div>
          <div class="hero-graph glass" id="hGraph" data-lens="1"></div>
        </section>
        <section class="list">
          <h2>Лекции</h2>
          ${L.all.map(lectureCard).join('')}
          <div class="lcard ghost"><span class="l-n">${String(L.all.length + 1).padStart(2, '0')}</span><span class="l-body"><span class="l-title">Следующая лекция появится здесь</span></span></div>
        </section>
        <p class="h-note">Студенческий учебный проект. Не официальный сайт НИУ ВШЭ.</p>
        ${footer()}
      </div>`;
    document.getElementById('creatorBtn').onclick = openCreator;
    const S = M.scope();
    if (!reduce) {
      M.type(S, document.getElementById('hTop'), 'whip', { dir: -1, delay: 60 });
      M.type(S, document.getElementById('hBig'), 'fall', { delay: 180, stagger: 48 });
      M.type(S, document.getElementById('hIt'), 'rise', { delay: 900, stagger: 28 });
      view.querySelectorAll('.lcard').forEach((e, i) => M.pop(S, e, { delay: 700 + i * 110, from: .86, y: 50 }));
    }
    heroGraph(S);
    g.Glass.scan();
    active = { destroy() { S.kill(); } };
  }

  /* живой график: точка едет по кривой, касательная и значение производной следуют за ней */
  function heroGraph(S) {
    const host = document.getElementById('hGraph');
    const W = 520, H = 400;
    const svg = M.svg(host, 'svg', { viewBox: `0 0 ${W} ${H}`, class: 'hg' });
    const f = (x) => .22 * x * x * x - 1.1 * x + 0.1, df = (x) => .66 * x * x - 1.1;
    const X = (v) => W / 2 + v * 92, Y = (v) => H / 2 + 20 - v * 62;
    const ax = (d) => M.svg(svg, 'path', { d, stroke: 'var(--ink)', 'stroke-width': 2, fill: 'none', opacity: .55 });
    M.draw(S, ax(`M16 ${Y(0)} L${W - 16} ${Y(0)}`), { dur: 900, delay: 300 });
    M.draw(S, ax(`M${X(0)} ${H - 12} L${X(0)} 12`), { dur: 900, delay: 400 });
    let d = '';
    for (let i = 0; i <= 140; i++) { const x = -2.7 + i * 5.4 / 140; d += `${i ? 'L' : 'M'}${X(x).toFixed(1)} ${Y(f(x)).toFixed(1)}`; }
    const curve = M.svg(svg, 'path', { d, stroke: 'var(--indigo)', 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round' });
    M.draw(S, curve, { dur: 1500, delay: 500 });
    const tan = M.svg(svg, 'line', { stroke: 'var(--orange)', 'stroke-width': 4, 'stroke-linecap': 'round' });
    const halo = M.svg(svg, 'circle', { r: 20, fill: 'var(--orange)', opacity: .22 });
    const dot = M.svg(svg, 'circle', { r: 9, fill: 'var(--orange)', stroke: '#fff', 'stroke-width': 3 });
    const read = M.el(host, 'div', 'hg-read');
    read.appendChild(B.tex("f'(x)=")); const val = M.el(read, 'b', '', '');
    const place = (x) => {
      const y = f(x), m = df(x), L0 = 1.15 / Math.hypot(1, m * 62 / 92);
      tan.setAttribute('x1', X(x - L0)); tan.setAttribute('y1', Y(y - m * L0));
      tan.setAttribute('x2', X(x + L0)); tan.setAttribute('y2', Y(y + m * L0));
      dot.setAttribute('cx', X(x)); dot.setAttribute('cy', Y(y));
      halo.setAttribute('cx', X(x)); halo.setAttribute('cy', Y(y));
      val.textContent = m.toFixed(2).replace('.', ',').replace('-', '−');
    };
    place(-1.6);
    if (!reduce) S.loop((t) => place(Math.sin(t * .55) * 2.1));
  }

  /* ---------- вкладки лекции ---------- */
  const TABS = [['', 'Урок'], ['/notes', 'Конспект'], ['/sheet', 'Шпора'], ['/test', 'Тест']];
  function renderTabs(id, cur) {
    const nav = document.getElementById('tabs');
    if (!id) { nav.hidden = true; return; }
    nav.hidden = false;
    nav.innerHTML = `<i class="tab-ink"></i>` + TABS.map(([p, t]) => `<a href="#/lecture/${id}${p}" class="${p === cur ? 'on' : ''}">${t}</a>`).join('');
    const place = () => {
      const on = nav.querySelector('.on'), ink = nav.querySelector('.tab-ink');
      if (on && ink) { ink.style.width = on.offsetWidth + 'px'; ink.style.transform = `translateX(${on.offsetLeft}px)`; }
    };
    requestAnimationFrame(place);
    document.fonts.ready.then(place);
    if (!nav._ro) { nav._ro = new ResizeObserver(place); nav._ro.observe(nav); }
  }

  function doc(id, kind) {
    const l = L.get(id);
    if (!l || !l[kind === 'notes' ? 'notes' : 'sheet']) { location.hash = '#/'; return; }
    document.getElementById('crumb').textContent = `Лекция ${l.n} · ${fmtDate(l.date)}`;
    if (kind === 'notes') g.Docs.renderNotes(view, l, fmtDate, openCreator); else g.Docs.renderSheet(view, l, openCreator);
    active = { destroy() { g.WhatIs.close(); } };
  }

  /* для tools/build.py: список реплик на озвучку */
  function exportData() {
    const data = L.all.map((l) => ({ id: l.id, lines: l.scenes.flatMap((s, i) => s.lines.map((x, k) => ({ key: `${i}.${k}`, say: x.say || x.t.replace(/\$/g, '') }))) }));
    view.innerHTML = '<pre id="export"></pre>';
    document.getElementById('export').textContent = JSON.stringify(data);
  }

  /* ---------- звуки ответов: синтез, без файлов ---------- */
  const Sfx = {
    ctx: null,
    get on() { return store.prefs().sfx !== false; },
    note(f, t, d, type, vol) {
      const c = this.ctx, o = c.createOscillator(), a = c.createGain();
      o.type = type; o.frequency.value = f;
      a.gain.setValueAtTime(0, c.currentTime + t);
      a.gain.linearRampToValueAtTime(vol, c.currentTime + t + .012);
      a.gain.exponentialRampToValueAtTime(.0008, c.currentTime + t + d);
      o.connect(a).connect(c.destination);
      o.start(c.currentTime + t); o.stop(c.currentTime + t + d + .02);
    },
    play(ok) {
      if (!this.on) return;
      try {
        this.ctx = this.ctx || new (g.AudioContext || g.webkitAudioContext)();
        this.ctx.resume();
        if (ok) { this.note(784, 0, .28, 'sine', .22); this.note(1175, .09, .42, 'sine', .2); this.note(2350, .09, .3, 'sine', .04); }
        else { this.note(233, 0, .2, 'triangle', .28); this.note(175, .13, .34, 'triangle', .28); }
      } catch (e) { /* без звука */ }
    },
  };

  /* ---------- лекция ---------- */
  function lecture(id) {
    const l = L.get(id);
    if (!l) { location.hash = '#/'; return; }
    document.getElementById('crumb').textContent = `Лекция ${l.n} · ${fmtDate(l.date)}`;
    const p = g.Player(view, l, store, { fmtDate });
    g.__player = p;
    g.Glass.scan();
    active = p;
  }

  /* ---------- тест ---------- */
  const TICK = '<svg class="mark ok" viewBox="0 0 60 60"><circle cx="30" cy="30" r="26"/><path d="M17 31l9 9 18-20"/></svg>';
  const CROSS = '<svg class="mark no" viewBox="0 0 60 60"><circle cx="30" cy="30" r="26"/><path d="M20 20l20 20M40 20L20 40"/></svg>';

  function test(id) {
    const l = L.get(id);
    if (!l) { location.hash = '#/'; return; }
    document.getElementById('crumb').textContent = `Тест · лекция ${l.n}`;
    let q = store.lecture(id).quiz || { answers: {}, at: 0 };
    const S = M.scope();
    active = { destroy() { S.kill(); } };
    const save = () => store.update(id, { quiz: q });
    const qs = l.test;

    view.innerHTML = `<div class="test"><div class="t-track" id="tTrack"></div><div class="t-card glass" id="tCard"></div>${footer()}</div>`;
    document.getElementById('creatorBtn').onclick = openCreator;
    const track = document.getElementById('tTrack'), card = document.getElementById('tCard');

    function renderTrack() {
      track.innerHTML = qs.map((_, n) => {
        const a = q.answers[n];
        return `<button class="dot ${a ? (a.ok ? 'ok' : 'no') : ''} ${n === q.at && !q.done ? 'cur' : ''}" data-n="${n}" aria-label="Вопрос ${n + 1}">${a ? (a.ok ? '✓' : '✕') : n + 1}</button>`;
      }).join('');
      track.querySelectorAll('.dot').forEach((b) => (b.onclick = () => { q.done = false; q.at = +b.dataset.n; save(); show(); }));
    }

    function record(n, value, ok) {
      q.answers[n] = { value, ok };
      save(); renderTrack(); Sfx.play(ok);
    }

    function feedback(n) {
      const a = q.answers[n], item = qs[n];
      const fb = card.querySelector('.t-fb');
      fb.innerHTML = `${a.ok ? TICK : CROSS}<div><b>${a.ok ? 'Верно' : 'Неверно'}</b><p class="why"></p></div>`;
      B.rich(fb.querySelector('.why'), item.why);
      fb.classList.add('in', a.ok ? 'good' : 'bad');
      const last = n === qs.length - 1;
      const nb = card.querySelector('.t-next');
      nb.innerHTML = `<button class="cta">${last ? 'Показать результат' : 'Дальше'}</button>`;
      nb.firstChild.onclick = () => {
        const firstOpen = qs.findIndex((_, x) => !q.answers[x]);
        if (last && firstOpen === -1) return results();
        q.at = last ? firstOpen : n + 1; save(); show();
      };
      if (a.ok) burst(fb.querySelector('.mark'));
    }
    function burst(el) {
      if (reduce || !el) return;
      S.anim({ dur: 620, ease: E_spring, on(v) { el.style.transform = `scale(${M.lerp(.2, 1, v)})`; }, done() { el.style.transform = ''; } });
    }
    const E_spring = M.ease.spring;

    function show() {
      const n = q.at, item = qs[n], a = q.answers[n];
      renderTrack();
      card.innerHTML = `<button class="sfx" id="sfx" aria-label="Звуки ответов">${Sfx.on ? g.ICON.on : g.ICON.off}</button><div class="t-sec">${item.section} · вопрос ${n + 1} из ${qs.length}</div><h2 class="t-q"></h2><div class="t-body"></div><div class="t-fb"></div><div class="t-next"></div>`;
      B.rich(card.querySelector('.t-q'), item.q);
      card.querySelector('#sfx').onclick = (e) => { store.setPrefs({ sfx: !Sfx.on }); e.currentTarget.innerHTML = Sfx.on ? g.ICON.on : g.ICON.off; if (Sfx.on) Sfx.play(true); };
      const body = card.querySelector('.t-body');
      if (item.type === 'choice') {
        item.options.forEach((o, x) => {
          const b = M.el(body, 'button', 'opt');
          if (o.tex) b.appendChild(B.tex(o.tex)); else b.textContent = o.text;
          b.onclick = () => { if (q.answers[n]) return; record(n, x, !!o.ok); paint(); feedback(n); };
        });
        const paint = () => {
          const ans = q.answers[n]; if (!ans) return;
          [...body.children].forEach((b, x) => {
            b.disabled = true;
            if (item.options[x].ok) b.classList.add('right');
            else if (x === ans.value) b.classList.add('wrong');
          });
        };
        paint();
      } else if (item.type === 'tf') {
        body.classList.add('tf');
        [[true, 'Верно', TICK], [false, 'Неверно', CROSS]].forEach(([v, label, icon]) => {
          const b = M.el(body, 'button', 'opt tfb', `${icon}<span>${label}</span>`);
          b.dataset.v = v;
          b.onclick = () => { if (q.answers[n]) return; record(n, v, v === item.answer); paint(); feedback(n); };
        });
        const paint = () => {
          const ans = q.answers[n]; if (!ans) return;
          [...body.children].forEach((b) => {
            b.disabled = true;
            const v = b.dataset.v === 'true';
            if (v === item.answer) b.classList.add('right');
            else if (v === ans.value) b.classList.add('wrong');
          });
        };
        paint();
      } else {
        gapQuestion(n, item, body);
      }
      if (a) feedback(n);
      if (!reduce) M.pop(S, card, { from: .94, y: 26, dur: 700 });
    }

    function gapQuestion(n, item, body) {
      const a0 = q.answers[n];
      const vals = a0 ? { ...a0.value } : {};
      const ids = Object.keys(item.answers);
      const fHost = M.el(body, 'div', 'gapf');
      const rack = M.el(body, 'div', 'gaprack');
      const check = M.el(body, 'button', 'cta check', 'Проверить');
      function draw() {
        let tex = item.tex;
        ids.forEach((id) => { if (vals[id] !== undefined) tex = tex.replace(`\\gap{${id}}`, `\\gap{${id}}{${vals[id]}}`); });
        fHost.textContent = '';
        fHost.appendChild(B.tex(tex));
        const gaps = fHost.querySelectorAll('.gap');
        gaps.forEach((gEl, x) => {
          const id = ids[x];
          if (a0) gEl.classList.add(String(vals[id]) === item.answers[id] ? 'right' : 'wrong');
          else gEl.onclick = () => { delete vals[id]; draw(); };
        });
        check.disabled = !!a0 || ids.some((id) => vals[id] === undefined);
        check.style.display = a0 ? 'none' : '';
      }
      item.chips.forEach((v) => {
        const b = M.el(rack, 'button', 'chip');
        b.appendChild(B.tex(v));
        b.disabled = !!a0;
        b.onclick = () => {
          const id = ids.find((x) => vals[x] === undefined);
          if (!id) return;
          vals[id] = v; draw();
          if (!reduce) { const gEl = fHost.querySelectorAll('.gap')[ids.indexOf(id)]; S.anim({ dur: 500, ease: M.ease.linear, on(_, p) { const k = Math.exp(-5 * p) * Math.cos(16 * p) * .22; gEl.style.transform = `scale(${1 + k},${1 - k})`; }, done() { gEl.style.transform = ''; } }); }
        };
      });
      check.onclick = () => {
        const ok = ids.every((id) => String(vals[id]) === item.answers[id]);
        record(n, { ...vals }, ok);
        show();
      };
      draw();
    }

    function results() {
      const score = qs.filter((_, n) => q.answers[n] && q.answers[n].ok).length;
      q.done = true; q.score = score; save();
      renderTrack();
      card.innerHTML = `<div class="t-sec">Результат</div><div class="res-n" id="resN"></div><p class="res-t">правильных ответов из ${qs.length}</p>
        <div class="res-b"><button class="cta" id="again">Пройти заново</button><a class="cta alt" href="#/lecture/${id}">К лекции</a><a class="cta alt" href="#/">Все лекции</a></div>`;
      M.count(S, document.getElementById('resN'), score, { dur: 900 });
      document.getElementById('again').onclick = () => { q = { answers: {}, at: 0 }; save(); show(); };
    }

    if (q.done) results(); else show();
  }

  /* ---------- маршруты ---------- */
  function route() {
    if (active) { active.destroy(); active = null; }
    document.querySelectorAll('.overlay').forEach((o) => o.remove());
    const h = location.hash.replace(/^#\/?/, '');
    const parts = h.split('/').filter(Boolean);
    const sub = parts[0] === 'lecture' ? parts[2] || '' : null;
    document.body.dataset.page = sub === null ? 'home' : sub === 'test' ? 'test' : sub ? 'doc' : 'lesson';
    renderTabs(sub === null ? null : parts[1], sub ? '/' + sub : '');
    scrollTo(0, 0);
    if (parts[0] === 'pdf-foot') { document.body.dataset.page = 'pdffoot'; view.innerHTML = `<div class="pdf-foot">Скачано с сайта «${SITE.name}» · Создатель: ${SITE.creator.name}</div>`; }
    else if (parts[0] === 'export') exportData();
    else if (sub === 'notes' || sub === 'sheet') doc(parts[1], sub);
    else if (parts[0] === 'lecture' && parts[2] === 'test') test(parts[1]);
    else if (parts[0] === 'lecture') lecture(parts[1]);
    else home();
  }
  /* ---------- тихое автообновление: без плашек ---------- */
  const BUILD = (document.querySelector('meta[name=build]') || {}).content || 'dev';
  let fresh = false;
  async function checkBuild() {
    if (BUILD === 'dev' || fresh) return;
    try {
      const html = await (await fetch('./?_=' + Date.now(), { cache: 'no-store' })).text();
      const m = html.match(/<meta name="build" content="(\w+)">/);
      if (m && m[1] !== BUILD) fresh = true;
    } catch (e) { /* нет сети */ }
  }
  const reloadIfFresh = () => { if (fresh) location.reload(); };
  addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') { await checkBuild(); reloadIfFresh(); }
  });
  setInterval(checkBuild, 5 * 60 * 1000);
  checkBuild();

  renderTop();
  g.Glass.scan();
  addEventListener('hashchange', () => { if (fresh) { location.reload(); return; } route(); });
  route();
})(window);

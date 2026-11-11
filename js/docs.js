/* docs.js — конспект и шпора: обычные страницы, которые можно скачать в PDF. */
(function (g) {
  const B = g.Board;
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const rich = (tag, cls, str) => { const e = document.createElement(tag); if (cls) e.className = cls; B.rich(e, str); return e; };
  const math = (tex, cls = 'd-f') => { const e = document.createElement('div'); e.className = cls; e.appendChild(B.tex(tex)); return e; };
  const DL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/></svg>';

  function toolbar(view, L, kind, label, hint) {
    const has = g.AudioManifest && g.AudioManifest[L.id] && g.AudioManifest[L.id].pdf && g.AudioManifest[L.id].pdf[kind];
    const bar = document.createElement('div');
    bar.className = 'doc-bar';
    bar.innerHTML = `<p>${hint}</p>` + (has
      ? `<a class="cta" href="${g.AudioManifest[L.id].pdf[kind]}" download="${label} — лекция ${L.n}.pdf">${DL}Скачать PDF</a>`
      : `<button class="cta" id="printDoc">${DL}Сохранить в PDF</button>`);
    view.appendChild(bar);
    const p = bar.querySelector('#printDoc');
    if (p) p.onclick = () => print();
  }

  /* подпись внизу: на странице скромная ссылка, в PDF печатается на каждом листе */
  function footer(page, openCreator) {
    const c = g.SITE.creator, f = document.createElement('footer');
    f.className = 'doc-foot';
    f.append(`Скачано с сайта «${g.SITE.name}» · `);
    const who = `Создатель: ${c.name}`;
    let el;
    if (c.url) { el = document.createElement('a'); el.href = c.url; el.target = '_blank'; el.rel = 'noopener'; }
    else { el = document.createElement('button'); el.onclick = openCreator; }
    el.textContent = who;
    f.appendChild(el);
    page.appendChild(f);
  }

  function renderNotes(view, L, fmtDate, openCreator) {
    view.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'doc';
    view.appendChild(wrap);
    toolbar(wrap, L, 'notes', 'Конспект', 'Обычный конспект без анимации. Нажми на символ в формуле, чтобы узнать, что он значит.');
    const page = document.createElement('article');
    page.className = 'paper-sheet notes';
    wrap.appendChild(page);
    const N = L.notes;
    page.innerHTML = `<header class="n-head"><div>${esc(N.course)}</div><h1>Лекция ${L.n}. ${esc(L.title)}</h1><div class="n-date">${fmtDate(L.date)}.${L.date.slice(0, 4)}</div></header>`;
    let sec = 0; const sub = { ex: 0, fig: 0 };
    N.blocks.forEach((b) => {
      if (b.h) { sec++; const h = document.createElement('h2'); h.textContent = `${sec}. ${b.h}`; page.appendChild(h); }
      else if (b.p) page.appendChild(rich('p', '', b.p));
      else if (b.f) page.appendChild(math(b.f));
      else if (b.def) {
        const kind = b.kind || 'Определение';
        sub[kind] = (sub[kind] || 0) + 1;
        const d = document.createElement('section'); d.className = 'n-def';
        d.innerHTML = `<b>${kind} ${sub[kind]}.</b> `;
        d.appendChild(rich('span', '', b.def));
        if (b.tex) d.appendChild(math(b.tex));
        page.appendChild(d);
      } else if (b.ex) {
        sub.ex++;
        const d = document.createElement('section'); d.className = 'n-ex';
        d.appendChild(rich('p', 'n-q', `Пример ${sub.ex}. ${b.ex}`));
        b.steps.forEach((s) => d.appendChild(math(s, 'd-f left')));
        page.appendChild(d);
      } else if (b.fig) {
        sub.fig++;
        const f = document.createElement('figure');
        f.innerHTML = L.figs[b.fig]();
        f.appendChild(rich('figcaption', '', `Рис. ${sub.fig}. ${b.cap}`));
        page.appendChild(f);
      } else if (b.table) {
        const t = document.createElement('table');
        const add = (cells, tag) => { const tr = t.insertRow(); cells.forEach((c) => { const td = document.createElement(tag); B.rich(td, c); tr.appendChild(td); }); };
        add(b.table[0], 'th'); b.table.slice(1).forEach((r) => add(r, 'td'));
        page.appendChild(t);
      } else if (b.warn) page.appendChild(rich('p', 'n-warn', b.warn));
      else if (b.list) { const u = document.createElement('ul'); b.list.forEach((x) => u.appendChild(rich('li', '', x))); page.appendChild(u); }
    });
    footer(page, openCreator);
    g.WhatIs.attach(page);
  }

  function renderSheet(view, L, openCreator) {
    view.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'doc';
    view.appendChild(wrap);
    toolbar(wrap, L, 'sheet', 'Шпора', 'Только формулы, одна страница.');
    const page = document.createElement('article');
    page.className = 'paper-sheet sheet-doc';
    wrap.appendChild(page);
    page.innerHTML = `<header class="s-head"><h1>ШПОРА</h1><div><b>Лекция ${L.n}</b><span>${esc(L.title)}</span></div></header>`;
    const cols = document.createElement('div');
    cols.className = 's-cols';
    page.appendChild(cols);
    L.sheet.forEach((blk) => {
      const s = document.createElement('section');
      s.className = 's-box' + (blk.main ? ' main' : '') + (blk.warn ? ' warn' : '');
      const h = document.createElement('h2'); h.textContent = blk.h; s.appendChild(h);
      blk.items.forEach((it) => {
        const row = document.createElement('div'); row.className = 's-row';
        const tex = typeof it === 'string' ? it : it.tex;
        row.appendChild(B.tex(tex));
        if (it.note) row.appendChild(rich('span', 's-note', it.note));
        s.appendChild(row);
      });
      cols.appendChild(s);
    });
    footer(page, openCreator);
    g.WhatIs.attach(page);
  }

  g.Docs = { renderNotes, renderSheet };
})(window);

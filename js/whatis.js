/* whatis.js — плашка «Что это?»: нажал на символ, рассказ встал, выплыло объяснение.
   Порядок поиска: пояснение к этой реплике → к сцене → общий словарь → по положению в формуле. */
(function (g) {
  const B = g.Board;

  /* общий словарь: что символ значит всегда */
  const G = {
    '=': { name: 'Равно', what: 'Слева и справа стоит одно и то же значение, просто записанное по-разному.', why: 'Правую часть получили из левой только разрешёнными действиями, значение от этого не изменилось.' },
    '≠': { name: 'Не равно', what: 'Левая и правая части дают разные значения.' },
    '≈': { name: 'Примерно равно', what: 'Значения почти совпадают, число округлено.' },
    '+': { name: 'Плюс', what: 'Сложение двух выражений.' },
    '−': { name: 'Минус', what: 'Вычитание, или знак отрицательного числа.' },
    'sup:−': { name: 'Минус в показателе', what: 'Отрицательная степень переворачивает дробь: выражение уходит в знаменатель.', ex: 'x^{-2}=\\frac{1}{x^2}' },
    '·': { name: 'Умножение', what: 'Точка в формулах значит «умножить». Часто её вообще не пишут: 2x это 2·x.' },
    '(': { name: 'Скобка', what: 'Показывает, что действие относится ко всему выражению внутри.' },
    ')': { name: 'Скобка', what: 'Показывает, что действие относится ко всему выражению внутри.' },
    '′': { name: 'Штрих', what: 'Значит «производная». f′(x) читается «эф штрих от икс»: как быстро меняется f в точке x.' },
    'Δ': { name: 'Дельта', what: 'Греческая буква, которой обозначают изменение. Δx значит «на сколько изменился x»: конец минус начало.', ex: '\\Delta x=x_2-x_1' },
    '→': { name: 'Стремится к', what: 'Значение подходит сколь угодно близко, но не обязано становиться равным.' },
    'lim': { name: 'Предел', what: 'От латинского limes, «граница». Значение, к которому выражение приближается, когда переменная подходит к указанному числу. Что подходит и к чему, написано снизу.' },
    'ln': { name: 'Натуральный логарифм', what: 'Логарифм по основанию e, где e ≈ 2,718. ln a отвечает на вопрос: в какую степень возвести e, чтобы получить a.', ex: '\\ln2\\approx0,693' },
    'bar': { name: 'Дробная черта', what: 'То же самое, что деление: верхнее делим на нижнее.' },
    'rad': { name: 'Квадратный корень', what: '√a это число, которое при умножении на себя даёт a. То же самое, что степень одна вторая.', ex: '\\sqrt{x}=x^{\\frac{1}{2}}' },
    'gap': { name: 'Пустая ячейка', what: 'Сюда подставляется конкретное число. Шаблон один, числа разные.' },
    '?': { name: 'Неизвестно', what: 'Значение пока не определено.' },
    x: { name: 'Икс', what: 'Переменная, аргумент функции: число, которое мы подставляем.' },
    y: { name: 'Игрек', what: 'Значение функции: что получилось после подстановки x.' },
    f: { name: 'Функция', what: 'Правило, которое каждому x ставит в соответствие одно число f(x).' },
    h: { name: 'Аш', what: 'Маленький сдвиг по x. Короткая запись для Δx.' },
    n: { name: 'Буква n', what: 'Натуральное число. Обычно так обозначают число столбцов матрицы или порядок квадратной матрицы.' },
    m: { name: 'Буква m', what: 'Натуральное число. Обычно так обозначают число строк матрицы.' },
    l: { name: 'Буква l', what: 'Число столбцов второй матрицы в произведении.' },
    i: { name: 'Индекс i', what: 'Номер строки, в которой стоит элемент.' },
    j: { name: 'Индекс j', what: 'Номер столбца, в котором стоит элемент.' },
    k: { name: 'Буква k', what: 'Номер или натуральное число. В произведении это номер столбца результата, в степени — сколько раз умножаем.' },
    s: { name: 'Буква s', what: 'Сколько всего строк (столбцов) участвует в комбинации.' },
    A: { name: 'Матрица A', what: 'Заглавной латинской буквой обозначают всю матрицу целиком.' },
    B: { name: 'Матрица B', what: 'Заглавной латинской буквой обозначают всю матрицу целиком.' },
    C: { name: 'Матрица C', what: 'Заглавной латинской буквой обозначают всю матрицу целиком.' },
    E: { name: 'Единичная матрица E', what: 'Квадратная матрица: на главной диагонали единицы, остальное нули. При умножении ведёт себя как число 1.', ex: '\\mat{1&0\\\\0&1}' },
    O: { name: 'Нулевая матрица O', what: 'Все элементы равны нулю. При сложении ведёт себя как число 0.' },
    a: { name: 'Элемент матрицы', what: 'Строчная буква с двумя индексами: первый — номер строки, второй — номер столбца.', ex: 'a_{23}' },
    b: { name: 'Элемент матрицы', what: 'Элемент матрицы B. Первый индекс — строка, второй — столбец.' },
    c: { name: 'Элемент матрицы', what: 'Элемент матрицы C (результата). Первый индекс — строка, второй — столбец.' },
    'sup:T': { name: 'Транспонирование', what: 'Буква T вверху значит «транспонировать»: строки становятся столбцами с сохранением порядка.' },
    'λ': { name: 'Лямбда', what: 'Греческая буква, которой обозначают обычное число (не матрицу).' },
    'μ': { name: 'Мю', what: 'Ещё одно обычное число, как и λ.' },
    '∑': { name: 'Сумма', what: 'Большая греческая сигма: сложить все слагаемые, номер пробегает значения от нижнего до верхнего.', ex: '\\sum_{j=1}^{3}x_j=x_1+x_2+x_3' },
    '×': { name: 'Размер «на»', what: 'В размере матрицы сначала число строк, потом число столбцов. 2×3 читается «два на три».' },
    '…': { name: 'Многоточие', what: 'И так далее: пропущенные элементы идут по тому же правилу.' },
    '⋯': { name: 'Многоточие', what: 'И так далее по строке.' },
    '⋮': { name: 'Многоточие', what: 'И так далее по столбцу.' },
    '⋱': { name: 'Многоточие', what: 'И так далее по диагонали.' },
    ';': { name: 'Разделитель', what: 'Отделяет элементы строки друг от друга.' },
    'matparen': { name: 'Скобки матрицы', what: 'Всё, что внутри круглых скобок, — одна матрица, одна таблица чисел.' },
    P: { name: 'Точка P', what: 'Точка на графике, в которой мы ищем наклон. Она неподвижна.' },
    Q: { name: 'Точка Q', what: 'Вторая точка на графике. Она двигается к P.' },
    'км/ч': { name: 'Километры в час', what: 'Единица скорости: сколько километров проходится за час.' },
    'counter': { name: 'Счётчик', what: 'Число на доске растёт до нужного значения.' },
    'парабола': { name: 'Парабола', what: 'График функции y = x². Похожа на чашу: при больших x растёт всё быстрее.' },
    'секущая': { name: 'Секущая', what: 'Прямая, проходящая через две точки графика. От латинского secare, «резать»: она разрезает кривую.' },
    'касательная': { name: 'Касательная', what: 'Прямая, которая в точке идёт ровно по направлению графика. Предельное положение секущей.' },
    'наклон': { name: 'Наклон', what: 'Насколько прямая поднимается на один шаг вправо. Считается как Δy делить на Δx.' },
    'производная': { name: 'Производная', what: 'Скорость изменения функции в одной точке. На графике это наклон касательной.' },
    'сейчас?': { name: 'Мгновенная скорость', what: 'Скорость в один конкретный момент, а не в среднем за поездку.' },
    'ловушка': { name: 'Ловушка', what: 'Частая ошибка, на которой легко потерять баллы.' },
    'степенная': { name: 'Степенная функция', what: 'x в основании, показатель число. Например x³.' },
    'показательная': { name: 'Показательная функция', what: 'Число в основании, x в показателе. Например 2ˣ.' },
    'ось x': { name: 'Ось x', what: 'Горизонтальная ось: значения аргумента.' },
    'ось y': { name: 'Ось y', what: 'Вертикальная ось: значения функции.' },
    'катет x': { name: 'Сдвиг Δx', what: 'На сколько сдвинулись вправо от P к Q.' },
    'катет y': { name: 'Подъём Δy', what: 'На сколько поднялись от P к Q.' },
    'tick': { name: 'Деление на оси', what: 'Отметка на оси, по которой читают координаты.' },
    'rack': { name: 'Фишка с вариантом', what: 'Один из вариантов числа для ячеек шаблона. Подходит только показатель степени из примера.' },
  };

  function info(el) {
    const chip = el.closest('.chip');
    const cell = el.closest('.mc');
    if (cell && !chip) {
      const mat = cell.closest('.mat'), [r, q] = cell.dataset.rc.split(','), nm = (mat.dataset.n || '').replace('^T', '');
      const w = el.dataset.w || '';
      const keys = [nm && `cell:${nm}${r}${q}`, `cell:${w}`, w].filter(Boolean);
      const letter = nm ? nm[0].toLowerCase() : 'a';
      return { w, keys, cell: { r, q, letter, tr: (mat.dataset.n || '').endsWith('^T') } };
    }
    if (chip) return { w: chip.dataset.v, keys: ['rack:' + chip.dataset.v, 'rack'], chip: true };
    const w = el.dataset.w || '';
    const host = el.closest('[data-c]');
    const pos = el.closest('.sup') ? 'sup' : el.closest('.sub,.below') ? 'sub' : el.closest('.num-r') ? 'num' : el.closest('.den-r') ? 'den' : null;
    const c = host && host.dataset.c;
    return { w, pos, keys: [c && `${c}:${w}`, pos && `${pos}:${w}`, w, c].filter(Boolean) };
  }

  function contextual(keys, ctx) {
    if (!ctx || !ctx.L || !ctx.L.why) return null;
    const sc = ctx.L.why[ctx.i];
    if (!sc) return null;
    for (const key of keys) {
      for (let n = ctx.k; n >= 0; n--) if (sc[n] && sc[n][key]) return sc[n][key];
      if (sc['*'] && sc['*'][key]) return sc['*'][key];
    }
    return null;
  }

  function resolve(el, ctx) {
    const t = info(el);
    let gl = null;
    for (const key of t.keys) if (G[key]) { gl = G[key]; break; }
    const here = contextual(t.keys, ctx);
    const isNum = /^\d/.test(t.w);
    let name = gl && gl.name, what = gl && gl.what;
    if (t.cell && (isNum || t.w === '−')) {
      name = `Элемент в строке ${t.cell.r}, столбце ${t.cell.q}`;
      what = `Он стоит на пересечении ${t.cell.r}-й строки и ${t.cell.q}-го столбца. Обозначается $${t.cell.letter}${t.cell.tr ? '^T' : ''}_{${t.cell.r}${t.cell.q}}$.`;
    } else if (isNum && !t.chip) {
      name = t.pos === 'sup' ? 'Показатель степени' : t.pos === 'den' ? 'Знаменатель' : t.pos === 'num' ? 'Числитель' : 'Число';
      what = t.pos === 'sup' ? 'Сколько раз основание умножается само на себя.' : t.pos === 'den' ? 'Нижняя часть дроби: на что делим.' : t.pos === 'num' ? 'Верхняя часть дроби: что делим.' : '';
    }
    if (!name) { name = t.w; what = 'Обозначение из этой формулы. Что оно значит, сказано в тексте рядом.'; }
    return { ...t, name, what, here: here || (gl && gl.why) || '', ex: gl && gl.ex };
  }

  const CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>';
  const isWord = (w) => /^[а-яёА-ЯЁ]/.test(w) || w === 'counter' || w === 'tick';

  g.WhatIs = {
    /* el: нажатый элемент, ctx: { L, i, k }, opts.onClose вызывается при закрытии */
    show(el, ctx, opts = {}) {
      this.close();
      const r = resolve(el, ctx);
      const box = el.getBoundingClientRect();
      const layer = document.createElement('div');
      layer.className = 'wi-layer';
      const pad = 6;
      const svgEl = el instanceof SVGElement && el.tagName !== 'g';
      const mark = svgEl ? null : document.createElement('div');
      if (mark) {
        mark.className = 'wi-mark';
        mark.style.cssText = `left:${box.left - pad}px;top:${box.top - pad}px;width:${box.width + pad * 2}px;height:${box.height + pad * 2}px`;
        layer.appendChild(mark);
      }
      const card = document.createElement('div');
      card.className = 'wi-card glass';
      card.setAttribute('role', 'dialog');
      card.innerHTML = `<button class="x" aria-label="Закрыть">${CLOSE}</button>
        <div class="wi-top"><div class="wi-sym"></div><div><span class="wi-k">Что это?</span><h3></h3></div></div>
        <p class="wi-what"></p><div class="wi-here"></div>
        <button class="cta wi-go">${opts.resume ? 'Продолжить рассказ' : 'Понятно'}</button>`;
      const sym = card.querySelector('.wi-sym');
      if (r.chip) sym.appendChild(B.tex(r.w));
      else if (r.w === 'bar') sym.textContent = '—';
      else if (r.w === 'rad') sym.textContent = '√';
      else if (r.w === 'gap') sym.innerHTML = '<span class="f"><span class="gap"></span></span>';
      else if (isWord(r.w) || r.w.length > 5) sym.remove();
      else sym.textContent = r.w;
      card.querySelector('h3').textContent = r.name;
      const what = card.querySelector('.wi-what');
      if (r.what) B.rich(what, r.what); else what.remove();
      if (r.ex) card.querySelector('.wi-what') ? what.appendChild(Object.assign(document.createElement('span'), { className: 'wi-ex' })).appendChild(B.tex(r.ex)) : 0;
      const here = card.querySelector('.wi-here');
      if (r.here) { const b = document.createElement('b'); b.textContent = 'Почему здесь'; const p = document.createElement('p'); B.rich(p, r.here); here.append(b, p); } else here.remove();
      layer.appendChild(card);
      document.body.appendChild(layer);

      if (innerWidth > 900) {
        const w = card.offsetWidth, h = card.offsetHeight, m = 14;
        let x = box.right + 18;
        if (x + w > innerWidth - m) x = box.left - w - 18;
        if (x < m) x = Math.min(innerWidth - w - m, Math.max(m, box.left));
        let y = Math.min(innerHeight - h - m, Math.max(76, box.top + box.height / 2 - h / 2));
        card.style.left = x + 'px'; card.style.top = y + 'px';
        card.style.transformOrigin = `${box.left + box.width / 2 - x}px ${box.top + box.height / 2 - y}px`;
      } else card.classList.add('sheet-mode');
      requestAnimationFrame(() => layer.classList.add('in'));

      const close = () => this.close();
      layer.addEventListener('click', (e) => { if (e.target === layer || e.target.closest('.x,.wi-go')) close(); });
      const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
      addEventListener('keydown', esc);
      this._close = () => {
        removeEventListener('keydown', esc);
        layer.classList.remove('in');
        setTimeout(() => layer.remove(), 220);
        opts.onClose && opts.onClose();
      };
    },
    close() { if (this._close) { const c = this._close; this._close = null; c(); } },
    /* для конспекта и шпоры: нажатие на символ в готовой странице */
    attach(root) {
      root.addEventListener('click', (e) => {
        const t = e.target.closest('.f [data-w]');
        if (t) this.show(t, null);
      });
    },
  };
})(window);

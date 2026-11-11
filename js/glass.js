/* glass.js — настоящее преломление по краю для элементов [data-lens].
   Работает в Chrome и Edge на компьютере. В Safari и на телефонах остаётся обычное размытое стекло. */
(function (g) {
  const brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
  const chromium = brands.some((b) => /chromium/i.test(b.brand)) || /Chrome\//.test(navigator.userAgent);
  const able = chromium && !matchMedia('(pointer: coarse)').matches && CSS.supports('backdrop-filter', 'url(#a)');
  const NS = 'http://www.w3.org/2000/svg';
  let root, n = 0;

  function map(w, h, radius, depth) {
    const s = 3, cw = Math.max(8, Math.ceil(w / s)), ch = Math.max(8, Math.ceil(h / s));
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(cw, ch), d = img.data;
    const r = Math.min(radius, w / 2, h / 2);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const px = (x + .5) * s - w / 2, py = (y + .5) * s - h / 2;
      const qx = Math.abs(px) - (w / 2 - r), qy = Math.abs(py) - (h / 2 - r);
      const ox = Math.max(qx, 0), oy = Math.max(qy, 0), len = Math.hypot(ox, oy);
      const dist = -(len + Math.min(Math.max(qx, qy), 0) - r);
      let nx, ny;
      if (len > 0) { nx = (ox / len) * Math.sign(px); ny = (oy / len) * Math.sign(py); }
      else if (qx > qy) { nx = Math.sign(px); ny = 0; } else { nx = 0; ny = Math.sign(py); }
      const t = Math.max(0, 1 - Math.max(dist, 0) / depth), bend = t * t * t;
      const i = (y * cw + x) * 4;
      d[i] = 128 - nx * bend * 127; d[i + 1] = 128 - ny * bend * 127; d[i + 2] = 128; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return cv.toDataURL();
  }

  function apply(el) {
    const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
    if (!w || !h || (el._lw === w && el._lh === h)) return;
    el._lw = w; el._lh = h;
    if (!root) { root = document.createElementNS(NS, 'svg'); root.setAttribute('style', 'position:absolute;width:0;height:0'); document.body.appendChild(root); }
    if (el._lens) el._lens.remove();
    const id = 'lens' + ++n;
    const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 24;
    const f = document.createElementNS(NS, 'filter');
    f.setAttribute('id', id);
    for (const [k, v] of Object.entries({ x: 0, y: 0, width: w, height: h, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' })) f.setAttribute(k, v);
    f.innerHTML = `<feImage href="${map(w, h, radius, Math.min(26, h / 2))}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="m"/><feDisplacementMap in="SourceGraphic" in2="m" scale="46" xChannelSelector="R" yChannelSelector="G"/>`;
    root.appendChild(f);
    el._lens = f;
    el.style.backdropFilter = `url(#${id}) blur(5px) saturate(175%)`;
  }

  const ro = able ? new ResizeObserver((es) => es.forEach((e) => apply(e.target))) : null;
  g.Glass = {
    scan(rootEl = document) {
      if (!able) return;
      rootEl.querySelectorAll('[data-lens]').forEach((el) => { if (!el._seen) { el._seen = 1; ro.observe(el); } });
    },
  };
})(window);

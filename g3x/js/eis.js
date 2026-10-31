/* EIS op de G3X in deze installatie: alleen oliedruk, brandstofdruk, volts en ampères (strook op de MFD en motorpagina).
   RPM, CT, olietemperatuur en brandstofhoeveelheid zijn analoge meters in het paneel (zie cockpit.js). */
window.G3X = window.G3X || {};
(function () {
  const U = G3X.util, D = G3X.display, C = D.C;
  const E = {};
  const LIM = {
    oilP: { min: 0, max: 7, bands: [[0, 0.8, 'r'], [0.8, 2, 'y'], [2, 5, 'g'], [5, 7, 'y']], unit: 'BAR', fmt: v => v.toFixed(1) },
    fuelP: { min: 0, max: 0.6, bands: [[0, 0.15, 'r'], [0.15, 0.5, 'g'], [0.5, 0.6, 'y']], unit: 'BAR', fmt: v => v.toFixed(2) },
    volts: { min: 8, max: 16, bands: [[8, 11.5, 'r'], [11.5, 12.6, 'y'], [12.6, 15.0, 'g'], [15.0, 16, 'r']], unit: 'V', fmt: v => v.toFixed(1) },
    amps: { min: -30, max: 30, bands: [[-30, -1, 'y'], [-1, 30, 'g']], unit: 'A', fmt: v => (v >= 0 ? '+' : '') + Math.round(v) },
  };
  const BC = { g: C.green, y: C.yellow, r: C.red };
  const colorFor = (lim, v) => { for (const [a, b, c] of lim.bands) if (v >= a && v <= b) return c === 'g' ? '#fff' : c === 'y' ? C.yellow : C.red; return '#fff'; };
  E.LIM = LIM;

  function hbar(ctx, x, y, w, h, label, lim, v, flash) {
    const col = colorFor(lim, v);
    D.text(ctx, label, x, y + 7, { size: 12, color: '#bfc7d1' });
    D.text(ctx, lim.fmt(v), x + w, y + 7, { size: 15, color: col === C.red && flash ? (D.blink(2) ? C.red : '#fff') : col, align: 'right', weight: 'bold' });
    D.text(ctx, lim.unit, x, y + h - 2, { size: 9, color: '#6b7a8c' });
    const by = y + 16, bh = h - 18;
    const px = val => x + (U.clamp(val, lim.min, lim.max) - lim.min) / (lim.max - lim.min) * w;
    for (const [a, b, c] of lim.bands) { ctx.fillStyle = BC[c]; ctx.fillRect(px(a), by + bh - 4, px(b) - px(a), 4); }
    D.line(ctx, x, by + bh, x + w, by + bh, '#888', 1);
    const p = px(v);
    D.poly(ctx, [[p, by + bh - 6], [p - 6, by], [p + 6, by]], col === '#fff' ? '#fff' : col, '#000', 1);
  }
  const rows = Eg => [['OIL PRESS', LIM.oilP, Eg.oilP, true], ['FUEL PRESS', LIM.fuelP, Eg.fuelP, true], ['VOLTS', LIM.volts, Eg.volts, true], ['AMPS', LIM.amps, Eg.amps]];

  E.renderStrip = (ctx, r) => {
    const S = G3X.sim.S, Eg = S.eng;
    const x = r.x, y = r.y, w = r.w;
    D.box(ctx, x, y, w, r.h, '#0d1117');
    D.line(ctx, x + w - 1, y, x + w - 1, y + r.h, '#2a3340', 2);
    D.text(ctx, 'ENGINE', x + w / 2, y + 14, { size: 12, color: '#9fb3c8', align: 'center', weight: 'bold' });
    let yy = y + 30; const m = 10, bw = w - 2 * m;
    rows(Eg).forEach(([l, lim, v, f]) => { hbar(ctx, x + m, yy, bw, 44, l, lim, v, f); yy += 52; });
    D.zone(x, y, w, r.h, () => G3X.ui.showPage('ENG'), 'eis');
  };

  E.renderPage = (ctx, r) => {
    const S = G3X.sim.S, Eg = S.eng, a = S.ac;
    const x = r.x, y = r.y, w = r.w, h = r.h;
    D.box(ctx, x, y, w, h, '#0d1117');
    D.text(ctx, 'ENGINE', x + w / 2, y + 16, { size: 16, color: '#9fb3c8', align: 'center', weight: 'bold' });
    const colW = Math.min(420, w - 60), cx = x + (w - colW) / 2;
    let yy = y + 50;
    rows(Eg).forEach(([l, lim, v, f]) => { hbar(ctx, cx, yy, colW, 64, l, lim, v, f); yy += 80; });
    const items = [['HOBBS', Eg.hobbs.toFixed(1) + ' H'], ['FLIGHT TIME', U.fmtTimer(a.flightTime)]];
    yy += 10;
    items.forEach(([l, v]) => { D.text(ctx, l, cx, yy, { size: 13, color: '#9fb3c8' }); D.text(ctx, v, cx + colW, yy, { size: 17, color: '#fff', align: 'right', weight: 'bold' }); yy += 30; });
    D.text(ctx, 'RPM, coolant/oil temperature and fuel quantity: analog gauges in the panel', x + w / 2, y + h - 20, { size: 12, color: '#6b7a8c', align: 'center' });
  };

  G3X.eis = E;
})();

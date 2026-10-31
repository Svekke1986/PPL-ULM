/* EIS: motorinstrumenten (Rotax 912 S) als strook en als volledige motorpagina met brandstofcomputer. */
window.G3X = window.G3X || {};
(function () {
  const U = G3X.util, D = G3X.display, C = D.C;
  const E = {};
  // grenswaarden (bij benadering Rotax 912 S / ULS)
  const LIM = {
    rpm: { min: 0, max: 6500, bands: [[1400, 5500, 'g'], [5500, 5800, 'y'], [5800, 6500, 'r']] },
    oilP: { min: 0, max: 7, bands: [[0, 0.8, 'r'], [0.8, 2, 'y'], [2, 5, 'g'], [5, 7, 'y']], unit: 'BAR', fmt: v => v.toFixed(1) },
    oilT: { min: 0, max: 150, bands: [[50, 90, 'y'], [90, 110, 'g'], [110, 130, 'y'], [130, 150, 'r']], unit: '°C', fmt: v => Math.round(v) },
    cht: { min: 0, max: 160, bands: [[0, 50, 'y'], [50, 120, 'g'], [120, 135, 'y'], [135, 160, 'r']], unit: '°C', fmt: v => Math.round(v) },
    egt: { min: 400, max: 950, bands: [[700, 880, 'g'], [880, 950, 'r']], unit: '°C', fmt: v => Math.round(v) },
    ff: { min: 0, max: 35, bands: [[0, 28, 'g'], [28, 35, 'y']], unit: 'L/H', fmt: v => v.toFixed(1) },
    fuelP: { min: 0, max: 0.6, bands: [[0, 0.15, 'r'], [0.15, 0.5, 'g'], [0.5, 0.6, 'y']], unit: 'BAR', fmt: v => v.toFixed(2) },
    volts: { min: 8, max: 16, bands: [[8, 11.5, 'r'], [11.5, 12.6, 'y'], [12.6, 15.0, 'g'], [15.0, 16, 'r']], unit: 'V', fmt: v => v.toFixed(1) },
    amps: { min: -30, max: 30, bands: [[-30, -1, 'y'], [-1, 30, 'g']], unit: 'A', fmt: v => (v >= 0 ? '+' : '') + Math.round(v) },
    fuel: { min: 0, max: 62, bands: [[0, 5, 'r'], [5, 10, 'y'], [10, 62, 'g']], unit: 'L', fmt: v => Math.round(v) },
  };
  const BC = { g: C.green, y: C.yellow, r: C.red };
  const colorFor = (lim, v) => { for (const [a, b, c] of lim.bands) if (v >= a && v <= b) return c === 'g' ? '#fff' : c === 'y' ? C.yellow : C.red; return '#fff'; };
  E.LIM = LIM;

  // horizontale balkmeter
  function hbar(ctx, x, y, w, h, label, lim, v, flash) {
    const col = colorFor(lim, v);
    D.text(ctx, label, x, y + 7, { size: 12, color: '#bfc7d1' });
    D.text(ctx, lim.fmt(v), x + w, y + 7, { size: 15, color: col === C.red && flash ? (D.blink(2) ? C.red : '#fff') : col, align: 'right', weight: 'bold' });
    const by = y + 16, bh = h - 18;
    const px = val => x + (U.clamp(val, lim.min, lim.max) - lim.min) / (lim.max - lim.min) * w;
    for (const [a, b, c] of lim.bands) { ctx.fillStyle = BC[c]; ctx.fillRect(px(a), by + bh - 4, px(b) - px(a), 4); }
    D.line(ctx, x, by + bh, x + w, by + bh, '#888', 1);
    const p = px(v);
    D.poly(ctx, [[p, by + bh - 6], [p - 6, by], [p + 6, by]], col === '#fff' ? '#fff' : col, '#000', 1);
  }
  // verticale balk (brandstof)
  function vbar(ctx, x, y, w, h, label, lim, v) {
    const col = colorFor(lim, v);
    D.text(ctx, label, x + w / 2, y + 6, { size: 11, color: '#bfc7d1', align: 'center' });
    const by = y + 14, bh = h - 34;
    const py = val => by + bh - (U.clamp(val, lim.min, lim.max) - lim.min) / (lim.max - lim.min) * bh;
    D.box(ctx, x + 6, by, w - 12, bh, '#111', '#555', 1);
    for (const [a, b, c] of lim.bands) { ctx.fillStyle = BC[c]; ctx.fillRect(x + 6, py(b), 4, py(a) - py(b)); }
    ctx.fillStyle = col === '#fff' ? '#2f7bff' : col; ctx.fillRect(x + 11, py(v), w - 18, py(0) - py(v));
    D.text(ctx, lim.fmt(v), x + w / 2, y + h - 8, { size: 14, color: col, align: 'center', weight: 'bold' });
  }
  // boogmeter (RPM)
  function arc(ctx, cx, cy, r, lim, v, label, big) {
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    const ang = val => a0 + (U.clamp(val, lim.min, lim.max) - lim.min) / (lim.max - lim.min) * (a1 - a0);
    ctx.lineWidth = big ? 10 : 7; ctx.strokeStyle = '#333'; ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
    for (const [a, b, c] of lim.bands) { ctx.strokeStyle = BC[c]; ctx.beginPath(); ctx.arc(cx, cy, r, ang(a), ang(b)); ctx.stroke(); }
    for (let t = 0; t <= lim.max; t += 1000) { const an = ang(t); D.line(ctx, cx + Math.cos(an) * (r - 8), cy + Math.sin(an) * (r - 8), cx + Math.cos(an) * (r + 6), cy + Math.sin(an) * (r + 6), '#fff', 2); if (big) D.text(ctx, String(t / 1000), cx + Math.cos(an) * (r - 20), cy + Math.sin(an) * (r - 20), { size: 12, color: '#fff', align: 'center' }); }
    const an = ang(v);
    D.poly(ctx, [[cx + Math.cos(an) * (r + 2), cy + Math.sin(an) * (r + 2)], [cx + Math.cos(an - 0.15) * (r - 16), cy + Math.sin(an - 0.15) * (r - 16)], [cx + Math.cos(an + 0.15) * (r - 16), cy + Math.sin(an + 0.15) * (r - 16)]], '#fff', '#000', 1);
    D.text(ctx, label, cx, cy - (big ? 14 : 10), { size: big ? 14 : 11, color: '#bfc7d1', align: 'center' });
    const col = v > 5800 ? C.red : v > 5500 ? C.yellow : '#fff';
    D.text(ctx, String(Math.round(v / 10) * 10), cx, cy + (big ? 12 : 8), { size: big ? 30 : 20, color: col, align: 'center', weight: 'bold' });
  }

  E.endurance = S => { const E_ = S.eng, a = S.ac; const usable = Math.max(0, a.fuelL - 2) + Math.max(0, a.fuelR - 2); return E_.ff > 0.5 ? usable / E_.ff : null; };

  E.renderStrip = (ctx, r) => {
    const S = G3X.sim.S, Eg = S.eng, a = S.ac, A = G3X.avionics.A;
    const x = r.x, y = r.y, w = r.w;
    D.box(ctx, x, y, w, r.h, '#0d1117');
    D.line(ctx, x + w - 1, y, x + w - 1, y + r.h, '#2a3340', 2);
    arc(ctx, x + w / 2, y + 62, 46, LIM.rpm, Eg.rpm, 'RPM', false);
    let yy = y + 118;
    const m = 10, bw = w - 2 * m;
    hbar(ctx, x + m, yy, bw, 36, 'OIL P', LIM.oilP, Eg.oilP, true); yy += 40;
    hbar(ctx, x + m, yy, bw, 36, 'OIL T', LIM.oilT, Eg.oilT, true); yy += 40;
    hbar(ctx, x + m, yy, bw, 36, 'CHT', LIM.cht, Eg.cht, true); yy += 40;
    hbar(ctx, x + m, yy, bw, 36, 'EGT L', LIM.egt, Eg.egt1); yy += 36;
    hbar(ctx, x + m, yy, bw, 36, 'EGT R', LIM.egt, Eg.egt2); yy += 40;
    hbar(ctx, x + m, yy, bw, 36, 'FUEL FLOW', LIM.ff, Eg.ff); yy += 40;
    hbar(ctx, x + m, yy, bw, 36, 'FUEL P', LIM.fuelP, Eg.fuelP, true); yy += 42;
    // brandstof
    D.text(ctx, 'FUEL QTY', x + w / 2, yy + 6, { size: 12, color: '#bfc7d1', align: 'center' }); yy += 10;
    vbar(ctx, x + 8, yy, 60, 96, 'L', LIM.fuel, a.fuelL);
    vbar(ctx, x + w - 68, yy, 60, 96, 'R', LIM.fuel, a.fuelR);
    // tankkeuze
    const sel = a.fuelSel; const sx = sel === 'L' ? x + 38 : sel === 'R' ? x + w - 38 : x + w / 2;
    if (sel !== 'OFF') D.poly(ctx, [[sx, yy + 10], [sx - 5, yy + 2], [sx + 5, yy + 2]], C.cyan);
    yy += 100;
    const end = E.endurance(S);
    D.text(ctx, 'TOT ' + D.fuelVal(a.fuelL + a.fuelR) + ' ' + D.fuelUnit(), x + w / 2, yy, { size: 13, color: '#fff', align: 'center', weight: 'bold' }); yy += 16;
    D.text(ctx, 'END ' + (end != null && a.flightTime > 1 ? U.fmtEte(end * 60).replace(/^0/, '') : '__:__'), x + w / 2, yy, { size: 13, color: end != null && end < 0.75 ? C.yellow : '#fff', align: 'center' }); yy += 20;
    hbar(ctx, x + m, yy, bw, 36, 'VOLTS', LIM.volts, Eg.volts, true); yy += 40;
    hbar(ctx, x + m, yy, bw, 36, 'AMPS', LIM.amps, Eg.amps); yy += 40;
    // flaps
    D.text(ctx, 'FLAPS', x + m, yy + 7, { size: 12, color: '#bfc7d1' });
    const fn = G3X.sim.AC.flapNames;
    fn.forEach((n, i) => { const fx = x + m + 34 + i * 32; D.box(ctx, fx, yy, 30, 16, a.flaps === i ? C.cyan : '#1b2330', '#3a4350', 1); D.text(ctx, n, fx + 15, yy + 8, { size: 10, color: a.flaps === i ? '#000' : '#9fb3c8', align: 'center', weight: 'bold' }); });
    D.zone(x, y, w, r.h, () => G3X.ui.showPage('ENG'), 'eis');
    void A;
  };

  E.renderPage = (ctx, r) => {
    const S = G3X.sim.S, Eg = S.eng, a = S.ac;
    const x = r.x, y = r.y, w = r.w, h = r.h;
    D.box(ctx, x, y, w, h, '#0d1117');
    D.text(ctx, 'ENGINE', x + w / 2, y + 16, { size: 16, color: '#9fb3c8', align: 'center', weight: 'bold' });
    const col1 = x + 20, colW = Math.min(300, w / 2 - 40);
    arc(ctx, col1 + colW / 2, y + 120, 80, LIM.rpm, Eg.rpm, 'RPM', true);
    let yy = y + 220;
    const rows = [['OIL PRESS', LIM.oilP, Eg.oilP, true], ['OIL TEMP', LIM.oilT, Eg.oilT, true], ['CHT', LIM.cht, Eg.cht, true], ['EGT L', LIM.egt, Eg.egt1], ['EGT R', LIM.egt, Eg.egt2], ['FUEL FLOW', LIM.ff, Eg.ff], ['FUEL PRESS', LIM.fuelP, Eg.fuelP, true], ['VOLTS', LIM.volts, Eg.volts, true], ['AMPS', LIM.amps, Eg.amps]];
    rows.forEach(([l, lim, v, f]) => { hbar(ctx, col1, yy, colW, 40, l, lim, v, f); yy += 44; });
    // rechterkolom: brandstof + computer
    const col2 = x + w / 2 + 10, c2w = w / 2 - 30;
    D.text(ctx, 'FUEL', col2 + c2w / 2, y + 36, { size: 14, color: '#bfc7d1', align: 'center' });
    vbar(ctx, col2 + 10, y + 46, 80, 160, 'LEFT', LIM.fuel, a.fuelL);
    vbar(ctx, col2 + c2w - 90, y + 46, 80, 160, 'RIGHT', LIM.fuel, a.fuelR);
    const sel = a.fuelSel;
    D.text(ctx, 'SEL ' + sel, col2 + c2w / 2, y + 120, { size: 16, color: C.cyan, align: 'center', weight: 'bold' });
    const end = E.endurance(S);
    const rangeNm = end != null ? end * a.gs : null;
    const items = [
      ['FUEL REMAINING', D.fuelVal(a.fuelL + a.fuelR) + ' ' + D.fuelUnit()],
      ['FUEL USED', D.fuelVal(a.fuelUsed) + ' ' + D.fuelUnit()],
      ['FUEL FLOW', Eg.ff.toFixed(1) + ' L/H'],
      ['ENDURANCE', end != null ? U.fmtEte(end * 60) : '__:__'],
      ['RANGE (GS)', rangeNm != null ? Math.round(D.distVal(rangeNm)) + ' ' + D.distUnit() : '____'],
      ['FUEL AT DEST', (() => { const n = G3X.avionics.A.nav; if (!n || !n.valid || n.destEte == null || !isFinite(n.destEte)) return '____'; const rem = a.fuelL + a.fuelR - Eg.ff * n.destEte / 60; return (rem < 10 ? '⚠ ' : '') + D.fuelVal(Math.max(0, rem)) + ' ' + D.fuelUnit(); })()],
      ['HOBBS', Eg.hobbs.toFixed(1) + ' H'],
      ['FLIGHT TIME', U.fmtTimer(a.flightTime)],
    ];
    let iy = y + 230;
    D.box(ctx, col2, iy - 10, c2w, items.length * 30 + 20, 'rgba(255,255,255,0.03)', '#2a3340', 1);
    items.forEach(([l, v]) => { D.text(ctx, l, col2 + 12, iy + 8, { size: 13, color: '#9fb3c8' }); D.text(ctx, v, col2 + c2w - 12, iy + 8, { size: 17, color: v.startsWith('⚠') ? C.yellow : '#fff', align: 'right', weight: 'bold' }); iy += 30; });
    // knoppen
    const btns = [['Fuel on Board', () => G3X.ui.openFuelOnBoard()], ['Reset Fuel Used', () => { a.fuelUsed = 0; }], ['Fuel Selector', () => G3X.ui.openFuelSelector()]];
    let bx = col2; const by = y + h - 56;
    btns.forEach(([l, fn]) => { const bw = (c2w - 16) / 3; D.box(ctx, bx, by, bw, 40, '#1b2330', '#4a5568', 1, 6); D.text(ctx, l, bx + bw / 2, by + 20, { size: 13, color: '#fff', align: 'center', weight: 'bold' }); D.zone(bx, by, bw, 40, fn, 'engbtn'); bx += bw + 8; });
  };

  G3X.eis = E;
})();

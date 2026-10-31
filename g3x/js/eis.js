/* EIS op de G3X in deze installatie (zoals op de MFD van OO-KWO): ronde OIL PSI-meter en verticale balkjes voor
   FUEL PSI, VOLTS en AMPS; motorpagina met dezelfde meters en Total Hours. RPM, CT, olietemperatuur en
   brandstofhoeveelheid zijn analoge meters in het paneel (cockpit.js). */
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

  // verticale balkmeter met kleurband en wijzer, label boven en digitale waarde eronder
  function vbar(ctx, x, y, w, h, label, lim, v, flash) {
    const col = colorFor(lim, v);
    D.text(ctx, label, x + w / 2, y + 8, { size: 12, color: '#bfc7d1', align: 'center' });
    const by = y + 22, bh = h - 50, bx = x + w / 2 - 4;
    const py = val => by + bh - (U.clamp(val, lim.min, lim.max) - lim.min) / (lim.max - lim.min) * bh;
    for (const [a, b, c] of lim.bands) { ctx.fillStyle = BC[c]; ctx.fillRect(bx, py(b), 8, py(a) - py(b)); }
    D.line(ctx, bx - 2, by, bx - 2, by + bh, '#888', 1);
    const p = py(v);
    D.poly(ctx, [[bx + 10, p], [bx + 20, p - 7], [bx + 20, p + 7]], col === '#fff' ? '#fff' : col, '#000', 1);
    D.text(ctx, lim.fmt(v), x + w / 2, y + h - 14, { size: 16, color: col === C.red && flash ? (D.blink(2) ? C.red : '#fff') : col, align: 'center', weight: 'bold' });
    D.text(ctx, lim.unit, x + w / 2, y + h - 1, { size: 9, color: '#6b7a8c', align: 'center' });
  }
  // ronde meter (OIL PSI)
  function arc(ctx, cx, cy, r, lim, v, label, flash) {
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    const ang = val => a0 + (U.clamp(val, lim.min, lim.max) - lim.min) / (lim.max - lim.min) * (a1 - a0);
    ctx.lineWidth = 7; ctx.strokeStyle = '#333'; ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
    for (const [a, b, c] of lim.bands) { ctx.strokeStyle = BC[c]; ctx.beginPath(); ctx.arc(cx, cy, r, ang(a), ang(b)); ctx.stroke(); }
    const an = ang(v);
    D.poly(ctx, [[cx + Math.cos(an) * (r + 2), cy + Math.sin(an) * (r + 2)], [cx + Math.cos(an - 0.18) * (r - 14), cy + Math.sin(an - 0.18) * (r - 14)], [cx + Math.cos(an + 0.18) * (r - 14), cy + Math.sin(an + 0.18) * (r - 14)]], '#fff', '#000', 1);
    D.text(ctx, label, cx, cy - 8, { size: 11, color: '#bfc7d1', align: 'center' });
    const col = colorFor(lim, v);
    D.text(ctx, lim.fmt(v), cx, cy + 10, { size: 18, color: col === C.red && flash ? (D.blink(2) ? C.red : '#fff') : col, align: 'center', weight: 'bold' });
  }

  E.renderStrip = (ctx, r) => {
    const S = G3X.sim.S, Eg = S.eng;
    const x = r.x, y = r.y, w = r.w;
    D.box(ctx, x, y, w, r.h, '#0d1117');
    D.line(ctx, x + w - 1, y, x + w - 1, y + r.h, '#2a3340', 2);
    arc(ctx, x + w / 2, y + 56, 40, LIM.oilP, Eg.oilP, 'OIL PSI', true);
    const bh = (r.h - 120) / 3;
    vbar(ctx, x + 4, y + 110, w - 8, bh, 'FUEL PSI', LIM.fuelP, Eg.fuelP, true);
    vbar(ctx, x + 4, y + 110 + bh, w - 8, bh, 'VOLTS', LIM.volts, Eg.volts, true);
    vbar(ctx, x + 4, y + 110 + 2 * bh, w - 8, bh, 'AMPS', LIM.amps, Eg.amps);
    D.zone(x, y, w, r.h, () => G3X.ui.showPage('ENG'), 'eis');
  };

  E.renderPage = (ctx, r) => {
    const S = G3X.sim.S, Eg = S.eng, a = S.ac;
    const x = r.x, y = r.y, w = r.w, h = r.h;
    D.box(ctx, x, y, w, h, '#0d1117');
    D.text(ctx, 'ENGINE', x + w / 2, y + 16, { size: 16, color: '#9fb3c8', align: 'center', weight: 'bold' });
    const groupW = (w - 60) / 2, g1 = x + 20, g2 = x + 40 + groupW, gy = y + 40, gh = h - 130;
    D.box(ctx, g1, gy, groupW, gh, 'rgba(255,255,255,0.03)', '#2a3340', 1);
    D.text(ctx, 'Engine', g1 + groupW / 2, gy + 14, { size: 13, color: '#9fb3c8', align: 'center' });
    arc(ctx, g1 + groupW / 4, gy + gh / 2 - 20, Math.min(70, groupW / 5), LIM.oilP, Eg.oilP, 'OIL PSI', true);
    vbar(ctx, g1 + groupW / 2, gy + 30, groupW / 2, gh - 40, 'FUEL PSI', LIM.fuelP, Eg.fuelP, true);
    D.box(ctx, g2, gy, groupW, gh, 'rgba(255,255,255,0.03)', '#2a3340', 1);
    D.text(ctx, 'Electrical', g2 + groupW / 2, gy + 14, { size: 13, color: '#9fb3c8', align: 'center' });
    vbar(ctx, g2, gy + 30, groupW / 2, gh - 40, 'VOLTS', LIM.volts, Eg.volts, true);
    vbar(ctx, g2 + groupW / 2, gy + 30, groupW / 2, gh - 40, 'AMPS', LIM.amps, Eg.amps);
    D.text(ctx, 'Total Hours', x + w / 2 - 10, y + h - 60, { size: 13, color: '#9fb3c8', align: 'right' });
    D.text(ctx, Eg.hobbs.toFixed(1), x + w / 2 + 10, y + h - 60, { size: 17, color: '#fff', weight: 'bold' });
    D.text(ctx, 'Flight Time', x + w / 2 - 10, y + h - 36, { size: 13, color: '#9fb3c8', align: 'right' });
    D.text(ctx, U.fmtTimer(a.flightTime), x + w / 2 + 10, y + h - 36, { size: 17, color: '#fff', weight: 'bold' });
  };

  G3X.eis = E;
})();

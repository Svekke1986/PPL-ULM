/* Weergave: twee G3X-schermen (links PFD, rechts MFD met EIS-strook), elk een canvas van 1280×768,
   lay-out per scherm, tekenhulpjes en aanraakzones. */
window.G3X = window.G3X || {};
(function () {
  const U = G3X.util;
  const D = {
    W: 1280, H: 768, BAR_H: 28, EIS_W: 120, TOP_H: 48,
    screens: {}, cur: null, ctx: null, zones: [], scale: 1,
    C: {
      sky: '#1f63c9', sky2: '#0f3d8a', ground: '#9a5b25', ground2: '#5c3512', magenta: '#ff2bff', cyan: '#19e6ff', green: '#28e02c', white: '#ffffff', yellow: '#ffd21a', red: '#ff3131', grey: '#9aa3ad', dark: '#0b0e12', panel: 'rgba(0,0,0,0.65)', amber: '#ffb000', blue: '#2f7bff'
    },
    FONT: '"Roboto Condensed", "Arial Narrow", "Segoe UI", Arial, sans-serif',
  };

  D.init = (canvasL, canvasR) => {
    for (const [id, cv] of [['L', canvasL], ['R', canvasR]]) { cv.width = D.W; cv.height = D.H; D.screens[id] = { id, canvas: cv, ctx: cv.getContext('2d'), zones: [], layout: null }; }
    D.cur = D.screens.L; D.ctx = D.cur.ctx; D.zones = D.cur.zones;
  };

  // lay-out per scherm: L = PFD, R = MFD (+ EIS-strook); bij reversionary toont R de PFD met EIS
  D.layoutFor = id => {
    const A = G3X.avionics.A, S = G3X.sim.S;
    const top = D.TOP_H, h = D.H - D.BAR_H - top;
    const base = { top: { x: 0, y: 0, w: D.W, h: top }, bar: { x: 0, y: D.H - D.BAR_H, w: D.W, h: D.BAR_H }, eis: null, pfd: null, mfd: null, dead: false };
    if (id === 'L') { if (S.fail.display) base.dead = true; else base.pfd = { x: 0, y: top, w: D.W, h }; return base; }
    if (A.reversion) { base.eis = { x: 0, y: top, w: D.EIS_W, h }; base.pfd = { x: D.EIS_W, y: top, w: D.W - D.EIS_W, h }; return base; }
    const eisVisible = A.mfdPage !== 'ENG';
    if (eisVisible) base.eis = { x: 0, y: top, w: D.EIS_W, h };
    const x0 = eisVisible ? D.EIS_W : 0;
    base.mfd = { x: x0, y: top, w: D.W - x0, h };
    return base;
  };

  // ---------- aanraakzones ----------
  D.zone = (x, y, w, h, fn, id) => { D.zones.push({ x, y, w, h, fn, id }); };
  D.tap = (screenId, px, py) => {
    const sc = D.screens[screenId]; if (!sc) return null;
    for (let i = sc.zones.length - 1; i >= 0; i--) {
      const z = sc.zones[i];
      if (px >= z.x && px <= z.x + z.w && py >= z.y && py <= z.y + z.h) { z.fn(px - z.x, py - z.y, z); return z; }
    }
    return null;
  };
  D.findZone = (screenId, id) => { const sc = D.screens[screenId]; return sc && sc.zones.find(z => z.id === id); };

  // ---------- tekenhulpjes ----------
  D.font = (size, weight = 'normal') => `${weight} ${size}px ${D.FONT}`;
  D.text = (ctx, s, x, y, { size = 16, color = '#fff', align = 'left', base = 'middle', weight = 'normal', font } = {}) => {
    ctx.font = font || D.font(size, weight); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(s, x, y);
  };
  D.textOutline = (ctx, s, x, y, opt = {}) => {
    ctx.font = D.font(opt.size || 16, opt.weight || 'bold'); ctx.textAlign = opt.align || 'left'; ctx.textBaseline = opt.base || 'middle';
    ctx.lineWidth = opt.lw || 3; ctx.strokeStyle = opt.outline || '#000'; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y);
    ctx.fillStyle = opt.color || '#fff'; ctx.fillText(s, x, y);
  };
  D.box = (ctx, x, y, w, h, fill, stroke, lw = 1, r = 0) => {
    ctx.beginPath();
    if (r) D.roundRect(ctx, x, y, w, h, r); else ctx.rect(x, y, w, h);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  };
  D.roundRect = (ctx, x, y, w, h, r) => {
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  };
  D.line = (ctx, x1, y1, x2, y2, color, lw = 1, dash) => {
    ctx.beginPath(); if (dash) ctx.setLineDash(dash); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke(); if (dash) ctx.setLineDash([]);
  };
  D.poly = (ctx, pts, fill, stroke, lw = 1, close = true) => {
    ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); if (close) ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  };
  D.circle = (ctx, x, y, r, fill, stroke, lw = 1) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); } };
  D.triangle = (ctx, x, y, size, dirDeg, fill, stroke) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(dirDeg * U.DEG);
    D.poly(ctx, [[0, -size], [size * 0.8, size * 0.6], [-size * 0.8, size * 0.6]], fill, stroke, 1); ctx.restore();
  };
  D.field = (ctx, x, y, w, h, label, value, { valueColor = '#fff', labelColor = '#bfc7d1', size = 18, bg = 'rgba(0,0,0,0.55)', border = '#3a4350', align = 'center' } = {}) => {
    D.box(ctx, x, y, w, h, bg, border, 1, 3);
    if (label) D.text(ctx, label, x + 6, y + 11, { size: 12, color: labelColor, align: 'left' });
    D.text(ctx, value, align === 'center' ? x + w / 2 : x + w - 6, y + h / 2 + (label ? 5 : 0), { size, color: valueColor, align: align === 'center' ? 'center' : 'right', weight: 'bold' });
  };
  D.redX = (ctx, x, y, w, h, label) => {
    D.box(ctx, x, y, w, h, 'rgba(40,40,40,0.85)');
    D.line(ctx, x, y, x + w, y + h, D.C.red, 5); D.line(ctx, x + w, y, x, y + h, D.C.red, 5);
    if (label) D.textOutline(ctx, label, x + w / 2, y + h / 2, { size: 22, color: D.C.red, align: 'center', weight: 'bold' });
  };
  D.clip = (ctx, x, y, w, h) => { ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); };
  D.blink = (hz = 2) => Math.floor(performance.now() / (1000 / hz)) % 2 === 0;

  // eenheden
  D.fmtAltUnit = () => (G3X.avionics.A.units.alt === 'M' ? 'M' : 'FT');
  D.altVal = ft => (G3X.avionics.A.units.alt === 'M' ? Math.round(ft * U.FT_M) : Math.round(ft));
  D.distVal = nm => (G3X.avionics.A.units.dist === 'KM' ? nm * 1.852 : nm);
  D.distUnit = () => (G3X.avionics.A.units.dist === 'KM' ? 'KM' : 'NM');
  D.spdVal = kt => (G3X.avionics.A.units.speed === 'KMH' ? Math.round(kt * 1.852) : Math.round(kt));
  D.spdUnit = () => (G3X.avionics.A.units.speed === 'KMH' ? 'KM/H' : 'KT');
  D.fmtBaro = hpa => (G3X.avionics.A.units.baro === 'INHG' ? U.hpaToInhg(hpa).toFixed(2) + ' IN' : Math.round(hpa) + ' HPA');
  D.tempVal = c => (G3X.avionics.A.units.temp === 'F' ? Math.round(c * 9 / 5 + 32) + '°F' : Math.round(c) + '°C');
  D.fuelVal = l => (G3X.avionics.A.units.fuel === 'GAL' ? (l / 3.785).toFixed(1) : l.toFixed(0));
  D.fuelUnit = () => (G3X.avionics.A.units.fuel === 'GAL' ? 'GAL' : 'L');

  // ---------- hoofdrender: beide schermen ----------
  D.render = (visible = { L: true, R: true }) => {
    const A = G3X.avionics.A;
    for (const id of ['L', 'R']) {
      const sc = D.screens[id]; if (!sc) continue;
      sc.layout = D.layoutFor(id); if (id === 'L') D.LL = sc.layout; else D.LR = sc.layout;
      if (!visible[id]) continue;
      D.cur = sc; D.ctx = sc.ctx; sc.zones.length = 0; D.zones = sc.zones;
      const ctx = sc.ctx, L = sc.layout;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, D.W, D.H);
      if (L.dead) { D.text(ctx, '', D.W / 2, D.H / 2); continue; }
      G3X.topbar.render(ctx, L.top, id);
      if (L.eis) G3X.eis.renderStrip(ctx, L.eis);
      if (L.pfd) G3X.pfd.render(ctx, L.pfd);
      if (L.mfd) G3X.mfd.render(ctx, L.mfd);
      G3X.buttonbar.render(ctx, L.bar, id);
      if (A.brightness < 100) { ctx.fillStyle = `rgba(0,0,0,${(100 - A.brightness) / 120})`; ctx.fillRect(0, 0, D.W, D.H); }
    }
  };

  G3X.display = D;
})();

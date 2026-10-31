/* MFD: bewegende kaart, terreinpagina, kaart-inzet. DOM-pagina's (FPL, NRST, …) worden door ui.js over het MFD-vlak gelegd. */
window.G3X = window.G3X || {};
(function () {
  const U = G3X.util, D = G3X.display, NAV = G3X.nav, C = D.C;
  const M = { feats: [], RANGES: [0.5, 0.8, 1.2, 2, 3, 5, 8, 10, 15, 20, 30, 50, 80, 120, 200] };
  const DOM_PAGES = ['HOME', 'FPL', 'NRST', 'WPT', 'SETUP', 'CHK', 'TIMER', 'INFO', 'MSG', 'TRAFFIC', 'WX', 'CHARTS', 'USER', 'FPLLIST', 'PROC', 'AUX', 'TRIP', 'VNAV', 'WB', 'TRACKLOG', 'DATALINK', 'MUSIC', 'TOOLS'];
  M.isDomPage = p => DOM_PAGES.includes(p);

  M.render = (ctx, r) => {
    const A = G3X.avionics.A;
    const p = A.mfdPage;
    if (p === 'MAP') renderMap(ctx, r, { mode: 'MAP' });
    else if (p === 'TERRAIN') renderMap(ctx, r, { mode: 'TERRAIN' });
    else if (p === 'ENG') G3X.eis.renderPage(ctx, r);
    else { D.box(ctx, r.x, r.y, r.w, r.h, '#0d1117'); }
  };
  M.renderInset = (ctx, r) => renderMap(ctx, r, { mode: 'MAP', inset: true });

  M.rangeStep = dir => {
    const A = G3X.avionics.A; const i = M.RANGES.indexOf(A.map.range);
    const ni = U.clamp((i < 0 ? 7 : i) + dir, 0, M.RANGES.length - 1); A.map.range = M.RANGES[ni];
  };

  // projectie-info van de laatste tekening (voor aanraken/slepen)
  M.last = null;

  const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };

  function terrainColor(ft, mode, acAlt) {
    if (mode === 'TERRAIN') { const d = acAlt - ft; if (d < 100) return '#d8232a'; if (d < 1000) return '#d9b31a'; return '#0f1a0f'; }
    if (ft < 150) return '#2f5e36'; if (ft < 450) return '#44733a'; if (ft < 800) return '#6b8a3e'; if (ft < 1300) return '#9c8d4a'; if (ft < 1800) return '#9c6f45'; return '#8a5a44';
  }

  function renderMap(ctx, r, opts) {
    const A = G3X.avionics.A, S = G3X.sim.S, a = S.ac, mp = A.map, inset = !!opts.inset, mode = opts.mode;
    const range = inset ? Math.min(mp.range, 10) : mp.range;
    const orient = inset ? 'TRKUP' : (mode === 'TERRAIN' ? mp.orient : mp.orient);
    const panning = !inset && mp.panning && mp.pan;
    const center = panning ? mp.pan : { lat: a.lat, lon: a.lon };
    const o = S.fail.gps && !panning ? 0 : orient === 'NORTH' ? 0 : orient === 'HDGUP' ? a.hdg : a.trk;
    const cx = r.x + r.w / 2, cy = panning || orient === 'NORTH' ? r.y + r.h / 2 : r.y + r.h * 0.68;
    const scale = ((orient === 'NORTH' || panning ? 0.5 : 0.68) * r.h - 26) / range;
    const feats = [];
    const toScr = p => { const xy = U.toXY(center, p); const ex = xy.x * scale, ny = -xy.y * scale; const th = -o * U.DEG; return [cx + ex * Math.cos(th) - ny * Math.sin(th), cy + ex * Math.sin(th) + ny * Math.cos(th)]; };
    const fromScr = (sx, sy) => { const dx = sx - cx, dy = sy - cy; const th = o * U.DEG; const ex = dx * Math.cos(th) - dy * Math.sin(th), ny = dx * Math.sin(th) + dy * Math.cos(th); return U.fromXY(center, ex / scale, -ny / scale); };
    if (!inset) M.last = { toScr, fromScr, r, scale, center, o };
    const dec = inset ? 3 : mp.declutter;
    const inRect = (x, y, m = 30) => x > r.x - m && x < r.x + r.w + m && y > r.y - m && y < r.y + r.h + m;

    ctx.save(); D.clip(ctx, r.x, r.y, r.w, r.h);
    ctx.fillStyle = '#0c1a10'; ctx.fillRect(r.x, r.y, r.w, r.h);
    // topografie / terrein
    const terrInhibited = mode === 'TERRAIN' && a.onGround; // zoals op het toestel: geen terreinkleuren op de grond
    if ((mp.topo || mode === 'TERRAIN') && !S.fail.gps) {
      const cell = inset ? 20 : (range > 50 ? 22 : 16);
      for (let sy = r.y; sy < r.y + r.h; sy += cell) for (let sx = r.x; sx < r.x + r.w; sx += cell) {
        const p = fromScr(sx + cell / 2, sy + cell / 2); const t = NAV.terrainFt(p.lat, p.lon);
        ctx.fillStyle = terrainColor(t, terrInhibited ? 'MAP' : mode, a.alt); ctx.fillRect(sx, sy, cell + 1, cell + 1);
      }
    }
    if (S.fail.gps && !panning) { ctx.fillStyle = '#111'; ctx.fillRect(r.x, r.y, r.w, r.h); D.text(ctx, 'NO GPS POSITION', cx, cy - 20, { size: 18, color: C.yellow, align: 'center', weight: 'bold' }); D.text(ctx, 'Dead reckoning', cx, cy + 4, { size: 13, color: '#aaa', align: 'center' }); }
    // water & kust
    if (mode === 'MAP' && dec < 2 && mp.water) {
      ctx.lineWidth = range > 50 ? 1.5 : 2.5; ctx.strokeStyle = '#2d7ad6';
      for (const w of NAV.WATER) { ctx.beginPath(); w.pts.forEach((p, i) => { const s = toScr({ lat: p[0], lon: p[1] }); i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); }); ctx.stroke(); }
      ctx.lineWidth = 2; ctx.strokeStyle = '#4aa3ff'; ctx.beginPath(); NAV.COAST.forEach((p, i) => { const s = toScr({ lat: p[0], lon: p[1] }); i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); }); ctx.stroke();
    }
    // steden
    if (mode === 'MAP' && dec < 1 && mp.cities && !inset) {
      for (const c of NAV.CITIES) { if ((c[3] === 0 && range > 20) || (c[3] === 1 && range > 60)) continue; const s = toScr({ lat: c[1], lon: c[2] }); if (!inRect(s[0], s[1])) continue; D.box(ctx, s[0] - 3, s[1] - 3, 6, 6, '#e8e3c8'); D.textOutline(ctx, c[0], s[0] + 6, s[1], { size: 11 + c[3], color: '#e8e3c8', weight: 'normal', lw: 2 }); }
    }
    // luchtruim
    if (mode === 'MAP' && mp.airspace && dec < 3) {
      for (const s of NAV.AIRSPACES) {
        if (s.type === 'ATZ' && range > 30) continue;
        if (s.floor > a.alt + 3000 && !panning) continue;
        const col = s.type === 'P' || s.type === 'R' ? '#ff3b3b' : s.type === 'D' ? '#ff8c3b' : s.type === 'ATZ' ? '#d04bd0' : s.cls === 'C' ? '#2f7bff' : '#49a3ff';
        ctx.strokeStyle = col; ctx.lineWidth = s.type === 'CTR' ? 2.5 : 1.5; ctx.setLineDash(s.type === 'ATZ' || s.type === 'D' ? [6, 5] : []);
        ctx.beginPath();
        if (s.shape.circle) { const c = toScr(s.shape.circle); ctx.arc(c[0], c[1], s.shape.r * scale, 0, Math.PI * 2); }
        else s.shape.poly.forEach((p, i) => { const q = toScr({ lat: p[0], lon: p[1] }); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
        ctx.closePath(); ctx.stroke();
        if (s.type === 'CTR' || s.type === 'P' || s.type === 'R' || s.type === 'D') { ctx.fillStyle = hexA(col, 0.09); ctx.fill(); }
        ctx.setLineDash([]);
        if (dec < 2 && range <= 50 && !inset) {
          const c = s.shape.circle ? toScr(s.shape.circle) : toScr({ lat: s.shape.poly.reduce((t, p) => t + p[0], 0) / s.shape.poly.length, lon: s.shape.poly.reduce((t, p) => t + p[1], 0) / s.shape.poly.length });
          if (inRect(c[0], c[1])) { D.textOutline(ctx, s.name, c[0], c[1] - 8, { size: 11, color: col, weight: 'bold', align: 'center', lw: 2 }); D.textOutline(ctx, `${s.ceil}\n`.trim() + ' / ' + (s.floor === 0 ? 'GND' : s.floor), c[0], c[1] + 6, { size: 10, color: col, weight: 'normal', align: 'center', lw: 2 }); }
        }
      }
    }
    // obstakels
    if (mp.obstacles && dec < 2 && range <= 30) for (const ob of NAV.OBSTACLES) { const s = toScr(ob); if (!inRect(s[0], s[1])) continue; const col = a.alt < ob.msl + 100 ? C.red : a.alt < ob.msl + 1000 ? C.yellow : '#ccc'; D.poly(ctx, [[s[0], s[1] - 10], [s[0] - 5, s[1] + 2], [s[0] + 5, s[1] + 2]], null, col, 1.5); D.circle(ctx, s[0], s[1] - 10, 1.5, col); feats.push({ x: s[0], y: s[1], item: Object.assign({ type: 'OBST' }, ob) }); }
    // navaids
    if (mode === 'MAP' && dec < 3) for (const n of NAV.NAVAIDS) {
      if (n.type === 'NDB' && range > 60) continue; const s = toScr(n); if (!inRect(s[0], s[1])) continue;
      if (n.type === 'VOR') { ctx.save(); ctx.translate(s[0], s[1]); const pts = []; for (let i = 0; i < 6; i++) pts.push([Math.cos(i * Math.PI / 3) * 7, Math.sin(i * Math.PI / 3) * 7]); D.poly(ctx, pts, null, '#5de1ff', 1.5); D.circle(ctx, 0, 0, 1.5, '#5de1ff'); ctx.restore(); }
      else { D.circle(ctx, s[0], s[1], 6, null, '#d99cff', 1.5); D.circle(ctx, s[0], s[1], 1.5, '#d99cff'); }
      if (dec < 2) D.textOutline(ctx, n.id, s[0] + 9, s[1] - 6, { size: 11, color: n.type === 'VOR' ? '#5de1ff' : '#d99cff', weight: 'normal', lw: 2 });
      feats.push({ x: s[0], y: s[1], item: n });
    }
    // waypoints / VRP
    if (mode === 'MAP' && dec < 2 && range <= 40) for (const w of [...NAV.WAYPOINTS, ...A.userWpts]) { const s = toScr(w); if (!inRect(s[0], s[1])) continue; D.poly(ctx, [[s[0], s[1] - 6], [s[0] + 6, s[1] + 5], [s[0] - 6, s[1] + 5]], null, w.user ? C.cyan : '#fff', 1.5); if (range <= 20) D.textOutline(ctx, w.id, s[0] + 8, s[1] - 4, { size: 10, color: w.user ? C.cyan : '#fff', weight: 'normal', lw: 2 }); feats.push({ x: s[0], y: s[1], item: w }); }
    // luchthavens
    for (const ap of NAV.AIRPORTS) {
      if (ap.kind === 'ulm' && range > 30) continue; if (ap.kind === 'civil' && range > 120 && dec > 0) continue;
      const s = toScr(ap); if (!inRect(s[0], s[1])) continue;
      const col = ap.kind === 'intl' ? '#4aa3ff' : ap.kind === 'mil' ? '#ff6b6b' : '#e85dff';
      const rw = ap.rwys[0];
      if (range <= 30) { ctx.save(); ctx.translate(s[0], s[1]); D.circle(ctx, 0, 0, 8, '#0b0e12', col, 2); ctx.rotate((rw.hdg - o) * U.DEG); ctx.fillStyle = col; ctx.fillRect(-2, -9, 4, 18); ctx.restore(); }
      else D.circle(ctx, s[0], s[1], 5, col);
      if (dec < 3 || range <= 10) D.textOutline(ctx, ap.id, s[0] + 11, s[1] - 7, { size: 12, color: col, weight: 'bold', lw: 2 });
      feats.push({ x: s[0], y: s[1], item: ap });
    }
    // vluchtplan
    const f = A.fpl, n = A.nav;
    if (f.wpts.length) {
      for (let i = 1; i < f.wpts.length; i++) {
        const p1 = toScr(f.wpts[i - 1]), p2 = toScr(f.wpts[i]);
        const active = i === f.active && !f.directTo; const missed = f.wpts[i].missed;
        D.line(ctx, p1[0], p1[1], p2[0], p2[1], active ? C.magenta : '#fff', active ? 3.5 : 2, missed ? [8, 6] : null);
      }
      f.wpts.forEach((w, i) => { const s = toScr(w); const act = i === f.active; D.poly(ctx, [[s[0], s[1] - 7], [s[0] + 7, s[1] + 6], [s[0] - 7, s[1] + 6]], act ? C.magenta : null, act ? '#000' : '#fff', 1.5); if (dec < 3 || act) D.textOutline(ctx, w.id, s[0] + 9, s[1] - 8, { size: 11, color: act ? C.magenta : '#fff', weight: 'bold', lw: 2 }); feats.push({ x: s[0], y: s[1], item: w }); });
    }
    if (f.directTo && n && n.valid) { const p1 = toScr(f.directTo.from.id === 'PPOS' ? { lat: a.lat, lon: a.lon } : f.directTo.from), p2 = toScr(f.directTo.to); D.line(ctx, p1[0], p1[1], p2[0], p2[1], C.magenta, 3.5); }
    // verkeer
    for (const t of A.traffic) { const s = toScr(t); const dAlt = Math.round((t.alt - a.alt) / 100); const near = U.distNm(a, t) < 2 && Math.abs(t.alt - a.alt) < 600; const col = near ? C.yellow : '#fff'; D.poly(ctx, [[s[0], s[1] - 7], [s[0] + 7, s[1]], [s[0], s[1] + 7], [s[0] - 7, s[1]]], near ? col : null, col, 2); D.textOutline(ctx, (dAlt >= 0 ? '+' : '') + dAlt, s[0] + 9, s[1] - 8, { size: 11, color: col, lw: 2 }); const tv = U.dest(t, t.trk, t.gs / 60); const e = toScr(tv); D.line(ctx, s[0], s[1], e[0], e[1], col, 1.5); }
    // range ring
    if (mp.rangeRing || inset) { const ac = toScr(center); ctx.setLineDash([4, 6]); D.circle(ctx, ac[0], ac[1], range * scale, null, 'rgba(255,255,255,0.45)', 1); ctx.setLineDash([]); }
    // koersvector
    const acs = toScr({ lat: a.lat, lon: a.lon });
    if (mp.trackVector && a.gs > 5 && !S.fail.gps) { const e = toScr(U.dest(a, a.trk, a.gs / 60)); D.line(ctx, acs[0], acs[1], e[0], e[1], '#fff', 1.5, [6, 4]); }
    // vliegtuig
    if (!S.fail.gps || panning) { ctx.save(); ctx.translate(acs[0], acs[1]); ctx.rotate((a.hdg - o) * U.DEG); D.poly(ctx, [[0, -12], [3, -4], [13, 0], [3, 2], [2, 9], [6, 12], [-6, 12], [-2, 9], [-3, 2], [-13, 0], [-3, -4]], '#fff', '#000', 1); ctx.restore(); }
    // cursor
    if (panning) { D.line(ctx, cx - 14, cy, cx + 14, cy, C.cyan, 2); D.line(ctx, cx, cy - 14, cx, cy + 14, C.cyan, 2); D.circle(ctx, cx, cy, 10, null, C.cyan, 1.5); }
    ctx.restore();
    M.feats = feats;

    // overlays
    if (!inset) {
      D.box(ctx, r.x, r.y, r.w, 22, 'rgba(0,0,0,0.55)');
      D.text(ctx, mode === 'TERRAIN' ? 'TERRAIN' : 'MAP', r.x + r.w / 2, r.y + 11, { size: 13, color: '#9fb3c8', align: 'center', weight: 'bold' });
      D.text(ctx, orient === 'NORTH' ? 'NORTH UP' : orient === 'HDGUP' ? 'HDG UP' : 'TRK UP', r.x + 6, r.y + 11, { size: 12, color: '#fff' });
      if (mp.declutter) D.text(ctx, 'DCLTR ' + mp.declutter, r.x + 90, r.y + 11, { size: 12, color: C.yellow });
      if (terrInhibited) D.text(ctx, 'TER INHB (ON GROUND)', r.x + r.w / 2, r.y + 40, { size: 14, color: C.yellow, align: 'center', weight: 'bold' });
      if (mode === 'TERRAIN') { D.box(ctx, r.x + r.w - 150, r.y + 26, 144, 46, 'rgba(0,0,0,0.6)'); D.box(ctx, r.x + r.w - 144, r.y + 31, 12, 12, '#d8232a'); D.text(ctx, '< 100 FT BELOW', r.x + r.w - 128, r.y + 37, { size: 11 }); D.box(ctx, r.x + r.w - 144, r.y + 50, 12, 12, '#d9b31a'); D.text(ctx, '< 1000 FT BELOW', r.x + r.w - 128, r.y + 56, { size: 11 }); }
      // range rechtsonder
      D.box(ctx, r.x + r.w - 92, r.y + r.h - 28, 88, 24, 'rgba(0,0,0,0.65)', '#3a4350', 1);
      D.text(ctx, (D.distVal(range) < 10 ? D.distVal(range).toFixed(1) : Math.round(D.distVal(range))) + ' ' + D.distUnit(), r.x + r.w - 48, r.y + r.h - 16, { size: 14, color: '#fff', align: 'center', weight: 'bold' });
      // − = uitzoomen (groter bereik), + = inzoomen (kleiner bereik), zoals op het toestel
      D.zone(r.x + r.w - 92, r.y + r.h - 28, 44, 24, () => M.rangeStep(1), 'rng-');
      D.zone(r.x + r.w - 48, r.y + r.h - 28, 44, 24, () => M.rangeStep(-1), 'rng+');
      D.text(ctx, '−', r.x + r.w - 86, r.y + r.h - 16, { size: 14, color: '#9fb3c8' }); D.text(ctx, '+', r.x + r.w - 12, r.y + r.h - 16, { size: 14, color: '#9fb3c8', align: 'right' });
      // datavelden
      if (n && n.valid && mode === 'MAP') {
        const fields = [['DIS', U.fmtDis(D.distVal(n.dis)) + ' ' + D.distUnit()], ['BRG', U.fmtHdg(n.brg) + '°'], ['ETE', U.fmtEte(n.ete)], ['GS', D.spdVal(a.gs) + '']];
        fields.forEach((fl, i) => { D.field(ctx, r.x + 4, r.y + 26 + i * 36, 86, 32, fl[0], fl[1], { size: 15 }); });
      }
      // cursorinfo
      if (panning) {
        const c = mp.pan; const dist = U.distNm(a, c), brg = U.bearing(a, c);
        D.box(ctx, r.x + 4, r.y + r.h - 62, 190, 58, 'rgba(0,0,0,0.75)', C.cyan, 1);
        D.text(ctx, `${U.fmtLat(c.lat)}  ${U.fmtLon(c.lon)}`, r.x + 10, r.y + r.h - 48, { size: 12, color: '#fff' });
        D.text(ctx, `BRG ${U.fmtHdg(brg)}°  DIS ${U.fmtDis(dist)} NM`, r.x + 10, r.y + r.h - 30, { size: 13, color: C.cyan, weight: 'bold' });
        D.text(ctx, `ELEV ${Math.round(NAV.terrainFt(c.lat, c.lon))} FT`, r.x + 10, r.y + r.h - 13, { size: 12, color: '#bbb' });
      }
      // tikken op kaart => feature of cursor
      D.zone(r.x, r.y + 22, r.w, r.h - 50, (px, py) => M.tap(r.x + px, r.y + 22 + py), 'map');
    }
  }

  // aanraking op de kaart: feature in de buurt => info, anders cursor plaatsen
  M.tap = (sx, sy) => {
    const A = G3X.avionics.A;
    let best = null, bd = 18;
    for (const f of M.feats) { const d = Math.hypot(f.x - sx, f.y - sy); if (d < bd) { bd = d; best = f; } }
    if (best) { G3X.ui.openFeatureInfo(best.item); return; }
    if (M.last) { A.map.pan = M.last.fromScr(sx, sy); A.map.panning = true; G3X.ui.showMapCursorMenu(); }
  };
  M.panBy = (dx, dy) => {
    const A = G3X.avionics.A; if (!M.last) return;
    const c = M.last.toScr(A.map.pan || { lat: G3X.sim.S.ac.lat, lon: G3X.sim.S.ac.lon });
    A.map.pan = M.last.fromScr(c[0] - dx, c[1] - dy); A.map.panning = true;
  };
  M.stopPan = () => { const A = G3X.avionics.A; A.map.panning = false; A.map.pan = null; };

  G3X.mfd = M;
})();

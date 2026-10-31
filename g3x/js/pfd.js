/* PFD: attitude (met synthetic vision), snelheids- en hoogtetape, VSI, HSI, AP-statusbalk, CAS-venster, velden. */
window.G3X = window.G3X || {};
(function () {
  const U = G3X.util, D = G3X.display, NAV = G3X.nav;
  const C = D.C;
  const P = { prevIas: 0, prevAlt: 0, prevT: 0, iasTrend: 0, altTrend: 0 };
  const PPD = 11; // pixels per graad pitch

  P.render = (ctx, r) => {
    const A = G3X.avionics.A, S = G3X.sim.S, a = S.ac, SIM = G3X.sim;
    const X = r.x, Y = r.y, W = r.w, H = r.h;
    const tapeTop = Y + 36, tapeBot = Y + H - 238, tapeH = tapeBot - tapeTop, cy = tapeTop + tapeH / 2, cx = X + W / 2;
    const hsiR = W > 800 ? 125 : 104, hx = cx, hy = Y + H - 116;
    const ias = a.iasShown ?? a.ias, indAlt = G3X.avionics.indAlt();
    // trend (6 s)
    const now = S.t; const dt = now - P.prevT;
    if (dt > 0.25) { P.iasTrend = U.lerp(P.iasTrend, (ias - P.prevIas) / dt * 6, 0.5); P.altTrend = U.lerp(P.altTrend, (indAlt - P.prevAlt) / dt * 6, 0.5); P.prevIas = ias; P.prevAlt = indAlt; P.prevT = now; }
    if (dt < 0) { P.prevT = now; P.prevIas = ias; P.prevAlt = indAlt; }

    ctx.save(); D.clip(ctx, X, Y, W, H);
    drawAttitude(ctx, X, Y, W, H, cx, cy, A, S);
    ctx.restore();

    drawAirspeed(ctx, X + 6, tapeTop, 84, tapeH, cy, ias, A, S);
    drawAltitude(ctx, X + W - 128, tapeTop, 86, tapeH, cy, indAlt, A, S);
    drawVsi(ctx, X + W - 40, tapeTop + 20, 34, tapeH - 40, cy, a.vs, A);
    drawVdev(ctx, X + W - 150, cy, A, S);
    drawCas(ctx, X + W - 312, cy - 160, 156, A, S);
    drawHsi(ctx, hx, hy, hsiR, A, S);
    drawCorners(ctx, X, Y, W, H, A, S);
    drawAnnunciations(ctx, cx, cy, A, S);
    if (A.inset === 'MAP' && W > 800) G3X.mfd.renderInset(ctx, { x: X + 100, y: Y + H - 250, w: 220, h: 220 });
  };

  // ---------- attitude + SVT ----------
  function drawAttitude(ctx, X, Y, W, H, cx, cy, A, S) {
    const a = S.ac;
    if (S.fail.ahrs) {
      ctx.fillStyle = '#1b1f26'; ctx.fillRect(X, Y, W, H);
      D.redX(ctx, X + 96, Y + 54, W - 230, H - 300, 'ATTITUDE FAIL');
      return;
    }
    const bank = a.bank, pitch = a.pitch;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(-bank * U.DEG);
    ctx.save(); ctx.translate(0, pitch * PPD);
    // lucht / grond
    const g1 = ctx.createLinearGradient(0, -600, 0, 0); g1.addColorStop(0, C.sky2); g1.addColorStop(1, C.sky);
    ctx.fillStyle = g1; ctx.fillRect(-2500, -2500, 5000, 2500);
    const g2 = ctx.createLinearGradient(0, 0, 0, 500); g2.addColorStop(0, C.ground); g2.addColorStop(1, C.ground2);
    ctx.fillStyle = g2; ctx.fillRect(-2500, 0, 5000, 2500);
    if (A.svt && !S.fail.gps) drawSvt(ctx, S, A);
    D.line(ctx, -2500, 0, 2500, 0, '#fff', 2);
    // koersmarkeringen op de horizon (SVT)
    if (A.svt) {
      const h0 = Math.round(a.hdg / 10) * 10;
      for (let h = -30; h <= 30; h += 10) {
        const hd = U.norm360(h0 + h); const x = U.norm180(hd - a.hdg) * PPD;
        D.line(ctx, x, 0, x, 10, '#fff', 1.5);
        D.textOutline(ctx, hd === 0 ? 'N' : hd === 90 ? 'E' : hd === 180 ? 'S' : hd === 270 ? 'W' : String(hd / 10), x, 20, { size: 13, align: 'center', color: '#fff', lw: 2 });
      }
    }
    // flight path marker
    if (!a.onGround && a.gs > 30) {
      const fpa = Math.atan2(a.vs, a.gs * 101.27) / U.DEG; const drift = U.norm180(a.trk - a.hdg);
      const fx = drift * PPD, fy = -fpa * PPD;
      ctx.lineWidth = 2; ctx.strokeStyle = '#28e02c';
      ctx.beginPath(); ctx.arc(fx, fy, 7, 0, Math.PI * 2); ctx.stroke();
      D.line(ctx, fx - 18, fy, fx - 7, fy, '#28e02c', 2); D.line(ctx, fx + 7, fy, fx + 18, fy, '#28e02c', 2); D.line(ctx, fx, fy - 7, fx, fy - 14, '#28e02c', 2);
    }
    // pitchladder
    ctx.save(); ctx.beginPath(); ctx.rect(-150, -pitch * PPD - 150, 300, 300); ctx.clip();
    for (let p = -90; p <= 90; p += 2.5) {
      if (p === 0) continue;
      const y = -p * PPD; if (Math.abs(y + pitch * PPD) > 170) continue;
      const major = p % 10 === 0, mid = p % 5 === 0;
      const len = major ? 60 : mid ? 30 : 14;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = major ? 2 : 1.5;
      ctx.beginPath(); ctx.moveTo(-len, y); ctx.lineTo(len, y); ctx.stroke();
      if (major) { D.textOutline(ctx, String(Math.abs(p)), -len - 8, y, { size: 15, align: 'right', lw: 2 }); D.textOutline(ctx, String(Math.abs(p)), len + 8, y, { size: 15, align: 'left', lw: 2 }); }
    }
    // chevrons bij extreme pitch
    if (pitch > 30) D.poly(ctx, [[-70, -45 * PPD], [0, -40 * PPD], [70, -45 * PPD]], null, C.red, 4, false);
    if (pitch < -20) D.poly(ctx, [[-70, 25 * PPD], [0, 30 * PPD], [70, 25 * PPD]], null, C.red, 4, false);
    ctx.restore();
    ctx.restore(); // pitch
    // rolschaal (vast) — getekend in gedraaid frame? nee: vaste schaal, bewegende wijzer
    ctx.restore();
    ctx.save(); ctx.translate(cx, cy);
    const R = 150;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, R, -Math.PI / 2 - 60 * U.DEG, -Math.PI / 2 + 60 * U.DEG); ctx.stroke();
    for (const t of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
      ctx.save(); ctx.rotate(t * U.DEG);
      const L = t === 0 ? 0 : (Math.abs(t) === 30 || Math.abs(t) === 60) ? 16 : 9;
      if (t === 0) D.poly(ctx, [[0, -R], [-8, -R - 14], [8, -R - 14]], '#fff');
      else D.line(ctx, 0, -R, 0, -R - L, '#fff', 2);
      ctx.restore();
    }
    // rolwijzer + slipindicator
    ctx.save(); ctx.rotate(-bank * U.DEG);
    D.poly(ctx, [[0, -R + 2], [-9, -R + 18], [9, -R + 18]], '#fff');
    const slip = U.clamp(a.slip, -1, 1) * 14;
    D.poly(ctx, [[-10 + slip, -R + 22], [10 + slip, -R + 22], [12 + slip, -R + 30], [-12 + slip, -R + 30]], '#fff');
    ctx.restore();
    // vliegtuigsymbool
    ctx.fillStyle = '#ffd21a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.fillRect(-4, -4, 8, 8); ctx.strokeRect(-4, -4, 8, 8);
    for (const s of [-1, 1]) { D.poly(ctx, [[s * 30, -3], [s * 95, -3], [s * 95, 3], [s * 38, 3], [s * 38, 14], [s * 30, 14]], '#ffd21a', '#000', 1); }
    ctx.restore();
  }

  function drawSvt(ctx, S, A) {
    const a = S.ac; const altFt = a.alt;
    const AZ = [], azStep = 3, azMax = 42;
    for (let az = -azMax; az <= azMax; az += azStep) AZ.push(az);
    const rings = [20, 14, 10, 7, 5, 3.5, 2.5, 1.7, 1.1, 0.7, 0.4, 0.2];
    for (const d of rings) {
      const pts = [];
      let maxEl = -90;
      for (const az of AZ) {
        const p = U.dest(a, a.hdg + az, d);
        const t = NAV.terrainFt(p.lat, p.lon);
        const el = Math.atan2(t - altFt, d * 6076.12) / U.DEG;
        maxEl = Math.max(maxEl, el);
        pts.push([az * PPD, -el * PPD, t]);
      }
      if (maxEl < -89) continue;
      const fog = U.clamp(d / 22, 0, 0.75);
      const avgT = pts.reduce((s, p) => s + p[2], 0) / pts.length;
      const base = avgT < 400 ? [70, 120, 50] : avgT < 1000 ? [120, 110, 55] : [130, 90, 55];
      const skyc = [40, 100, 200];
      const col = base.map((v, i) => Math.round(U.lerp(v, skyc[i], fog)));
      ctx.beginPath(); ctx.moveTo(pts[0][0] - 40, 2500);
      ctx.lineTo(pts[0][0] - 40, pts[0][1]);
      pts.forEach(p => ctx.lineTo(p[0], p[1]));
      ctx.lineTo(pts[pts.length - 1][0] + 40, pts[pts.length - 1][1]); ctx.lineTo(pts[pts.length - 1][0] + 40, 2500); ctx.closePath();
      ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`; ctx.fill();
      ctx.strokeStyle = `rgba(0,0,0,${0.35 - fog * 0.3})`; ctx.lineWidth = 1; ctx.stroke();
    }
    // banen
    for (const apt of NAV.AIRPORTS) {
      const dist = U.distNm(a, apt); if (dist > 14) continue;
      for (const rw of apt.rwys) {
        const re = NAV.runwayEnds(apt, rw.id.split('/')[0]); if (!re) continue;
        const wNm = 0.012;
        const corners = [U.dest(re.thr, re.hdg - 90, wNm), U.dest(re.thr, re.hdg + 90, wNm), U.dest(re.end, re.hdg + 90, wNm), U.dest(re.end, re.hdg - 90, wNm)];
        const scr = corners.map(c => proj(a, c, apt.elev)); if (scr.some(s => !s)) continue;
        D.poly(ctx, scr.map(s => [s.x, s.y]), '#555', '#fff', 1);
        const mid1 = proj(a, re.thr, apt.elev), mid2 = proj(a, re.end, apt.elev);
        if (mid1 && mid2) D.line(ctx, mid1.x, mid1.y, mid2.x, mid2.y, '#fff', 1, [4, 4]);
        if (mid1 && dist < 8) D.textOutline(ctx, re.id, mid1.x, mid1.y + 12, { size: 12, align: 'center', lw: 2 });
      }
    }
    // obstakels
    for (const o of NAV.OBSTACLES) {
      const d = U.distNm(a, o); if (d > 8) continue;
      const b = proj(a, o, o.msl - o.agl), t = proj(a, o, o.msl); if (!b || !t) continue;
      D.line(ctx, b.x, b.y, t.x, t.y, a.alt < o.msl + 100 ? C.red : C.yellow, 2);
      D.circle(ctx, t.x, t.y, 2, a.alt < o.msl + 100 ? C.red : C.yellow);
    }
    // flightplan-leg projectie (magenta 'pathway' in vereenvoudigde vorm): volgende waypoint als vlag
    const n = A.nav;
    if (n && n.valid && n.legTo) {
      const t = proj(a, n.legTo, NAV.terrainFt(n.legTo.lat, n.legTo.lon));
      if (t && n.dis < 25) { D.line(ctx, t.x, t.y, t.x, t.y - 26, C.magenta, 2); D.poly(ctx, [[t.x, t.y - 26], [t.x + 18, t.y - 21], [t.x, t.y - 16]], C.magenta); D.textOutline(ctx, n.legTo.id, t.x, t.y - 34, { size: 12, align: 'center', color: C.magenta, lw: 2 }); }
    }
  }
  function proj(a, p, elev) {
    const d = U.distNm(a, p); if (d < 0.03) return null;
    const az = U.norm180(U.bearing(a, p) - a.hdg); if (Math.abs(az) > 48) return null;
    const el = Math.atan2(elev - a.alt, d * 6076.12) / U.DEG;
    return { x: az * PPD, y: -el * PPD };
  }

  // ---------- databalk & AP ----------
  function drawDataBar(ctx, X, Y, W, A, S) {
    const a = S.ac, n = A.nav;
    D.box(ctx, X, Y, W, 24, 'rgba(0,0,0,0.75)');
    const fields = [
      ['GS', D.spdVal(a.gs) + ' ' + D.spdUnit()],
      ['TRK', U.fmtHdg(a.trk) + '°'],
      ['DTK', n && n.valid ? U.fmtHdg(n.dtk) + '°' : '___°'],
      ['DIS', n && n.valid ? U.fmtDis(D.distVal(n.dis)) + ' ' + D.distUnit() : '__._'],
      ['ETE', n && n.valid ? U.fmtEte(n.ete) : '__:__'],
    ];
    if (W > 800) fields.push(['BRG', n && n.valid ? U.fmtHdg(n.brg) + '°' : '___°'], ['XTK', n && n.valid ? (Math.abs(n.xtk) < 0.05 ? '0.00' : (n.xtk > 0 ? 'R ' : 'L ') + Math.abs(n.xtk).toFixed(2)) + ' NM' : '____'], ['OAT', D.tempVal(G3X.sim.oat())]);
    const fw = W / fields.length;
    fields.forEach((f, i) => {
      const x = X + i * fw;
      D.text(ctx, f[0], x + 6, Y + 12, { size: 12, color: '#9fb3c8' });
      D.text(ctx, f[1], x + fw - 6, Y + 12, { size: 16, color: '#fff', align: 'right', weight: 'bold' });
      if (i) D.line(ctx, x, Y + 3, x, Y + 21, '#3a4350');
    });
  }

  // ---------- snelheidstape ----------
  function drawAirspeed(ctx, x, y, w, h, cy, ias, A, S) {
    const AC = G3X.sim.AC, a = S.ac, pk = 5.6;
    D.box(ctx, x, y, w, h, 'rgba(0,0,0,0.55)');
    if (S.fail.adc) { D.redX(ctx, x, y, w, h, 'AIRSPEED FAIL'); return; }
    ctx.save(); D.clip(ctx, x, y, w, h);
    // kleurbanden
    const band = (v1, v2, col, bx = x + w - 10, bw = 8) => { const y1 = cy - (v1 - ias) * pk, y2 = cy - (v2 - ias) * pk; ctx.fillStyle = col; ctx.fillRect(bx, Math.min(y1, y2), bw, Math.abs(y1 - y2)); };
    band(0, AC.vs0, C.red); band(AC.vs0, AC.vfe, '#fff', x + w - 10, 4); band(AC.vs1, AC.vno, C.green, x + w - 6, 4); band(AC.vno, AC.vne, C.yellow, x + w - 6, 4); band(AC.vne, 400, C.red, x + w - 10, 8);
    // schaal
    const v0 = Math.floor((ias - 40) / 10) * 10;
    for (let v = Math.max(0, v0); v <= ias + 45; v += 5) {
      const yy = cy - (v - ias) * pk; if (v < 20 && v > 0) continue;
      const major = v % 10 === 0;
      D.line(ctx, x + w - 10 - (major ? 14 : 8), yy, x + w - 10, yy, '#fff', major ? 2 : 1);
      if (major && v >= 20) D.text(ctx, String(v), x + w - 28, yy, { size: 17, color: '#fff', align: 'right' });
    }
    // trend
    if (Math.abs(P.iasTrend) > 1.5 && !a.onGround) { const t = U.clamp(P.iasTrend, -40, 40); D.line(ctx, x + w - 3, cy, x + w - 3, cy - t * pk, C.magenta, 4); }
    // V-snelheden
    if (A.vspeeds) {
      const vs = [[AC.vr, 'R'], [AC.vx, 'X'], [AC.vy, 'Y'], [AC.vglide, 'G']];
      for (const [v, l] of vs) { const yy = cy - (v - ias) * pk; if (yy < y + 10 || yy > y + h - 10) continue; D.box(ctx, x + w - 2, yy - 8, 14, 16, '#000', C.cyan, 1); D.text(ctx, l, x + w + 5, yy, { size: 11, color: C.cyan, align: 'center', weight: 'bold' }); }
    }
    ctx.restore();
    // uitlezing
    const low = !a.onGround && ias < AC.vs1 * 1.1 && ias > 20, over = ias > AC.vne;
    D.poly(ctx, [[x + 4, cy - 20], [x + w - 16, cy - 20], [x + w - 16, cy - 8], [x + w - 4, cy], [x + w - 16, cy + 8], [x + w - 16, cy + 20], [x + 4, cy + 20]], '#000', over ? C.red : low ? C.yellow : '#fff', 2);
    D.text(ctx, ias < 20 ? '---' : String(Math.round(ias)), x + w - 20, cy, { size: 28, color: over ? C.red : low ? C.yellow : '#fff', align: 'right', weight: 'bold' });
    D.text(ctx, D.spdUnit(), x + 6, y - 10, { size: 12, color: '#9fb3c8' });
    // TAS / GS
    D.box(ctx, x, y + h + 2, w, 22, 'rgba(0,0,0,0.6)');
    D.text(ctx, 'TAS', x + 4, y + h + 13, { size: 12, color: '#9fb3c8' });
    D.text(ctx, String(D.spdVal(a.tas)), x + w - 4, y + h + 13, { size: 16, color: '#fff', align: 'right', weight: 'bold' });
    D.zone(x, y, w, h, () => G3X.ui.openPfdOptions(), 'asi');
  }

  // ---------- hoogtetape ----------
  function drawAltitude(ctx, x, y, w, h, cy, alt, A, S) {
    const pf = 0.56, a = S.ac;
    D.box(ctx, x, y, w, h, 'rgba(0,0,0,0.55)');
    // geselecteerde hoogte boven
    const selFlash = A.altAlert.t > 0 && D.blink(2);
    D.box(ctx, x, y - 30, w, 28, selFlash ? '#3a3a00' : '#000', C.cyan, 1);
    D.text(ctx, String(D.altVal(A.altSel)), x + w - 6, y - 16, { size: 22, color: C.cyan, align: 'right', weight: 'bold' });
    D.zone(x, y - 30, w, 28, () => G3X.ui.openAltSel(), 'altsel');
    if (S.fail.adc) { D.redX(ctx, x, y, w, h, 'ALTITUDE FAIL'); }
    else {
      ctx.save(); D.clip(ctx, x, y, w, h);
      const a0 = Math.floor((alt - 400) / 100) * 100;
      for (let v = a0; v <= alt + 420; v += 20) {
        const yy = cy - (v - alt) * pf; const major = v % 100 === 0;
        D.line(ctx, x + 2, yy, x + 2 + (major ? 12 : 6), yy, '#fff', major ? 2 : 1);
        if (major) { const th = Math.floor(Math.abs(v) / 1000), rest = Math.abs(v) % 1000; const s = (v < 0 ? '-' : '') + (th ? th : '') ; ctx.font = D.font(14); ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.font = D.font(18, 'bold'); ctx.fillText(s, x + 18, yy); const sw = ctx.measureText(s).width; ctx.font = D.font(14); ctx.fillText(U.pad(rest, 3), x + 18 + sw, yy); }
      }
      // trend
      if (Math.abs(P.altTrend) > 20 && !a.onGround) D.line(ctx, x + 1, cy, x + 1, cy - U.clamp(P.altTrend, -300, 300) * pf, C.magenta, 4);
      // bugs: geselecteerde hoogte
      const by = U.clamp(cy - (A.altSel - alt) * pf, y + 8, y + h - 8);
      D.poly(ctx, [[x, by - 12], [x + 12, by - 12], [x + 12, by - 4], [x + 5, by], [x + 12, by + 4], [x + 12, by + 12], [x, by + 12]], C.cyan);
      // minimums
      if (A.minimumsOn && A.minimums != null) { const my = cy - (A.minimums - alt) * pf; if (my > y && my < y + h) { D.poly(ctx, [[x + 2, my], [x + 14, my - 8], [x + 14, my + 8]], alt <= A.minimums ? C.yellow : C.cyan); } }
      ctx.restore();
      // uitlezing
      D.poly(ctx, [[x + 2, cy], [x + 14, cy - 9], [x + 14, cy - 22], [x + w - 2, cy - 22], [x + w - 2, cy + 22], [x + 14, cy + 22], [x + 14, cy + 9]], '#000', '#fff', 2);
      const shown = Math.round(D.altVal(alt) / 10) * 10;
      D.text(ctx, String(shown), x + w - 8, cy, { size: 28, color: '#fff', align: 'right', weight: 'bold' });
    }
    // baro
    D.box(ctx, x, y + h + 2, w, 24, '#000', '#3a4350', 1);
    D.text(ctx, A.baroStd ? 'STD' : D.fmtBaro(A.baro), x + w / 2, y + h + 14, { size: 17, color: C.cyan, align: 'center', weight: 'bold' });
    D.zone(x, y + h + 2, w, 24, () => G3X.ui.openBaro(), 'baro');
    D.text(ctx, D.fmtAltUnit(), x + w - 4, y - 42, { size: 12, color: '#9fb3c8', align: 'right' });
  }

  // ---------- VSI ----------
  function drawVsi(ctx, x, y, w, h, cy, vs, A) {
    D.box(ctx, x, y, w, h, 'rgba(0,0,0,0.45)');
    const map = v => { v = U.clamp(v, -2200, 2200); const s = Math.sign(v), m = Math.abs(v); const px = m <= 1000 ? m * 0.09 : 90 + (m - 1000) * 0.045; return cy - s * px; };
    for (const v of [-2000, -1000, -500, 0, 500, 1000, 2000]) { const yy = map(v); D.line(ctx, x, yy, x + (v % 1000 === 0 ? 10 : 6), yy, '#fff', 1.5); if (v % 1000 === 0 && v) D.text(ctx, String(Math.abs(v) / 1000), x + 14, yy, { size: 13, color: '#fff' }); }
    const py = map(vs);
    D.poly(ctx, [[x, py], [x + 10, py - 9], [x + w, py - 9], [x + w, py + 9], [x + 10, py + 9]], '#000', '#fff', 1.5);
    if (Math.abs(vs) >= 100) D.text(ctx, String(Math.round(vs / 50) * 50 / 100 * 100 | 0).replace(/-/, '-'), x + w - 2, py, { size: 12, color: '#fff', align: 'right', weight: 'bold' });
  }

  // ---------- verticale afwijking ----------
  function drawVdev(ctx, x, cy, A, S) {
    const n = A.nav; const src = A.navSource;
    let dots = null, color = C.magenta, label = 'G';
    if (src === 'GPS' && n && n.gpValid && n.vdev != null) {
      const distFt = Math.max(0.3, U.distNm(S.ac, n.legTo)) * 6076; const full = Math.max(150, Math.tan(0.7 * U.DEG) * distFt);
      dots = U.clamp(-n.vdev / (full / 2), -2.2, 2.2);
    } else if (src !== 'GPS') { const d = A[src.toLowerCase()].data; if (d.gsValid) { dots = U.clamp(d.gsDev, -2.2, 2.2); color = C.green; } }
    else if (n && n.vnav && n.vnav.todDis < 5) { dots = U.clamp(-n.vnav.vdev / 500, -2.2, 2.2); label = 'V'; } // VNAV-afwijking vanaf 5 nm vóór TOD
    if (dots == null) return;
    const sp = 32;
    D.box(ctx, x - 12, cy - 2.5 * sp - 16, 24, 5 * sp + 32, 'rgba(0,0,0,0.5)');
    D.text(ctx, label, x, cy - 2.5 * sp - 4, { size: 13, color, align: 'center', weight: 'bold' });
    for (const d of [-2, -1, 1, 2]) D.circle(ctx, x, cy + d * sp, 3, null, '#fff', 1.5);
    D.line(ctx, x - 8, cy, x + 8, cy, '#fff', 2);
    const yy = cy - dots * sp;
    if (label === 'V') D.poly(ctx, [[x - 8, yy - 8], [x, yy], [x - 8, yy + 8]], null, color, 3, false);
    else D.poly(ctx, [[x, yy - 9], [x + 8, yy], [x, yy + 9], [x - 8, yy]], color, '#000', 1);
  }

  // ---------- CAS ----------
  function drawCas(ctx, x, y, w, A, S) {
    const list = A.cas.slice(0, 7); if (!list.length) return;
    const lh = 22;
    list.forEach((c, i) => {
      const ack = A.acked[c.id] && A.acked[c.id].seen; const flash = !ack && c.level !== 'ADV' && D.blink(2);
      const col = c.level === 'WARN' ? C.red : c.level === 'CAUT' ? C.yellow : '#fff';
      D.box(ctx, x, y + i * lh, w, lh - 2, flash ? col : 'rgba(0,0,0,0.75)', col, 1);
      D.text(ctx, c.text, x + w / 2, y + i * lh + lh / 2 - 1, { size: 14, color: flash ? '#000' : col, align: 'center', weight: 'bold' });
    });
    D.zone(x, y, w, list.length * lh, () => { for (const c of A.cas) if (A.acked[c.id]) A.acked[c.id].seen = true; }, 'cas');
  }

  // ---------- HSI ----------
  function drawHsi(ctx, hx, hy, R, A, S) {
    const a = S.ac, n = A.nav; const hdg = S.fail.ahrs ? a.trk : a.hdg;
    const src = A.navSource;
    const srcColor = src === 'GPS' ? C.magenta : C.green;
    ctx.save();
    D.circle(ctx, hx, hy, R + 2, 'rgba(0,0,0,0.45)');
    // roos
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(-hdg * U.DEG);
    for (let d = 0; d < 360; d += 5) {
      ctx.save(); ctx.rotate(d * U.DEG);
      const major = d % 10 === 0;
      D.line(ctx, 0, -R, 0, -R + (major ? 12 : 7), '#fff', major ? 2 : 1);
      if (d % 30 === 0) { const lab = d === 0 ? 'N' : d === 90 ? 'E' : d === 180 ? 'S' : d === 270 ? 'W' : String(d / 10); D.text(ctx, lab, 0, -R + 24, { size: d % 90 === 0 ? 18 : 15, color: '#fff', align: 'center', weight: d % 90 === 0 ? 'bold' : 'normal' }); }
      ctx.restore();
    }
    // heading bug
    ctx.save(); ctx.rotate(A.hdgBug * U.DEG); D.poly(ctx, [[-9, -R - 1], [-9, -R + 8], [-4, -R + 8], [0, -R + 3], [4, -R + 8], [9, -R + 8], [9, -R - 1]], C.cyan, '#000', 1); ctx.restore();
    // track-indicator
    ctx.save(); ctx.rotate(a.trk * U.DEG); D.poly(ctx, [[0, -R + 2], [-6, -R + 12], [0, -R + 22], [6, -R + 12]], C.magenta, '#000', 1); ctx.restore();
    // bearing pointers
    const bp = (sel, dbl) => {
      let brg = null;
      if (sel === 'GPS' && n && n.valid) brg = n.brg;
      else if (sel === 'NAV1' && A.nav1.data.valid && !A.nav1.data.loc) brg = U.norm360(A.nav1.data.radial + 180);
      else if (sel === 'NAV2' && A.nav2.data.valid && !A.nav2.data.loc) brg = U.norm360(A.nav2.data.radial + 180);
      if (brg == null) return;
      ctx.save(); ctx.rotate(brg * U.DEG);
      const col = C.cyan;
      if (!dbl) { D.line(ctx, 0, -R + 14, 0, -40, col, 2); D.line(ctx, 0, 40, 0, R - 14, col, 2); D.poly(ctx, [[0, -R + 14], [-8, -R + 30], [8, -R + 30]], null, col, 2); }
      else { for (const s of [-4, 4]) { D.line(ctx, s, -R + 14, s, -40, col, 2); D.line(ctx, s, 40, s, R - 14, col, 2); } D.poly(ctx, [[0, -R + 14], [-10, -R + 32], [10, -R + 32]], null, col, 2); }
      ctx.restore();
    };
    if (A.brg1 !== 'OFF') bp(A.brg1, false);
    if (A.brg2 !== 'OFF') bp(A.brg2, true);
    // course pointer + CDI
    let crs = src === 'GPS' ? (n && n.valid ? n.dtk : A.crs1) : A[src.toLowerCase()].obs;
    let devDots = 0, toFrom = 'OFF', valid = false;
    if (src === 'GPS') { if (n && n.valid && !S.fail.gps) { valid = true; devDots = U.clamp(-n.xtk / n.scale * 2, -2.4, 2.4); toFrom = n.toFrom; } }
    else { const d = A[src.toLowerCase()].data; if (d.valid) { valid = true; devDots = U.clamp(d.dev, -2.4, 2.4); toFrom = d.toFrom; } }
    ctx.save(); ctx.rotate(crs * U.DEG);
    const dot = R * 0.3;
    D.poly(ctx, [[0, -R + 6], [-9, -R + 26], [-3, -R + 26], [-3, -dot * 2.2], [3, -dot * 2.2], [3, -R + 26], [9, -R + 26]], srcColor, '#000', 1);
    D.box(ctx, -3, dot * 2.2, 6, R - 8 - dot * 2.2, srcColor, '#000', 1);
    for (const d of [-2, -1, 1, 2]) D.circle(ctx, d * dot, 0, 4, null, '#fff', 1.5);
    if (valid) { const off = devDots * dot; D.box(ctx, off - 3, -dot * 2.1, 6, dot * 4.2, srcColor, '#000', 1); if (toFrom === 'TO') D.poly(ctx, [[0, -dot * 2.3 - 22], [-8, -dot * 2.3 - 6], [8, -dot * 2.3 - 6]], srcColor); else if (toFrom === 'FROM') D.poly(ctx, [[0, dot * 2.3 + 22], [-8, dot * 2.3 + 6], [8, dot * 2.3 + 6]], srcColor); }
    ctx.restore();
    ctx.restore(); // roos
    // lubber & heading box
    D.poly(ctx, [[hx, hy - R - 2], [hx - 8, hy - R - 16], [hx + 8, hy - R - 16]], '#fff');
    D.box(ctx, hx - 42, hy - R - 46, 84, 28, '#000', '#fff', 1.5);
    D.text(ctx, U.fmtHdg(hdg) + '°', hx, hy - R - 32, { size: 22, color: '#fff', align: 'center', weight: 'bold' });
    // vliegtuigje
    D.poly(ctx, [[hx, hy - 12], [hx + 3, hy - 4], [hx + 12, hy], [hx + 3, hy + 2], [hx + 2, hy + 9], [hx + 5, hy + 12], [hx - 5, hy + 12], [hx - 2, hy + 9], [hx - 3, hy + 2], [hx - 12, hy], [hx - 3, hy - 4]], '#fff', '#000', 1);
    // nav-bron en schaal
    const lx = hx - R - 4, ly = hy - R + 4;
    D.box(ctx, lx - 54, ly, 56, 42, 'rgba(0,0,0,0.6)');
    D.text(ctx, src === 'GPS' ? 'GPS' : (A[src.toLowerCase()].data.loc ? 'LOC' + src.slice(-1) : 'VOR' + src.slice(-1)), lx - 26, ly + 12, { size: 15, color: srcColor, align: 'center', weight: 'bold' });
    D.text(ctx, src === 'GPS' ? (S.fail.gps ? 'LOI' : (n && n.valid ? n.scaleLabel : '')) : (A[src.toLowerCase()].data.ident || '---'), lx - 26, ly + 30, { size: 13, color: src === 'GPS' && S.fail.gps ? C.yellow : srcColor, align: 'center' });
    D.zone(lx - 54, ly, 56, 42, () => G3X.ui.cycleNavSource(), 'navsrc');
    if (src === 'GPS' && S.fail.gps) D.textOutline(ctx, 'LOI', hx, hy + 40, { size: 16, color: C.yellow, align: 'center' });
    if (src === 'GPS' && A.fpl.susp) { D.box(ctx, hx + 20, hy - R + 4, 46, 20, '#000', '#fff', 1); D.text(ctx, 'SUSP', hx + 43, hy - R + 14, { size: 13, color: '#fff', align: 'center', weight: 'bold' }); D.zone(hx + 20, hy - R + 4, 46, 20, () => G3X.ui.button('SUSP'), 'susp'); }
    if (src === 'GPS' && A.fpl.obs) { D.text(ctx, 'OBS', hx + 43, hy - R + 38, { size: 13, color: C.magenta, align: 'center', weight: 'bold' }); D.zone(hx + 20, hy - R + 28, 46, 20, () => G3X.ui.button('OBS'), 'obs'); }
    // CRS-veld (rechtsonder HSI) en XTK
    const cx2 = hx + R + 6;
    D.box(ctx, cx2, hy - R + 4, 70, 36, 'rgba(0,0,0,0.6)');
    D.text(ctx, src === 'GPS' ? 'DTK' : 'CRS', cx2 + 4, hy - R + 14, { size: 12, color: '#9fb3c8' });
    D.text(ctx, U.fmtHdg(crs) + '°', cx2 + 66, hy - R + 28, { size: 17, color: srcColor, align: 'right', weight: 'bold' });
    D.zone(cx2, hy - R + 4, 70, 36, () => G3X.ui.openCrs(), 'crs');
    // bearing pointer labels
    const bl = (which, sel, yoff) => {
      D.box(ctx, cx2, hy + yoff, 70, 30, 'rgba(0,0,0,0.6)');
      D.text(ctx, 'BRG' + which, cx2 + 4, hy + yoff + 8, { size: 11, color: '#9fb3c8' });
      let val = sel;
      if (sel === 'GPS') val = n && n.valid ? n.legTo.id : 'GPS';
      if (sel === 'NAV1' || sel === 'NAV2') val = A[sel.toLowerCase()].data.ident || sel;
      D.text(ctx, val, cx2 + 66, hy + yoff + 20, { size: 13, color: C.cyan, align: 'right' });
      D.zone(cx2, hy + yoff, 70, 30, () => G3X.ui.cycleBrg(which), 'brg' + which);
    };
    bl(1, A.brg1, 10); bl(2, A.brg2, 44);
    // wind
    drawWind(ctx, lx - 54, hy + 10, A, S);
    // afstand/tijd links onder
    if (n && n.valid) {
      D.box(ctx, lx - 54, hy + 48, 56, 30, 'rgba(0,0,0,0.6)');
      D.text(ctx, n.legTo.id, lx - 26, hy + 57, { size: 12, color: C.magenta, align: 'center' });
      D.text(ctx, U.fmtDis(D.distVal(n.dis)), lx - 26, hy + 71, { size: 14, color: '#fff', align: 'center', weight: 'bold' });
    }
    ctx.restore();
    D.zone(hx - R, hy - R, 2 * R, 2 * R, () => G3X.ui.openHsiOptions(), 'hsi');
  }
  function drawWind(ctx, x, y, A, S) {
    const a = S.ac, w = G3X.sim.windAt();
    D.box(ctx, x, y, 56, 34, 'rgba(0,0,0,0.6)');
    D.zone(x, y, 56, 34, () => { A.windMode = (A.windMode + 1) % 4; }, 'wind');
    if (A.windMode === 0 || a.onGround) { D.text(ctx, a.onGround ? 'NO WIND' : 'WIND', x + 28, y + 17, { size: 11, color: '#9fb3c8', align: 'center' }); if (A.windMode === 0) D.text(ctx, 'OFF', x + 28, y + 26, { size: 10, color: '#9fb3c8', align: 'center' }); return; }
    const rel = U.norm180(w.dir - a.hdg);
    if (A.windMode === 1) {
      const head = Math.round(w.spd * Math.cos(rel * U.DEG)), cross = Math.round(w.spd * Math.sin(rel * U.DEG));
      D.text(ctx, (head >= 0 ? '↓' : '↑') + Math.abs(head), x + 14, y + 17, { size: 14, color: '#fff', align: 'center' });
      D.text(ctx, (cross >= 0 ? '←' : '→') + Math.abs(cross), x + 42, y + 17, { size: 14, color: '#fff', align: 'center' });
    } else if (A.windMode === 2) {
      ctx.save(); ctx.translate(x + 14, y + 17); ctx.rotate((rel + 180) * U.DEG); D.poly(ctx, [[0, -10], [-5, 2], [0, -1], [5, 2]], '#fff'); D.line(ctx, 0, -2, 0, 10, '#fff', 2); ctx.restore();
      D.text(ctx, String(Math.round(w.spd)), x + 38, y + 17, { size: 16, color: '#fff', align: 'center', weight: 'bold' });
    } else D.text(ctx, `${U.fmtHdg(w.dir)}°/${U.pad(Math.round(w.spd), 2)}`, x + 28, y + 17, { size: 13, color: '#fff', align: 'center', weight: 'bold' });
  }

  // ---------- hoeken ----------
  function drawCorners(ctx, X, Y, W, H, A, S) {
    // linksonder: NAV1/NAV2 (actief · standby · ident) en OAT — zoals op de G3X staan de NAV-frequenties op de PFD
    const nb = { x: X + 4, y: Y + H - 76, w: 150, h: 72 };
    D.box(ctx, nb.x, nb.y, nb.w, nb.h, 'rgba(0,0,0,0.65)', '#3a4350', 1);
    [1, 2].forEach((n, i) => {
      const rd = A['nav' + n], yy = nb.y + 12 + i * 22;
      D.text(ctx, 'NAV' + n, nb.x + 4, yy, { size: 10, color: '#9fb3c8' });
      D.text(ctx, U.fmtNav(rd.active), nb.x + 36, yy, { size: 15, color: S.fail['nav' + n] ? C.red : (A.navSource === 'NAV' + n ? C.green : '#fff'), weight: 'bold' });
      D.text(ctx, U.fmtNav(rd.standby), nb.x + nb.w - 4, yy, { size: 13, color: C.cyan, align: 'right' });
      D.zone(nb.x, yy - 11, 90, 22, () => G3X.avionics.swapNav(n), 'nav' + n + 'act');
      D.zone(nb.x + 90, yy - 11, nb.w - 90, 22, () => G3X.ui.openFreq('NAV', n), 'nav' + n + 'stby');
    });
    D.text(ctx, (A.nav1.ident ? 'NAV1 ' + A.nav1.ident : '') + (A.nav2.ident ? '  NAV2 ' + A.nav2.ident : ''), nb.x + 4, nb.y + 58, { size: 11, color: C.green });
    D.text(ctx, 'OAT ' + D.tempVal(G3X.sim.oat()), nb.x + nb.w - 4, nb.y + 58, { size: 11, color: '#fff', align: 'right' });
    // minimums
    if (A.minimumsOn && A.minimums != null) { D.text(ctx, 'MINS ' + A.minimums, X + W - 140, Y + H - 90, { size: 13, color: C.cyan, align: 'right' }); }
  }

  function drawAnnunciations(ctx, cx, cy, A, S) {
    const a = S.ac;
    if (A.minFlag && D.blink(2)) D.textOutline(ctx, 'MINIMUMS', cx, cy + 70, { size: 24, color: C.yellow, align: 'center' });
    if (a.crashed) { D.box(ctx, cx - 160, cy - 40, 320, 80, 'rgba(0,0,0,0.8)', C.red, 2); D.text(ctx, 'HARD LANDING / CRASH', cx, cy - 12, { size: 20, color: C.red, align: 'center', weight: 'bold' }); D.text(ctx, 'Reset the scenario in the trainer panel', cx, cy + 14, { size: 14, color: '#fff', align: 'center' }); }
    if (S.paused && !a.crashed) D.textOutline(ctx, 'SIM PAUSED', cx, cy - 130, { size: 22, color: C.yellow, align: 'center' });
  }

  G3X.pfd = P;
})();

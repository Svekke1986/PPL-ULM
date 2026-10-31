/* Bovenbalk (COM1 · audio · XPDR · datavelden · COM2) en onderste strook (knopfuncties · Messages · klok),
   ingedeeld zoals op de G3X Touch (GDU 460). NRST, Direct-To, MENU en BACK zijn harde toetsen op de bezel. */
window.G3X = window.G3X || {};
(function () {
  const U = G3X.util, D = G3X.display, C = D.C, NAV = G3X.nav;

  // naam van het station bij een COM-frequentie (bv. "EBZH RADIO")
  function stationName(f) {
    for (const apt of NAV.AIRPORTS) for (const fr of apt.freqs) if (fr.freq && Math.abs(fr.freq - f) < 0.0005) return `${apt.id} ${fr.type}`;
    if (Math.abs(f - 121.5) < 0.0005) return 'EMERGENCY';
    for (const s of NAV.AIRSPACES) if (s.freq && Math.abs(s.freq - f) < 0.0005) return s.name.split(' ')[0] + ' ' + s.type;
    return '';
  }

  const TB = {};
  TB.render = (ctx, r) => {
    const A = G3X.avionics.A, S = G3X.sim.S;
    D.box(ctx, r.x, r.y, r.w, r.h, '#05070a');
    D.line(ctx, r.x, r.y + r.h - 1, r.x + r.w, r.y + r.h - 1, '#2a3340', 1);
    const sep = x => D.line(ctx, x, r.y + 4, x, r.y + r.h - 5, '#2a3340');
    const comBox = (n, x, w) => {
      const rd = A['com' + n];
      D.text(ctx, 'COM' + n, x + 6, r.y + 10, { size: 11, color: '#9fb3c8' });
      D.text(ctx, 'STBY', x + w / 2 + 6, r.y + 10, { size: 11, color: '#9fb3c8' });
      D.text(ctx, U.fmtFreq(rd.active), x + 6, r.y + 26, { size: 21, color: S.fail['com' + n] ? C.red : '#fff', weight: 'bold' });
      D.text(ctx, U.fmtFreq(rd.standby), x + w / 2 + 6, r.y + 26, { size: 19, color: C.cyan });
      D.text(ctx, stationName(rd.active), x + 6, r.y + 40, { size: 10, color: '#9fb3c8' });
      D.text(ctx, stationName(rd.standby), x + w / 2 + 6, r.y + 40, { size: 10, color: '#9fb3c8' });
      D.zone(x, r.y, w / 2, r.h, () => G3X.avionics.swapCom(n), 'com' + n + 'act');
      D.zone(x + w / 2, r.y, w / 2, r.h, () => G3X.ui.openFreq('COM', n), 'com' + n + 'stby');
    };
    // COM1
    comBox(1, r.x, 236); sep(r.x + 236);
    // audio
    let x = r.x + 240;
    D.text(ctx, 'MIC', x + 4, r.y + 12, { size: 10, color: '#9fb3c8' }); D.text(ctx, A.com1.mic ? 'COM1' : 'COM2', x + 30, r.y + 12, { size: 12, color: C.green, weight: 'bold' });
    D.text(ctx, 'MON', x + 4, r.y + 30, { size: 10, color: '#9fb3c8' }); D.text(ctx, [A.com1.mon ? '1' : '', A.com2.mon ? '2' : ''].filter(Boolean).map(k => 'COM' + k).join(' ') || '—', x + 30, r.y + 30, { size: 12, color: '#fff' });
    D.zone(x, r.y, 84, r.h, () => G3X.ui.openAudio(), 'audio'); sep(x + 84);
    // XPDR
    x += 88; const xp = A.xpdr;
    D.text(ctx, 'XPDR', x + 4, r.y + 10, { size: 11, color: '#9fb3c8' });
    D.text(ctx, xp.code, x + 4, r.y + 27, { size: 21, color: xp.mode === 'STBY' ? '#fff' : C.green, weight: 'bold' });
    D.text(ctx, xp.mode === 'ALT' && S.ac.onGround ? 'GND' : xp.mode, x + 66, r.y + 20, { size: 13, color: '#fff', weight: 'bold' });
    D.text(ctx, 'IDENT', x + 66, r.y + 36, { size: 11, color: xp.ident > 0 ? C.green : '#6b7a8c', weight: xp.ident > 0 ? 'bold' : 'normal' });
    if (xp.reply) D.text(ctx, 'R', x + 108, r.y + 20, { size: 12, color: C.green, align: 'right' });
    D.zone(x, r.y, 112, r.h, () => G3X.ui.openXpdr(), 'xpdr'); sep(x + 112);
    // datavelden
    x += 116; const n = A.nav; const fw = (r.w - 236 - 240 - 4 - (x - r.x)) / 5;
    const fields = [
      ['Timer', U.fmtTimer(A.timer.value), () => G3X.ui.showPage('TIMER')],
      ['WPT', n && n.valid ? n.legTo.id : '____'],
      ['BRG', n && n.valid ? U.fmtHdg(n.brg) + '°' : '___°'],
      ['DIST', n && n.valid ? U.fmtDis(D.distVal(n.dis)) + ' ' + D.distUnit().toLowerCase() : '__._'],
      ['ETE', n && n.valid ? U.fmtEte(n.ete) : '__:__'],
    ];
    fields.forEach((f, i) => {
      const fx = x + i * fw;
      D.text(ctx, f[0], fx + fw / 2, r.y + 10, { size: 11, color: '#9fb3c8', align: 'center' });
      D.text(ctx, f[1], fx + fw / 2, r.y + 29, { size: 17, color: f[0] === 'WPT' ? C.magenta : '#fff', align: 'center', weight: 'bold' });
      if (f[2]) D.zone(fx, r.y, fw, r.h, f[2], 'df' + i);
      sep(fx + fw);
    });
    // COM2
    comBox(2, r.x + r.w - 236, 236);
  };
  G3X.topbar = TB;

  // ---------- onderste strook ----------
  const BB = {};
  const LABEL = { HDG: 'Heading', ALT: 'Altitude', BARO: 'Baro', CRS: 'Course', RANGE: 'Range', PAN: 'Pan', 'PAN ↕': 'Pan', SCROLL: 'Scroll', SELECT: 'List', '—': '', 'COM1 MHz': 'COM1 MHz', 'COM1 kHz': 'COM1 kHz', 'MHz': 'MHz', 'kHz': 'kHz', '+/−': '+/−', CHAR: 'Character' };
  const lab = s => LABEL[s] ?? s;
  BB.render = (ctx, r) => {
    const A = G3X.avionics.A;
    D.box(ctx, r.x, r.y, r.w, r.h, '#05070a');
    D.line(ctx, r.x, r.y, r.x + r.w, r.y, '#2a3340', 1);
    const kl = G3X.ui.knobLabels();
    const knobText = (k, x, align) => {
      const o = lab(k.outer), i = lab(k.inner);
      const t = o && i ? `${o}  ↕  ${i}` : (o || i);
      D.text(ctx, t, x, r.y + r.h / 2, { size: 13, color: '#dfe6ee', align, weight: 'bold' });
      if (k.push) D.text(ctx, '  |  Push: ' + k.push, x + (align === 'left' ? ctx.measureText(t).width + 4 : -ctx.measureText(t).width - 4), r.y + r.h / 2, { size: 12, color: '#9fb3c8', align });
    };
    knobText(kl.left, r.x + 10, 'left');
    knobText(kl.right, r.x + r.w - 10, 'right');
    // midden: Messages + klok (+ SUSP/OBS wanneer van toepassing)
    const cx = r.x + r.w / 2;
    const flash = A.msgNew && D.blink(2);
    D.box(ctx, cx - 120, r.y + 3, 100, r.h - 6, flash ? C.yellow : '#141a22', flash ? C.yellow : '#3a4350', 1, 5);
    D.text(ctx, 'Messages', cx - 70, r.y + r.h / 2, { size: 13, color: flash ? '#000' : '#fff', align: 'center', weight: 'bold' });
    D.zone(cx - 120, r.y, 100, r.h, () => G3X.ui.button('MSG'), 'msg');
    D.text(ctx, U.fmtTime(new Date(), A.clockUtc) + (A.clockUtc ? ' UTC' : ' LCL'), cx + 10, r.y + r.h / 2, { size: 13, color: '#fff' });
    if (A.fpl.susp) { D.box(ctx, cx + 120, r.y + 3, 70, r.h - 6, '#5a3a00', C.yellow, 1, 5); D.text(ctx, 'SUSP', cx + 155, r.y + r.h / 2, { size: 13, color: '#fff', align: 'center', weight: 'bold' }); D.zone(cx + 120, r.y, 70, r.h, () => G3X.ui.button('SUSP'), 'susp'); }
    else if (A.fpl.obs) { D.box(ctx, cx + 120, r.y + 3, 70, r.h - 6, '#1f3a5f', C.cyan, 1, 5); D.text(ctx, 'OBS', cx + 155, r.y + r.h / 2, { size: 13, color: '#fff', align: 'center', weight: 'bold' }); D.zone(cx + 120, r.y, 70, r.h, () => G3X.ui.button('OBS'), 'obs'); }
  };
  G3X.buttonbar = BB;
})();

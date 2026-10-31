/* Bovenbalk (COM1 · audio · XPDR · datavelden · COM2) en onderste strook (knopfuncties · Messages · klok),
   ingedeeld zoals op de G3X Touch (GDU 460). NRST, Direct-To, MENU en BACK zijn harde toetsen op de bezel. */
window.G3X = window.G3X || {};
(function () {
  const U = G3X.util, D = G3X.display, C = D.C;

  const TB = {};
  TB.render = (ctx, r) => {
    const A = G3X.avionics.A, S = G3X.sim.S, a = S.ac, n = A.nav;
    D.box(ctx, r.x, r.y, r.w, r.h, '#05070a');
    D.line(ctx, r.x, r.y + r.h - 1, r.x + r.w, r.y + r.h - 1, '#2a3340', 1);
    // in deze installatie zijn radio en transponder aparte toestellen: de bovenbalk toont alleen datavelden
    const fields = [
      ['GS', D.spdVal(a.gs) + ' ' + D.spdUnit().toLowerCase()],
      ['TRK', U.fmtHdg(a.trk) + '°'],
      ['Timer', U.fmtTimer(A.timer.value), () => G3X.ui.showPage('TIMER')],
      ['WPT', n && n.valid ? n.legTo.id : '____'],
      ['BRG', n && n.valid ? U.fmtHdg(n.brg) + '°' : '___°'],
      ['DIST', n && n.valid ? U.fmtDis(D.distVal(n.dis)) + ' ' + D.distUnit().toLowerCase() : '__._'],
      ['ETE', n && n.valid ? U.fmtEte(n.ete) : '__:__'],
      ['OAT', D.tempVal(G3X.sim.oat())],
    ];
    const fw = r.w / fields.length;
    fields.forEach((f, i) => {
      const fx = r.x + i * fw;
      D.text(ctx, f[0], fx + fw / 2, r.y + 11, { size: 11, color: '#9fb3c8', align: 'center' });
      D.text(ctx, f[1], fx + fw / 2, r.y + 31, { size: 19, color: f[0] === 'WPT' ? C.magenta : '#fff', align: 'center', weight: 'bold' });
      if (f[2]) D.zone(fx, r.y, fw, r.h, f[2], 'df' + i);
      if (i) D.line(ctx, fx, r.y + 6, fx, r.y + r.h - 7, '#2a3340');
    });
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

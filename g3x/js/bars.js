/* Bovenbalk (NAV/COM/XPDR-velden) en onderste knoppenbalk (Back, Direct-To, NRST, MENU, MSG, Home …). */
window.G3X = window.G3X || {};
(function () {
  const U = G3X.util, D = G3X.display, C = D.C;

  const TB = {};
  TB.render = (ctx, r) => {
    const A = G3X.avionics.A, S = G3X.sim.S;
    D.box(ctx, r.x, r.y, r.w, r.h, '#05070a');
    D.line(ctx, r.x, r.y + r.h - 1, r.x + r.w, r.y + r.h - 1, '#2a3340', 1);
    // NAV-velden links
    const navField = (n, x) => {
      const rd = A['nav' + n], w = 170;
      D.text(ctx, 'NAV' + n, x + 4, r.y + 11, { size: 11, color: '#9fb3c8' });
      const idTxt = rd.ident || '';
      D.text(ctx, idTxt, x + 4, r.y + 28, { size: 12, color: C.green });
      D.text(ctx, U.fmtNav(rd.active), x + 95, r.y + 20, { size: 20, color: S.fail['nav' + n] ? C.red : '#fff', align: 'right', weight: 'bold' });
      D.text(ctx, U.fmtNav(rd.standby), x + w - 4, r.y + 20, { size: 17, color: C.cyan, align: 'right' });
      D.zone(x, r.y, 98, r.h, () => G3X.avionics.swapNav(n), 'nav' + n + 'act');
      D.zone(x + 98, r.y, w - 98, r.h, () => G3X.ui.openFreq('NAV', n), 'nav' + n + 'stby');
      D.line(ctx, x + w + 4, r.y + 6, x + w + 4, r.y + r.h - 6, '#2a3340');
    };
    navField(1, r.x + 4); navField(2, r.x + 184);
    // midden: pagina/tijd
    D.text(ctx, pageTitle(A), r.x + r.w / 2, r.y + 20, { size: 15, color: '#9fb3c8', align: 'center', weight: 'bold' });
    // COM rechts
    const comField = (n, x) => {
      const rd = A['com' + n], w = 190;
      D.text(ctx, 'COM' + n, x + 4, r.y + 11, { size: 11, color: '#9fb3c8' });
      if (rd.mic) { D.box(ctx, x + 2, r.y + 20, 30, 14, C.green); D.text(ctx, 'MIC', x + 17, r.y + 27, { size: 10, color: '#000', align: 'center', weight: 'bold' }); }
      else if (rd.mon) D.text(ctx, 'MON', x + 4, r.y + 28, { size: 10, color: '#9fb3c8' });
      D.text(ctx, U.fmtFreq(rd.active), x + 112, r.y + 20, { size: 20, color: S.fail['com' + n] ? C.red : '#fff', align: 'right', weight: 'bold' });
      D.text(ctx, U.fmtFreq(rd.standby), x + w - 4, r.y + 20, { size: 17, color: C.cyan, align: 'right' });
      D.zone(x, r.y, 36, r.h, () => G3X.avionics.setMic(n), 'com' + n + 'mic');
      D.zone(x + 36, r.y, 80, r.h, () => G3X.avionics.swapCom(n), 'com' + n + 'act');
      D.zone(x + 116, r.y, w - 116, r.h, () => G3X.ui.openFreq('COM', n), 'com' + n + 'stby');
      D.line(ctx, x - 4, r.y + 6, x - 4, r.y + r.h - 6, '#2a3340');
    };
    comField(1, r.x + r.w - 500); comField(2, r.x + r.w - 300);
    // XPDR
    const x = r.x + r.w - 104, xp = A.xpdr;
    D.text(ctx, 'XPDR', x + 4, r.y + 11, { size: 11, color: '#9fb3c8' });
    D.text(ctx, xp.code, x + 62, r.y + 24, { size: 20, color: xp.mode === 'STBY' ? '#fff' : C.green, align: 'right', weight: 'bold' });
    D.text(ctx, xp.ident > 0 ? 'IDNT' : xp.mode, x + 100, r.y + 20, { size: 13, color: xp.ident > 0 ? C.green : '#fff', align: 'right' });
    if (xp.reply) D.text(ctx, 'R', x + 100, r.y + 33, { size: 11, color: C.green, align: 'right' });
    D.zone(x, r.y, 104, r.h, () => G3X.ui.openXpdr(), 'xpdr');
    D.line(ctx, x - 4, r.y + 6, x - 4, r.y + r.h - 6, '#2a3340');
  };
  function pageTitle(A) {
    const names = { MAP: 'Map', FPL: 'Active Flight Plan', NRST: 'Nearest', WPT: 'Waypoint Info', SETUP: 'Setup', CHK: 'Checklist', TIMER: 'Timer', INFO: 'Info', ENG: 'Engine', TERRAIN: 'Terrain', HOME: 'Main Menu', MSG: 'Messages', TRAFFIC: 'Traffic', WX: 'Weather', CHARTS: 'Charts', USER: 'User Waypoints', FPLLIST: 'Flight Plan List', PROC: 'Procedures', AUX: 'Aux', TRIP: 'Trip Computer' };
    const t = A.layout === 'PFD' ? (A.pfdPage === 'ENG' ? 'Engine' : 'PFD') : names[A.mfdPage] || A.mfdPage;
    return A.layout === 'SPLIT' ? 'PFD  |  ' + t : t;
  }
  G3X.topbar = TB;

  // ---------- knoppenbalk ----------
  const BB = {};
  BB.render = (ctx, r) => {
    const A = G3X.avionics.A;
    D.box(ctx, r.x, r.y, r.w, r.h, '#05070a');
    D.line(ctx, r.x, r.y, r.x + r.w, r.y, '#2a3340', 1);
    // knoplabels links/rechts
    const kl = G3X.ui.knobLabels();
    D.text(ctx, kl.left.outer, r.x + 8, r.y + 20, { size: 12, color: C.cyan, weight: 'bold' });
    D.text(ctx, kl.left.inner, r.x + 8, r.y + 42, { size: 12, color: '#fff', weight: 'bold' });
    D.text(ctx, 'outer ▸', r.x + 90, r.y + 20, { size: 10, color: '#6b7a8c' }); D.text(ctx, 'inner ▸', r.x + 90, r.y + 42, { size: 10, color: '#6b7a8c' });
    D.text(ctx, kl.right.outer, r.x + r.w - 8, r.y + 20, { size: 12, color: C.cyan, align: 'right', weight: 'bold' });
    D.text(ctx, kl.right.inner, r.x + r.w - 8, r.y + 42, { size: 12, color: '#fff', align: 'right', weight: 'bold' });
    D.text(ctx, '◂ outer', r.x + r.w - 92, r.y + 20, { size: 10, color: '#6b7a8c', align: 'right' }); D.text(ctx, '◂ inner', r.x + r.w - 92, r.y + 42, { size: 10, color: '#6b7a8c', align: 'right' });
    // knoppen
    const btns = [
      { id: 'BACK', label: '◀ Back' },
      { id: 'DTO', label: 'Direct-To', glyph: 'D' },
      { id: 'NRST', label: 'Nearest' },
      { id: 'MENU', label: 'Menu' },
      { id: 'MSG', label: 'MSG', flash: A.msgNew },
      { id: 'HOME', label: '⌂ Home' },
      { id: 'PFD', label: 'PFD', on: A.layout === 'PFD' },
      { id: 'SPLIT', label: 'Split', on: A.layout === 'SPLIT' },
      { id: 'MFD', label: 'MFD', on: A.layout === 'MFD' },
    ];
    if (A.fpl.susp) btns.push({ id: 'SUSP', label: 'SUSP', warn: true });
    else if (A.fpl.obs) btns.push({ id: 'OBS', label: 'OBS', on: true });
    const bx0 = r.x + 160, bw = (r.w - 320) / btns.length;
    btns.forEach((b, i) => {
      const x = bx0 + i * bw + 3, y = r.y + 8, w = bw - 6, h = r.h - 16;
      const flash = b.flash && D.blink(2);
      D.box(ctx, x, y, w, h, b.on ? '#1f3a5f' : flash ? C.yellow : b.warn ? '#5a3a00' : '#141a22', b.on ? C.cyan : '#3a4350', 1, 8);
      if (b.glyph) {
        // Direct-To-symbool: een D met een pijl erdoor (zoals op de G3X)
        const gx = x + w / 2 - 6, gy = y + h / 2 - 9;
        D.text(ctx, 'D', gx, gy, { size: 20, color: C.magenta, align: 'center', weight: 'bold' });
        D.line(ctx, gx - 12, gy, gx + 14, gy, C.magenta, 2.5); D.poly(ctx, [[gx + 14, gy - 5], [gx + 20, gy], [gx + 14, gy + 5]], C.magenta);
        D.text(ctx, b.label, x + w / 2, y + h / 2 + 12, { size: 11, color: flash ? '#000' : '#cfd6de', align: 'center' });
      }
      else D.text(ctx, b.label, x + w / 2, y + h / 2, { size: 14, color: flash ? '#000' : '#fff', align: 'center', weight: 'bold' });
      D.zone(x, y, w, h, () => G3X.ui.button(b.id), 'btn-' + b.id);
    });
  };
  G3X.buttonbar = BB;
})();

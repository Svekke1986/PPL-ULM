/* Aanraakinterface (DOM over het canvas): knoppenbalk-acties, pagina's (Home, FPL, NRST, WPT, Setup, Checklist, Timer …),
   dialoogvensters (toetsenborden voor frequenties, transponder, baro, hoogte, heading, Direct-To, AP-paneel …) en de draaiknoppen.
   Alle tekst op het scherm is Engels, zoals op het echte toestel. */
window.G3X = window.G3X || {};
(function () {
  const U = G3X.util, NAV = G3X.nav, D = G3X.display, SIM = G3X.sim, AV = G3X.avionics, esc = U.esc;
  const A = () => AV.A;

  // gebeurtenissenbus voor de scenario-controle
  const bus = { log: [], emit(name, data) { bus.log.push({ name, data, t: SIM.S.t }); if (bus.log.length > 500) bus.log.shift(); }, since(t, name) { return bus.log.filter(e => e.t >= t && (!name || e.name === name)); } };
  G3X.bus = bus;

  const UI = { pane: null, dialogLayer: null, dialog: null, pageBuilt: null, lastPaneRefresh: 0, menuOpen: false, knobLeftSet: 0, sel: 0 };

  // overlays: één per scherm (L = PFD, R = MFD); de DOM-pagina's liggen op het MFD, dialoogvensters op het actieve scherm
  UI.activeScreen = 'L';
  UI.init = overlays => {
    UI.overlays = overlays; UI.dialogLayers = {}; UI.toastEls = {};
    for (const id of ['L', 'R']) {
      const ov = overlays[id];
      ov.innerHTML = (id === 'R' ? '<div id="g3x-pane" class="g3x-pane hidden"></div>' : '') + `<div class="g3x-dialogs" id="g3x-dialogs-${id}"></div><div class="g3x-toast hidden" id="g3x-toast-${id}"></div>`;
      UI.dialogLayers[id] = ov.querySelector(`#g3x-dialogs-${id}`); UI.toastEls[id] = ov.querySelector(`#g3x-toast-${id}`);
      ov.addEventListener('pointerdown', () => { UI.activeScreen = id; if (G3X.audio) G3X.audio.ensure(); }, { passive: true });
    }
    UI.pane = overlays.R.querySelector('#g3x-pane');
  };

  UI.toast = (text, screen, ms = 2500) => { const t = UI.toastEls[screen || UI.activeScreen || 'L']; t.textContent = text; t.classList.remove('hidden'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.add('hidden'), ms); };

  // ---------- pagina's / lay-out ----------
  UI.PAGE_CYCLE = ['MAP', 'FPL', 'WPT', 'NRST', 'ENG', 'TERRAIN', 'CHK', 'TIMER', 'TRIP', 'SETUP'];
  UI.showPage = page => {
    const a = A();
    if (page === 'PFD') { if (G3X.main) G3X.main.setView('PFD'); bus.emit('page', 'PFD'); return; }
    if (a.mfdPage !== page) { a.prevPage = a.mfdPage; a.mfdPage = page; }
    if (G3X.main && G3X.main.view === 'PFD') G3X.main.setView('MFD');
    UI.sel = 0; UI.menuOpen = false;
    bus.emit('page', page);
  };
  UI.button = (id, screen) => {
    const a = A(); if (screen) UI.activeScreen = screen;
    if (G3X.audio) G3X.audio.play('click');
    bus.emit('button', id);
    switch (id) {
      case 'BACK': if (UI.dialog) { UI.closeDialog(); break; } if (a.map.panning && a.mfdPage === 'MAP') { G3X.mfd.stopPan(); break; } if (a.mfdPage === 'HOME') a.mfdPage = 'MAP'; else if (G3X.mfd.isDomPage(a.mfdPage)) a.mfdPage = 'MAP'; else a.mfdPage = 'HOME'; break;
      case 'DTO': UI.openDirectTo(); break;
      case 'NRST': UI.showPage('NRST'); break;
      case 'MENU': UI.openMenu(); break;
      case 'MSG': UI.showPage('MSG'); a.msgNew = false; break;
      case 'HOME': UI.showPage('HOME'); break;
      case 'PFD': case 'SPLIT': case 'MFD': if (G3X.main) G3X.main.setView(id === 'SPLIT' ? 'BOTH' : id); break;
      case 'SUSP': AV.unsuspend(); bus.emit('unsusp'); break;
      case 'OBS': a.fpl.obs = false; break;
    }
  };

  // ---------- draaiknoppen ----------
  // knopfuncties per scherm: PFD-scherm = Heading/Altitude en Course/Baro; MFD-scherm = Select Page/Zoom Map en Scroll/List of Range/Pan
  UI.knobLabels = screen => {
    const a = A();
    if (UI.dialog && UI.dialog.knobLabels && UI.dialog.screen === screen) return UI.dialog.knobLabels;
    if (screen === 'L') return { left: { outer: 'HDG', inner: 'ALT', push: 'Sync HDG' }, right: { outer: 'CRS', inner: 'BARO', push: 'STD' } };
    const listPage = ['FPL', 'NRST', 'CHK', 'MSG', 'FPLLIST', 'USER', 'HOME', 'PROC'].includes(a.mfdPage);
    const left = { outer: 'PAGE', inner: 'ZOOM', push: 'Main Menu' };
    const right = (a.mfdPage === 'MAP' || a.mfdPage === 'TERRAIN') ? { outer: 'RANGE', inner: a.map.panning ? 'PAN ↕' : 'PAN', push: 'Cursor' } : listPage ? { outer: 'SCROLL', inner: 'SELECT', push: 'Select' } : { outer: 'RANGE', inner: '—' };
    return { left, right };
  };
  // screen 'L'|'R', side 'L'|'R', ring 'outer'|'inner', dir ±1
  UI.knob = (screen, side, ring, dir) => {
    const a = A(); UI.activeScreen = screen;
    if (UI.dialog && UI.dialog.onKnob) { UI.dialog.onKnob(side, ring, dir); return; }
    if (screen === 'L') {
      if (side === 'L') { if (ring === 'outer') { a.hdgBug = U.norm360(a.hdgBug + dir); bus.emit('hdgbug', a.hdgBug); } else { a.altSel = U.clamp(a.altSel + dir * 100, -1000, 20000); bus.emit('altsel', a.altSel); } }
      else { if (ring === 'outer') UI.adjustCrs(dir); else { a.baroStd = false; a.baro = U.clamp(a.baro + dir, 940, 1060); bus.emit('baro', a.baro); } }
      return;
    }
    if (side === 'L') { if (ring === 'outer') { const i = UI.PAGE_CYCLE.indexOf(a.mfdPage); UI.showPage(UI.PAGE_CYCLE[(i < 0 ? 0 : i + dir + UI.PAGE_CYCLE.length) % UI.PAGE_CYCLE.length]); } else { G3X.mfd.rangeStep(dir); bus.emit('range', a.map.range); } return; }
    if (a.mfdPage === 'MAP' || a.mfdPage === 'TERRAIN') { if (ring === 'outer') { G3X.mfd.rangeStep(dir); bus.emit('range', a.map.range); } else { if (!a.map.panning) { a.map.pan = { lat: SIM.S.ac.lat, lon: SIM.S.ac.lon }; a.map.panning = true; } G3X.mfd.panBy(0, dir * -30); } return; }
    if (['FPL', 'NRST', 'CHK', 'MSG', 'FPLLIST', 'USER', 'HOME', 'PROC'].includes(a.mfdPage)) { UI.moveSel(dir); return; }
  };
  UI.knobPress = (screen, side) => {
    const a = A(); UI.activeScreen = screen;
    if (UI.dialog && UI.dialog.onEnter) { UI.dialog.onEnter(); return; }
    if (screen === 'L') { if (side === 'L') { a.hdgBug = Math.round(SIM.S.ac.hdg); bus.emit('hdgbug', a.hdgBug); UI.toast('Heading bug synced', 'L'); } else { a.baroStd = !a.baroStd; bus.emit('baro', a.baroStd ? 'STD' : a.baro); } return; }
    if (side === 'L') { UI.showPage('HOME'); return; }
    if (a.mfdPage === 'MAP' || a.mfdPage === 'TERRAIN') { if (a.map.panning) G3X.mfd.stopPan(); else { a.map.pan = { lat: SIM.S.ac.lat, lon: SIM.S.ac.lon }; a.map.panning = true; UI.showMapCursorMenu(); } return; }
    const sel = UI.pane.querySelector('.row.sel, .tile.sel, .item.sel'); if (sel) sel.click();
  };
  UI.adjustCrs = dir => { const a = A(); if (a.navSource === 'GPS') { a.crs1 = U.norm360(a.crs1 + dir); if (a.fpl.obs) bus.emit('crs', a.crs1); } else { const r = a[a.navSource.toLowerCase()]; r.obs = U.norm360(r.obs + dir); bus.emit('crs', r.obs); } };
  UI.moveSel = dir => { const rows = [...UI.pane.querySelectorAll('.row, .tile, .item')].filter(r => !r.classList.contains('nosel')); if (!rows.length) return; UI.sel = U.clamp(UI.sel + dir, 0, rows.length - 1); rows.forEach((r, i) => r.classList.toggle('sel', i === UI.sel)); rows[UI.sel].scrollIntoView({ block: 'nearest' }); };

  UI.cycleNavSource = () => { const a = A(); const order = ['GPS', 'NAV1', 'NAV2']; a.navSource = order[(order.indexOf(a.navSource) + 1) % 3]; bus.emit('navsrc', a.navSource); UI.toast('CDI source: ' + a.navSource); };
  UI.cycleBrg = which => { const a = A(); const order = ['OFF', 'GPS', 'NAV1', 'NAV2']; const k = 'brg' + which; a[k] = order[(order.indexOf(a[k]) + 1) % 4]; bus.emit('brg' + which, a[k]); };

  // ---------- dialoogvenster-raamwerk ----------
  UI.closeDialog = () => { if (UI.dialog && UI.dialog.el) UI.dialog.el.remove(); UI.dialog = null; Object.values(UI.dialogLayers).forEach(l => l.classList.remove('open')); };
  UI.openDialog = cfg => {
    UI.closeDialog();
    const screen = cfg.screen || UI.activeScreen || 'L'; UI.dialogLayer = UI.dialogLayers[screen];
    const el = document.createElement('div'); el.className = 'g3x-dialog ' + (cfg.cls || '');
    if (cfg.width) el.style.width = cfg.width + 'px';
    el.innerHTML = `<div class="dlg-title"><span>${esc(cfg.title)}</span><button class="dlg-close" aria-label="Close">✕</button></div><div class="dlg-body">${cfg.html || ''}</div>${cfg.buttons ? `<div class="dlg-buttons">${cfg.buttons.map((b, i) => `<button class="dlg-btn ${b.cls || ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div>` : ''}`;
    el.querySelector('.dlg-close').onclick = () => UI.closeDialog();
    if (cfg.buttons) el.querySelectorAll('.dlg-btn').forEach(b => { b.onclick = () => { const c = cfg.buttons[+b.dataset.i]; if (c.onClick) { const keep = c.onClick(); if (keep !== true) UI.closeDialog(); } else UI.closeDialog(); }; });
    UI.dialogLayer.appendChild(el); UI.dialogLayer.classList.add('open');
    UI.dialog = Object.assign({ el, body: el.querySelector('.dlg-body'), screen }, cfg);
    if (cfg.onOpen) cfg.onOpen(UI.dialog);
    return UI.dialog;
  };

  // numeriek toetsenbord
  function numpad(cfg) {
    let val = cfg.value || '';
    const keys = cfg.keys || ['1', '2', '3', '4', '5', '6', '7', '8', '9', cfg.dot ? '.' : '', '0', '⌫'];
    const d = UI.openDialog({
      title: cfg.title, cls: 'numpad', width: cfg.width || 360,
      html: `<div class="np-display"><span class="np-val">${esc(cfg.display ? cfg.display(val) : val)}</span><span class="np-unit">${esc(cfg.unit || '')}</span></div>${cfg.extra || ''}<div class="np-keys">${keys.map(k => `<button class="np-key ${k === '' ? 'empty' : ''}" data-k="${k}">${k}</button>`).join('')}</div>`,
      buttons: [{ label: 'Cancel' }, { label: cfg.enterLabel || 'Enter', cls: 'primary', onClick: () => { const r = cfg.onEnter(val); return r === false ? true : undefined; } }],
      knobLabels: { left: { outer: '—', inner: '—' }, right: { outer: cfg.knobOuter || '+/−', inner: cfg.knobInner || '+/−' } },
      onKnob: (side, ring, dir) => { if (cfg.onKnob) { val = cfg.onKnob(val, ring, dir) ?? val; refresh(); } },
      onEnter: () => { const r = cfg.onEnter(val); if (r !== false) UI.closeDialog(); },
    });
    const refresh = () => { d.body.querySelector('.np-val').textContent = cfg.display ? cfg.display(val) : val; if (cfg.onChange) cfg.onChange(val, d); };
    d.body.querySelectorAll('.np-key').forEach(b => { b.onclick = () => { const k = b.dataset.k; if (!k) return; if (k === '⌫') val = val.slice(0, -1); else if (k === 'C') val = ''; else if (val.length < (cfg.maxLen || 6)) val += k; if (cfg.filter) val = cfg.filter(val); refresh(); }; });
    d.setVal = v => { val = v; refresh(); };
    return d;
  }
  // alfanumeriek toetsenbord met waypoint-zoekresultaten
  function alphaPad(cfg) {
    let val = cfg.value || '';
    const rows = ['ABCDEFG', 'HIJKLMN', 'OPQRSTU', 'VWXYZ⌫', '1234567', '890'];
    const d = UI.openDialog({
      title: cfg.title, cls: 'alphapad', width: 560,
      html: `<div class="ap-top"><div class="np-display"><span class="np-val">${esc(val)}</span><span class="np-cursor">_</span></div><div class="ap-results"></div></div><div class="ap-keys">${rows.map(r => `<div class="ap-row">${r.split('').map(k => `<button class="np-key" data-k="${k}">${k}</button>`).join('')}</div>`).join('')}</div>${cfg.extra || ''}`,
      buttons: [{ label: 'Cancel' }, { label: cfg.enterLabel || 'Enter', cls: 'primary', onClick: () => { const r = cfg.onEnter(val); return r === false ? true : undefined; } }],
      knobLabels: { left: { outer: '—', inner: '—' }, right: { outer: 'CHAR', inner: 'CHAR' } },
      onKnob: (side, ring, dir) => { const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; const last = val.slice(-1) || 'A'; let i = alpha.indexOf(last); if (i < 0) i = 0; i = (i + dir + alpha.length) % alpha.length; val = (val.length ? val.slice(0, -1) : '') + alpha[i]; refresh(); },
      onEnter: () => { const r = cfg.onEnter(val); if (r !== false) UI.closeDialog(); },
    });
    const results = d.body.querySelector('.ap-results');
    const refresh = () => {
      d.body.querySelector('.np-val').textContent = val;
      const list = cfg.search ? cfg.search(val) : [];
      results.innerHTML = list.map(w => `<button class="ap-res" data-id="${esc(w.id)}"><b>${esc(w.id)}</b> <span>${esc(w.name || '')}</span> <em>${esc(w.type || '')}</em></button>`).join('') || '<div class="muted">No matches</div>';
      results.querySelectorAll('.ap-res').forEach(b => { b.onclick = () => { val = b.dataset.id; d.body.querySelector('.np-val').textContent = val; const r = cfg.onEnter(val); if (r !== false) UI.closeDialog(); }; });
    };
    d.body.querySelectorAll('.np-key').forEach(b => { b.onclick = () => { const k = b.dataset.k; if (k === '⌫') val = val.slice(0, -1); else if (val.length < 6) val += k; refresh(); }; });
    refresh();
    return d;
  }
  UI.numpad = numpad; UI.alphaPad = alphaPad;

  // ---------- frequenties ----------
  UI.openFreq = (kind, n) => {
    const a = A(), r = a[(kind === 'COM' ? 'com' : 'nav') + n];
    const isCom = kind === 'COM';
    const nearby = NAV.nearest(SIM.S.ac, 'APT', 6).flatMap(x => x.item.freqs.filter(f => f.freq && U.isValidCom(f.freq)).map(f => ({ label: `${x.item.id} ${f.type}`, freq: f.freq })));
    const vors = NAV.nearest(SIM.S.ac, 'VOR', 6).map(x => ({ label: `${x.item.id} ${x.item.name}`, freq: x.item.freq }));
    const ils = [];
    NAV.nearest(SIM.S.ac, 'APT', 8).forEach(x => x.item.rwys.forEach(rw => rw.ils && Object.entries(rw.ils).forEach(([rid, f]) => ils.push({ label: `${x.item.id} ILS ${rid}`, freq: f }))));
    const lists = isCom ? [['Recent', a.recentCom.map(f => ({ label: U.fmtFreq(f), freq: f }))], ['Nearest', nearby], ['Emergency', [{ label: 'Emergency', freq: 121.5 }, { label: 'ULM/club', freq: 123.405 }, { label: 'Brussels INFO', freq: 126.905 }]]] : [['Nearest VOR', vors], ['Nearest ILS', ils]];
    const fmt = s => { if (!s.length) return isCom ? '1__.___' : '1__.__'; let str = s; const whole = str.slice(0, 3), frac = str.slice(3); return (whole + '___'.slice(whole.length)) + '.' + (frac + (isCom ? '___' : '__').slice(frac.length)); };
    const toFreq = s => { if (s.length < 4) return null; const f = parseFloat(s.slice(0, 3) + '.' + s.slice(3).padEnd(isCom ? 3 : 2, '0')); return f; };
    const d = numpad({
      title: `${kind}${n} Standby`, value: '', maxLen: isCom ? 6 : 5, unit: 'MHz', width: 620,
      display: fmt,
      filter: v => { if (v.length === 1 && v !== '1') return '1' + v; if (v.length === 2 && !/^1[1-3]$/.test(v)) return v.slice(0, 1); return v; },
      extra: `<div class="freq-lists">${lists.map(([t, l]) => `<div class="freq-col"><h4>${esc(t)}</h4>${l.map(x => `<button class="freq-item" data-f="${x.freq}"><span>${esc(x.label)}</span><b>${isCom ? U.fmtFreq(x.freq) : U.fmtNav(x.freq)}</b></button>`).join('') || '<div class="muted">—</div>'}</div>`).join('')}</div><div class="freq-cur">Active: <b>${isCom ? U.fmtFreq(r.active) : U.fmtNav(r.active)}</b> · Standby: <b>${isCom ? U.fmtFreq(r.standby) : U.fmtNav(r.standby)}</b></div>`,
      enterLabel: 'Enter', knobOuter: 'MHz', knobInner: 'kHz',
      onKnob: (v, ring, dir) => { const cur = toFreq(v) || r.standby; const nf = isCom ? U.nextCom(cur, dir, ring === 'outer') : U.nextNav(cur, dir, ring === 'outer'); return (isCom ? U.fmtFreq(nf) : U.fmtNav(nf)).replace('.', ''); },
      onEnter: v => { const f = toFreq(v); if (f == null) { UI.toast('Incomplete frequency'); return false; } const ok = isCom ? AV.setComStandby(n, f) : AV.setNavStandby(n, f); if (!ok) { UI.toast(isCom ? 'Invalid 8.33 kHz channel' : 'Invalid NAV frequency'); return false; } bus.emit('freq', { kind, n, f }); },
    });
    d.el.querySelectorAll('.freq-item').forEach(b => { b.onclick = () => { const f = parseFloat(b.dataset.f); if (isCom) AV.setComStandby(n, f); else AV.setNavStandby(n, f); bus.emit('freq', { kind, n, f }); UI.closeDialog(); }; });
    const bar = d.el.querySelector('.dlg-buttons'); const sw = document.createElement('button'); sw.className = 'dlg-btn'; sw.textContent = '⇄ XFER'; sw.onclick = () => { if (isCom) AV.swapCom(n); else AV.swapNav(n); UI.closeDialog(); }; bar.insertBefore(sw, bar.firstChild);
    if (isCom) { const em = document.createElement('button'); em.className = 'dlg-btn danger'; em.textContent = '121.500'; em.onclick = () => { AV.setComStandby(n, 121.5); bus.emit('freq', { kind, n, f: 121.5 }); UI.closeDialog(); }; bar.insertBefore(em, bar.firstChild); }
  };


  // ---------- baro / hoogte / heading / koers ----------
  UI.openBaro = () => {
    const a = A();
    const inHg = a.units.baro === 'INHG';
    numpad({
      title: 'Baro Setting', value: '', maxLen: 4, unit: inHg ? 'inHg' : 'hPa', width: 420, dot: false,
      display: v => inHg ? ((v + '____').slice(0, 2) + '.' + (v + '____').slice(2, 4)) : (v + '____').slice(0, 4),
      extra: `<div class="xp-modes"><button class="xp-mode std ${a.baroStd ? 'on' : ''}">STD (1013)</button><button class="xp-mode unitsw">${inHg ? 'hPa' : 'inHg'}</button></div><div class="xp-cur">Current: <b>${a.baroStd ? 'STD' : D.fmtBaro(a.baro)}</b></div>`,
      onEnter: v => { let hpa; if (inHg) { if (v.length < 4) return false; hpa = parseFloat(v.slice(0, 2) + '.' + v.slice(2)) * 33.8639; } else { if (v.length < 3) return false; hpa = parseInt(v, 10); } if (hpa < 940 || hpa > 1060) { UI.toast('Out of range (940–1060 hPa)'); return false; } a.baro = Math.round(hpa); a.baroStd = false; bus.emit('baro', a.baro); },
      onKnob: (v, ring, dir) => { a.baroStd = false; a.baro = U.clamp(a.baro + dir * (ring === 'outer' ? 10 : 1), 940, 1060); bus.emit('baro', a.baro); UI.dialog.el.querySelector('.xp-cur b').textContent = D.fmtBaro(a.baro); return v; },
      onOpen: d => { d.el.querySelector('.std').onclick = () => { a.baroStd = !a.baroStd; bus.emit('baro', a.baroStd ? 'STD' : a.baro); UI.closeDialog(); }; d.el.querySelector('.unitsw').onclick = () => { a.units.baro = inHg ? 'HPA' : 'INHG'; AV.save(); UI.openBaro(); }; },
    });
  };
  UI.openAltSel = () => {
    const a = A();
    numpad({ title: 'Selected Altitude', value: '', maxLen: 5, unit: D.fmtAltUnit(), width: 400, display: v => v || String(a.altSel), extra: `<div class="xp-modes"><button class="xp-mode sync">Current Altitude</button></div>`,
      onEnter: v => { if (!v) return; let ft = parseInt(v, 10); if (a.units.alt === 'M') ft = ft / U.FT_M; a.altSel = Math.round(ft / 10) * 10; bus.emit('altsel', a.altSel); },
      onKnob: (v, ring, dir) => { a.altSel = U.clamp(a.altSel + dir * (ring === 'outer' ? 1000 : 100), -1000, 20000); bus.emit('altsel', a.altSel); return ''; },
      onOpen: d => { d.el.querySelector('.sync').onclick = () => { a.altSel = Math.round(AV.indAlt() / 100) * 100; bus.emit('altsel', a.altSel); UI.closeDialog(); }; } });
  };
  UI.openHdgSel = () => {
    const a = A();
    numpad({ title: 'Heading Bug', value: '', maxLen: 3, unit: '°', width: 400, display: v => v || U.fmtHdg(a.hdgBug), extra: `<div class="xp-modes"><button class="xp-mode sync">SYNC to Heading</button></div><div class="xp-cur muted">Tip: the outer ring of the left knob also sets the heading bug</div>`,
      onEnter: v => { if (!v) return; a.hdgBug = U.norm360(parseInt(v, 10)); bus.emit('hdgbug', a.hdgBug); },
      onKnob: (v, ring, dir) => { a.hdgBug = U.norm360(a.hdgBug + dir * (ring === 'outer' ? 10 : 1)); bus.emit('hdgbug', a.hdgBug); return ''; },
      onOpen: d => { d.el.querySelector('.sync').onclick = () => { a.hdgBug = Math.round(SIM.S.ac.hdg); bus.emit('hdgbug', a.hdgBug); UI.closeDialog(); }; } });
  };
  UI.openCrs = () => {
    const a = A();
    const cur = () => a.navSource === 'GPS' ? a.crs1 : a[a.navSource.toLowerCase()].obs;
    numpad({ title: a.navSource === 'GPS' ? 'Course (OBS Mode)' : `CRS ${a.navSource}`, value: '', maxLen: 3, unit: '°', width: 420, display: v => v || U.fmtHdg(cur()),
      extra: a.navSource === 'GPS' ? `<div class="xp-modes"><button class="xp-mode obs ${a.fpl.obs ? 'on' : ''}">OBS ${a.fpl.obs ? 'Off' : 'On'}</button></div><div class="xp-cur muted">OBS suspends waypoint sequencing and lets you select a course to the active waypoint.</div>` : `<div class="xp-cur muted">Set the course pointer to the desired radial / inbound course.</div>`,
      onEnter: v => { if (!v) return; const c = U.norm360(parseInt(v, 10)); if (a.navSource === 'GPS') { a.crs1 = c; if (!a.fpl.obs && a.nav && a.nav.valid) { a.fpl.obs = true; } } else a[a.navSource.toLowerCase()].obs = c; bus.emit('crs', c); },
      onKnob: (v, ring, dir) => { for (let i = 0; i < (ring === 'outer' ? 10 : 1); i++) UI.adjustCrs(dir); return ''; },
      onOpen: d => { const b = d.el.querySelector('.obs'); if (b) b.onclick = () => { if (!a.nav || !a.nav.valid) { UI.toast('No active waypoint'); return; } a.fpl.obs = !a.fpl.obs; if (a.fpl.obs) a.crs1 = Math.round(a.nav.dtk); bus.emit('obs', a.fpl.obs); UI.closeDialog(); }; } });
  };


  // ---------- PFD-opties / menu ----------
  UI.openPfdOptions = () => {
    const a = A();
    const opt = (label, key, values, fmt) => `<div class="opt-row"><span>${label}</span><div class="opt-vals">${values.map(v => `<button class="opt-val ${a[key] === v ? 'on' : ''}" data-k="${key}" data-v="${v}">${fmt ? fmt(v) : v}</button>`).join('')}</div></div>`;
    const html = `<div class="opts">
      ${opt('Synthetic Vision', 'svt', [true, false], v => v ? 'ON' : 'OFF')}
      ${opt('Bearing Pointer 1', 'brg1', ['OFF', 'GPS', 'NAV1', 'NAV2'])}
      ${opt('Bearing Pointer 2', 'brg2', ['OFF', 'GPS', 'NAV1', 'NAV2'])}
      ${opt('Wind Vector', 'windMode', [0, 1, 2, 3], v => ['OFF', 'Components', 'Arrow', 'Dir/Speed'][v])}
      ${opt('CDI Source', 'navSource', ['GPS', 'NAV1', 'NAV2'])}
      ${opt('V-Speeds', 'vspeeds', [true, false], v => v ? 'ON' : 'OFF')}
      ${opt('Map Inset (full PFD)', 'inset', ['OFF', 'MAP'])}
      ${opt('Minimums', 'minimumsOn', [true, false], v => v ? 'ON' : 'OFF')}
      <div class="opt-row"><span>Minimums Altitude</span><div class="opt-vals"><button class="opt-val setmins">${a.minimums != null ? a.minimums + ' FT' : 'Set…'}</button></div></div>
    </div>`;
    const d = UI.openDialog({ title: 'PFD Options', html, width: 560, buttons: [{ label: 'Close' }] });
    d.el.querySelectorAll('.opt-val[data-k]').forEach(b => { b.onclick = () => { const k = b.dataset.k; let v = b.dataset.v; if (v === 'true') v = true; else if (v === 'false') v = false; else if (/^\d+$/.test(v)) v = +v; a[k] = v; bus.emit('pfdopt', { k, v }); if (k === 'svt') AV.save(); d.el.querySelectorAll(`.opt-val[data-k="${k}"]`).forEach(c => c.classList.toggle('on', c === b)); }; });
    d.el.querySelector('.setmins').onclick = () => { numpad({ title: 'Minimums (Baro)', value: '', maxLen: 5, unit: 'FT', width: 380, display: v => v || String(a.minimums ?? ''), onEnter: v => { if (!v) return; a.minimums = parseInt(v, 10); a.minimumsOn = true; bus.emit('minimums', a.minimums); } }); };
  };
  UI.openMenu = () => {
    const a = A();
    if (UI.dialog) { UI.closeDialog(); return; }
    const page = UI.activeScreen === 'L' ? 'PFD' : a.mfdPage;
    if (page === 'PFD') return UI.openPfdOptions();
    if (page === 'MAP' || page === 'TERRAIN') return UI.openMapOptions();
    if (page === 'FPL') return UI.openFplMenu();
    if (page === 'HOME') return UI.openGeneralMenu();
    UI.openGeneralMenu();
  };
  // algemeen menu (ook de schermindeling: op de G3X via MENU → Full Screen / Split Screen)
  UI.openGeneralMenu = extra => {
    const a = A();
    UI.openDialog({ title: 'Menu', html: `<div class="menu-list">${extra || ''}<button class="item" data-a="pfd">PFD Options</button><button class="item" data-a="map">Map Options</button><button class="item" data-a="setup">Setup</button><button class="item" data-a="home">Main Menu</button></div>`, width: 400, buttons: [{ label: 'Close' }], onOpen: d => { d.el.querySelectorAll('.item').forEach(b => { b.onclick = () => { const act = b.dataset.a; if (act === 'pfd') UI.openPfdOptions(); else if (act === 'map') UI.openMapOptions(); else if (act === 'setup') { UI.closeDialog(); UI.showPage('SETUP'); } else if (act === 'home') { UI.closeDialog(); UI.showPage('HOME'); } }; }); } });
  };
  UI.openMapOptions = () => {
    const a = A(), m = a.map;
    const opt = (label, key, values, fmt) => `<div class="opt-row"><span>${label}</span><div class="opt-vals">${values.map(v => `<button class="opt-val ${m[key] === v ? 'on' : ''}" data-k="${key}" data-v="${v}">${fmt ? fmt(v) : v}</button>`).join('')}</div></div>`;
    const onoff = v => v ? 'ON' : 'OFF';
    const html = `<div class="opts">
      ${opt('Orientation', 'orient', ['NORTH', 'TRKUP', 'HDGUP'], v => ({ NORTH: 'North Up', TRKUP: 'Track Up', HDGUP: 'Heading Up' })[v])}
      ${opt('Declutter', 'declutter', [0, 1, 2, 3], v => v === 0 ? 'All' : 'Level ' + v)}
      ${opt('Topo', 'topo', [true, false], onoff)}
      ${opt('Airspace', 'airspace', [true, false], onoff)}
      ${opt('Track Vector (60 s)', 'trackVector', [true, false], onoff)}
      ${opt('Range Ring', 'rangeRing', [true, false], onoff)}
      ${opt('Obstacles', 'obstacles', [true, false], onoff)}
      ${opt('Cities', 'cities', [true, false], onoff)}
      ${opt('Water', 'water', [true, false], onoff)}
      <div class="opt-row"><span>Cursor</span><div class="opt-vals"><button class="opt-val stoppan">Cursor Off</button><button class="opt-val measure">Measure from Aircraft</button></div></div>
    </div>`;
    const d = UI.openDialog({ title: a.mfdPage === 'TERRAIN' ? 'Terrain Options' : 'Map Options', html, width: 560, buttons: [{ label: 'Close' }] });
    d.el.querySelectorAll('.opt-val[data-k]').forEach(b => { b.onclick = () => { const k = b.dataset.k; let v = b.dataset.v; if (v === 'true') v = true; else if (v === 'false') v = false; else if (/^\d+$/.test(v)) v = +v; m[k] = v; bus.emit('mapopt', { k, v }); AV.save(); d.el.querySelectorAll(`.opt-val[data-k="${k}"]`).forEach(c => c.classList.toggle('on', c === b)); }; });
    d.el.querySelector('.stoppan').onclick = () => { G3X.mfd.stopPan(); UI.closeDialog(); };
    d.el.querySelector('.measure').onclick = () => { m.pan = { lat: SIM.S.ac.lat, lon: SIM.S.ac.lon }; m.panning = true; UI.closeDialog(); UI.toast('Drag the map or turn the inner knob: bearing and distance are shown bottom left'); };
  };
  UI.showMapCursorMenu = () => {
    const a = A();
    const d = UI.openDialog({ title: 'Map Cursor', cls: 'mini', width: 330, html: `<div class="menu-list"><button class="item" data-a="dto">Direct-To Cursor</button><button class="item" data-a="usr">Create User Waypoint</button><button class="item" data-a="ins">Insert in Flight Plan</button><button class="item" data-a="info">Airspace at Cursor</button><button class="item" data-a="off">Cursor Off</button></div>`,
      onOpen: dd => { dd.el.querySelectorAll('.item').forEach(b => { b.onclick = () => { const p = a.map.pan; const act = b.dataset.a; if (act === 'dto') { const w = { id: 'MAPWP', name: 'Map point', type: 'USER', lat: p.lat, lon: p.lon }; AV.directTo(w); bus.emit('dto', w.id); } else if (act === 'usr') { const w = AV.addUserWaypoint(p.lat, p.lon); bus.emit('userwpt', w.id); UI.toast(`${w.id} created`); } else if (act === 'ins') { const w = AV.addUserWaypoint(p.lat, p.lon); AV.fplAdd(w); bus.emit('fpladd', w.id); } else if (act === 'info') { const list = NAV.airspacesAt(p); UI.closeDialog(); UI.openDialog({ title: 'Airspace at Cursor', width: 460, html: list.length ? `<div class="menu-list">${list.map(s => `<div class="item nosel"><b>${esc(s.name)}</b><br><span class="muted">Class ${s.cls} · ${s.floor === 0 ? 'GND' : s.floor + ' FT'} – ${s.ceil} FT${s.freq ? ' · ' + U.fmtFreq(s.freq) : ''}</span></div>`).join('')}</div>` : '<p class="muted">No controlled airspace at this position (class G).</p>', buttons: [{ label: 'Close' }] }); return; } else if (act === 'off') G3X.mfd.stopPan(); UI.closeDialog(); }; }); } });
    d.el.classList.add('corner');
  };

  // ---------- feature-info / waypoint-info ----------
  UI.openFeatureInfo = item => {
    const a = A(), pos = SIM.S.ac;
    const brg = U.bearing(pos, item), dis = U.distNm(pos, item);
    let body = `<div class="wi-head"><b>${esc(item.id)}</b> <span>${esc(item.name || '')}</span><em>${esc(item.type || '')}</em></div><div class="wi-grid"><div>BRG <b>${U.fmtHdg(brg)}°</b></div><div>DIS <b>${U.fmtDis(D.distVal(dis))} ${D.distUnit()}</b></div><div>${U.fmtLat(item.lat)}</div><div>${U.fmtLon(item.lon)}</div></div>`;
    if (item.type === 'APT') {
      body += `<div class="wi-sec">Elevation <b>${item.elev} FT</b> · ${esc({ intl: 'towered', civil: 'non-towered', mil: 'military', ulm: 'ultralight field' }[item.kind] || '')}</div>`;
      body += `<div class="wi-sec"><h4>Runways</h4>${item.rwys.map(r => `<div>${esc(r.id)} · ${r.len} m · ${esc(r.surf)} · ${U.fmtHdg(r.hdg)}°/${U.fmtHdg(r.hdg + 180)}°${r.ils ? ' · ILS ' + Object.entries(r.ils).map(([k, v]) => k + ' ' + U.fmtNav(v)).join(', ') : ''}</div>`).join('')}</div>`;
      body += `<div class="wi-sec"><h4>Frequencies</h4>${item.freqs.filter(f => f.freq).map(f => `<button class="freq-item tune" data-f="${f.freq}"><span>${esc(f.type)}</span><b>${U.fmtFreq(f.freq)}</b></button>`).join('') || '<span class="muted">—</span>'}<div class="muted">Touch a frequency to load it into COM1 standby</div></div>`;
      const wind = SIM.windAt(); const best = item.rwys.flatMap(r => r.id.split('/').map((id, i) => ({ id, hdg: i ? U.norm360(r.hdg + 180) : r.hdg }))).map(r => ({ r, hw: wind.spd * Math.cos((wind.dir - r.hdg) * U.DEG) })).sort((p, q) => q.hw - p.hw)[0];
      body += `<div class="wi-sec">Wind ${U.fmtHdg(wind.dir)}°/${Math.round(wind.spd)} KT → best runway (most headwind): <b>${best.r.id}</b></div>`;
      if (NAV.APPROACHES[item.id]) body += `<div class="wi-sec">Approaches: ${NAV.APPROACHES[item.id].map(p => esc(p.name)).join(', ')}</div>`;
    } else if (item.type === 'VOR' || item.type === 'NDB') {
      body += `<div class="wi-sec">Frequency <b>${item.type === 'VOR' ? U.fmtNav(item.freq) : item.freq.toFixed(1)}</b>${item.dme ? ' · DME' : ''} · ident <b>${esc(item.id)}</b> <span class="morse">${esc(U.morse(item.id))}</span></div><div class="wi-sec">Radial from station: <b>${U.fmtHdg(U.bearing(item, pos))}°</b></div>`;
      if (item.type === 'VOR') body += `<div class="wi-sec"><button class="freq-item tunenav" data-f="${item.freq}"><span>Load into NAV1 standby</span><b>${U.fmtNav(item.freq)}</b></button></div>`;
    } else if (item.type === 'OBST') {
      body += `<div class="wi-sec">Top <b>${item.msl} FT MSL</b> (${item.agl} FT AGL)</div>`;
    }
    const buttons = [{ label: 'Close' }];
    if (item.type !== 'OBST') {
      buttons.push({ label: 'Direct-To', cls: 'primary', onClick: () => { AV.directTo(item); bus.emit('dto', item.id); } });
      buttons.push({ label: 'Insert in FPL', onClick: () => { UI.openInsertPosition(item); return true; } });
    }
    if (item.type === 'APT' && NAV.APPROACHES[item.id]) buttons.push({ label: 'Approach', onClick: () => { UI.showPage('PROC'); UI.procApt = item.id; } });
    if (item.user) buttons.push({ label: 'Delete', cls: 'danger', onClick: () => { a.userWpts = a.userWpts.filter(w => w !== item); const i = NAV.ALL.indexOf(item); if (i >= 0) NAV.ALL.splice(i, 1); AV.save(); } });
    const d = UI.openDialog({ title: 'Waypoint Information', html: body, width: 520, buttons });
    d.el.querySelectorAll('.tune').forEach(b => { b.onclick = () => { AV.setComStandby(1, parseFloat(b.dataset.f)); bus.emit('freq', { kind: 'COM', n: 1, f: parseFloat(b.dataset.f) }); UI.toast('COM1 standby set'); }; });
    d.el.querySelectorAll('.tunenav').forEach(b => { b.onclick = () => { AV.setNavStandby(1, parseFloat(b.dataset.f)); bus.emit('freq', { kind: 'NAV', n: 1, f: parseFloat(b.dataset.f) }); UI.toast('NAV1 standby set'); }; });
    bus.emit('wptinfo', item.id);
  };
  UI.openInsertPosition = item => {
    const f = A().fpl;
    if (!f.wpts.length) { AV.fplAdd(item); bus.emit('fpladd', item.id); UI.closeDialog(); UI.toast(`${item.id} added`); return; }
    UI.openDialog({ title: `Insert ${item.id}`, width: 420, html: `<div class="menu-list">${f.wpts.map((w, i) => `<button class="item" data-i="${i}">Before ${esc(w.id)}</button>`).join('')}<button class="item" data-i="${f.wpts.length}">At the end</button></div>`, buttons: [{ label: 'Cancel' }], onOpen: d => { d.el.querySelectorAll('.item').forEach(b => { b.onclick = () => { AV.fplAdd(item, +b.dataset.i); bus.emit('fpladd', item.id); UI.closeDialog(); UI.toast(`${item.id} added`); }; }); } });
  };

  // ---------- Direct-To ----------
  // Direct To-venster zoals op de G3X Touch: tabbladen Waypoint / Flight Plan / Nearest Airports / Recent,
  // infokaart met kaartje, Course To, knoppen Info · Stop Navigation · Activate
  UI.openDirectTo = (presetId) => {
    const a = A(), pos = SIM.S.ac;
    a.recentDto = a.recentDto || [];
    const st = { tab: 'WPT', id: presetId || (a.fpl.directTo ? a.fpl.directTo.to.id : (a.nav && a.nav.valid ? a.nav.legTo.id : '')), crs: null };
    const render = () => {
      const w = st.id ? (AV.findWpt(st.id) || a.fpl.wpts.find(x => x.id === st.id)) : null;
      const tabs = [['WPT', 'Waypoint'], ['FPL', 'Flight Plan'], ['NRST', 'Nearest Airports'], ['RECENT', 'Recent']];
      let body = `<div class="tabs dto-tabs">${tabs.map(t => `<button class="tab ${st.tab === t[0] ? 'on' : ''}" data-t="${t[0]}">${t[1]}</button>`).join('')}</div>`;
      if (st.tab === 'WPT') {
        body += `<div class="dto-card"><button class="dto-id">${w ? esc(w.id) : '______'} <small>▸ touch to enter identifier</small></button>`;
        if (w) {
          const kind = w.type === 'APT' ? ({ intl: 'Towered Airport', civil: 'Public Airport', mil: 'Military Airport', ulm: 'Ultralight Field' }[w.kind] || 'Airport') : w.type === 'VOR' ? 'VOR' + (w.dme ? '/DME' : '') : w.type === 'NDB' ? 'NDB' : w.type === 'VRP' ? 'VFR Reporting Point' : w.type === 'USER' ? 'User Waypoint' : 'Intersection';
          body += `<div class="dto-info"><div class="dto-thumb" id="dto-thumb"></div><div><div class="dto-kind">${esc(kind)}</div><div class="dto-name">${esc(w.name || '')}</div><div class="dto-reg">Belgium / Benelux</div><div class="dto-brg">Brg <b>${U.fmtHdg(U.bearing(pos, w))}°</b></div><div class="dto-brg">Dist <b>${U.fmtDis(D.distVal(U.distNm(pos, w)))} ${D.distUnit().toLowerCase()}</b></div></div></div>`;
          body += `<button class="dto-course">Course To <b>${st.crs != null ? U.fmtHdg(st.crs) : U.fmtHdg(U.bearing(pos, w))}°</b>${st.crs == null ? ' <small>(direct)</small>' : ''}</button>`;
        }
        body += '</div>';
      } else {
        let list = [];
        if (st.tab === 'FPL') list = a.fpl.wpts;
        else if (st.tab === 'NRST') list = NAV.nearest(pos, 'APT', 10).map(x => x.item);
        else list = a.recentDto.map(id => AV.findWpt(id)).filter(Boolean);
        body += `<div class="dto-list">${list.map(x => `<button class="row dto-row" data-id="${esc(x.id)}"><span class="c-id"><b>${esc(x.id)}</b></span><span class="c-name">${esc(x.name || '')}</span><span class="c-dtk">${U.fmtHdg(U.bearing(pos, x))}°</span><span class="c-dis">${U.fmtDis(D.distVal(U.distNm(pos, x)))}</span></button>`).join('') || '<p class="muted pad">Nothing to show.</p>'}</div>`;
      }
      return body;
    };
    const d = UI.openDialog({ title: 'Direct To', cls: 'dto', width: 560, html: render(), buttons: [{ label: 'Info', onClick: () => { const w = st.id && AV.findWpt(st.id); if (w) { UI.openFeatureInfo(w); } return true; } }, { label: 'Stop Navigation', cls: 'danger', onClick: () => { AV.cancelDirectTo(); bus.emit('dtocancel'); } }, { label: 'Activate', cls: 'primary', onClick: () => { const w = st.id && (AV.findWpt(st.id) || a.fpl.wpts.find(x => x.id === st.id)); if (!w) { UI.toast('Select a waypoint'); return true; } AV.directTo(w, st.crs); a.recentDto = [w.id, ...a.recentDto.filter(x => x !== w.id)].slice(0, 8); bus.emit('dto', w.id); } }],
      knobLabels: { left: { outer: '—', inner: '—' }, right: { outer: 'SELECT', inner: 'SELECT', push: 'Activate' } }, onEnter: () => d.el.querySelector('.dlg-btn.primary').click() });
    const bind = () => {
      d.body.querySelectorAll('.tab').forEach(b => { b.onclick = () => { st.tab = b.dataset.t; refresh(); }; });
      const idb = d.body.querySelector('.dto-id'); if (idb) idb.onclick = () => alphaPad({ title: 'Waypoint Identifier', value: '', enterLabel: 'Select', search: q => q ? NAV.search(q, 8) : [], onEnter: v => { const w = AV.findWpt(v); if (!w) { UI.toast('Unknown waypoint'); return false; } UI.openDirectTo(w.id); } });
      const cb = d.body.querySelector('.dto-course'); if (cb) cb.onclick = () => { const w = AV.findWpt(st.id); numpad({ title: `Course To ${st.id}`, maxLen: 3, unit: '°', width: 380, display: v => v || U.fmtHdg(st.crs ?? U.bearing(pos, w)), extra: '<div class="xp-modes"><button class="xp-mode direct">Direct (no course)</button></div>', onEnter: v => { const c = v ? U.norm360(parseInt(v, 10)) : null; UI.openDirectTo(st.id); UI.dialog.setCourse(c); }, onOpen: dd => { dd.el.querySelector('.direct').onclick = () => { UI.openDirectTo(st.id); }; } }); };
      d.body.querySelectorAll('.dto-row').forEach(b => { b.onclick = () => { st.id = b.dataset.id; st.tab = 'WPT'; st.crs = null; refresh(); }; });
      drawThumb();
    };
    const refresh = () => { d.body.innerHTML = render(); bind(); };
    d.setCourse = c => { st.crs = c; refresh(); };
    // miniatuurkaartje met het waypoint, noord boven
    const drawThumb = () => {
      const el = d.body.querySelector('#dto-thumb'); const w = st.id && (AV.findWpt(st.id) || a.fpl.wpts.find(x => x.id === st.id)); if (!el || !w) return;
      const cv = document.createElement('canvas'); cv.width = 150; cv.height = 110; el.appendChild(cv); const ctx = cv.getContext('2d');
      ctx.fillStyle = '#17331f'; ctx.fillRect(0, 0, 150, 110);
      const scale = 150 / 16; // 16 nm breed
      const toS = p => { const xy = U.toXY(w, p); return [75 + xy.x * scale, 55 - xy.y * scale]; };
      ctx.strokeStyle = '#49a3ff'; ctx.lineWidth = 1;
      for (const s of NAV.AIRSPACES) { if (s.type === 'ATZ') continue; ctx.beginPath(); if (s.shape.circle) { const c = toS(s.shape.circle); ctx.arc(c[0], c[1], s.shape.r * scale, 0, Math.PI * 2); } else s.shape.poly.forEach((p, i) => { const q = toS({ lat: p[0], lon: p[1] }); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); ctx.stroke(); }
      for (const apt of NAV.AIRPORTS) { const s = toS(apt); if (s[0] < 0 || s[0] > 150 || s[1] < 0 || s[1] > 110) continue; ctx.fillStyle = apt.kind === 'intl' ? '#4aa3ff' : '#e85dff'; ctx.beginPath(); ctx.arc(s[0], s[1], 3, 0, Math.PI * 2); ctx.fill(); }
      if (w.type === 'APT') { ctx.save(); ctx.translate(75, 55); ctx.rotate(w.rwys[0].hdg * U.DEG); ctx.fillStyle = '#fff'; ctx.fillRect(-2, -10, 4, 20); ctx.restore(); } else { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(75, 48); ctx.lineTo(81, 60); ctx.lineTo(69, 60); ctx.closePath(); ctx.stroke(); }
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.fillText(w.id, 80, 46);
      const ac = toS(pos); if (ac[0] > 0 && ac[0] < 150 && ac[1] > 0 && ac[1] < 110) { ctx.save(); ctx.translate(ac[0], ac[1]); ctx.rotate(pos.hdg * U.DEG); ctx.fillStyle = '#ffd21a'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(5, 5); ctx.lineTo(0, 2); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); ctx.restore(); }
      ctx.fillStyle = '#9fb3c8'; ctx.font = '9px sans-serif'; ctx.fillText('N ↑  16 nm', 4, 106);
    };
    bind();
  };


  // ---------- vluchtplan-menu ----------
  UI.openFplMenu = () => {
    const a = A(), f = a.fpl;
    UI.openDialog({ title: 'Flight Plan Options', width: 420, html: `<div class="menu-list">
      <button class="item" data-a="add">Add Waypoint</button>
      <button class="item" data-a="proc">Load Approach (PROC)</button>
      <button class="item" data-a="invert">Invert Flight Plan</button>
      <button class="item" data-a="store">Store Flight Plan</button>
      <button class="item" data-a="list">Flight Plan List</button>
      <button class="item" data-a="obs">${f.obs ? 'OBS Off' : 'OBS Mode'}</button>
      <button class="item danger" data-a="clear">Delete Flight Plan</button></div>`, buttons: [{ label: 'Close' }],
      onOpen: d => { d.el.querySelectorAll('.item').forEach(b => { b.onclick = () => { const act = b.dataset.a; UI.closeDialog(); if (act === 'add') UI.openAddWaypoint(); else if (act === 'proc') UI.showPage('PROC'); else if (act === 'invert') { AV.fplInvert(); bus.emit('fplinvert'); } else if (act === 'store') { AV.fplStore(); bus.emit('fplstore'); UI.toast('Flight plan stored'); } else if (act === 'list') UI.showPage('FPLLIST'); else if (act === 'obs') { if (!a.nav || !a.nav.valid) { UI.toast('No active waypoint'); return; } f.obs = !f.obs; if (f.obs) a.crs1 = Math.round(a.nav.dtk); bus.emit('obs', f.obs); } else if (act === 'clear') { AV.fplClear(); bus.emit('fplclear'); } }; }); } });
  };
  UI.openAddWaypoint = index => {
    alphaPad({ title: index != null ? 'Insert Waypoint' : 'Add Waypoint', enterLabel: 'Add', search: q => q ? NAV.search(q, 8) : NAV.nearest(SIM.S.ac, 'ALL', 8).map(x => x.item),
      onEnter: v => { const w = AV.findWpt(v); if (!w) { UI.toast('Unknown waypoint'); return false; } AV.fplAdd(w, index); bus.emit('fpladd', w.id); } });
  };

  // ---------- DOM-pagina's ----------
  UI.tick = () => {
    const a = A(), L = D.LR; if (!L) return;
    const page = a.reversion ? null : a.mfdPage;
    const show = page && G3X.mfd.isDomPage(page) && L.mfd;
    UI.pane.classList.toggle('hidden', !show);
    if (!show) { UI.pageBuilt = null; return; }
    const r = L.mfd; Object.assign(UI.pane.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    const now = performance.now();
    const key = page + ':' + (page === 'FPL' ? a.fpl.wpts.length + ':' + a.fpl.active + ':' + (a.fpl.directTo ? a.fpl.directTo.to.id : '') + ':' + (a.fpl.approach ? a.fpl.approach.name + a.fpl.approach.active : '') : '') + (page === 'MSG' ? a.msgs.length : '') + (page === 'CHK' ? a.checklist.group : '') + (page === 'PROC' ? (UI.procApt || '') + (UI.procIdx || 0) + (UI.procTrans || '') : '') + (page === 'NRST' ? UI.nrstTab || '' : '') + (page === 'USER' ? a.userWpts.length : '') + (page === 'FPLLIST' ? a.storedFpls.length : '');
    const dynamic = ['FPL', 'NRST', 'TIMER', 'INFO', 'TRIP', 'TRAFFIC', 'WPT', 'MSG'].includes(page);
    if (UI.pageBuilt !== key || (dynamic && now - UI.lastPaneRefresh > 1000)) {
      const scroll = UI.pane.querySelector('.page-body') ? UI.pane.querySelector('.page-body').scrollTop : 0;
      if (UI.pageBuilt !== key) UI.sel = 0;
      UI.buildPage(page);
      const pb = UI.pane.querySelector('.page-body'); if (pb) pb.scrollTop = scroll;
      UI.pageBuilt = key; UI.lastPaneRefresh = now;
      const rows = [...UI.pane.querySelectorAll('.row, .tile, .item')].filter(x => !x.classList.contains('nosel')); if (rows[UI.sel]) rows[UI.sel].classList.add('sel');
    }
  };

  UI.buildPage = page => {
    const a = A(), S = SIM.S, pos = S.ac;
    const P = UI.pane; let h = '';
    const head = (title, right = '') => `<div class="page-head"><span>${esc(title)}</span><span class="page-right">${right}</span></div>`;
    switch (page) {
      case 'HOME': {
        // tegels en volgorde zoals het hoofdmenu van de G3X Touch (vier kolommen, scrollbaar)
        const tiles = [['MAP', 'Map'], ['CHARTS', 'Charts'], ['FPL', 'Active Flight Plan'], ['WPT', 'Waypoint Info'], ['WX', 'Weather'], ['TRAFFIC', 'Traffic'], ['TERRAIN', 'Terrain'], ['ENG', 'Engine'], ['TRIP', 'Info'], ['CHK', 'Checklists'], ['FLIGHTLOG', 'Flight Log'], ['FPLLIST', 'Flight Plan List'], ['VNAV', 'VNAV'], ['TRACKLOG', 'Track Log'], ['USERTIMER', 'User Timer'], ['USER', 'User Waypoints'], ['WB', 'Weight & Balance'], ['DATALINK', 'Data Link'], ['MUSIC', 'Music'], ['TOOLS', 'Tools'], ['SETUP', 'Setup'], ['BACKLIGHT', 'Backlight Intensity']];
        h = `<div class="page-head"><span>${G3X.icons.HOME} Main Menu</span></div><div class="page-body tiles">${tiles.map(t => `<button class="tile" data-p="${t[0]}"><span class="ico">${G3X.icons[t[0]] || ''}</span><span>${t[1]}</span></button>`).join('')}</div>`;
        P.innerHTML = h; P.querySelectorAll('.tile').forEach(b => { b.onclick = () => UI.openTile(b.dataset.p); }); return;
      }
      case 'FPL': {
        const f = a.fpl, n = a.nav;
        let rows = '';
        let cum = 0;
        f.wpts.forEach((w, i) => {
          const isActive = i === f.active && !f.directTo; const isDto = f.directTo && f.directTo.to === w;
          const dtk = i > 0 ? U.bearing(f.wpts[i - 1], w) : null; const legDis = i > 0 ? U.distNm(f.wpts[i - 1], w) : 0;
          let dis = '', ete = '';
          if (i >= f.active && f.active >= 0) { if (i === f.active || isDto) cum = n && n.valid ? n.dis : U.distNm(pos, w); else if (i > f.active) cum += legDis; dis = U.fmtDis(D.distVal(cum)); ete = U.fmtEte(cum / Math.max(pos.gs, 1) * 60); }
          rows += `<div class="row fplrow ${isActive || isDto ? 'active' : ''} ${w.missed ? 'missed' : ''} ${w.proc ? 'proc' : ''}" data-i="${i}">
            <span class="c-idx">${isActive || isDto ? '▶' : i + 1}</span><span class="c-id">${esc(w.id)}${w.faf ? ' <em>FAF</em>' : ''}${w.map ? ' <em>MAP</em>' : ''}${w.iaf ? ' <em>IAF</em>' : ''}${w.hold ? ' <em>HOLD</em>' : ''}</span>
            <span class="c-type">${esc(w.proc ? (w.missed ? 'missed' : 'apr') : w.type)}</span><span class="c-dtk">${dtk != null ? U.fmtHdg(dtk) + '°' : ''}</span><span class="c-dis">${i > 0 ? U.fmtDis(D.distVal(legDis)) : ''}</span><span class="c-cum">${dis}</span><span class="c-ete">${ete}</span><span class="c-alt">${w.alt != null ? D.altVal(w.alt) : '____'}</span></div>`;
        });
        const apr = f.approach;
        const aprBar = apr ? `<div class="apr-bar"><span>${esc(apr.apt)} ${esc(apr.name)} · ${esc(apr.transition)} ${apr.active ? '<b class="g">ACTIVE</b>' : '<b>LOADED</b>'}${f.susp ? ' · <b class="y">SUSP</b>' : ''}</span><span>${!apr.active ? '<button class="pbtn act">Activate Approach</button>' : ''}<button class="pbtn vtf">Vectors-to-Final</button><button class="pbtn missed">Missed</button><button class="pbtn rm">Remove</button></span></div>` : '';
        const total = f.wpts.length > 1 ? f.wpts.filter(w => !w.missed).reduce((t, w, i, arr) => i ? t + U.distNm(arr[i - 1], w) : 0, 0) : 0;
        h = head(f.name ? 'Flight Plan ' + f.name : 'Active Flight Plan', `${f.wpts.length} WPT · ${U.fmtDis(D.distVal(total))} ${D.distUnit()}`) +
          `<div class="fpl-tools"><button class="pbtn add">+ Waypoint</button><button class="pbtn proc">PROC</button><button class="pbtn dto">Direct-To</button>${f.directTo ? '<button class="pbtn dtoc">Cancel D→</button>' : ''}<button class="pbtn menu">Menu</button></div>${aprBar}
          <div class="fpl-cols"><span class="c-idx">#</span><span class="c-id">ID</span><span class="c-type">TYPE</span><span class="c-dtk">DTK</span><span class="c-dis">LEG</span><span class="c-cum">DIS</span><span class="c-ete">ETE</span><span class="c-alt">ALT</span></div>
          <div class="page-body">${rows || '<p class="muted pad">Flight plan is empty. Add waypoints with “+ Waypoint” or use Direct-To.</p>'}</div>`;
        P.innerHTML = h;
        P.querySelector('.add').onclick = () => UI.openAddWaypoint();
        P.querySelector('.proc').onclick = () => UI.showPage('PROC');
        P.querySelector('.dto').onclick = () => UI.openDirectTo();
        const dc = P.querySelector('.dtoc'); if (dc) dc.onclick = () => { AV.cancelDirectTo(); bus.emit('dtocancel'); };
        P.querySelector('.menu').onclick = () => UI.openFplMenu();
        if (apr) { const act = P.querySelector('.act'); if (act) act.onclick = () => { AV.activateApproach(); bus.emit('aprActivate'); }; P.querySelector('.vtf').onclick = () => { AV.activateVtf(); bus.emit('vtf'); }; P.querySelector('.missed').onclick = () => { AV.activateMissed(); bus.emit('missed'); }; P.querySelector('.rm').onclick = () => { AV.removeApproach(); bus.emit('aprRemove'); }; }
        P.querySelectorAll('.fplrow').forEach(r => { r.onclick = () => UI.openFplRowMenu(+r.dataset.i); });
        return;
      }
      case 'PROC': {
        const apts = Object.keys(NAV.APPROACHES);
        const dest = a.fpl.wpts.filter(w => !w.proc).slice(-1)[0];
        if (!UI.procApt) UI.procApt = dest && NAV.APPROACHES[dest.id] ? dest.id : NAV.nearest(pos, 'APT', 20, x => NAV.APPROACHES[x.id])[0].item.id;
        const list = NAV.APPROACHES[UI.procApt]; UI.procIdx = U.clamp(UI.procIdx || 0, 0, list.length - 1);
        const ap = list[UI.procIdx]; if (!UI.procTrans || !ap.transitions.includes(UI.procTrans)) UI.procTrans = ap.transitions[0];
        h = head('Procedures (PROC)') + `<div class="page-body proc-page">
          <div class="proc-col"><h4>Airport</h4>${apts.map(id => `<button class="item ${id === UI.procApt ? 'on' : ''}" data-apt="${id}">${id} <span class="muted">${esc(NAV.find(id).name)}</span></button>`).join('')}</div>
          <div class="proc-col"><h4>Approach</h4>${list.map((p, i) => `<button class="item ${i === UI.procIdx ? 'on' : ''}" data-idx="${i}">${esc(p.name)} <span class="muted">${p.type}${p.freq ? ' ' + U.fmtNav(p.freq) : ''}</span></button>`).join('')}
            <h4>Transition</h4>${ap.transitions.map(t => `<button class="item ${t === UI.procTrans ? 'on' : ''}" data-tr="${t}">${t === 'VECTORS' ? 'Vectors-to-Final' : t}</button>`).join('')}</div>
          <div class="proc-col"><h4>Overview</h4><div class="proc-info">Final course <b>${U.fmtHdg(ap.finalCrs)}°</b> · runway <b>${esc(ap.rwy)}</b>${ap.freq ? ` · LOC <b>${U.fmtNav(ap.freq)}</b>` : ''}<br>${ap.legs.map(l => `${esc(l.id)} ${l.alt} FT`).join(' → ')}<br>Missed: ${ap.missed.map(l => esc(l.id)).join(' → ')}</div>
            <button class="pbtn big load">Load</button><button class="pbtn big loadact">Load &amp; Activate</button>${ap.freq ? `<button class="pbtn big tune">LOC Frequency → NAV1</button>` : ''}</div></div>`;
        P.innerHTML = h;
        P.querySelectorAll('[data-apt]').forEach(b => { b.onclick = () => { UI.procApt = b.dataset.apt; UI.procIdx = 0; UI.procTrans = null; }; });
        P.querySelectorAll('[data-idx]').forEach(b => { b.onclick = () => { UI.procIdx = +b.dataset.idx; UI.procTrans = null; }; });
        P.querySelectorAll('[data-tr]').forEach(b => { b.onclick = () => { UI.procTrans = b.dataset.tr; }; });
        P.querySelector('.load').onclick = () => { AV.loadApproach(UI.procApt, UI.procIdx, UI.procTrans); bus.emit('aprLoad', { apt: UI.procApt, name: ap.name, trans: UI.procTrans }); UI.showPage('FPL'); };
        P.querySelector('.loadact').onclick = () => { AV.loadApproach(UI.procApt, UI.procIdx, UI.procTrans); AV.activateApproach(); bus.emit('aprLoad', { apt: UI.procApt, name: ap.name, trans: UI.procTrans }); bus.emit('aprActivate'); UI.showPage('FPL'); };
        const tn = P.querySelector('.tune'); if (tn) tn.onclick = () => { AV.setNavStandby(1, ap.freq); bus.emit('freq', { kind: 'NAV', n: 1, f: ap.freq }); UI.toast('NAV1 standby: ' + U.fmtNav(ap.freq)); };
        return;
      }
      case 'NRST': {
        const tab = UI.nrstTab || 'APT';
        const tabs = [['APT', 'Airports'], ['VOR', 'VOR'], ['NDB', 'NDB'], ['WPT', 'VRP/INT'], ['USER', 'User'], ['ASPC', 'Airspace']];
        let rows = '';
        if (tab === 'ASPC') {
          const list = NAV.AIRSPACES.map(s => ({ s, d: NAV.inside(s, pos) ? 0 : NAV.distToAirspace(s, pos) })).sort((x, y) => x.d - y.d).slice(0, 12);
          rows = list.map(x => `<div class="row nosel"><span class="c-id">${esc(x.s.name)}</span><span class="c-type">${x.s.cls}</span><span class="c-alt">${x.s.floor === 0 ? 'GND' : x.s.floor}–${x.s.ceil}</span><span class="c-dis">${x.d === 0 ? '<b class="y">INSIDE</b>' : U.fmtDis(D.distVal(x.d)) + ' ' + D.distUnit()}</span><span class="c-ete">${x.s.freq ? U.fmtFreq(x.s.freq) : ''}</span></div>`).join('');
        } else {
          const list = tab === 'USER' ? a.userWpts.map(w => ({ item: w, dist: U.distNm(pos, w), brg: U.bearing(pos, w) })).sort((x, y) => x.dist - y.dist) : NAV.nearest(pos, tab, 12);
          rows = list.map(x => { const it = x.item; const rel = U.norm180(x.brg - pos.hdg); return `<div class="row nrow" data-id="${esc(it.id)}"><span class="c-id"><b>${esc(it.id)}</b></span><span class="c-name">${esc(it.name || '')}</span><span class="c-dtk">${U.fmtHdg(x.brg)}° <small>${rel > 0 ? '→' : '←'}</small></span><span class="c-dis">${U.fmtDis(D.distVal(x.dist))}</span><span class="c-ete">${it.type === 'APT' ? U.fmtFreq(NAV.mainFreq(it)) : it.type === 'VOR' ? U.fmtNav(it.freq) : it.type === 'NDB' ? it.freq.toFixed(1) : ''}</span><span class="c-alt">${it.type === 'APT' ? it.elev + ' FT · ' + it.rwys[0].id + ' ' + it.rwys[0].len + 'm' : ''}</span></div>`; }).join('') || '<p class="muted pad">Nothing found.</p>';
        }
        h = head('Nearest', `${D.distUnit()} · BRG`) + `<div class="tabs">${tabs.map(t => `<button class="tab ${t[0] === tab ? 'on' : ''}" data-t="${t[0]}">${t[1]}</button>`).join('')}</div><div class="page-body">${rows}</div>`;
        P.innerHTML = h;
        P.querySelectorAll('.tab').forEach(b => { b.onclick = () => { UI.nrstTab = b.dataset.t; bus.emit('nrsttab', b.dataset.t); }; });
        P.querySelectorAll('.nrow').forEach(r => { r.onclick = () => { const it = AV.findWpt(r.dataset.id); if (it) UI.openFeatureInfo(it); }; });
        return;
      }
      case 'WPT': {
        const w = UI.wptSel ? AV.findWpt(UI.wptSel) : null;
        h = head('Waypoint Information') + `<div class="page-body wpt"><button class="pbtn big search">🔍 Search Waypoint (ID)</button>${w ? `<div class="wpt-card"><h3>${esc(w.id)} <small>${esc(w.name || '')}</small></h3><div>Type <b>${esc(w.type)}</b> · BRG <b>${U.fmtHdg(U.bearing(pos, w))}°</b> · DIS <b>${U.fmtDis(D.distVal(U.distNm(pos, w)))} ${D.distUnit()}</b></div><div>${U.fmtLat(w.lat)} ${U.fmtLon(w.lon)}</div>${w.type === 'APT' ? `<div>Elevation ${w.elev} FT · runways ${w.rwys.map(r => r.id).join(', ')} · ${w.freqs.filter(f => f.freq).map(f => f.type + ' ' + U.fmtFreq(f.freq)).join(' · ')}</div>` : ''}${w.freq ? `<div>Frequency ${w.type === 'VOR' ? U.fmtNav(w.freq) : w.freq.toFixed(1)} · ${esc(U.morse(w.id))}</div>` : ''}<div class="btns"><button class="pbtn info">Full Info</button><button class="pbtn dto">Direct-To</button><button class="pbtn ins">Insert in FPL</button><button class="pbtn map">Show on Map</button></div></div>` : '<p class="muted pad">Search a waypoint by identifier (e.g. EBZH, BUB, HASSE).</p>'}</div>`;
        P.innerHTML = h;
        P.querySelector('.search').onclick = () => alphaPad({ title: 'Search Waypoint', enterLabel: 'Show', search: q => q ? NAV.search(q, 10) : [], onEnter: v => { const x = AV.findWpt(v); if (!x) { UI.toast('Unknown waypoint'); return false; } UI.wptSel = x.id; UI.pageBuilt = null; bus.emit('wptinfo', x.id); } });
        if (w) { P.querySelector('.info').onclick = () => UI.openFeatureInfo(w); P.querySelector('.dto').onclick = () => { AV.directTo(w); bus.emit('dto', w.id); }; P.querySelector('.ins').onclick = () => UI.openInsertPosition(w); P.querySelector('.map').onclick = () => { a.map.pan = { lat: w.lat, lon: w.lon }; a.map.panning = true; UI.showPage('MAP'); }; }
        return;
      }
      case 'SETUP': {
        const u = a.units, m = a.map;
        const opt = (label, obj, key, values, fmt) => `<div class="opt-row"><span>${label}</span><div class="opt-vals">${values.map(v => `<button class="opt-val ${obj[key] === v ? 'on' : ''}" data-o="${obj === u ? 'u' : obj === m ? 'm' : 'a'}" data-k="${key}" data-v="${v}">${fmt ? fmt(v) : v}</button>`).join('')}</div></div>`;
        const onoff = v => v ? 'ON' : 'OFF';
        h = head('Setup') + `<div class="page-body opts">
          <h4>Units</h4>${opt('Distance', u, 'dist', ['NM', 'KM'])}${opt('Altitude', u, 'alt', ['FT', 'M'])}${opt('Speed', u, 'speed', ['KT', 'KMH'], v => v === 'KMH' ? 'KM/H' : v)}${opt('Temperature', u, 'temp', ['C', 'F'], v => '°' + v)}${opt('Baro', u, 'baro', ['HPA', 'INHG'], v => v === 'HPA' ? 'hPa' : 'inHg')}${opt('Fuel', u, 'fuel', ['L', 'GAL'])}
          <h4>PFD</h4>${opt('Synthetic Vision', a, 'svt', [true, false], onoff)}${opt('V-Speeds', a, 'vspeeds', [true, false], onoff)}${opt('Clock', a, 'clockUtc', [false, true], v => v ? 'UTC' : 'Local')}
          <h4>Map</h4>${opt('Orientation', m, 'orient', ['NORTH', 'TRKUP', 'HDGUP'], v => ({ NORTH: 'North Up', TRKUP: 'Track Up', HDGUP: 'Heading Up' })[v])}${opt('Topo', m, 'topo', [true, false], onoff)}${opt('Airspace', m, 'airspace', [true, false], onoff)}
          <h4>System</h4>${opt('Sound', a, 'sound', [true, false], onoff)}${opt('Brightness', a, 'brightness', [100, 70, 40], v => v + '%')}
          <div class="opt-row"><span>Stored Data</span><div class="opt-vals"><button class="opt-val reset">Clear All</button></div></div>
          <p class="muted pad">Trainer: simplified navigation data, not for navigation. No magnetic variation modelled.</p></div>`;
        P.innerHTML = h;
        P.querySelectorAll('.opt-val[data-k]').forEach(b => { b.onclick = () => { const obj = b.dataset.o === 'u' ? u : b.dataset.o === 'm' ? m : a; let v = b.dataset.v; if (v === 'true') v = true; else if (v === 'false') v = false; else if (/^\d+$/.test(v)) v = +v; obj[b.dataset.k] = v; AV.save(); bus.emit('setup', { k: b.dataset.k, v }); P.querySelectorAll(`.opt-val[data-k="${b.dataset.k}"]`).forEach(c => c.classList.toggle('on', c === b)); }; });
        P.querySelector('.reset').onclick = () => { if (confirm('Clear stored flight plans, user waypoints and settings?')) { localStorage.removeItem('g3x.persist'); a.storedFpls = []; a.userWpts = []; UI.toast('Cleared'); } };
        return;
      }
      case 'CHK': {
        const c = a.checklist; const groups = AV.CHECKLISTS; const g = groups[c.group];
        const doneKey = i => c.group + ':' + i;
        const allDone = g.items.every((_, i) => c.done[doneKey(i)]);
        h = head('Checklist — ' + g.name, `${g.items.filter((_, i) => c.done[doneKey(i)]).length}/${g.items.length}`) + `<div class="chk-wrap"><div class="chk-groups">${groups.map((gr, i) => `<button class="item ${i === c.group ? 'on' : ''} ${gr.name.startsWith('EMERG') ? 'emerg' : ''}" data-g="${i}">${esc(gr.name)}</button>`).join('')}</div><div class="page-body chk-items">${g.items.map((it, i) => `<button class="row chk ${c.done[doneKey(i)] ? 'done' : ''}" data-i="${i}"><span class="box">${c.done[doneKey(i)] ? '✓' : ''}</span><span>${esc(it)}</span></button>`).join('')}${allDone ? '<div class="chk-complete">Checklist complete ✓</div>' : ''}<div class="btns"><button class="pbtn resetchk">Reset Checklist</button><button class="pbtn nextchk">Next Checklist</button></div></div></div>`;
        P.innerHTML = h;
        P.querySelectorAll('[data-g]').forEach(b => { b.onclick = () => { c.group = +b.dataset.g; UI.pageBuilt = null; }; });
        P.querySelectorAll('.chk').forEach(b => { b.onclick = () => { const k = doneKey(+b.dataset.i); c.done[k] = !c.done[k]; bus.emit('chk', { group: g.name, item: +b.dataset.i, done: c.done[k] }); if (g.items.every((_, i) => c.done[doneKey(i)])) bus.emit('chkdone', g.name); UI.pageBuilt = null; }; });
        P.querySelector('.resetchk').onclick = () => { g.items.forEach((_, i) => delete c.done[doneKey(i)]); UI.pageBuilt = null; };
        P.querySelector('.nextchk').onclick = () => { c.group = (c.group + 1) % groups.length; UI.pageBuilt = null; };
        return;
      }
      case 'TIMER': {
        const t = a.timer;
        h = head('Timer') + `<div class="page-body timer">
          <div class="tm-card"><h4>Generic Timer</h4><div class="tm-val">${U.fmtTimer(t.value)}</div><div class="btns"><button class="pbtn startstop">${t.running ? 'Stop' : 'Start'}</button><button class="pbtn resett">Reset</button><button class="pbtn dir">${t.dir === 'UP' ? 'Count Up' : 'Count Down'}</button><button class="pbtn preset">Set…</button></div>${t.expired ? '<div class="y">Timer expired</div>' : ''}</div>
          <div class="tm-card"><h4>Flight Timer</h4><div class="tm-val">${U.fmtTimer(a.flightTimer)}</div><div class="muted">Runs once the aircraft moves</div></div>
          <div class="tm-card"><h4>Clock</h4><div class="tm-val">${U.fmtTime(new Date(), a.clockUtc)}</div><div class="btns"><button class="pbtn clock">${a.clockUtc ? 'UTC' : 'Local'}</button></div></div>
          <div class="tm-card"><h4>Engine</h4><div class="muted">Hobbs ${S.eng.hobbs.toFixed(1)} h · flight time ${U.fmtTimer(S.ac.flightTime)}</div></div></div>`;
        P.innerHTML = h;
        P.querySelector('.startstop').onclick = () => { t.running = !t.running; t.expired = false; bus.emit('timer', t.running ? 'start' : 'stop'); };
        P.querySelector('.resett').onclick = () => { t.value = t.dir === 'DOWN' ? t.preset : 0; t.expired = false; t.running = false; bus.emit('timer', 'reset'); };
        P.querySelector('.dir').onclick = () => { t.dir = t.dir === 'UP' ? 'DOWN' : 'UP'; t.value = t.dir === 'DOWN' ? t.preset : 0; bus.emit('timer', 'dir' + t.dir); };
        P.querySelector('.preset').onclick = () => numpad({ title: 'Set Timer (mm:ss)', maxLen: 4, display: v => { const s = (v.padStart(4, '0')); return s.slice(0, 2) + ':' + s.slice(2); }, onEnter: v => { const s = v.padStart(4, '0'); t.preset = parseInt(s.slice(0, 2), 10) * 60 + parseInt(s.slice(2), 10); t.dir = 'DOWN'; t.value = t.preset; t.expired = false; bus.emit('timer', 'preset' + t.preset); } });
        P.querySelector('.clock').onclick = () => { a.clockUtc = !a.clockUtc; };
        return;
      }
      case 'TRIP': case 'INFO': {
        const ac = S.ac;
        h = head('Trip Computer') + `<div class="page-body opts"><div class="info-grid">
          <div>Odometer<b>${U.fmtDis(D.distVal(ac.odo))} ${D.distUnit()}</b></div><div>Flight time<b>${U.fmtTimer(ac.flightTime)}</b></div><div>Average GS<b>${ac.flightTime > 10 ? D.spdVal(ac.odo / (ac.flightTime / 3600)) : 0} ${D.spdUnit()}</b></div><div>Maximum GS<b>${D.spdVal(ac.maxGs)} ${D.spdUnit()}</b></div><div>Fuel used<b>${D.fuelVal(ac.fuelUsed)} ${D.fuelUnit()}</b></div><div>Position<b>${U.fmtLat(ac.lat)}<br>${U.fmtLon(ac.lon)}</b></div><div>GPS altitude<b>${Math.round(ac.alt)} FT</b></div><div>AGL / terrain<b>${Math.round(ac.agl || 0)} FT / ${Math.round(NAV.terrainFt(ac.lat, ac.lon))} FT</b></div><div>Pressure altitude<b>${Math.round(SIM.pressureAlt())} FT</b></div><div>Density altitude<b>${Math.round(SIM.pressureAlt() + 120 * (SIM.oat() - U.isaTemp(SIM.pressureAlt())))} FT</b></div><div>Wind<b>${U.fmtHdg(S.env.windDir)}°/${Math.round(S.env.windSpd)} KT</b></div><div>OAT / ISA dev<b>${D.tempVal(SIM.oat())} / ${(SIM.oat() - U.isaTemp(ac.alt)).toFixed(0)}°</b></div></div>
          <div class="btns"><button class="pbtn resettrip">Reset Trip</button></div></div>`;
        P.innerHTML = h; P.querySelector('.resettrip').onclick = () => { ac.odo = 0; ac.flightTime = 0; ac.maxGs = 0; ac.fuelUsed = 0; };
        return;
      }
      case 'MSG': {
        const list = a.msgs.filter(m => !m.cleared);
        h = head('Messages', `${list.length}`) + `<div class="page-body">${list.map(m => `<div class="row nosel msg ${m.kind}"><span class="c-time">${U.fmtTime(m.time, a.clockUtc).slice(0, 5)}</span><span class="c-text">${esc(m.text)}</span></div>`).join('') || '<p class="muted pad">No messages.</p>'}<div class="btns"><button class="pbtn clearmsg">Clear All</button></div></div>`;
        P.innerHTML = h; P.querySelector('.clearmsg').onclick = () => { a.msgs.forEach(m => m.cleared = true); a.msgNew = false; };
        a.msgNew = false;
        return;
      }
      case 'TRAFFIC': {
        h = head('Traffic (simulated)') + `<div class="page-body">${a.traffic.length ? a.traffic.map(t => { const d = U.distNm(pos, t), b = U.bearing(pos, t); return `<div class="row nosel"><span class="c-id"><b>${esc(t.id)}</b></span><span class="c-dtk">${U.fmtHdg(b)}°</span><span class="c-dis">${U.fmtDis(d)} NM</span><span class="c-alt">${t.alt > pos.alt ? '+' : ''}${Math.round((t.alt - pos.alt) / 100)}00 FT</span><span class="c-ete">${t.vs > 200 ? '↑' : t.vs < -200 ? '↓' : '→'}</span></div>`; }).join('') : '<p class="muted pad">No traffic. This trainer has no ADS-B receiver; scenarios can simulate traffic.</p>'}<div class="btns"><button class="pbtn addtraffic">Simulate Traffic</button><button class="pbtn cleartraffic">Clear</button></div></div>`;
        P.innerHTML = h;
        P.querySelector('.addtraffic').onclick = () => UI.spawnTraffic();
        P.querySelector('.cleartraffic').onclick = () => { a.traffic = []; };
        return;
      }
      case 'WX': { h = head('Weather') + `<div class="page-body pad"><p>No weather datalink available in this trainer (no SiriusXM / FIS-B in Europe).</p><p>Simulated environment: wind <b>${U.fmtHdg(S.env.windDir)}°/${Math.round(S.env.windSpd)} KT</b>, QNH <b>${S.env.qnh} hPa</b>, OAT <b>${D.tempVal(SIM.oat())}</b>, turbulence <b>${S.env.turb < 0.3 ? 'light' : S.env.turb < 0.8 ? 'moderate' : 'strong'}</b>.</p><p class="muted">Tip: in real life you get the QNH from ATIS/AFIS or the METAR. Set it in the baro field below the altitude tape.</p></div>`; P.innerHTML = h; return; }
      case 'CHARTS': { h = head('Charts') + `<div class="page-body pad"><p>No electronic charts (FliteCharts / ChartView) loaded in this trainer.</p><p class="muted">On the real G3X Touch approach charts are an optional database subscription.</p></div>`; P.innerHTML = h; return; }
      case 'USER': {
        h = head('User Waypoints', `${a.userWpts.length}`) + `<div class="page-body">${a.userWpts.map(w => `<div class="row urow" data-id="${esc(w.id)}"><span class="c-id"><b>${esc(w.id)}</b></span><span class="c-name">${U.fmtLat(w.lat)} ${U.fmtLon(w.lon)}</span><span class="c-dtk">${U.fmtHdg(U.bearing(pos, w))}°</span><span class="c-dis">${U.fmtDis(U.distNm(pos, w))} NM</span></div>`).join('') || '<p class="muted pad">No user waypoints yet.</p>'}<div class="btns"><button class="pbtn mkhere">Create at Present Position</button></div></div>`;
        P.innerHTML = h;
        P.querySelector('.mkhere').onclick = () => { const w = AV.addUserWaypoint(pos.lat, pos.lon); bus.emit('userwpt', w.id); UI.toast(`${w.id} created`); };
        P.querySelectorAll('.urow').forEach(r => { r.onclick = () => UI.openFeatureInfo(AV.findWpt(r.dataset.id)); });
        return;
      }
      case 'FPLLIST': {
        h = head('Flight Plan List', `${a.storedFpls.length}`) + `<div class="page-body">${a.storedFpls.map((s, i) => `<div class="row srow" data-i="${i}"><span class="c-id"><b>${esc(s.name)}</b></span><span class="c-name">${s.wpts.map(w => esc(w.id)).join(' → ')}</span><span class="c-ete"><button class="pbtn del" data-i="${i}">✕</button></span></div>`).join('') || '<p class="muted pad">No stored flight plans. Store the active plan via FPL → Menu → Store Flight Plan.</p>'}<div class="btns"><button class="pbtn storecur">Store Active Plan</button></div></div>`;
        P.innerHTML = h;
        P.querySelectorAll('.srow').forEach(r => { r.onclick = e => { if (e.target.classList.contains('del')) { AV.fplDeleteStored(+e.target.dataset.i); return; } AV.fplLoad(+r.dataset.i); bus.emit('fplload'); UI.showPage('FPL'); }; });
        P.querySelector('.storecur').onclick = () => { AV.fplStore(); bus.emit('fplstore'); };
        return;
      }
      case 'VNAV': {
        const n = a.nav; const v = n && n.vnav;
        const cons = a.fpl.wpts.filter(w => w.alt != null && !w.missed);
        h = head('VNAV') + `<div class="page-body opts"><div class="info-grid">
          <div>Next constraint<b>${v ? v.wpt + ' at ' + v.alt + ' FT' : '—'}</b></div><div>Distance to TOD<b>${v ? (v.todDis > 0 ? U.fmtDis(v.todDis) + ' NM · ' + U.fmtEte(v.todEte) : 'PAST TOD') : '—'}</b></div><div>Required vertical speed<b>${v ? Math.round(v.reqFpm) + ' FPM' : '—'}</b></div><div>Vertical deviation<b>${v ? (v.vdev > 0 ? '+' : '') + Math.round(v.vdev) + ' FT' : '—'}</b></div><div>Descent angle<b>3.0°</b></div><div>Deviation indicator<b>${v && v.todDis < 5 ? 'SHOWN ON PFD (V)' : 'OFF'}</b></div></div>
          <h4>Altitude constraints in the flight plan</h4>${cons.length ? cons.map(w => `<div class="opt-row"><span>${esc(w.id)}</span><b>${w.alt} FT</b></div>`).join('') : '<p class="muted">None. Touch a waypoint in the Active Flight Plan → Set Altitude (VNAV).</p>'}
          <p class="muted">Fly the descent manually: keep the magenta V chevron centred (≈ 3°, about 300 ft per NM).</p><div class="btns"><button class="pbtn gofpl">Active Flight Plan</button></div></div>`;
        P.innerHTML = h; P.querySelector('.gofpl').onclick = () => UI.showPage('FPL');
        return;
      }
      case 'WB': {
        const wb = a.wb || (a.wb = { empty: 390, pilot: 85, pax: 0, bag: 5 });
        const fuelKg = Math.round((S.ac.fuelL + S.ac.fuelR) * 0.72);
        const total = wb.empty + wb.pilot + wb.pax + wb.bag + fuelKg; const mtow = 600;
        const row = (k, label, val, editable = true) => `<div class="opt-row"><span>${label}</span><div class="opt-vals"><button class="opt-val ${editable ? 'wbe' : ''}" data-k="${k}">${val} kg</button></div></div>`;
        h = head('Weight & Balance') + `<div class="page-body opts">${row('empty', 'Empty weight', wb.empty)}${row('pilot', 'Pilot', wb.pilot)}${row('pax', 'Passenger', wb.pax)}${row('bag', 'Baggage (max 20 kg)', wb.bag)}${row('fuel', 'Fuel (from tanks, 0.72 kg/L)', fuelKg, false)}
          <div class="opt-row"><span><b>Take-off weight</b></span><b class="${total > mtow ? 'y' : 'g'}">${total} kg / MTOW ${mtow} kg${total > mtow ? ' — OVERWEIGHT' : ''}</b></div>
          <p class="muted">Trainer: weights are indicative; no arm/CG data loaded. Use the aircraft's weighing report and POH.</p></div>`;
        P.innerHTML = h;
        P.querySelectorAll('.wbe').forEach(b => { b.onclick = () => numpad({ title: b.closest('.opt-row').querySelector('span').textContent, maxLen: 3, unit: 'kg', display: v => v || String(wb[b.dataset.k]), onEnter: v => { if (v) { wb[b.dataset.k] = parseInt(v, 10); UI.pageBuilt = null; } } }); });
        return;
      }
      case 'TRACKLOG': { P.innerHTML = head('Track Log') + `<div class="page-body pad"><p>Track logging is not available in this trainer.</p><p class="muted">On the real G3X Touch the track log records your flight path for review or export to a data card.</p></div>`; return; }
      case 'DATALINK': { P.innerHTML = head('Data Link') + `<div class="page-body pad"><p>No data link (Connext / GDL) connected in this trainer.</p><p class="muted">Used for weather, traffic and Flight Stream connectivity with a tablet.</p></div>`; return; }
      case 'MUSIC': { P.innerHTML = head('Music') + `<div class="page-body pad"><p>No audio source connected.</p></div>`; return; }
      case 'TOOLS': {
        P.innerHTML = head('Tools') + `<div class="page-body"><div class="menu-list pad"><button class="item" data-p="PROC">Approach / Procedures</button><button class="item" data-p="TRIP">Trip Computer</button><button class="item" data-p="WB">Weight &amp; Balance</button><button class="item" data-p="USER">User Waypoints</button></div></div>`;
        P.querySelectorAll('.item').forEach(b => { b.onclick = () => UI.showPage(b.dataset.p); }); return;
      }
      default: P.innerHTML = head(page) + '<div class="page-body pad muted">Page not available.</div>';
    }
  };
  // tegel uit het hoofdmenu: pagina of dialoogvenster
  UI.openTile = p => {
    bus.emit('tile', p);
    switch (p) {
      case 'FLIGHTLOG': UI.showPage('TRIP'); break;
      case 'USERTIMER': UI.showPage('TIMER'); break;
      case 'BACKLIGHT': UI.openBacklight(); break;
      default: UI.showPage(p);
    }
  };
  UI.openBacklight = () => {
    const a = A();
    UI.openDialog({ title: 'Backlight Intensity', width: 420, html: `<div class="xp-modes">${[100, 85, 70, 55, 40].map(v => `<button class="xp-mode bl ${a.brightness === v ? 'on' : ''}" data-v="${v}">${v}%</button>`).join('')}</div><p class="muted">Lower the intensity at night or to reduce electrical load (alternator failure).</p>`, buttons: [{ label: 'Close' }], onOpen: d => { d.el.querySelectorAll('.bl').forEach(b => { b.onclick = () => { a.brightness = +b.dataset.v; bus.emit('setup', { k: 'brightness', v: a.brightness }); d.el.querySelectorAll('.bl').forEach(c => c.classList.toggle('on', c === b)); }; }); } });
  };
  // HSI-opties: aantikken van de HSI geeft de CDI-bron (GPS / VOR), heading bug, bearing pointers en OBS
  UI.openHsiOptions = () => {
    const a = A();
    const opt = (label, key, values, fmt) => `<div class="opt-row"><span>${label}</span><div class="opt-vals">${values.map(v => `<button class="opt-val ${a[key] === v ? 'on' : ''}" data-k="${key}" data-v="${v}">${fmt ? fmt(v) : v}</button>`).join('')}</div></div>`;
    const srcName = v => v === 'GPS' ? 'GPS' : (a[v.toLowerCase()].data.loc ? 'LOC' + v.slice(-1) : 'VOR' + v.slice(-1));
    const html = `<div class="opts">
      ${opt('CDI Source', 'navSource', ['GPS', 'NAV1', 'NAV2'], srcName)}
      ${opt('Bearing Pointer 1', 'brg1', ['OFF', 'GPS', 'NAV1', 'NAV2'])}
      ${opt('Bearing Pointer 2', 'brg2', ['OFF', 'GPS', 'NAV1', 'NAV2'])}
      <div class="opt-row"><span>Heading Bug</span><div class="opt-vals"><button class="opt-val hdg">${U.fmtHdg(a.hdgBug)}°</button><button class="opt-val sync">SYNC</button></div></div>
      <div class="opt-row"><span>Course</span><div class="opt-vals"><button class="opt-val crs">${U.fmtHdg(a.navSource === 'GPS' ? a.crs1 : a[a.navSource.toLowerCase()].obs)}°</button><button class="opt-val obs ${a.fpl.obs ? 'on' : ''}">OBS</button></div></div>
    </div>`;
    const d = UI.openDialog({ title: 'HSI Options', html, width: 520, buttons: [{ label: 'Close' }] });
    d.el.querySelectorAll('.opt-val[data-k]').forEach(b => { b.onclick = () => { const k = b.dataset.k; a[k] = b.dataset.v; bus.emit(k === 'navSource' ? 'navsrc' : k, a[k]); d.el.querySelectorAll(`.opt-val[data-k="${k}"]`).forEach(c => c.classList.toggle('on', c === b)); if (k === 'navSource') UI.toast('CDI source: ' + srcName(a.navSource)); }; });
    d.el.querySelector('.hdg').onclick = () => UI.openHdgSel();
    d.el.querySelector('.sync').onclick = () => { a.hdgBug = Math.round(SIM.S.ac.hdg); bus.emit('hdgbug', a.hdgBug); UI.closeDialog(); };
    d.el.querySelector('.crs').onclick = () => UI.openCrs();
    d.el.querySelector('.obs').onclick = () => { if (!a.nav || !a.nav.valid) { UI.toast('No active waypoint'); return; } a.fpl.obs = !a.fpl.obs; if (a.fpl.obs) a.crs1 = Math.round(a.nav.dtk); bus.emit('obs', a.fpl.obs); UI.closeDialog(); };
  };
  UI.openFplRowMenu = i => {
    const f = A().fpl, w = f.wpts[i];
    UI.openDialog({ title: `${w.id}`, width: 400, html: `<div class="menu-list"><button class="item" data-a="leg">Activate Leg to ${esc(w.id)}</button><button class="item" data-a="dto">Direct-To ${esc(w.id)}</button><button class="item" data-a="before">Insert Before</button><button class="item" data-a="after">Insert After</button><button class="item" data-a="alt">Set Altitude (VNAV)</button><button class="item" data-a="info">Waypoint Info</button><button class="item danger" data-a="rm">Remove</button></div>`, buttons: [{ label: 'Close' }],
      onOpen: d => { d.el.querySelectorAll('.item').forEach(b => { b.onclick = () => { const act = b.dataset.a; UI.closeDialog(); if (act === 'leg') { if (i === 0) { UI.toast('First waypoint: no leg'); return; } AV.fplActivateLeg(i); bus.emit('actleg', w.id); } else if (act === 'dto') { AV.directTo(w); bus.emit('dto', w.id); } else if (act === 'before') UI.openAddWaypoint(i); else if (act === 'after') UI.openAddWaypoint(i + 1); else if (act === 'alt') numpad({ title: `Altitude at ${w.id}`, maxLen: 5, unit: 'FT', display: v => v || (w.alt != null ? String(w.alt) : ''), onEnter: v => { w.alt = v ? parseInt(v, 10) : null; bus.emit('wptalt', { id: w.id, alt: w.alt }); }, extra: '<div class="xp-modes"><button class="xp-mode clr">Clear Altitude</button></div>', onOpen: dd => { dd.el.querySelector('.clr').onclick = () => { w.alt = null; UI.closeDialog(); }; } }); else if (act === 'info') UI.openFeatureInfo(AV.findWpt(w.id) || w); else if (act === 'rm') { AV.fplRemove(i); bus.emit('fplremove', w.id); } }; }); } });
  };
  UI.spawnTraffic = () => {
    const a = A(), p = SIM.S.ac;
    const n = a.traffic.length;
    const brg = U.rnd(0, 360), d = U.rnd(2, 6);
    const pos = U.dest(p, brg, d);
    a.traffic.push({ id: 'TFC' + (n + 1), lat: pos.lat, lon: pos.lon, alt: p.alt + U.pick([-800, -500, 0, 300, 700]), trk: U.norm360(brg + 180 + U.rnd(-30, 30)), gs: U.rnd(80, 130), vs: U.pick([0, 0, -300, 400]) });
    bus.emit('traffic');
  };

  G3X.ui = UI;
})();

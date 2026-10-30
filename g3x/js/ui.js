/* Aanraakinterface (DOM over het canvas): knoppenbalk-acties, pagina's (Home, FPL, NRST, WPT, Setup, Checklist, Timer …),
   dialoogvensters (toetsenborden voor frequenties, transponder, baro, hoogte, heading, Direct-To, AP-paneel …) en de draaiknoppen. */
window.G3X = window.G3X || {};
(function () {
  const U = G3X.util, NAV = G3X.nav, D = G3X.display, SIM = G3X.sim, AV = G3X.avionics, AP = G3X.autopilot, esc = U.esc;
  const A = () => AV.A;

  // gebeurtenissenbus voor de scenario-controle
  const bus = { log: [], emit(name, data) { bus.log.push({ name, data, t: SIM.S.t }); if (bus.log.length > 500) bus.log.shift(); }, since(t, name) { return bus.log.filter(e => e.t >= t && (!name || e.name === name)); } };
  G3X.bus = bus;

  const UI = { pane: null, dialogLayer: null, dialog: null, pageBuilt: null, lastPaneRefresh: 0, menuOpen: false, knobLeftSet: 0, sel: 0 };

  UI.init = overlay => {
    UI.overlay = overlay;
    overlay.innerHTML = '<div id="g3x-pane" class="g3x-pane hidden"></div><div id="g3x-dialogs" class="g3x-dialogs"></div><div id="g3x-toast" class="g3x-toast hidden"></div>';
    UI.pane = overlay.querySelector('#g3x-pane');
    UI.dialogLayer = overlay.querySelector('#g3x-dialogs');
    UI.toastEl = overlay.querySelector('#g3x-toast');
    overlay.addEventListener('pointerdown', () => { if (G3X.audio) G3X.audio.ensure(); }, { passive: true });
  };

  UI.toast = (text, ms = 2500) => { const t = UI.toastEl; t.textContent = text; t.classList.remove('hidden'); clearTimeout(UI.toastT); UI.toastT = setTimeout(() => t.classList.add('hidden'), ms); };

  // ---------- pagina's / lay-out ----------
  UI.showPage = page => {
    const a = A();
    if (page === 'PFD') { a.layout = a.layout === 'MFD' ? 'SPLIT' : a.layout; a.pfdPage = 'PFD'; bus.emit('page', 'PFD'); return; }
    if (a.layout === 'PFD') { if (page === 'ENG') { a.pfdPage = 'ENG'; bus.emit('page', page); return; } a.layout = 'SPLIT'; }
    if (a.pfdPage === 'ENG') a.pfdPage = 'PFD';
    if (a.mfdPage !== page) { a.prevPage = a.mfdPage; a.mfdPage = page; }
    UI.sel = 0; UI.menuOpen = false;
    bus.emit('page', page);
  };
  UI.button = id => {
    const a = A();
    if (G3X.audio) G3X.audio.play('click');
    bus.emit('button', id);
    switch (id) {
      case 'BACK': if (UI.dialog) { UI.closeDialog(); break; } if (a.map.panning && a.mfdPage === 'MAP') { G3X.mfd.stopPan(); break; } if (a.layout === 'PFD' && a.pfdPage === 'ENG') { a.pfdPage = 'PFD'; break; } if (a.mfdPage === 'HOME') a.mfdPage = 'MAP'; else if (G3X.mfd.isDomPage(a.mfdPage)) a.mfdPage = 'MAP'; else a.mfdPage = 'HOME'; break;
      case 'DTO': UI.openDirectTo(); break;
      case 'NRST': UI.showPage('NRST'); break;
      case 'MENU': UI.openMenu(); break;
      case 'MSG': UI.showPage('MSG'); a.msgNew = false; break;
      case 'HOME': UI.showPage('HOME'); break;
      case 'PFD': a.layout = 'PFD'; a.pfdPage = 'PFD'; bus.emit('layout', 'PFD'); break;
      case 'SPLIT': a.layout = 'SPLIT'; a.pfdPage = 'PFD'; bus.emit('layout', 'SPLIT'); break;
      case 'MFD': a.layout = 'MFD'; bus.emit('layout', 'MFD'); break;
      case 'SUSP': AV.unsuspend(); bus.emit('unsusp'); break;
      case 'OBS': a.fpl.obs = false; break;
    }
  };

  // ---------- draaiknoppen ----------
  UI.knobLabels = () => {
    const a = A();
    if (UI.dialog && UI.dialog.knobLabels) return UI.dialog.knobLabels;
    const left = UI.knobLeftSet === 0 ? { outer: 'HDG', inner: 'ALT' } : UI.knobLeftSet === 1 ? { outer: 'BARO', inner: 'CRS' } : { outer: 'COM1 MHz', inner: 'COM1 kHz' };
    let right;
    if (a.layout === 'PFD') right = { outer: 'BARO', inner: 'CRS' };
    else if (a.mfdPage === 'MAP' || a.mfdPage === 'TERRAIN') right = { outer: 'RANGE', inner: a.map.panning ? 'PAN ↕' : 'PAN' };
    else if (['FPL', 'NRST', 'CHK', 'MSG', 'FPLLIST', 'USER', 'HOME', 'PROC'].includes(a.mfdPage)) right = { outer: 'SCROLL', inner: 'SELECT' };
    else right = { outer: 'RANGE', inner: '—' };
    return { left, right };
  };
  // side 'L'|'R', ring 'outer'|'inner', dir ±1
  UI.knob = (side, ring, dir) => {
    const a = A();
    if (UI.dialog && UI.dialog.onKnob) { UI.dialog.onKnob(side, ring, dir); return; }
    if (side === 'L') {
      if (UI.knobLeftSet === 0) { if (ring === 'outer') { a.hdgBug = U.norm360(a.hdgBug + dir); bus.emit('hdgbug', a.hdgBug); } else { a.altSel = U.clamp(a.altSel + dir * 100, -1000, 20000); bus.emit('altsel', a.altSel); } }
      else if (UI.knobLeftSet === 1) { if (ring === 'outer') { if (a.baroStd) { a.baroStd = false; } a.baro = U.clamp(a.baro + dir, 940, 1060); bus.emit('baro', a.baro); } else { UI.adjustCrs(dir); } }
      else { a.com1.standby = U.nextCom(a.com1.standby, dir, ring === 'outer'); }
      return;
    }
    // rechts
    if (a.layout === 'PFD') { if (ring === 'outer') { a.baroStd = false; a.baro = U.clamp(a.baro + dir, 940, 1060); bus.emit('baro', a.baro); } else UI.adjustCrs(dir); return; }
    if (a.mfdPage === 'MAP' || a.mfdPage === 'TERRAIN') { if (ring === 'outer') { G3X.mfd.rangeStep(dir); bus.emit('range', a.map.range); } else { if (!a.map.panning) { a.map.pan = { lat: SIM.S.ac.lat, lon: SIM.S.ac.lon }; a.map.panning = true; } G3X.mfd.panBy(0, dir * -30); } return; }
    if (['FPL', 'NRST', 'CHK', 'MSG', 'FPLLIST', 'USER', 'HOME', 'PROC'].includes(a.mfdPage)) { UI.moveSel(dir); return; }
  };
  UI.knobPress = side => {
    const a = A();
    if (UI.dialog && UI.dialog.onEnter) { UI.dialog.onEnter(); return; }
    if (side === 'L') { UI.knobLeftSet = (UI.knobLeftSet + 1) % 3; UI.toast(['Linkerknop: HDG (buiten) / ALT (binnen)', 'Linkerknop: BARO (buiten) / CRS (binnen)', 'Linkerknop: COM1 standby MHz / kHz'][UI.knobLeftSet]); return; }
    if (a.mfdPage === 'MAP' || a.mfdPage === 'TERRAIN') { if (a.map.panning) G3X.mfd.stopPan(); else { a.map.pan = { lat: SIM.S.ac.lat, lon: SIM.S.ac.lon }; a.map.panning = true; UI.showMapCursorMenu(); } return; }
    const sel = UI.pane.querySelector('.row.sel, .tile.sel, .item.sel'); if (sel) sel.click();
  };
  UI.adjustCrs = dir => { const a = A(); if (a.navSource === 'GPS') { a.crs1 = U.norm360(a.crs1 + dir); if (a.fpl.obs) bus.emit('crs', a.crs1); } else { const r = a[a.navSource.toLowerCase()]; r.obs = U.norm360(r.obs + dir); bus.emit('crs', r.obs); } };
  UI.moveSel = dir => { const rows = [...UI.pane.querySelectorAll('.row, .tile, .item')].filter(r => !r.classList.contains('nosel')); if (!rows.length) return; UI.sel = U.clamp(UI.sel + dir, 0, rows.length - 1); rows.forEach((r, i) => r.classList.toggle('sel', i === UI.sel)); rows[UI.sel].scrollIntoView({ block: 'nearest' }); };

  UI.cycleNavSource = () => { const a = A(); const order = ['GPS', 'NAV1', 'NAV2']; a.navSource = order[(order.indexOf(a.navSource) + 1) % 3]; bus.emit('navsrc', a.navSource); UI.toast('CDI-bron: ' + a.navSource); };
  UI.cycleBrg = which => { const a = A(); const order = ['OFF', 'GPS', 'NAV1', 'NAV2']; const k = 'brg' + which; a[k] = order[(order.indexOf(a[k]) + 1) % 4]; bus.emit('brg' + which, a[k]); };

  // ---------- dialoogvenster-raamwerk ----------
  UI.closeDialog = () => { if (UI.dialog && UI.dialog.el) UI.dialog.el.remove(); UI.dialog = null; UI.dialogLayer.classList.remove('open'); };
  UI.openDialog = cfg => {
    UI.closeDialog();
    const el = document.createElement('div'); el.className = 'g3x-dialog ' + (cfg.cls || '');
    if (cfg.width) el.style.width = cfg.width + 'px';
    el.innerHTML = `<div class="dlg-title"><span>${esc(cfg.title)}</span><button class="dlg-close" aria-label="Sluiten">✕</button></div><div class="dlg-body">${cfg.html || ''}</div>${cfg.buttons ? `<div class="dlg-buttons">${cfg.buttons.map((b, i) => `<button class="dlg-btn ${b.cls || ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div>` : ''}`;
    el.querySelector('.dlg-close').onclick = () => UI.closeDialog();
    if (cfg.buttons) el.querySelectorAll('.dlg-btn').forEach(b => { b.onclick = () => { const c = cfg.buttons[+b.dataset.i]; if (c.onClick) { const keep = c.onClick(); if (keep !== true) UI.closeDialog(); } else UI.closeDialog(); }; });
    UI.dialogLayer.appendChild(el); UI.dialogLayer.classList.add('open');
    UI.dialog = Object.assign({ el, body: el.querySelector('.dlg-body') }, cfg);
    if (cfg.onOpen) cfg.onOpen(UI.dialog);
    return UI.dialog;
  };

  // numeriek toetsenbord
  function numpad(cfg) {
    // cfg: title, value (string), maxLen, keys (array), onChange(str)=>display, onEnter(str)=>bool|void, extra html, onKnob
    let val = cfg.value || '';
    const keys = cfg.keys || ['1', '2', '3', '4', '5', '6', '7', '8', '9', cfg.dot ? '.' : '', '0', '⌫'];
    const d = UI.openDialog({
      title: cfg.title, cls: 'numpad', width: cfg.width || 360,
      html: `<div class="np-display"><span class="np-val">${esc(cfg.display ? cfg.display(val) : val)}</span><span class="np-unit">${esc(cfg.unit || '')}</span></div>${cfg.extra || ''}<div class="np-keys">${keys.map(k => `<button class="np-key ${k === '' ? 'empty' : ''}" data-k="${k}">${k}</button>`).join('')}</div>`,
      buttons: [{ label: 'Annuleer' }, { label: cfg.enterLabel || 'Enter', cls: 'primary', onClick: () => { const r = cfg.onEnter(val); return r === false ? true : undefined; } }],
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
      buttons: [{ label: 'Annuleer' }, { label: cfg.enterLabel || 'Enter', cls: 'primary', onClick: () => { const r = cfg.onEnter(val); return r === false ? true : undefined; } }],
      knobLabels: { left: { outer: '—', inner: '—' }, right: { outer: 'LETTER', inner: 'LETTER' } },
      onKnob: (side, ring, dir) => { const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; const last = val.slice(-1) || 'A'; let i = alpha.indexOf(last); if (i < 0) i = 0; i = (i + dir + alpha.length) % alpha.length; val = (val.length ? val.slice(0, -1) : '') + alpha[i]; refresh(); },
      onEnter: () => { const r = cfg.onEnter(val); if (r !== false) UI.closeDialog(); },
    });
    const results = d.body.querySelector('.ap-results');
    const refresh = () => {
      d.body.querySelector('.np-val').textContent = val;
      const list = cfg.search ? cfg.search(val) : [];
      results.innerHTML = list.map(w => `<button class="ap-res" data-id="${esc(w.id)}"><b>${esc(w.id)}</b> <span>${esc(w.name || '')}</span> <em>${esc(w.type || '')}</em></button>`).join('') || '<div class="muted">Geen resultaten</div>';
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
    const lists = isCom ? [['Recent', a.recentCom.map(f => ({ label: U.fmtFreq(f), freq: f }))], ['Nabij', nearby], ['Nood', [{ label: 'Noodfrequentie', freq: 121.5 }, { label: 'ULM/club', freq: 123.405 }, { label: 'Brussels INFO', freq: 126.905 }]]] : [['VOR nabij', vors], ['ILS nabij', ils]];
    const fmt = s => { if (!s.length) return isCom ? '1__.___' : '1__.__'; let str = s; const whole = str.slice(0, 3), frac = str.slice(3); return (whole + '___'.slice(whole.length)) + '.' + (frac + (isCom ? '___' : '__').slice(frac.length)); };
    const toFreq = s => { if (s.length < 4) return null; const f = parseFloat(s.slice(0, 3) + '.' + s.slice(3).padEnd(isCom ? 3 : 2, '0')); return f; };
    const d = numpad({
      title: `${kind}${n} standby`, value: '', maxLen: isCom ? 6 : 5, unit: 'MHz', width: 620,
      display: fmt,
      filter: v => { if (v.length === 1 && v !== '1') return '1' + v; if (v.length === 2 && !/^1[1-3]$/.test(v)) return v.slice(0, 1); return v; },
      extra: `<div class="freq-lists">${lists.map(([t, l]) => `<div class="freq-col"><h4>${esc(t)}</h4>${l.map(x => `<button class="freq-item" data-f="${x.freq}"><span>${esc(x.label)}</span><b>${isCom ? U.fmtFreq(x.freq) : U.fmtNav(x.freq)}</b></button>`).join('') || '<div class="muted">—</div>'}</div>`).join('')}</div><div class="freq-cur">Actief: <b>${isCom ? U.fmtFreq(r.active) : U.fmtNav(r.active)}</b> · Standby: <b>${isCom ? U.fmtFreq(r.standby) : U.fmtNav(r.standby)}</b></div>`,
      enterLabel: 'Enter', knobOuter: 'MHz', knobInner: 'kHz',
      onKnob: (v, ring, dir) => { const cur = toFreq(v) || r.standby; const nf = isCom ? U.nextCom(cur, dir, ring === 'outer') : U.nextNav(cur, dir, ring === 'outer'); return (isCom ? U.fmtFreq(nf) : U.fmtNav(nf)).replace('.', ''); },
      onEnter: v => { const f = toFreq(v); if (f == null) { UI.toast('Onvolledige frequentie'); return false; } const ok = isCom ? AV.setComStandby(n, f) : AV.setNavStandby(n, f); if (!ok) { UI.toast(isCom ? 'Ongeldig 8,33 kHz-kanaal' : 'Ongeldige NAV-frequentie'); return false; } bus.emit('freq', { kind, n, f }); },
    });
    d.el.querySelectorAll('.freq-item').forEach(b => { b.onclick = () => { const f = parseFloat(b.dataset.f); if (isCom) AV.setComStandby(n, f); else AV.setNavStandby(n, f); bus.emit('freq', { kind, n, f }); UI.closeDialog(); }; });
    // extra knop: swap
    const bar = d.el.querySelector('.dlg-buttons'); const sw = document.createElement('button'); sw.className = 'dlg-btn'; sw.textContent = '⇄ XFER'; sw.onclick = () => { if (isCom) AV.swapCom(n); else AV.swapNav(n); UI.closeDialog(); }; bar.insertBefore(sw, bar.firstChild);
    if (isCom) { const em = document.createElement('button'); em.className = 'dlg-btn danger'; em.textContent = '121.500'; em.onclick = () => { AV.setComStandby(n, 121.5); bus.emit('freq', { kind, n, f: 121.5 }); UI.closeDialog(); }; bar.insertBefore(em, bar.firstChild); }
  };

  // ---------- transponder ----------
  UI.openXpdr = () => {
    const a = A(), x = a.xpdr;
    const d = numpad({
      title: 'Transponder', value: '', maxLen: 4, keys: ['1', '2', '3', '4', '5', '6', '7', '', '0', '⌫'], width: 520,
      display: v => (v + '____').slice(0, 4),
      extra: `<div class="xp-modes">${['STBY', 'GND', 'ON', 'ALT'].map(m => `<button class="xp-mode ${x.mode === m ? 'on' : ''}" data-m="${m}">${m}</button>`).join('')}<button class="xp-mode ident">IDENT</button><button class="xp-mode vfr">VFR 7000</button></div><div class="xp-cur">Huidige code: <b>${x.code}</b> · modus <b>${x.mode}</b><br><span class="muted">7700 nood · 7600 radio-uitval · 7500 kaping</span></div>`,
      onEnter: v => { if (v.length !== 4) { UI.toast('Code heeft 4 cijfers (0–7)'); return false; } AV.setSquawk(v); bus.emit('squawk', v); },
      onKnob: (v, ring, dir) => { let code = parseInt((v.length === 4 ? v : x.code), 8); code = (code + dir * (ring === 'outer' ? 64 : 1) + 4096) % 4096; return code.toString(8).padStart(4, '0'); },
    });
    d.el.querySelectorAll('.xp-mode[data-m]').forEach(b => { b.onclick = () => { AV.setXpdrMode(b.dataset.m); bus.emit('xpdrmode', b.dataset.m); d.el.querySelectorAll('.xp-mode[data-m]').forEach(c => c.classList.toggle('on', c.dataset.m === b.dataset.m)); }; });
    d.el.querySelector('.xp-mode.ident').onclick = () => { AV.ident(); bus.emit('ident'); UI.toast('IDENT'); };
    d.el.querySelector('.xp-mode.vfr').onclick = () => { AV.setSquawk('7000'); bus.emit('squawk', '7000'); UI.closeDialog(); };
  };

  // ---------- baro / hoogte / heading / koers ----------
  UI.openBaro = () => {
    const a = A();
    const inHg = a.units.baro === 'INHG';
    numpad({
      title: 'Baro-instelling', value: '', maxLen: inHg ? 4 : 4, unit: inHg ? 'inHg' : 'hPa', width: 420, dot: false,
      display: v => inHg ? ((v + '____').slice(0, 2) + '.' + (v + '____').slice(2, 4)) : (v + '____').slice(0, 4),
      extra: `<div class="xp-modes"><button class="xp-mode std ${a.baroStd ? 'on' : ''}">STD (1013)</button><button class="xp-mode unitsw">${inHg ? 'hPa' : 'inHg'}</button></div><div class="xp-cur">Huidig: <b>${a.baroStd ? 'STD' : D.fmtBaro(a.baro)}</b></div>`,
      onEnter: v => { let hpa; if (inHg) { if (v.length < 4) return false; hpa = parseFloat(v.slice(0, 2) + '.' + v.slice(2)) * 33.8639; } else { if (v.length < 3) return false; hpa = parseInt(v, 10); } if (hpa < 940 || hpa > 1060) { UI.toast('Buiten bereik (940–1060 hPa)'); return false; } a.baro = Math.round(hpa); a.baroStd = false; bus.emit('baro', a.baro); },
      onKnob: (v, ring, dir) => { a.baroStd = false; a.baro = U.clamp(a.baro + dir * (ring === 'outer' ? 10 : 1), 940, 1060); bus.emit('baro', a.baro); UI.dialog.el.querySelector('.xp-cur b').textContent = D.fmtBaro(a.baro); return v; },
      onOpen: d => { d.el.querySelector('.std').onclick = () => { a.baroStd = !a.baroStd; bus.emit('baro', a.baroStd ? 'STD' : a.baro); UI.closeDialog(); }; d.el.querySelector('.unitsw').onclick = () => { a.units.baro = inHg ? 'HPA' : 'INHG'; AV.save(); UI.openBaro(); }; },
    });
  };
  UI.openAltSel = () => {
    const a = A();
    numpad({ title: 'Geselecteerde hoogte', value: '', maxLen: 5, unit: D.fmtAltUnit(), width: 400, display: v => v || String(a.altSel), extra: `<div class="xp-modes"><button class="xp-mode sync">Huidige hoogte</button></div>`,
      onEnter: v => { if (!v) return; let ft = parseInt(v, 10); if (a.units.alt === 'M') ft = ft / U.FT_M; a.altSel = Math.round(ft / 10) * 10; bus.emit('altsel', a.altSel); },
      onKnob: (v, ring, dir) => { a.altSel = U.clamp(a.altSel + dir * (ring === 'outer' ? 1000 : 100), -1000, 20000); bus.emit('altsel', a.altSel); return ''; },
      onOpen: d => { d.el.querySelector('.sync').onclick = () => { a.altSel = Math.round(AV.indAlt() / 100) * 100; bus.emit('altsel', a.altSel); UI.closeDialog(); }; } });
  };
  UI.openHdgSel = () => {
    const a = A();
    numpad({ title: 'Heading bug', value: '', maxLen: 3, unit: '°', width: 400, display: v => v || U.fmtHdg(a.hdgBug), extra: `<div class="xp-modes"><button class="xp-mode sync">SYNC naar huidige heading</button></div><div class="xp-cur muted">Tip: ook met de buitenring van de linkerknop</div>`,
      onEnter: v => { if (!v) return; a.hdgBug = U.norm360(parseInt(v, 10)); bus.emit('hdgbug', a.hdgBug); },
      onKnob: (v, ring, dir) => { a.hdgBug = U.norm360(a.hdgBug + dir * (ring === 'outer' ? 10 : 1)); bus.emit('hdgbug', a.hdgBug); return ''; },
      onOpen: d => { d.el.querySelector('.sync').onclick = () => { a.hdgBug = Math.round(SIM.S.ac.hdg); bus.emit('hdgbug', a.hdgBug); UI.closeDialog(); }; } });
  };
  UI.openCrs = () => {
    const a = A();
    const cur = () => a.navSource === 'GPS' ? a.crs1 : a[a.navSource.toLowerCase()].obs;
    numpad({ title: a.navSource === 'GPS' ? 'Koers (OBS-modus)' : `CRS ${a.navSource}`, value: '', maxLen: 3, unit: '°', width: 420, display: v => v || U.fmtHdg(cur()),
      extra: a.navSource === 'GPS' ? `<div class="xp-modes"><button class="xp-mode obs ${a.fpl.obs ? 'on' : ''}">OBS ${a.fpl.obs ? 'uit' : 'aan'}</button></div><div class="xp-cur muted">OBS houdt het actieve waypoint vast en laat je een eigen koers ernaartoe kiezen.</div>` : `<div class="xp-cur muted">Draai de koerswijzer op de gewenste radiaal/inbound koers.</div>`,
      onEnter: v => { if (!v) return; const c = U.norm360(parseInt(v, 10)); if (a.navSource === 'GPS') { a.crs1 = c; if (!a.fpl.obs && a.nav && a.nav.valid) { a.fpl.obs = true; } } else a[a.navSource.toLowerCase()].obs = c; bus.emit('crs', c); },
      onKnob: (v, ring, dir) => { for (let i = 0; i < (ring === 'outer' ? 10 : 1); i++) UI.adjustCrs(dir); return ''; },
      onOpen: d => { const b = d.el.querySelector('.obs'); if (b) b.onclick = () => { if (!a.nav || !a.nav.valid) { UI.toast('Geen actief waypoint'); return; } a.fpl.obs = !a.fpl.obs; if (a.fpl.obs) a.crs1 = Math.round(a.nav.dtk); bus.emit('obs', a.fpl.obs); UI.closeDialog(); }; } });
  };

  // ---------- autopilot-paneel ----------
  UI.openApPanel = () => {
    const html = `<div class="ap-panel">${['HDG', 'TRK', 'NAV', 'APR', 'AP', 'FD', 'ALT', 'VS', 'IAS', 'VNV', 'LVL', 'GA'].map(b => `<button class="ap-btn" data-b="${b}">${b}</button>`).join('')}<button class="ap-btn" data-b="UP">▲ NOSE UP</button><button class="ap-btn" data-b="DN">▼ NOSE DN</button><button class="ap-btn danger" data-b="DISC">AP DISC</button></div><div class="ap-status"></div>`;
    const d = UI.openDialog({ title: 'Autopilot (GMC 507)', html, width: 520, buttons: [{ label: 'Sluit' }] });
    const refresh = () => { const st = AP.status(); d.el.querySelector('.ap-status').innerHTML = `AP <b class="${st.on ? 'g' : ''}">${st.on ? 'AAN' : 'UIT'}</b> · FD <b>${st.fd ? 'AAN' : 'UIT'}</b> · ${esc(st.lat)}${st.latArm ? ' <i>(' + esc(st.latArm) + ')</i>' : ''} / ${esc(st.vert)} ${esc(st.vertRef)}${st.vertArm ? ' <i>(' + esc(st.vertArm) + ')</i>' : ''}`; d.el.querySelectorAll('.ap-btn').forEach(b => { const id = b.dataset.b; const p = A().ap; b.classList.toggle('on', (id === 'AP' && p.on) || (id === 'FD' && p.fd) || p.lat === id || p.vert === id || (id === 'NAV' && (p.lat === 'NAV' || p.latArm === 'NAV')) || (id === 'APR' && (p.lat === 'APR' || p.latArm === 'APR')) || (id === 'VNV' && (p.vert === 'VNV' || p.vertArm.includes('VNV')))); }); };
    d.el.querySelectorAll('.ap-btn').forEach(b => { b.onclick = () => { UI.apButton(b.dataset.b); refresh(); }; });
    d.refresh = refresh; refresh();
  };
  UI.apButton = id => { AP.press(id); bus.emit('ap', id); if (G3X.audio) G3X.audio.play('click'); if (UI.dialog && UI.dialog.refresh) UI.dialog.refresh(); if (G3X.main) G3X.main.refreshApPanel(); };

  // ---------- PFD-opties / menu ----------
  UI.openPfdOptions = () => {
    const a = A();
    const opt = (label, key, values, fmt) => `<div class="opt-row"><span>${label}</span><div class="opt-vals">${values.map(v => `<button class="opt-val ${a[key] === v ? 'on' : ''}" data-k="${key}" data-v="${v}">${fmt ? fmt(v) : v}</button>`).join('')}</div></div>`;
    const html = `<div class="opts">
      ${opt('Synthetic Vision', 'svt', [true, false], v => v ? 'AAN' : 'UIT')}
      ${opt('Bearing pointer 1', 'brg1', ['OFF', 'GPS', 'NAV1', 'NAV2'])}
      ${opt('Bearing pointer 2', 'brg2', ['OFF', 'GPS', 'NAV1', 'NAV2'])}
      ${opt('Windvector', 'windMode', [0, 1, 2, 3], v => ['UIT', 'Componenten', 'Pijl', 'Richting/snelheid'][v])}
      ${opt('CDI-bron', 'navSource', ['GPS', 'NAV1', 'NAV2'])}
      ${opt('V-snelheden', 'vspeeds', [true, false], v => v ? 'AAN' : 'UIT')}
      ${opt('Kaart-inzet (volledig PFD)', 'inset', ['OFF', 'MAP'])}
      ${opt('Minimums', 'minimumsOn', [true, false], v => v ? 'AAN' : 'UIT')}
      <div class="opt-row"><span>Minimums-hoogte</span><div class="opt-vals"><button class="opt-val setmins">${a.minimums != null ? a.minimums + ' ft' : 'instellen'}</button></div></div>
    </div>`;
    const d = UI.openDialog({ title: 'PFD-opties', html, width: 560, buttons: [{ label: 'Sluit' }] });
    d.el.querySelectorAll('.opt-val[data-k]').forEach(b => { b.onclick = () => { const k = b.dataset.k; let v = b.dataset.v; if (v === 'true') v = true; else if (v === 'false') v = false; else if (/^\d+$/.test(v)) v = +v; a[k] = v; bus.emit('pfdopt', { k, v }); if (k === 'svt') AV.save(); d.el.querySelectorAll(`.opt-val[data-k="${k}"]`).forEach(c => c.classList.toggle('on', c === b)); }; });
    d.el.querySelector('.setmins').onclick = () => { numpad({ title: 'Minimums (baro)', value: '', maxLen: 5, unit: 'ft', width: 380, display: v => v || String(a.minimums ?? ''), onEnter: v => { if (!v) return; a.minimums = parseInt(v, 10); a.minimumsOn = true; bus.emit('minimums', a.minimums); } }); };
  };
  UI.openMenu = () => {
    const a = A();
    if (UI.dialog) { UI.closeDialog(); return; }
    const page = a.layout === 'PFD' ? 'PFD' : a.mfdPage;
    if (page === 'PFD') return UI.openPfdOptions();
    if (page === 'MAP' || page === 'TERRAIN') return UI.openMapOptions();
    if (page === 'FPL') return UI.openFplMenu();
    if (page === 'ENG') { UI.openFuelOnBoard(); return; }
    UI.openDialog({ title: 'Menu', html: '<div class="menu-list"><button class="item" data-a="pfd">PFD-opties</button><button class="item" data-a="map">Kaartopties</button><button class="item" data-a="setup">Instellingen</button><button class="item" data-a="layout">Schermindeling wisselen</button></div>', width: 400, buttons: [{ label: 'Sluit' }], onOpen: d => { d.el.querySelectorAll('.item').forEach(b => { b.onclick = () => { const act = b.dataset.a; if (act === 'pfd') UI.openPfdOptions(); else if (act === 'map') UI.openMapOptions(); else if (act === 'setup') { UI.closeDialog(); UI.showPage('SETUP'); } else { a.layout = a.layout === 'SPLIT' ? 'MFD' : a.layout === 'MFD' ? 'PFD' : 'SPLIT'; UI.closeDialog(); } }; }); } });
  };
  UI.openMapOptions = () => {
    const a = A(), m = a.map;
    const opt = (label, key, values, fmt) => `<div class="opt-row"><span>${label}</span><div class="opt-vals">${values.map(v => `<button class="opt-val ${m[key] === v ? 'on' : ''}" data-k="${key}" data-v="${v}">${fmt ? fmt(v) : v}</button>`).join('')}</div></div>`;
    const onoff = v => v ? 'AAN' : 'UIT';
    const html = `<div class="opts">
      ${opt('Oriëntatie', 'orient', ['NORTH', 'TRKUP', 'HDGUP'], v => ({ NORTH: 'North up', TRKUP: 'Track up', HDGUP: 'Heading up' })[v])}
      ${opt('Declutter', 'declutter', [0, 1, 2, 3], v => v === 0 ? 'Alles' : 'Niveau ' + v)}
      ${opt('Topografie', 'topo', [true, false], onoff)}
      ${opt('Luchtruim', 'airspace', [true, false], onoff)}
      ${opt('Koersvector (60 s)', 'trackVector', [true, false], onoff)}
      ${opt('Range ring', 'rangeRing', [true, false], onoff)}
      ${opt('Obstakels', 'obstacles', [true, false], onoff)}
      ${opt('Steden', 'cities', [true, false], onoff)}
      ${opt('Water', 'water', [true, false], onoff)}
      <div class="opt-row"><span>Cursor</span><div class="opt-vals"><button class="opt-val stoppan">Cursor uit</button><button class="opt-val measure">Meten vanaf vliegtuig</button></div></div>
    </div>`;
    const d = UI.openDialog({ title: a.mfdPage === 'TERRAIN' ? 'Terreinopties' : 'Kaartopties', html, width: 560, buttons: [{ label: 'Sluit' }] });
    d.el.querySelectorAll('.opt-val[data-k]').forEach(b => { b.onclick = () => { const k = b.dataset.k; let v = b.dataset.v; if (v === 'true') v = true; else if (v === 'false') v = false; else if (/^\d+$/.test(v)) v = +v; m[k] = v; bus.emit('mapopt', { k, v }); AV.save(); d.el.querySelectorAll(`.opt-val[data-k="${k}"]`).forEach(c => c.classList.toggle('on', c === b)); }; });
    d.el.querySelector('.stoppan').onclick = () => { G3X.mfd.stopPan(); UI.closeDialog(); };
    d.el.querySelector('.measure').onclick = () => { m.pan = { lat: SIM.S.ac.lat, lon: SIM.S.ac.lon }; m.panning = true; UI.closeDialog(); UI.toast('Sleep de kaart of draai de binnenknop: peiling en afstand staan linksonder'); };
  };
  UI.showMapCursorMenu = () => {
    // kleine knoppenbalk bij de cursor
    const a = A();
    const d = UI.openDialog({ title: 'Kaartcursor', cls: 'mini', width: 330, html: `<div class="menu-list"><button class="item" data-a="dto">Direct-To cursorpositie</button><button class="item" data-a="usr">Gebruikerswaypoint hier</button><button class="item" data-a="ins">Toevoegen aan vluchtplan</button><button class="item" data-a="info">Luchtruim hier</button><button class="item" data-a="off">Cursor uit</button></div>`,
      onOpen: dd => { dd.el.querySelectorAll('.item').forEach(b => { b.onclick = () => { const p = a.map.pan; const act = b.dataset.a; if (act === 'dto') { const w = { id: 'MAPWP', name: 'Kaartpunt', type: 'USER', lat: p.lat, lon: p.lon }; AV.directTo(w); bus.emit('dto', w.id); } else if (act === 'usr') { const w = AV.addUserWaypoint(p.lat, p.lon); bus.emit('userwpt', w.id); UI.toast(`${w.id} aangemaakt`); } else if (act === 'ins') { const w = AV.addUserWaypoint(p.lat, p.lon); AV.fplAdd(w); bus.emit('fpladd', w.id); } else if (act === 'info') { const list = NAV.airspacesAt(p); UI.closeDialog(); UI.openDialog({ title: 'Luchtruim op cursorpositie', width: 460, html: list.length ? `<div class="menu-list">${list.map(s => `<div class="item nosel"><b>${esc(s.name)}</b><br><span class="muted">Klasse ${s.cls} · ${s.floor === 0 ? 'GND' : s.floor + ' ft'} – ${s.ceil} ft${s.freq ? ' · ' + U.fmtFreq(s.freq) : ''}</span></div>`).join('')}</div>` : '<p class="muted">Geen gecontroleerd luchtruim op deze positie (klasse G).</p>', buttons: [{ label: 'Sluit' }] }); return; } else if (act === 'off') G3X.mfd.stopPan(); UI.closeDialog(); }; }); } });
    d.el.classList.add('corner');
  };

  // ---------- feature-info / waypoint-info ----------
  UI.openFeatureInfo = item => {
    const a = A(), pos = SIM.S.ac;
    const brg = U.bearing(pos, item), dis = U.distNm(pos, item);
    let body = `<div class="wi-head"><b>${esc(item.id)}</b> <span>${esc(item.name || '')}</span><em>${esc(item.type || '')}</em></div><div class="wi-grid"><div>BRG <b>${U.fmtHdg(brg)}°</b></div><div>DIS <b>${U.fmtDis(D.distVal(dis))} ${D.distUnit()}</b></div><div>${U.fmtLat(item.lat)}</div><div>${U.fmtLon(item.lon)}</div></div>`;
    if (item.type === 'APT') {
      body += `<div class="wi-sec">Hoogte <b>${item.elev} ft</b> · ${esc({ intl: 'gecontroleerd', civil: 'ongecontroleerd', mil: 'militair', ulm: 'ULM-terrein' }[item.kind] || '')}</div>`;
      body += `<div class="wi-sec"><h4>Banen</h4>${item.rwys.map(r => `<div>${esc(r.id)} · ${r.len} m · ${esc(r.surf)} · ${U.fmtHdg(r.hdg)}°/${U.fmtHdg(r.hdg + 180)}°${r.ils ? ' · ILS ' + Object.entries(r.ils).map(([k, v]) => k + ' ' + U.fmtNav(v)).join(', ') : ''}</div>`).join('')}</div>`;
      body += `<div class="wi-sec"><h4>Frequenties</h4>${item.freqs.filter(f => f.freq).map(f => `<button class="freq-item tune" data-f="${f.freq}"><span>${esc(f.type)}</span><b>${U.fmtFreq(f.freq)}</b></button>`).join('') || '<span class="muted">—</span>'}<div class="muted">Tik op een frequentie: naar COM1 standby</div></div>`;
      const wind = SIM.windAt(); const best = item.rwys.flatMap(r => r.id.split('/').map((id, i) => ({ id, hdg: i ? U.norm360(r.hdg + 180) : r.hdg }))).map(r => ({ r, hw: wind.spd * Math.cos((wind.dir - r.hdg) * U.DEG) })).sort((p, q) => q.hw - p.hw)[0];
      body += `<div class="wi-sec">Wind ${U.fmtHdg(wind.dir)}°/${Math.round(wind.spd)} kt → baan in gebruik (meeste tegenwind): <b>${best.r.id}</b></div>`;
      if (NAV.APPROACHES[item.id]) body += `<div class="wi-sec">Naderingen: ${NAV.APPROACHES[item.id].map(p => esc(p.name)).join(', ')}</div>`;
    } else if (item.type === 'VOR' || item.type === 'NDB') {
      body += `<div class="wi-sec">Frequentie <b>${item.type === 'VOR' ? U.fmtNav(item.freq) : item.freq.toFixed(1)}</b>${item.dme ? ' · DME' : ''} · ident <b>${esc(item.id)}</b> <span class="morse">${esc(U.morse(item.id))}</span></div><div class="wi-sec">Radiaal vanaf station: <b>${U.fmtHdg(U.bearing(item, pos))}°</b></div>`;
      if (item.type === 'VOR') body += `<div class="wi-sec"><button class="freq-item tunenav" data-f="${item.freq}"><span>Naar NAV1 standby</span><b>${U.fmtNav(item.freq)}</b></button></div>`;
    } else if (item.type === 'OBST') {
      body += `<div class="wi-sec">Hoogte top <b>${item.msl} ft MSL</b> (${item.agl} ft AGL)</div>`;
    }
    const buttons = [{ label: 'Sluit' }];
    if (item.type !== 'OBST') {
      buttons.push({ label: 'Direct-To', cls: 'primary', onClick: () => { AV.directTo(item); bus.emit('dto', item.id); } });
      buttons.push({ label: 'In vluchtplan', onClick: () => { UI.openInsertPosition(item); return true; } });
    }
    if (item.type === 'APT' && NAV.APPROACHES[item.id]) buttons.push({ label: 'Nadering', onClick: () => { UI.showPage('PROC'); UI.procApt = item.id; } });
    if (item.user) buttons.push({ label: 'Verwijder', cls: 'danger', onClick: () => { a.userWpts = a.userWpts.filter(w => w !== item); const i = NAV.ALL.indexOf(item); if (i >= 0) NAV.ALL.splice(i, 1); AV.save(); } });
    const d = UI.openDialog({ title: 'Waypoint-informatie', html: body, width: 520, buttons });
    d.el.querySelectorAll('.tune').forEach(b => { b.onclick = () => { AV.setComStandby(1, parseFloat(b.dataset.f)); bus.emit('freq', { kind: 'COM', n: 1, f: parseFloat(b.dataset.f) }); UI.toast('COM1 standby ingesteld'); }; });
    d.el.querySelectorAll('.tunenav').forEach(b => { b.onclick = () => { AV.setNavStandby(1, parseFloat(b.dataset.f)); bus.emit('freq', { kind: 'NAV', n: 1, f: parseFloat(b.dataset.f) }); UI.toast('NAV1 standby ingesteld'); }; });
    bus.emit('wptinfo', item.id);
  };
  UI.openInsertPosition = item => {
    const f = A().fpl;
    if (!f.wpts.length) { AV.fplAdd(item); bus.emit('fpladd', item.id); UI.closeDialog(); UI.toast(`${item.id} toegevoegd`); return; }
    UI.openDialog({ title: `${item.id} invoegen`, width: 420, html: `<div class="menu-list">${f.wpts.map((w, i) => `<button class="item" data-i="${i}">Vóór ${esc(w.id)}</button>`).join('')}<button class="item" data-i="${f.wpts.length}">Aan het einde</button></div>`, buttons: [{ label: 'Annuleer' }], onOpen: d => { d.el.querySelectorAll('.item').forEach(b => { b.onclick = () => { AV.fplAdd(item, +b.dataset.i); bus.emit('fpladd', item.id); UI.closeDialog(); UI.toast(`${item.id} toegevoegd`); }; }); } });
  };

  // ---------- Direct-To ----------
  UI.openDirectTo = () => {
    const a = A(), pos = SIM.S.ac;
    const near = NAV.nearest(pos, 'ALL', 8, x => x.type !== 'INT' || true).map(x => x.item);
    const fpl = a.fpl.wpts;
    const extra = `<div class="dto-lists"><div class="freq-col"><h4>Vluchtplan</h4>${fpl.map(w => `<button class="ap-res" data-id="${esc(w.id)}"><b>${esc(w.id)}</b></button>`).join('') || '<div class="muted">leeg</div>'}</div><div class="freq-col"><h4>Dichtstbij</h4>${near.map(w => `<button class="ap-res" data-id="${esc(w.id)}"><b>${esc(w.id)}</b> <span>${esc(w.type)}</span></button>`).join('')}</div></div>`;
    const d = alphaPad({ title: 'Direct-To', value: '', enterLabel: 'Activeer', extra, search: q => q ? NAV.search(q, 8) : [],
      onEnter: v => { const w = AV.findWpt(v); if (!w) { UI.toast('Onbekend waypoint'); return false; } AV.directTo(w); bus.emit('dto', w.id); } });
    d.el.querySelectorAll('.dto-lists .ap-res').forEach(b => { b.onclick = () => { const w = AV.findWpt(b.dataset.id) || fpl.find(x => x.id === b.dataset.id); if (w) { AV.directTo(w); bus.emit('dto', w.id); UI.closeDialog(); } }; });
    const bar = d.el.querySelector('.dlg-buttons');
    if (a.fpl.directTo) { const c = document.createElement('button'); c.className = 'dlg-btn danger'; c.textContent = 'Direct-To annuleren'; c.onclick = () => { AV.cancelDirectTo(); bus.emit('dtocancel'); UI.closeDialog(); }; bar.insertBefore(c, bar.firstChild); }
    const crsB = document.createElement('button'); crsB.className = 'dlg-btn'; crsB.textContent = 'Met koers…'; crsB.onclick = () => { const id = d.el.querySelector('.np-val').textContent; const w = AV.findWpt(id); if (!w) { UI.toast('Kies eerst een waypoint'); return; } numpad({ title: `Koers naar ${w.id}`, maxLen: 3, unit: '°', width: 380, display: v => v || U.fmtHdg(U.bearing(pos, w)), onEnter: v => { AV.directTo(w, v ? U.norm360(parseInt(v, 10)) : null); bus.emit('dto', w.id); } }); }; bar.insertBefore(crsB, bar.firstChild);
  };

  // ---------- brandstof ----------
  UI.openFuelOnBoard = () => {
    const ac = SIM.S.ac;
    numpad({ title: 'Brandstof aan boord (totaal)', value: '', maxLen: 3, unit: 'L', width: 420, display: v => v || String(Math.round(ac.fuelL + ac.fuelR)), extra: `<div class="xp-modes"><button class="xp-mode full">Vol (2×60 L)</button><button class="xp-mode half">Halfvol</button></div><div class="xp-cur muted">Dit is de brandstofcomputer: vertel het systeem hoeveel je getankt hebt. In de echte G3X past dit alleen de berekening aan, in deze trainer ook de tanks.</div>`,
      onEnter: v => { if (!v) return; const tot = U.clamp(parseInt(v, 10), 0, 120); ac.fuelL = tot / 2; ac.fuelR = tot / 2; bus.emit('fob', tot); },
      onOpen: d => { d.el.querySelector('.full').onclick = () => { ac.fuelL = 60; ac.fuelR = 60; bus.emit('fob', 120); UI.closeDialog(); }; d.el.querySelector('.half').onclick = () => { ac.fuelL = 30; ac.fuelR = 30; bus.emit('fob', 60); UI.closeDialog(); }; } });
  };
  UI.openFuelSelector = () => {
    const ac = SIM.S.ac;
    UI.openDialog({ title: 'Tankkeuze (cockpitkraan)', width: 380, html: `<div class="xp-modes">${['L', 'R', 'OFF'].map(s => `<button class="xp-mode fs ${ac.fuelSel === s ? 'on' : ''}" data-s="${s}">${s === 'L' ? 'LINKS' : s === 'R' ? 'RECHTS' : 'OFF'}</button>`).join('')}</div><p class="muted">De P2008 heeft een tankkraan L / R / OFF. Wissel regelmatig van tank om de balans te bewaren.</p>`, buttons: [{ label: 'Sluit' }], onOpen: d => { d.el.querySelectorAll('.fs').forEach(b => { b.onclick = () => { SIM.setFuelSel(b.dataset.s); bus.emit('fuelsel', b.dataset.s); d.el.querySelectorAll('.fs').forEach(c => c.classList.toggle('on', c === b)); }; }); } });
  };

  // ---------- vluchtplan-menu ----------
  UI.openFplMenu = () => {
    const a = A(), f = a.fpl;
    UI.openDialog({ title: 'Vluchtplan-opties', width: 420, html: `<div class="menu-list">
      <button class="item" data-a="add">Waypoint toevoegen</button>
      <button class="item" data-a="proc">Nadering laden (PROC)</button>
      <button class="item" data-a="invert">Vluchtplan omkeren</button>
      <button class="item" data-a="store">Vluchtplan opslaan</button>
      <button class="item" data-a="list">Opgeslagen vluchtplannen</button>
      <button class="item" data-a="obs">${f.obs ? 'OBS uitschakelen' : 'OBS-modus'}</button>
      <button class="item danger" data-a="clear">Vluchtplan wissen</button></div>`, buttons: [{ label: 'Sluit' }],
      onOpen: d => { d.el.querySelectorAll('.item').forEach(b => { b.onclick = () => { const act = b.dataset.a; UI.closeDialog(); if (act === 'add') UI.openAddWaypoint(); else if (act === 'proc') UI.showPage('PROC'); else if (act === 'invert') { AV.fplInvert(); bus.emit('fplinvert'); } else if (act === 'store') { AV.fplStore(); bus.emit('fplstore'); UI.toast('Vluchtplan opgeslagen'); } else if (act === 'list') UI.showPage('FPLLIST'); else if (act === 'obs') { if (!a.nav || !a.nav.valid) { UI.toast('Geen actief waypoint'); return; } f.obs = !f.obs; if (f.obs) a.crs1 = Math.round(a.nav.dtk); bus.emit('obs', f.obs); } else if (act === 'clear') { AV.fplClear(); bus.emit('fplclear'); } }; }); } });
  };
  UI.openAddWaypoint = index => {
    alphaPad({ title: index != null ? 'Waypoint invoegen' : 'Waypoint toevoegen', enterLabel: 'Toevoegen', search: q => q ? NAV.search(q, 8) : NAV.nearest(SIM.S.ac, 'ALL', 8).map(x => x.item),
      onEnter: v => { const w = AV.findWpt(v); if (!w) { UI.toast('Onbekend waypoint'); return false; } AV.fplAdd(w, index); bus.emit('fpladd', w.id); } });
  };

  // ---------- DOM-pagina's ----------
  UI.tick = () => {
    const a = A(), L = D.L; if (!L) return;
    const page = a.layout === 'PFD' ? null : a.mfdPage;
    const show = page && G3X.mfd.isDomPage(page) && L.mfd && !SIM.S.fail.display;
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
        const tiles = [['MAP', '🗺️', 'Kaart'], ['PFD', '🧭', 'PFD'], ['FPL', '📋', 'Actief vluchtplan'], ['WPT', '📍', 'Waypoint-info'], ['NRST', '📡', 'Dichtstbijzijnde'], ['PROC', '🛬', 'Naderingen'], ['ENG', '⚙️', 'Motor'], ['TERRAIN', '⛰️', 'Terrein'], ['TRAFFIC', '✈️', 'Verkeer'], ['WX', '🌦️', 'Weer'], ['CHARTS', '📑', 'Kaarten'], ['TIMER', '⏱️', 'Timers'], ['CHK', '✅', 'Checklist'], ['FPLLIST', '🗂️', 'Vluchtplannen'], ['USER', '⭐', 'Gebruikerswpt'], ['TRIP', '🧮', 'Tripcomputer'], ['MSG', '💬', 'Berichten'], ['SETUP', '🔧', 'Instellingen']];
        h = head('Hoofdmenu') + `<div class="page-body tiles">${tiles.map(t => `<button class="tile" data-p="${t[0]}"><span class="ico">${t[1]}</span><span>${t[2]}</span></button>`).join('')}</div>`;
        P.innerHTML = h; P.querySelectorAll('.tile').forEach(b => { b.onclick = () => UI.showPage(b.dataset.p); }); return;
      }
      case 'FPL': {
        const f = a.fpl, n = a.nav;
        let rows = '';
        let cum = 0, prev = null;
        f.wpts.forEach((w, i) => {
          const isActive = i === f.active && !f.directTo; const isDto = f.directTo && f.directTo.to === w;
          const dtk = i > 0 ? U.bearing(f.wpts[i - 1], w) : null; const legDis = i > 0 ? U.distNm(f.wpts[i - 1], w) : 0;
          let dis = '', ete = '';
          if (i >= f.active && f.active >= 0) { if (i === f.active || isDto) cum = n && n.valid ? n.dis : U.distNm(pos, w); else if (i > f.active) cum += legDis; dis = U.fmtDis(D.distVal(cum)); ete = U.fmtEte(cum / Math.max(pos.gs, 1) * 60); }
          rows += `<div class="row fplrow ${isActive || isDto ? 'active' : ''} ${w.missed ? 'missed' : ''} ${w.proc ? 'proc' : ''}" data-i="${i}">
            <span class="c-idx">${isActive || isDto ? '▶' : i + 1}</span><span class="c-id">${esc(w.id)}${w.faf ? ' <em>FAF</em>' : ''}${w.map ? ' <em>MAP</em>' : ''}${w.iaf ? ' <em>IAF</em>' : ''}${w.hold ? ' <em>HOLD</em>' : ''}</span>
            <span class="c-type">${esc(w.proc ? (w.missed ? 'missed' : 'apr') : w.type)}</span><span class="c-dtk">${dtk != null ? U.fmtHdg(dtk) + '°' : ''}</span><span class="c-dis">${i > 0 ? U.fmtDis(D.distVal(legDis)) : ''}</span><span class="c-cum">${dis}</span><span class="c-ete">${ete}</span><span class="c-alt">${w.alt != null ? D.altVal(w.alt) : '____'}</span></div>`;
          prev = w;
        });
        void prev;
        const apr = f.approach;
        const aprBar = apr ? `<div class="apr-bar"><span>${esc(apr.apt)} ${esc(apr.name)} · ${esc(apr.transition)} ${apr.active ? '<b class="g">ACTIEF</b>' : '<b>GELADEN</b>'}${f.susp ? ' · <b class="y">SUSP</b>' : ''}</span><span>${!apr.active ? '<button class="pbtn act">Activeer nadering</button>' : ''}<button class="pbtn vtf">Vectors-to-final</button><button class="pbtn missed">Missed</button><button class="pbtn rm">Verwijder</button></span></div>` : '';
        const total = f.wpts.length > 1 ? f.wpts.filter(w => !w.missed).reduce((t, w, i, arr) => i ? t + U.distNm(arr[i - 1], w) : 0, 0) : 0;
        h = head(f.name ? 'Vluchtplan ' + f.name : 'Actief vluchtplan', `${f.wpts.length} wpt · ${U.fmtDis(D.distVal(total))} ${D.distUnit()}`) +
          `<div class="fpl-tools"><button class="pbtn add">+ Waypoint</button><button class="pbtn proc">PROC</button><button class="pbtn dto">Direct-To</button>${f.directTo ? '<button class="pbtn dtoc">D→ annuleren</button>' : ''}<button class="pbtn menu">Menu</button></div>${aprBar}
          <div class="fpl-cols"><span class="c-idx">#</span><span class="c-id">ID</span><span class="c-type">type</span><span class="c-dtk">DTK</span><span class="c-dis">LEG</span><span class="c-cum">DIS</span><span class="c-ete">ETE</span><span class="c-alt">ALT</span></div>
          <div class="page-body">${rows || '<p class="muted pad">Leeg vluchtplan. Voeg waypoints toe met “+ Waypoint” of gebruik Direct-To.</p>'}</div>`;
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
        h = head('Naderingen (PROC)') + `<div class="page-body proc-page">
          <div class="proc-col"><h4>Vliegveld</h4>${apts.map(id => `<button class="item ${id === UI.procApt ? 'on' : ''}" data-apt="${id}">${id} <span class="muted">${esc(NAV.find(id).name)}</span></button>`).join('')}</div>
          <div class="proc-col"><h4>Nadering</h4>${list.map((p, i) => `<button class="item ${i === UI.procIdx ? 'on' : ''}" data-idx="${i}">${esc(p.name)} <span class="muted">${p.type}${p.freq ? ' ' + U.fmtNav(p.freq) : ''}</span></button>`).join('')}
            <h4>Transitie</h4>${ap.transitions.map(t => `<button class="item ${t === UI.procTrans ? 'on' : ''}" data-tr="${t}">${t === 'VECTORS' ? 'Vectors-to-final' : t}</button>`).join('')}</div>
          <div class="proc-col"><h4>Overzicht</h4><div class="proc-info">Eindkoers <b>${U.fmtHdg(ap.finalCrs)}°</b> · baan <b>${esc(ap.rwy)}</b>${ap.freq ? ` · LOC <b>${U.fmtNav(ap.freq)}</b>` : ''}<br>${ap.legs.map(l => `${esc(l.id)} ${l.alt} ft`).join(' → ')}<br>Missed: ${ap.missed.map(l => esc(l.id)).join(' → ')}</div>
            <button class="pbtn big load">Laden</button><button class="pbtn big loadact">Laden &amp; activeren</button>${ap.freq ? `<button class="pbtn big tune">LOC-frequentie naar NAV1</button>` : ''}</div></div>`;
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
        const tabs = [['APT', 'Vliegvelden'], ['VOR', 'VOR'], ['NDB', 'NDB'], ['WPT', 'VRP/INT'], ['USER', 'Gebruiker'], ['ASPC', 'Luchtruim']];
        let rows = '';
        if (tab === 'ASPC') {
          const list = NAV.AIRSPACES.map(s => ({ s, d: NAV.inside(s, pos) ? 0 : NAV.distToAirspace(s, pos) })).sort((x, y) => x.d - y.d).slice(0, 12);
          rows = list.map(x => `<div class="row nosel"><span class="c-id">${esc(x.s.name)}</span><span class="c-type">${x.s.cls}</span><span class="c-alt">${x.s.floor === 0 ? 'GND' : x.s.floor}–${x.s.ceil}</span><span class="c-dis">${x.d === 0 ? '<b class="y">BINNEN</b>' : U.fmtDis(D.distVal(x.d)) + ' ' + D.distUnit()}</span><span class="c-ete">${x.s.freq ? U.fmtFreq(x.s.freq) : ''}</span></div>`).join('');
        } else {
          const list = tab === 'USER' ? a.userWpts.map(w => ({ item: w, dist: U.distNm(pos, w), brg: U.bearing(pos, w) })).sort((x, y) => x.dist - y.dist) : NAV.nearest(pos, tab, 12);
          rows = list.map(x => { const it = x.item; const rel = U.norm180(x.brg - pos.hdg); return `<div class="row nrow" data-id="${esc(it.id)}"><span class="c-id"><b>${esc(it.id)}</b></span><span class="c-name">${esc(it.name || '')}</span><span class="c-dtk">${U.fmtHdg(x.brg)}° <small>${rel > 0 ? '→' : '←'}</small></span><span class="c-dis">${U.fmtDis(D.distVal(x.dist))}</span><span class="c-ete">${it.type === 'APT' ? U.fmtFreq(NAV.mainFreq(it)) : it.type === 'VOR' ? U.fmtNav(it.freq) : it.type === 'NDB' ? it.freq.toFixed(1) : ''}</span><span class="c-alt">${it.type === 'APT' ? it.elev + ' ft · ' + it.rwys[0].id + ' ' + it.rwys[0].len + 'm' : ''}</span></div>`; }).join('') || '<p class="muted pad">Niets gevonden.</p>';
        }
        h = head('Dichtstbijzijnde', `${D.distUnit()} · peiling`) + `<div class="tabs">${tabs.map(t => `<button class="tab ${t[0] === tab ? 'on' : ''}" data-t="${t[0]}">${t[1]}</button>`).join('')}</div><div class="page-body">${rows}</div>`;
        P.innerHTML = h;
        P.querySelectorAll('.tab').forEach(b => { b.onclick = () => { UI.nrstTab = b.dataset.t; bus.emit('nrsttab', b.dataset.t); }; });
        P.querySelectorAll('.nrow').forEach(r => { r.onclick = () => { const it = AV.findWpt(r.dataset.id); if (it) UI.openFeatureInfo(it); }; });
        return;
      }
      case 'WPT': {
        const w = UI.wptSel ? AV.findWpt(UI.wptSel) : null;
        h = head('Waypoint-informatie') + `<div class="page-body wpt"><button class="pbtn big search">🔍 Waypoint zoeken (ID)</button>${w ? `<div class="wpt-card"><h3>${esc(w.id)} <small>${esc(w.name || '')}</small></h3><div>Type <b>${esc(w.type)}</b> · BRG <b>${U.fmtHdg(U.bearing(pos, w))}°</b> · DIS <b>${U.fmtDis(D.distVal(U.distNm(pos, w)))} ${D.distUnit()}</b></div><div>${U.fmtLat(w.lat)} ${U.fmtLon(w.lon)}</div>${w.type === 'APT' ? `<div>Hoogte ${w.elev} ft · banen ${w.rwys.map(r => r.id).join(', ')} · ${w.freqs.filter(f => f.freq).map(f => f.type + ' ' + U.fmtFreq(f.freq)).join(' · ')}</div>` : ''}${w.freq ? `<div>Frequentie ${w.type === 'VOR' ? U.fmtNav(w.freq) : w.freq.toFixed(1)} · ${esc(U.morse(w.id))}</div>` : ''}<div class="btns"><button class="pbtn info">Volledige info</button><button class="pbtn dto">Direct-To</button><button class="pbtn ins">In vluchtplan</button><button class="pbtn map">Toon op kaart</button></div></div>` : '<p class="muted pad">Zoek een waypoint op ID (bv. EBZH, BUB, HASSE).</p>'}</div>`;
        P.innerHTML = h;
        P.querySelector('.search').onclick = () => alphaPad({ title: 'Waypoint zoeken', enterLabel: 'Toon', search: q => q ? NAV.search(q, 10) : [], onEnter: v => { const x = AV.findWpt(v); if (!x) { UI.toast('Onbekend'); return false; } UI.wptSel = x.id; UI.pageBuilt = null; bus.emit('wptinfo', x.id); } });
        if (w) { P.querySelector('.info').onclick = () => UI.openFeatureInfo(w); P.querySelector('.dto').onclick = () => { AV.directTo(w); bus.emit('dto', w.id); }; P.querySelector('.ins').onclick = () => UI.openInsertPosition(w); P.querySelector('.map').onclick = () => { a.map.pan = { lat: w.lat, lon: w.lon }; a.map.panning = true; UI.showPage('MAP'); }; }
        return;
      }
      case 'SETUP': {
        const u = a.units, m = a.map;
        const opt = (label, obj, key, values, fmt) => `<div class="opt-row"><span>${label}</span><div class="opt-vals">${values.map(v => `<button class="opt-val ${obj[key] === v ? 'on' : ''}" data-o="${obj === u ? 'u' : obj === m ? 'm' : 'a'}" data-k="${key}" data-v="${v}">${fmt ? fmt(v) : v}</button>`).join('')}</div></div>`;
        const onoff = v => v ? 'AAN' : 'UIT';
        h = head('Instellingen') + `<div class="page-body opts">
          <h4>Eenheden</h4>${opt('Afstand', u, 'dist', ['NM', 'KM'])}${opt('Hoogte', u, 'alt', ['FT', 'M'])}${opt('Snelheid', u, 'speed', ['KT', 'KMH'])}${opt('Temperatuur', u, 'temp', ['C', 'F'])}${opt('Baro', u, 'baro', ['HPA', 'INHG'])}${opt('Brandstof', u, 'fuel', ['L', 'GAL'])}
          <h4>PFD</h4>${opt('Synthetic Vision', a, 'svt', [true, false], onoff)}${opt('V-snelheden', a, 'vspeeds', [true, false], onoff)}${opt('Klok', a, 'clockUtc', [false, true], v => v ? 'UTC' : 'Lokaal')}
          <h4>Kaart</h4>${opt('Oriëntatie', m, 'orient', ['NORTH', 'TRKUP', 'HDGUP'])}${opt('Topografie', m, 'topo', [true, false], onoff)}${opt('Luchtruim', m, 'airspace', [true, false], onoff)}
          <h4>Systeem</h4>${opt('Geluid', a, 'sound', [true, false], onoff)}${opt('Helderheid', a, 'brightness', [100, 70, 40], v => v + '%')}
          <div class="opt-row"><span>Opgeslagen gegevens</span><div class="opt-vals"><button class="opt-val reset">Alles wissen</button></div></div>
          <p class="muted pad">Trainer: navigatiedata vereenvoudigd en niet actueel. Geen magnetische variatie gemodelleerd.</p></div>`;
        P.innerHTML = h;
        P.querySelectorAll('.opt-val[data-k]').forEach(b => { b.onclick = () => { const obj = b.dataset.o === 'u' ? u : b.dataset.o === 'm' ? m : a; let v = b.dataset.v; if (v === 'true') v = true; else if (v === 'false') v = false; else if (/^\d+$/.test(v)) v = +v; obj[b.dataset.k] = v; AV.save(); bus.emit('setup', { k: b.dataset.k, v }); P.querySelectorAll(`.opt-val[data-k="${b.dataset.k}"]`).forEach(c => c.classList.toggle('on', c === b)); }; });
        P.querySelector('.reset').onclick = () => { if (confirm('Opgeslagen vluchtplannen, waypoints en instellingen wissen?')) { localStorage.removeItem('g3x.persist'); a.storedFpls = []; a.userWpts = []; UI.toast('Gewist'); } };
        return;
      }
      case 'CHK': {
        const c = a.checklist; const groups = AV.CHECKLISTS; const g = groups[c.group];
        const doneKey = i => c.group + ':' + i;
        const allDone = g.items.every((_, i) => c.done[doneKey(i)]);
        h = head('Checklist — ' + g.name, `${g.items.filter((_, i) => c.done[doneKey(i)]).length}/${g.items.length}`) + `<div class="chk-wrap"><div class="chk-groups">${groups.map((gr, i) => `<button class="item ${i === c.group ? 'on' : ''} ${gr.name.startsWith('EMERG') ? 'emerg' : ''}" data-g="${i}">${esc(gr.name)}</button>`).join('')}</div><div class="page-body chk-items">${g.items.map((it, i) => `<button class="row chk ${c.done[doneKey(i)] ? 'done' : ''}" data-i="${i}"><span class="box">${c.done[doneKey(i)] ? '✓' : ''}</span><span>${esc(it)}</span></button>`).join('')}${allDone ? '<div class="chk-complete">Checklist voltooid ✓</div>' : ''}<div class="btns"><button class="pbtn resetchk">Reset deze checklist</button><button class="pbtn nextchk">Volgende checklist</button></div></div></div>`;
        P.innerHTML = h;
        P.querySelectorAll('[data-g]').forEach(b => { b.onclick = () => { c.group = +b.dataset.g; UI.pageBuilt = null; }; });
        P.querySelectorAll('.chk').forEach(b => { b.onclick = () => { const k = doneKey(+b.dataset.i); c.done[k] = !c.done[k]; bus.emit('chk', { group: g.name, item: +b.dataset.i, done: c.done[k] }); if (g.items.every((_, i) => c.done[doneKey(i)])) bus.emit('chkdone', g.name); UI.pageBuilt = null; }; });
        P.querySelector('.resetchk').onclick = () => { g.items.forEach((_, i) => delete c.done[doneKey(i)]); UI.pageBuilt = null; };
        P.querySelector('.nextchk').onclick = () => { c.group = (c.group + 1) % groups.length; UI.pageBuilt = null; };
        return;
      }
      case 'TIMER': {
        const t = a.timer;
        h = head('Timers') + `<div class="page-body timer">
          <div class="tm-card"><h4>Algemene timer</h4><div class="tm-val">${U.fmtTimer(t.value)}</div><div class="btns"><button class="pbtn startstop">${t.running ? 'Stop' : 'Start'}</button><button class="pbtn resett">Reset</button><button class="pbtn dir">${t.dir === 'UP' ? 'Omhoog' : 'Omlaag'}</button><button class="pbtn preset">Instellen…</button></div>${t.expired ? '<div class="y">Timer afgelopen</div>' : ''}</div>
          <div class="tm-card"><h4>Vluchttijd</h4><div class="tm-val">${U.fmtTimer(a.flightTimer)}</div><div class="muted">Loopt zodra het toestel beweegt</div></div>
          <div class="tm-card"><h4>Klok</h4><div class="tm-val">${U.fmtTime(new Date(), a.clockUtc)}</div><div class="btns"><button class="pbtn clock">${a.clockUtc ? 'UTC' : 'Lokaal'}</button></div></div>
          <div class="tm-card"><h4>Motor</h4><div class="muted">Hobbs ${S.eng.hobbs.toFixed(1)} h · vliegtijd ${U.fmtTimer(S.ac.flightTime)}</div></div></div>`;
        P.innerHTML = h;
        P.querySelector('.startstop').onclick = () => { t.running = !t.running; t.expired = false; bus.emit('timer', t.running ? 'start' : 'stop'); };
        P.querySelector('.resett').onclick = () => { t.value = t.dir === 'DOWN' ? t.preset : 0; t.expired = false; t.running = false; bus.emit('timer', 'reset'); };
        P.querySelector('.dir').onclick = () => { t.dir = t.dir === 'UP' ? 'DOWN' : 'UP'; t.value = t.dir === 'DOWN' ? t.preset : 0; bus.emit('timer', 'dir' + t.dir); };
        P.querySelector('.preset').onclick = () => numpad({ title: 'Timer instellen (mm:ss)', maxLen: 4, display: v => { const s = (v.padStart(4, '0')); return s.slice(0, 2) + ':' + s.slice(2); }, onEnter: v => { const s = v.padStart(4, '0'); t.preset = parseInt(s.slice(0, 2), 10) * 60 + parseInt(s.slice(2), 10); t.dir = 'DOWN'; t.value = t.preset; t.expired = false; bus.emit('timer', 'preset' + t.preset); } });
        P.querySelector('.clock').onclick = () => { a.clockUtc = !a.clockUtc; };
        return;
      }
      case 'TRIP': case 'INFO': {
        const ac = S.ac;
        h = head('Tripcomputer') + `<div class="page-body opts"><div class="info-grid">
          <div>Afgelegde afstand<b>${U.fmtDis(D.distVal(ac.odo))} ${D.distUnit()}</b></div><div>Vluchttijd<b>${U.fmtTimer(ac.flightTime)}</b></div><div>Gem. grondsnelheid<b>${ac.flightTime > 10 ? D.spdVal(ac.odo / (ac.flightTime / 3600)) : 0} ${D.spdUnit()}</b></div><div>Max. grondsnelheid<b>${D.spdVal(ac.maxGs)} ${D.spdUnit()}</b></div><div>Brandstof verbruikt<b>${D.fuelVal(ac.fuelUsed)} ${D.fuelUnit()}</b></div><div>Positie<b>${U.fmtLat(ac.lat)}<br>${U.fmtLon(ac.lon)}</b></div><div>GPS-hoogte<b>${Math.round(ac.alt)} ft</b></div><div>AGL / terrein<b>${Math.round(ac.agl || 0)} ft / ${Math.round(NAV.terrainFt(ac.lat, ac.lon))} ft</b></div><div>Drukhoogte<b>${Math.round(SIM.pressureAlt())} ft</b></div><div>Dichtheidshoogte<b>${Math.round(SIM.pressureAlt() + 120 * (SIM.oat() - U.isaTemp(SIM.pressureAlt())))} ft</b></div><div>Wind<b>${U.fmtHdg(S.env.windDir)}°/${Math.round(S.env.windSpd)} kt</b></div><div>OAT / ISA-afwijking<b>${D.tempVal(SIM.oat())} / ${(SIM.oat() - U.isaTemp(ac.alt)).toFixed(0)}°</b></div></div>
          <div class="btns"><button class="pbtn resettrip">Trip resetten</button></div></div>`;
        P.innerHTML = h; P.querySelector('.resettrip').onclick = () => { ac.odo = 0; ac.flightTime = 0; ac.maxGs = 0; ac.fuelUsed = 0; };
        return;
      }
      case 'MSG': {
        const list = a.msgs.filter(m => !m.cleared);
        h = head('Berichten', `${list.length}`) + `<div class="page-body">${list.map(m => `<div class="row nosel msg ${m.kind}"><span class="c-time">${U.fmtTime(m.time, a.clockUtc).slice(0, 5)}</span><span class="c-text">${esc(m.text)}</span></div>`).join('') || '<p class="muted pad">Geen berichten.</p>'}<div class="btns"><button class="pbtn clearmsg">Alles wissen</button></div></div>`;
        P.innerHTML = h; P.querySelector('.clearmsg').onclick = () => { a.msgs.forEach(m => m.cleared = true); a.msgNew = false; };
        a.msgNew = false;
        return;
      }
      case 'TRAFFIC': {
        h = head('Verkeer (gesimuleerd)') + `<div class="page-body">${a.traffic.length ? a.traffic.map(t => { const d = U.distNm(pos, t), b = U.bearing(pos, t); return `<div class="row nosel"><span class="c-id"><b>${esc(t.id)}</b></span><span class="c-dtk">${U.fmtHdg(b)}°</span><span class="c-dis">${U.fmtDis(d)} NM</span><span class="c-alt">${t.alt > pos.alt ? '+' : ''}${Math.round((t.alt - pos.alt) / 100)}00 ft</span><span class="c-ete">${t.vs > 200 ? '↑' : t.vs < -200 ? '↓' : '→'}</span></div>`; }).join('') : '<p class="muted pad">Geen verkeer. Deze trainer heeft geen ADS-B-ontvanger; scenario’s kunnen verkeer simuleren.</p>'}<div class="btns"><button class="pbtn addtraffic">Verkeer simuleren</button><button class="pbtn cleartraffic">Wissen</button></div></div>`;
        P.innerHTML = h;
        P.querySelector('.addtraffic').onclick = () => UI.spawnTraffic();
        P.querySelector('.cleartraffic').onclick = () => { a.traffic = []; };
        return;
      }
      case 'WX': { h = head('Weer') + `<div class="page-body pad"><p>Geen weerdatalink beschikbaar in deze trainer (geen SiriusXM/FIS-B in Europa).</p><p>Gesimuleerde omgeving: wind <b>${U.fmtHdg(S.env.windDir)}°/${Math.round(S.env.windSpd)} kt</b>, QNH <b>${S.env.qnh} hPa</b>, OAT <b>${D.tempVal(SIM.oat())}</b>, turbulentie <b>${S.env.turb < 0.3 ? 'licht' : S.env.turb < 0.8 ? 'matig' : 'sterk'}</b>.</p><p class="muted">Tip: de QNH krijg je in de praktijk van ATIS/AFIS of de METAR. Stel hem in via het baro-veld onder de hoogtetape.</p></div>`; P.innerHTML = h; return; }
      case 'CHARTS': { h = head('Kaarten') + `<div class="page-body pad"><p>Geen elektronische kaarten (FliteCharts/ChartView) geladen in deze trainer.</p><p class="muted">In de echte G3X Touch zijn naderingskaarten optioneel beschikbaar via een database-abonnement.</p></div>`; P.innerHTML = h; return; }
      case 'USER': {
        h = head('Gebruikerswaypoints', `${a.userWpts.length}`) + `<div class="page-body">${a.userWpts.map(w => `<div class="row urow" data-id="${esc(w.id)}"><span class="c-id"><b>${esc(w.id)}</b></span><span class="c-name">${U.fmtLat(w.lat)} ${U.fmtLon(w.lon)}</span><span class="c-dtk">${U.fmtHdg(U.bearing(pos, w))}°</span><span class="c-dis">${U.fmtDis(U.distNm(pos, w))} NM</span></div>`).join('') || '<p class="muted pad">Nog geen gebruikerswaypoints.</p>'}<div class="btns"><button class="pbtn mkhere">Waypoint op huidige positie</button></div></div>`;
        P.innerHTML = h;
        P.querySelector('.mkhere').onclick = () => { const w = AV.addUserWaypoint(pos.lat, pos.lon); bus.emit('userwpt', w.id); UI.toast(`${w.id} aangemaakt`); };
        P.querySelectorAll('.urow').forEach(r => { r.onclick = () => UI.openFeatureInfo(AV.findWpt(r.dataset.id)); });
        return;
      }
      case 'FPLLIST': {
        h = head('Opgeslagen vluchtplannen', `${a.storedFpls.length}`) + `<div class="page-body">${a.storedFpls.map((s, i) => `<div class="row srow" data-i="${i}"><span class="c-id"><b>${esc(s.name)}</b></span><span class="c-name">${s.wpts.map(w => esc(w.id)).join(' → ')}</span><span class="c-ete"><button class="pbtn del" data-i="${i}">✕</button></span></div>`).join('') || '<p class="muted pad">Geen opgeslagen vluchtplannen. Sla het actieve plan op via FPL → Menu → Opslaan.</p>'}<div class="btns"><button class="pbtn storecur">Actief plan opslaan</button></div></div>`;
        P.innerHTML = h;
        P.querySelectorAll('.srow').forEach(r => { r.onclick = e => { if (e.target.classList.contains('del')) { AV.fplDeleteStored(+e.target.dataset.i); return; } AV.fplLoad(+r.dataset.i); bus.emit('fplload'); UI.showPage('FPL'); }; });
        P.querySelector('.storecur').onclick = () => { AV.fplStore(); bus.emit('fplstore'); };
        return;
      }
      default: P.innerHTML = head(page) + '<div class="page-body pad muted">Pagina niet beschikbaar.</div>';
    }
  };
  UI.openFplRowMenu = i => {
    const f = A().fpl, w = f.wpts[i];
    UI.openDialog({ title: `${w.id}`, width: 400, html: `<div class="menu-list"><button class="item" data-a="leg">Activeer leg naar ${esc(w.id)}</button><button class="item" data-a="dto">Direct-To ${esc(w.id)}</button><button class="item" data-a="before">Waypoint invoegen vóór</button><button class="item" data-a="after">Waypoint invoegen na</button><button class="item" data-a="alt">Hoogte instellen (VNAV)</button><button class="item" data-a="info">Waypoint-info</button><button class="item danger" data-a="rm">Verwijderen</button></div>`, buttons: [{ label: 'Sluit' }],
      onOpen: d => { d.el.querySelectorAll('.item').forEach(b => { b.onclick = () => { const act = b.dataset.a; UI.closeDialog(); if (act === 'leg') { if (i === 0) { UI.toast('Eerste waypoint: geen leg'); return; } AV.fplActivateLeg(i); bus.emit('actleg', w.id); } else if (act === 'dto') { AV.directTo(w); bus.emit('dto', w.id); } else if (act === 'before') UI.openAddWaypoint(i); else if (act === 'after') UI.openAddWaypoint(i + 1); else if (act === 'alt') numpad({ title: `Hoogte bij ${w.id}`, maxLen: 5, unit: 'ft', display: v => v || (w.alt != null ? String(w.alt) : ''), onEnter: v => { w.alt = v ? parseInt(v, 10) : null; bus.emit('wptalt', { id: w.id, alt: w.alt }); }, extra: '<div class="xp-modes"><button class="xp-mode clr">Wis hoogte</button></div>', onOpen: dd => { dd.el.querySelector('.clr').onclick = () => { w.alt = null; UI.closeDialog(); }; } }); else if (act === 'info') UI.openFeatureInfo(AV.findWpt(w.id) || w); else if (act === 'rm') { AV.fplRemove(i); bus.emit('fplremove', w.id); } }; }); } });
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

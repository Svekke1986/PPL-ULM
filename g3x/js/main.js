/* Hoofdlus, invoer (toetsenbord, muis/aanraking, gamepad), bezel-knoppen, GMC 507-paneel, vliegtuigpaneel en trainerpaneel. */
window.G3X = window.G3X || {};
(function () {
  const U = G3X.util, D = G3X.display, SIM = G3X.sim, AV = G3X.avionics, UI = G3X.ui, T = G3X.trainer, AP = G3X.autopilot, esc = U.esc;
  const M = { keys: {}, lastRender: 0, panelT: 0, cat: null, lastT: performance.now(), invertPitch: false, stick: { x: 0, y: 0 } };
  const $ = s => document.querySelector(s);

  M.init = () => {
    AV.load();
    D.init($('#g3x-canvas'));
    UI.init($('#g3x-overlay'));
    try { M.invertPitch = localStorage.getItem('g3x.invertPitch') === '1'; } catch (e) { /* */ }
    buildKnobs(); buildApPanel(); buildAircraftPanel(); buildTrainerPanel(); bindCanvas(); bindKeyboard();
    window.addEventListener('resize', M.fit); M.fit();
    // scenario uit URL (#s=id) of standaard
    const m = location.hash.match(/s=([a-z_0-9]+)/i);
    T.start(m ? m[1] : 'pfd_baro');
    requestAnimationFrame(M.loop);
  };

  // ---------- schaal ----------
  M.fit = () => {
    const wrap = $('#g3x-wrap'), unit = $('#g3x-unit');
    const W = 1460, H = 844;
    const k = Math.min(wrap.clientWidth / W, (window.innerHeight - 120) / H, 1.25);
    D.scale = Math.max(0.25, k);
    unit.style.transform = `scale(${D.scale})`;
    wrap.style.height = Math.round(H * D.scale) + 'px';
  };

  // ---------- lus ----------
  M.loop = now => {
    const dtReal = Math.min(0.1, (now - M.lastT) / 1000); M.lastT = now;
    const S = SIM.S;
    applyControls(dtReal);
    SIM.step(dtReal);
    if (!S.paused) { const dtSim = dtReal * S.rate; AV.step(S, dtSim); T.tick(dtSim); }
    else AV.step(S, 0);
    if (now - M.lastRender > 33) { D.render(); UI.tick(); M.lastRender = now; }
    if (now - M.panelT > 250) { refreshPanels(); M.panelT = now; }
    pollGamepad();
    requestAnimationFrame(M.loop);
  };

  // ---------- besturing ----------
  function applyControls() {
    const S = SIM.S, c = S.cmds, k = M.keys;
    const apFlying = AV.A.ap.on && !S.ac.onGround;
    let pitch = 0, roll = 0, yaw = 0;
    if (k.ArrowUp) pitch -= 1; if (k.ArrowDown) pitch += 1; if (k.ArrowLeft) roll -= 1; if (k.ArrowRight) roll += 1; if (k.KeyQ) yaw -= 1; if (k.KeyE) yaw += 1;
    if (M.invertPitch) pitch = -pitch;
    pitch += -M.stick.y; roll += M.stick.x;
    if (M.gp) { pitch += M.gp.pitch; roll += M.gp.roll; yaw += M.gp.yaw; }
    pitch = U.clamp(pitch, -1, 1); roll = U.clamp(roll, -1, 1); yaw = U.clamp(yaw, -1, 1);
    const manual = Math.abs(pitch) > 0.05 || Math.abs(roll) > 0.05;
    if (apFlying) { if (manual && !M.apWarned) { UI.toast('Autopilot engaged — disconnect first (A or AP DISC)'); M.apWarned = true; setTimeout(() => M.apWarned = false, 4000); } c.yaw = yaw; return; }
    c.pitchRate = pitch * 4; c.rollRate = roll * 28; c.yaw = yaw;
    if (k.PageUp) SIM.setThrottle(S.ac.throttle + 0.012); if (k.PageDown) SIM.setThrottle(S.ac.throttle - 0.012);
    S.ac.brakes = !!k.KeyB;
  }
  function bindKeyboard() {
    window.addEventListener('keydown', e => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      const k = e.code; M.keys[k] = true;
      const S = SIM.S;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Space'].includes(k)) e.preventDefault();
      if (e.repeat) return;
      switch (k) {
        case 'KeyF': SIM.setFlaps(S.ac.flaps + 1); G3X.bus.emit('flaps', S.ac.flaps); break;
        case 'KeyV': SIM.setFlaps(S.ac.flaps - 1); G3X.bus.emit('flaps', S.ac.flaps); break;
        case 'KeyA': case 'Space': UI.apButton('DISC'); break;
        case 'KeyL': UI.apButton('LVL'); break;
        case 'KeyG': UI.apButton('GA'); break;
        case 'KeyP': S.paused = !S.paused; break;
        case 'Home': SIM.setThrottle(1); break;
        case 'End': SIM.setThrottle(0); break;
        case 'BracketLeft': UI.knob('R', 'outer', -1); break;
        case 'BracketRight': UI.knob('R', 'outer', 1); break;
        case 'Comma': UI.knob('L', 'outer', -1); break;
        case 'Period': UI.knob('L', 'outer', 1); break;
        case 'KeyK': UI.knob('L', 'inner', -1); break;
        case 'KeyM': UI.knob('L', 'inner', 1); break;
        case 'Enter': UI.knobPress('R'); break;
        case 'Escape': UI.button('BACK'); break;
        case 'KeyH': toggleHelp(); break;
        case 'Digit1': S.rate = 1; break; case 'Digit2': S.rate = 2; break; case 'Digit4': S.rate = 4; break;
      }
    });
    window.addEventListener('keyup', e => { M.keys[e.code] = false; });
    window.addEventListener('blur', () => { M.keys = {}; });
  }
  function pollGamepad() {
    const gps = navigator.getGamepads ? navigator.getGamepads() : []; let gp = null;
    for (const g of gps) if (g && g.axes && g.axes.length >= 2) { gp = g; break; }
    if (!gp) { M.gp = null; return; }
    const dz = v => Math.abs(v) < 0.08 ? 0 : v;
    const roll = dz(gp.axes[0]), pitch = dz(gp.axes[1]) * (M.invertPitch ? -1 : 1), yaw = gp.axes.length > 2 ? dz(gp.axes[2]) : 0;
    M.gp = { roll, pitch, yaw };
    if (gp.axes.length > 3) { const t = (1 - gp.axes[3]) / 2; if (Math.abs(t - SIM.S.ac.throttle) > 0.02) SIM.setThrottle(t); }
    const btn = i => gp.buttons[i] && gp.buttons[i].pressed;
    M.gpPrev = M.gpPrev || {};
    const edge = (i, fn) => { const p = btn(i); if (p && !M.gpPrev[i]) fn(); M.gpPrev[i] = p; };
    edge(0, () => UI.apButton('DISC')); edge(1, () => SIM.setFlaps(SIM.S.ac.flaps + 1)); edge(2, () => SIM.setFlaps(SIM.S.ac.flaps - 1)); edge(3, () => UI.apButton('LVL'));
  }

  // ---------- canvas-aanraking ----------
  function bindCanvas() {
    const cv = D.canvas; let down = null, dragged = false;
    const pos = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * D.W, y: (e.clientY - r.top) / r.height * D.H }; };
    cv.addEventListener('pointerdown', e => { if (G3X.audio) G3X.audio.ensure(); const p = pos(e); down = p; dragged = false; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => {
      if (!down) return; const p = pos(e); const dx = p.x - down.x, dy = p.y - down.y;
      const L = D.L; const inMap = L && L.mfd && (AV.A.mfdPage === 'MAP' || AV.A.mfdPage === 'TERRAIN') && down.x >= L.mfd.x && down.x <= L.mfd.x + L.mfd.w && down.y >= L.mfd.y && down.y <= L.mfd.y + L.mfd.h;
      if (inMap && (dragged || Math.hypot(dx, dy) > 8)) { if (!dragged) { if (!AV.A.map.panning) { AV.A.map.pan = { lat: SIM.S.ac.lat, lon: SIM.S.ac.lon }; AV.A.map.panning = true; } } dragged = true; G3X.mfd.panBy(dx, dy); down = p; }
    });
    cv.addEventListener('pointerup', e => { if (!down) return; const p = pos(e); if (!dragged) D.tap(p.x, p.y); down = null; });
    cv.addEventListener('pointercancel', () => { down = null; });
    cv.addEventListener('wheel', e => {
      e.preventDefault(); const p = pos(e); const L = D.L; if (!L) return; const dir = e.deltaY > 0 ? 1 : -1;
      if (L.mfd && p.x >= L.mfd.x && (AV.A.mfdPage === 'MAP' || AV.A.mfdPage === 'TERRAIN')) G3X.mfd.rangeStep(dir);
      else if (L.pfd && p.x >= L.pfd.x && p.x <= L.pfd.x + L.pfd.w) { if (p.x > L.pfd.x + L.pfd.w - 140) { AV.A.baroStd = false; AV.A.baro = U.clamp(AV.A.baro - dir, 940, 1060); G3X.bus.emit('baro', AV.A.baro); } else if (p.x < L.pfd.x + 100) { AV.A.altSel = U.clamp(AV.A.altSel - dir * 100, -1000, 20000); G3X.bus.emit('altsel', AV.A.altSel); } else { AV.A.hdgBug = U.norm360(AV.A.hdgBug - dir); G3X.bus.emit('hdgbug', AV.A.hdgBug); } }
    }, { passive: false });
  }

  // ---------- bezel-knoppen ----------
  function buildKnobs() {
    const mk = side => {
      const el = $(`#knob-${side}`);
      el.innerHTML = `<div class="knob-ring outer" title="Buitenring"><button class="ka l" data-r="outer" data-d="-1">◀</button><button class="ka r" data-r="outer" data-d="1">▶</button><div class="knob-ring inner" title="Binnenknop"><button class="ka l" data-r="inner" data-d="-1">◀</button><button class="ka r" data-r="inner" data-d="1">▶</button><button class="knob-push" title="Indrukken">PUSH</button></div></div><div class="knob-label"></div>`;
      el.querySelectorAll('.ka').forEach(b => { b.onclick = e => { e.stopPropagation(); UI.knob(side, b.dataset.r, +b.dataset.d); if (G3X.audio) { G3X.audio.ensure(); G3X.audio.play('click'); } }; });
      el.querySelector('.knob-push').onclick = e => { e.stopPropagation(); UI.knobPress(side); };
      el.querySelector('.outer').addEventListener('wheel', e => { e.preventDefault(); e.stopPropagation(); const inner = e.target.closest('.inner'); UI.knob(side, inner ? 'inner' : 'outer', e.deltaY > 0 ? 1 : -1); }, { passive: false });
    };
    mk('L'); mk('R');
  }
  function refreshKnobLabels() {
    const kl = UI.knobLabels();
    $('#knob-L .knob-label').innerHTML = `<span>${esc(kl.left.outer)}</span><span>${esc(kl.left.inner)}</span>`;
    $('#knob-R .knob-label').innerHTML = `<span>${esc(kl.right.outer)}</span><span>${esc(kl.right.inner)}</span>`;
  }

  // ---------- GMC 507 ----------
  function buildApPanel() {
    const el = $('#gmc');
    const btns = [['HDG', 'HDG'], ['APR', 'APR'], ['NAV', 'NAV'], ['AP', 'AP'], ['FD', 'FD'], ['ALT', 'ALT'], ['VS', 'VS'], ['IAS', 'IAS'], ['VNV', 'VNV'], ['LVL', 'LVL'], ['GA', 'TO/GA'], ['DISC', 'AP DISC']];
    el.innerHTML = `<div class="gmc-title">GMC 507</div><div class="gmc-knob"><span>HDG</span><button data-k="hdg-">−</button><button data-k="hdgsync" title="SYNC">●</button><button data-k="hdg+">+</button></div><div class="gmc-btns">${btns.map(b => `<button class="gmc-btn" data-b="${b[0]}">${b[1]}</button>`).join('')}</div><div class="gmc-wheel"><span>NOSE</span><button data-k="UP">▲ UP</button><button data-k="DN">▼ DN</button></div><div class="gmc-knob"><span>ALT</span><button data-k="alt-">−</button><button data-k="altsync" title="Huidige hoogte">●</button><button data-k="alt+">+</button></div>`;
    el.querySelectorAll('.gmc-btn').forEach(b => { b.onclick = () => { if (G3X.audio) G3X.audio.ensure(); UI.apButton(b.dataset.b); }; });
    el.querySelectorAll('[data-k]').forEach(b => { b.onclick = () => { const A = AV.A; const k = b.dataset.k; if (k === 'hdg-') A.hdgBug = U.norm360(A.hdgBug - 1); else if (k === 'hdg+') A.hdgBug = U.norm360(A.hdgBug + 1); else if (k === 'hdgsync') A.hdgBug = Math.round(SIM.S.ac.hdg); else if (k === 'alt-') A.altSel = U.clamp(A.altSel - 100, -1000, 20000); else if (k === 'alt+') A.altSel = U.clamp(A.altSel + 100, -1000, 20000); else if (k === 'altsync') A.altSel = Math.round(AV.indAlt() / 100) * 100; else UI.apButton(k); if (k.startsWith('hdg')) G3X.bus.emit('hdgbug', A.hdgBug); if (k.startsWith('alt')) G3X.bus.emit('altsel', A.altSel); }; const hold = (fn) => { let t; b.addEventListener('pointerdown', () => { t = setInterval(fn, 120); }); const stop = () => clearInterval(t); b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); }; if (['hdg-', 'hdg+', 'alt-', 'alt+'].includes(b.dataset.k)) hold(() => b.onclick()); });
  }
  M.refreshApPanel = () => {
    const p = AV.A.ap;
    document.querySelectorAll('#gmc .gmc-btn').forEach(b => { const id = b.dataset.b; const on = (id === 'AP' && p.on) || (id === 'FD' && p.fd) || p.lat === id || p.vert === id || (id === 'NAV' && (p.lat === 'NAV' || p.latArm === 'NAV')) || (id === 'APR' && (p.lat === 'APR' || p.latArm === 'APR')) || (id === 'VNV' && (p.vert === 'VNV' || p.vertArm.includes('VNV'))) || (id === 'LVL' && p.lat === 'LVL') || (id === 'GA' && p.lat === 'GA'); b.classList.toggle('on', !!on); b.classList.toggle('arm', (id === 'NAV' && p.latArm === 'NAV') || (id === 'APR' && p.latArm === 'APR') || (id === 'VNV' && p.vertArm.includes('VNV'))); });
  };

  // ---------- vliegtuigpaneel ----------
  function buildAircraftPanel() {
    const el = $('#acpanel');
    el.innerHTML = `<div class="acp-title">Vliegtuig — ${esc(SIM.AC.name)}</div>
      <div class="acp-row"><label>Gas <output id="thr-out">0 %</output></label><input id="thr" type="range" min="0" max="100" value="0"></div>
      <div class="acp-row btns"><span>Flaps</span>${SIM.AC.flapNames.map((n, i) => `<button class="acb flap" data-f="${i}">${n}</button>`).join('')}</div>
      <div class="acp-row btns"><span>Tank</span><button class="acb fuel" data-s="L">L</button><button class="acb fuel" data-s="R">R</button><button class="acb fuel" data-s="OFF">OFF</button><span class="sep"></span><button class="acb" id="pump">Fuel pump</button></div>
      <div class="acp-row btns"><button class="acb" id="master">Master</button><button class="acb" id="start">Start</button><button class="acb" id="pbrake">Parkeerrem</button><button class="acb" id="brake" title="Houd ingedrukt (of toets B)">Rem</button></div>
      <div class="acp-row btns"><button class="acb" id="pause">Pauze</button><button class="acb rate" data-r="1">1×</button><button class="acb rate" data-r="2">2×</button><button class="acb rate" data-r="4">4×</button><button class="acb" id="revers" title="Reversionary: herstelt het scherm (PFD+EIS)">Reversionary</button><button class="acb" id="sound">🔊</button></div>
      <div class="acp-row btns"><span>Storing</span><select id="failsel"><option value="">— kies —</option><option value="ahrs">AHRS</option><option value="adc">ADC (air data)</option><option value="gps">GPS (LOI)</option><option value="alternator">Alternator</option><option value="oilPress">Oliedruk</option><option value="chtHigh">CHT hoog</option><option value="engine">Motor stopt</option><option value="engineRough">Motor loopt ruw</option><option value="com1">COM1</option><option value="nav1">NAV1</option><option value="pitot">Pitot (snelheid)</option><option value="fuelLeak">Brandstoflek</option><option value="display">Scherm</option></select><button class="acb" id="failon">Aan</button><button class="acb" id="failoff">Uit</button><button class="acb" id="failclear">Alles herstellen</button></div>
      <div class="acp-row small"><label><input type="checkbox" id="invpitch"> ↑ = neus omhoog (omgekeerd)</label> <span class="muted">Toetsen: ↑↓ pitch · ←→ rol · Q/E richting · PgUp/PgDn gas · F/V flaps · B rem · A AP uit · L LVL · G GA · P pauze · H help</span></div>
      <div class="stick" id="stick" title="Virtuele stuurknuppel: sleep"><div class="stick-dot"></div></div>`;
    const thr = $('#thr'); thr.oninput = () => SIM.setThrottle(thr.value / 100);
    el.querySelectorAll('.flap').forEach(b => { b.onclick = () => { SIM.setFlaps(+b.dataset.f); G3X.bus.emit('flaps', SIM.S.ac.flaps); }; });
    el.querySelectorAll('.fuel').forEach(b => { b.onclick = () => { SIM.setFuelSel(b.dataset.s); G3X.bus.emit('fuelsel', b.dataset.s); }; });
    $('#pump').onclick = () => { M.pump = !M.pump; G3X.bus.emit('pump', M.pump); };
    $('#master').onclick = () => { SIM.toggleMaster(); G3X.bus.emit('master', SIM.S.eng.master); };
    $('#start').onclick = () => { const r = SIM.startEngine(); if (r) alert(r); else G3X.bus.emit('start'); };
    $('#pbrake').onclick = () => { SIM.S.ac.parkBrake = !SIM.S.ac.parkBrake; G3X.bus.emit('pbrake', SIM.S.ac.parkBrake); };
    const br = $('#brake'); br.onpointerdown = () => { SIM.S.ac.brakes = true; M.keys.KeyB = true; }; br.onpointerup = br.onpointerleave = () => { M.keys.KeyB = false; SIM.S.ac.brakes = false; };
    $('#pause').onclick = () => { SIM.S.paused = !SIM.S.paused; };
    el.querySelectorAll('.rate').forEach(b => { b.onclick = () => { SIM.S.rate = +b.dataset.r; }; });
    $('#revers').onclick = () => { SIM.S.fail.display = false; AV.A.layout = 'SPLIT'; AV.A.pfdPage = 'PFD'; G3X.bus.emit('reversionary'); UI.toast('REVERSIONARY MODE — PFD + EIS on remaining display'); };
    $('#sound').onclick = () => { AV.A.sound = !AV.A.sound; AV.save(); if (G3X.audio) G3X.audio.ensure(); };
    $('#failon').onclick = () => { const v = $('#failsel').value; if (v) SIM.setFail(v, true); };
    $('#failoff').onclick = () => { const v = $('#failsel').value; if (v) SIM.setFail(v, false); };
    $('#failclear').onclick = () => { Object.keys(SIM.S.fail).forEach(k => { if (typeof SIM.S.fail[k] === 'boolean') SIM.S.fail[k] = false; }); SIM.S.fail.oilPressT = 0; };
    const inv = $('#invpitch'); inv.checked = M.invertPitch; inv.onchange = () => { M.invertPitch = inv.checked; try { localStorage.setItem('g3x.invertPitch', inv.checked ? '1' : '0'); } catch (e) { /* */ } };
    // virtuele stick
    const st = $('#stick'), dot = st.querySelector('.stick-dot'); let sid = null;
    const setStick = e => { const r = st.getBoundingClientRect(); const x = U.clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1), y = U.clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1); M.stick = { x, y: M.invertPitch ? -y : y }; dot.style.left = (50 + x * 40) + '%'; dot.style.top = (50 + y * 40) + '%'; };
    st.addEventListener('pointerdown', e => { sid = e.pointerId; st.setPointerCapture(sid); setStick(e); });
    st.addEventListener('pointermove', e => { if (sid != null) setStick(e); });
    const rel = () => { sid = null; M.stick = { x: 0, y: 0 }; dot.style.left = '50%'; dot.style.top = '50%'; };
    st.addEventListener('pointerup', rel); st.addEventListener('pointercancel', rel);
  }
  function refreshPanels() {
    const S = SIM.S, a = S.ac;
    const thr = $('#thr'); if (document.activeElement !== thr) thr.value = Math.round(a.throttle * 100); $('#thr-out').textContent = Math.round(a.throttle * 100) + ' %';
    document.querySelectorAll('#acpanel .flap').forEach(b => b.classList.toggle('on', +b.dataset.f === a.flaps));
    document.querySelectorAll('#acpanel .fuel').forEach(b => b.classList.toggle('on', b.dataset.s === a.fuelSel));
    $('#master').classList.toggle('on', S.eng.master); $('#pbrake').classList.toggle('on', a.parkBrake); $('#pump').classList.toggle('on', !!M.pump);
    $('#pause').classList.toggle('on', S.paused); document.querySelectorAll('#acpanel .rate').forEach(b => b.classList.toggle('on', +b.dataset.r === S.rate));
    $('#sound').textContent = AV.A.sound ? '🔊' : '🔇';
    $('#start').classList.toggle('on', S.eng.running);
    M.refreshApPanel(); refreshKnobLabels();
    const st = $('#statusline'); if (st) st.textContent = `${a.onGround ? 'Op de grond' : 'In de lucht'} · ${Math.round(a.ias)} kt · ${Math.round(AV.indAlt())} ft · HDG ${U.fmtHdg(a.hdg)}° · ${Math.round(S.eng.rpm)} rpm · brandstof ${Math.round(a.fuelL)}/${Math.round(a.fuelR)} L · wind ${U.fmtHdg(S.env.windDir)}/${Math.round(S.env.windSpd)} · QNH ${S.env.qnh}${S.rate > 1 ? ' · ' + S.rate + '×' : ''}`;
    if (T.current && !T.done) { const stp = T.steps[T.stepIndex]; const bar = $('#step-progress'); if (bar && stp) bar.style.width = Math.round((stp.ctx.progress || 0) * 100) + '%'; const tm = $('#trainer-time'); if (tm) tm.textContent = U.fmtTimer(S.t - T.started); }
  }

  // ---------- trainerpaneel ----------
  function buildTrainerPanel() {
    const cats = T.categories();
    $('#scenario-cats').innerHTML = `<option value="">Alle categorieën</option>` + cats.map(c => `<option>${esc(c)}</option>`).join('');
    $('#scenario-cats').onchange = renderScenarioList;
    $('#btn-random').onclick = () => { const cat = $('#scenario-cats').value; const pool = T.GEN.filter(g => g.cat !== 'Vrij vliegen' && (!cat || g.cat === cat)); T.start(U.pick(pool).id); location.hash = 's=' + T.current.id; };
    $('#btn-restart').onclick = () => { if (T.current) T.reset(); };
    $('#btn-new').onclick = () => { if (T.current) T.start(T.current.id); };
    $('#explore-start').innerHTML = T.exploreOptions().map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('');
    $('#btn-explore-start').onclick = () => { T.startExplore($('#explore-start').value); location.hash = 's=' + T.current.id; };
    $('#btn-explore-reset').onclick = () => { if (T.mode === 'explore' && T.current) T.reset(); else T.startExplore($('#explore-start').value); };
    $('#mode-explore').onclick = () => { if (T.mode !== 'explore') T.startExplore($('#explore-start').value); M.setMode('explore'); };
    $('#mode-scenario').onclick = () => { M.setMode('scenario'); };
    $('#btn-help').onclick = toggleHelp; $('#help-close').onclick = toggleHelp;
    renderScenarioList();
  }
  M.setMode = mode => {
    $('#explore-pane').classList.toggle('hidden', mode !== 'explore');
    $('#scenario-pane').classList.toggle('hidden', mode !== 'scenario');
    $('#mode-explore').classList.toggle('on', mode === 'explore');
    $('#mode-scenario').classList.toggle('on', mode === 'scenario');
  };
  function renderScenarioList() {
    const cat = $('#scenario-cats').value; const el = $('#scenario-list');
    const list = T.GEN.filter(g => !cat || g.cat === cat);
    let html = ''; let lastCat = null;
    for (const g of list) {
      if (g.cat !== lastCat) { html += `<div class="sc-cat">${esc(g.cat)}</div>`; lastCat = g.cat; }
      const b = T.best[g.id]; const stars = b ? '★'.repeat(b.stars) + '☆'.repeat(3 - b.stars) : '';
      html += `<button class="sc-item ${T.current && T.current.id === g.id ? 'on' : ''}" data-id="${g.id}"><span>${esc(g.name)}</span><small>${stars}${b && b.runs ? ' · ' + b.runs + '×' : ''}</small></button>`;
    }
    el.innerHTML = html;
    el.querySelectorAll('.sc-item').forEach(b => { b.onclick = () => { T.start(b.dataset.id); location.hash = 's=' + b.dataset.id; }; });
  }
  M.onScenarioStart = () => { M.setMode(T.mode); if (T.mode === 'explore') $('#explore-start').value = T.current.id; renderScenarioList(); M.onTrainerUpdate(); $('#trainer-current').scrollIntoView({ block: 'nearest' }); };
  M.onTrainerUpdate = () => {
    const el = $('#trainer-current'); const sc = T.current; if (!sc) { el.innerHTML = ''; return; }
    let html = `<div class="tc-head"><div><span class="tc-cat">${esc(T.mode === 'explore' ? 'Verkennen' : sc.cat)}</span><h3>${esc(sc.title)}</h3></div><span class="tc-time" id="trainer-time">00:00:00</span></div><div class="tc-intro">${sc.intro || ''}</div>`;
    if (T.mode === 'explore') { html += '<p class="muted small">Tips: alle velden op het scherm zijn aanraakbaar, MENU geeft de opties van de huidige pagina, en in het paneel Vliegtuig kun je storingen inschakelen. Zet een scenario op via het tabblad <b>Scenario</b>.</p>'; el.innerHTML = html; return; }
    html += '<ol class="steps">';
    T.steps.forEach((s, i) => {
      const cls = s.status; const cur = i === T.stepIndex && !T.done;
      html += `<li class="step ${cls} ${cur ? 'current' : ''}"><div class="step-text">${s.text}</div>`;
      if (cur) {
        if (s.question) {
          html += `<div class="q-opts">${s.question.options.map((o, k) => `<button class="q-opt ${s.answered === k ? (k === s.question.correct ? 'ok' : 'bad') : ''}" data-k="${k}" ${s.answered != null ? 'disabled' : ''}>${esc(o)}</button>`).join('')}</div>`;
          if (s.feedback) html += `<div class="q-fb ${s.feedback.ok ? 'ok' : 'bad'}">${s.feedback.ok ? '✓ Juist. ' : '✗ Fout. '}${esc(s.feedback.text || '')}</div>`;
        } else html += `<div class="step-progress"><div id="step-progress"></div></div>`;
        if (s.hintShown) html += `<div class="hint">💡 ${esc(s.hint || 'Geen extra hint.')}</div>`;
        html += `<div class="step-actions">${!s.hintShown && s.hint ? '<button class="sb hint-btn">Hint</button>' : ''}<button class="sb skip-btn">Overslaan</button></div>`;
        if (s.errors.length) html += `<div class="step-err">⚠ ${esc(s.errors[s.errors.length - 1])}</div>`;
      }
      html += '</li>';
    });
    html += '</ol>';
    if (T.done && T.result) { const r = T.result; html += `<div class="result ${T.failed ? 'failed' : ''}"><div class="stars">${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)}</div><div><b>${T.failed ? 'Scenario mislukt' : 'Scenario voltooid'}</b> · score ${r.score}/100 · ${U.fmtTimer(r.dur)} · ${r.hints} hint(s)</div>${r.errors.length ? `<ul class="errs">${r.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : '<div class="muted">Geen fouten.</div>'}<div class="step-actions"><button class="sb reset">↺ Reset (zelfde gegevens)</button><button class="sb again">🎲 Nieuwe gegevens</button><button class="sb next">Volgend willekeurig scenario</button></div></div>`; }
    if (T.errors.length && !T.done) html += `<div class="tc-errs">Fouten: ${T.errors.length}</div>`;
    el.innerHTML = html;
    el.querySelectorAll('.q-opt').forEach(b => { b.onclick = () => T.answer(+b.dataset.k); });
    const hb = el.querySelector('.hint-btn'); if (hb) hb.onclick = () => T.hint();
    const sk = el.querySelector('.skip-btn'); if (sk) sk.onclick = () => T.skip();
    const ag = el.querySelector('.again'); if (ag) ag.onclick = () => T.start(T.current.id);
    const rs = el.querySelector('.reset'); if (rs) rs.onclick = () => T.reset();
    const nx = el.querySelector('.next'); if (nx) nx.onclick = () => $('#btn-random').click();
    renderScenarioList();
  };
  function toggleHelp() { $('#help').classList.toggle('hidden'); }

  G3X.main = M;
  window.addEventListener('DOMContentLoaded', M.init);
})();

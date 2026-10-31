/* Cockpit buiten de G3X, zoals in OO-KWO: GMA 245-audiopaneel, GNC 255 (COM/NAV), GTX 335-transponder,
   analoge motormeters, rode LEFT/RIGHT-brandstofkraan en flapschakelaar met lampjes 0 / T / L. */
window.G3X = window.G3X || {};
(function () {
  const U = G3X.util, SIM = G3X.sim, AV = G3X.avionics, esc = U.esc;
  const CK = { gnc: { mode: 'COM', cursor: false }, gma: { com1: true, com2: false, nav1: false, nav2: false, mic: 1, isol: 'PILOT' } };
  const $ = s => document.querySelector(s);

  // ---------- analoge meters ----------
  function dial(ctx, cx, cy, r, { min, max, bands, value, label, unit, ticks, fmt, a0 = 150, a1 = 390 }) {
    const ang = v => (a0 + (U.clamp(v, min, max) - min) / (max - min) * (a1 - a0)) * U.DEG;
    ctx.save();
    const g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r); g.addColorStop(0, '#15171b'); g.addColorStop(1, '#050608');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6b7079'; ctx.lineWidth = 3; ctx.stroke();
    for (const [a, b, col] of bands) { ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, r - 9, ang(a), ang(b)); ctx.stroke(); }
    ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(r * 0.19)}px "Segoe UI", Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of ticks) { const an = ang(t.v); ctx.lineWidth = t.major ? 2.5 : 1.2; const r1 = r - (t.major ? 20 : 16), r2 = r - 12; ctx.beginPath(); ctx.moveTo(cx + Math.cos(an) * r1, cy + Math.sin(an) * r1); ctx.lineTo(cx + Math.cos(an) * r2, cy + Math.sin(an) * r2); ctx.stroke(); if (t.label != null) ctx.fillText(String(t.label), cx + Math.cos(an) * (r - 31), cy + Math.sin(an) * (r - 31)); }
    ctx.font = `${Math.round(r * 0.17)}px "Segoe UI", Arial, sans-serif`; ctx.fillStyle = '#cfd6de';
    ctx.fillText(label, cx, cy + r * 0.5); ctx.fillText(unit, cx, cy + r * 0.68);
    const an = ang(value);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx - Math.cos(an) * r * 0.15, cy - Math.sin(an) * r * 0.15); ctx.lineTo(cx + Math.cos(an) * (r - 22), cy + Math.sin(an) * (r - 22)); ctx.stroke();
    ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
    if (fmt) { ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(r * 0.2)}px "Segoe UI", Arial, sans-serif`; ctx.fillText(fmt(value), cx, cy + r * 0.26); }
    ctx.restore();
  }
  CK.drawGauges = () => {
    const cv = CK.gauges; if (!cv) return; const ctx = cv.getContext('2d'); const S = SIM.S, E = S.eng, a = S.ac;
    ctx.clearRect(0, 0, cv.width, cv.height);
    const y = 78;
    dial(ctx, 90, y, 72, { min: 0, max: 7000, value: E.rpm, label: 'RPM', unit: '×100', bands: [[1400, 5500, '#28e02c'], [5500, 5800, '#ffd21a'], [5800, 7000, '#ff3131']], ticks: [0, 10, 20, 30, 40, 50, 60, 70].map(v => ({ v: v * 100, major: v % 20 === 0, label: v % 20 === 0 ? v : null })), fmt: v => String(Math.round(v / 10) * 10) });
    dial(ctx, 225, y, 58, { min: 40, max: 150, value: E.cht, label: 'CT', unit: '°C', bands: [[50, 120, '#28e02c'], [120, 135, '#ffd21a'], [135, 150, '#ff3131']], ticks: [50, 75, 100, 125, 150].map(v => ({ v, major: v % 50 === 0, label: v % 50 === 0 ? v : null })) });
    dial(ctx, 345, y, 58, { min: 0, max: 150, value: E.oilT, label: 'OIL T', unit: '°C', bands: [[50, 90, '#ffd21a'], [90, 110, '#28e02c'], [110, 130, '#ffd21a'], [130, 150, '#ff3131']], ticks: [0, 50, 100, 150].map(v => ({ v, major: true, label: v })) });
    dial(ctx, 470, y, 58, { min: 0, max: 60, value: a.fuelL, label: 'FUEL L', unit: 'L', bands: [[0, 5, '#ff3131'], [5, 10, '#ffd21a'], [10, 60, '#28e02c']], ticks: [0, 15, 30, 45, 60].map(v => ({ v, major: true, label: v })) });
    dial(ctx, 595, y, 58, { min: 0, max: 60, value: a.fuelR, label: 'FUEL R', unit: 'L', bands: [[0, 5, '#ff3131'], [5, 10, '#ffd21a'], [10, 60, '#28e02c']], ticks: [0, 15, 30, 45, 60].map(v => ({ v, major: true, label: v })) });
  };

  // ---------- GNC 255 ----------
  function stationName(f) {
    for (const apt of G3X.nav.AIRPORTS) for (const fr of apt.freqs) if (fr.freq && Math.abs(fr.freq - f) < 0.0005) return `${apt.id} ${fr.type}`;
    if (Math.abs(f - 121.5) < 0.0005) return 'EMERGENCY';
    return '';
  }
  CK.refreshGnc = () => {
    const A = AV.A, S = SIM.S, off = !S.eng.master || S.fail.com1;
    const com = CK.gnc.mode === 'COM', r = com ? A.com1 : A.nav1;
    const fmt = com ? U.fmtFreq : U.fmtNav;
    $('#gnc-act').textContent = off ? '' : fmt(r.active); $('#gnc-stb').textContent = off ? '' : fmt(r.standby);
    $('#gnc-mode').textContent = off ? '' : (com ? 'COM' : 'NAV');
    let l1 = '', l2 = '';
    if (!off) {
      if (com) { l1 = stationName(r.active); l2 = stationName(r.standby); }
      else { const d = A.nav1.data; l1 = d.valid ? `${d.ident}  ${d.loc ? 'LOC' : 'R-' + U.fmtHdg(d.radial)}${d.dme != null ? '  ' + U.fmtDis(d.dme) + 'nm' : ''}` : 'NO SIGNAL'; l2 = CK.gnc.showObs ? `OBS ${U.fmtHdg(A.nav1.obs)}°  ${d.valid ? d.toFrom : ''}` : stationNameNav(r.standby); }
    }
    $('#gnc-l1').textContent = l1; $('#gnc-l2').textContent = l2;
    $('#gnc-mon').classList.toggle('on', !!A.com1.monStby && !off);
    $('#gnc-cn').classList.toggle('on', !com);
  };
  function stationNameNav(f) { const s = G3X.nav.NAVAIDS.find(n => n.type === 'VOR' && Math.abs(n.freq - f) < 0.001); if (s) return `${s.id} ${s.name}`.toUpperCase(); for (const apt of G3X.nav.AIRPORTS) for (const rw of apt.rwys) if (rw.ils) for (const [rid, fr] of Object.entries(rw.ils)) if (Math.abs(fr - f) < 0.001) return `${apt.id} ILS ${rid}`; return ''; }
  function gncTune(dir, big) {
    const A = AV.A;
    if (CK.gnc.mode === 'COM') { A.com1.standby = U.nextCom(A.com1.standby, dir, big); G3X.bus.emit('freq', { kind: 'COM', n: 1, f: A.com1.standby }); }
    else if (CK.gnc.showObs) { A.nav1.obs = U.norm360(A.nav1.obs + dir * (big ? 10 : 1)); G3X.bus.emit('crs', A.nav1.obs); }
    else { A.nav1.standby = U.nextNav(A.nav1.standby, dir, big); G3X.bus.emit('freq', { kind: 'NAV', n: 1, f: A.nav1.standby }); }
    CK.refreshGnc();
  }

  // ---------- GTX 335 ----------
  CK.refreshGtx = () => {
    const x = AV.A.xpdr, S = SIM.S; const off = !S.eng.master || x.mode === 'OFF';
    $('#gtx-code').textContent = off ? '' : (x.pending ? (x.pending + '____').slice(0, 4) : x.code);
    $('#gtx-code').classList.toggle('pending', !!x.pending);
    const mode = x.mode === 'ALT' && S.ac.onGround ? 'GND' : x.mode === 'STBY' ? 'SBY' : x.mode;
    $('#gtx-mode').textContent = off ? '' : mode; $('#gtx-r').textContent = !off && x.reply ? 'R' : '';
    $('#gtx-fid').textContent = off ? '' : 'OOKWO'; $('#gtx-fidl').textContent = off ? '' : 'FLIGHT ID';
    $('#gtx-msg').textContent = off ? '' : (x.ident > 0 ? 'IDENT' : 'PRESS ALT FL' + U.pad(Math.max(0, Math.round(SIM.pressureAlt() / 100)), 3));
    document.querySelectorAll('#gtx .gtx-m').forEach(b => b.classList.toggle('on', b.dataset.m === x.mode && !(!S.eng.master)));
    $('#gtx-idnt').classList.toggle('on', x.ident > 0);
  };

  // ---------- GMA 245 ----------
  CK.refreshGma = () => {
    const g = CK.gma, S = SIM.S, off = !S.eng.master;
    document.querySelectorAll('#gma .gb[data-k]').forEach(b => { const k = b.dataset.k; let on = false; if (k === 'com1') on = g.com1; else if (k === 'com2') on = g.com2; else if (k === 'nav1') on = g.nav1; else if (k === 'nav2') on = g.nav2; else if (k === 'mic1') on = g.mic === 1; else if (k === 'mic2') on = g.mic === 2; else if (k === 'pilot') on = g.isol === 'PILOT'; else if (k === 'crew') on = g.isol === 'CREW'; b.classList.toggle('lit', on && !off); });
  };

  CK.init = () => {
    const el = $('#cockpit');
    el.innerHTML = `
      <div class="ck-left">
        <div class="ck-gauges"><div class="ck-title">Motorinstrumenten (analoog)</div><canvas id="ck-gauges" width="660" height="160"></canvas></div>
        <div class="ck-lower">
          <div class="fuelsel"><div class="ck-title">Fuel</div><div class="fuel-dial"><span class="fl">LEFT</span><span class="fr">RIGHT</span><div class="lever" id="fuel-lever"></div></div><div class="flapbtns"><button class="acb fuel" data-s="L">LEFT</button><button class="acb fuel" data-s="R">RIGHT</button></div></div>
          <div class="flapsw"><div class="ck-title">Flap</div><div class="lamprow"><span class="lamp" data-f="0">0</span><span class="lampcap">FLAP UP</span></div><div class="lamprow"><span class="lamp" data-f="1">T</span><span class="lampcap">TO</span></div><div class="lamprow"><span class="lamp" data-f="2">L</span><span class="lampcap">LND</span></div><div class="flapbtns"><button class="acb" id="flap-up" title="Flaps op">▲</button><button class="acb" id="flap-dn" title="Flaps neer">▼</button></div></div>
        </div>
      </div>
      <div class="ck-stack">
        <div class="unit gma" id="gma"><div class="unit-brand">GARMIN <small>GMA 245</small></div>
          <div class="gma-grid">
            <button class="gb" data-k="com1">COM1</button><button class="gb" data-k="com2">COM2</button><button class="gb" data-k="nav1">NAV1</button><button class="gb" data-k="nav2">NAV2</button><button class="gb" data-k="music">MUSIC</button><button class="gb" data-k="aux1">AUX1</button><button class="gb" data-k="aux2">AUX2</button><button class="gb" data-k="mkr">MKR<br>MUTE</button>
            <button class="gb" data-k="mic1">COM1<br>MIC</button><button class="gb" data-k="mic2">COM2<br>MIC</button><button class="gb" data-k="spkr">SPKR</button><button class="gb" data-k="tel">TEL</button><span class="gb-spacer"></span><button class="gb" data-k="pilot">PILOT</button><button class="gb" data-k="crew">CREW</button><span class="gb-note">ICS ISOLATION</span>
          </div></div>
        <div class="unit gnc" id="gnc"><div class="unit-brand">GARMIN <small>GNC 255</small></div>
          <div class="gnc-row">
            <div class="gnc-knobs"><div class="gknob"><span>COM</span><div class="kn"></div><small>PWR/VOL · PUSH SQ</small></div><button class="ub" id="gnc-mon">MON</button><div class="gknob"><span>NAV</span><div class="kn"></div><small>VOL · PUSH ID</small></div></div>
            <div class="gnc-disp"><div class="gnc-top"><span class="lbl">ACT</span><span class="freq" id="gnc-act">118.955</span><span class="mode" id="gnc-mode">COM</span><span class="lbl">STB</span><span class="freq stb" id="gnc-stb">121.500</span></div><div class="gnc-bot"><span id="gnc-l1"></span><span id="gnc-l2"></span></div></div>
            <div class="gnc-right"><button class="ub flip" id="gnc-flip" title="Actief ⇄ standby (vasthouden = 121.500)">⇄</button><div class="tune"><span>TUNE</span><div class="tunebtns"><button class="ub" data-t="-1000" title="buitenknop −">−</button><button class="ub" data-t="1000" title="buitenknop +">+</button></div><div class="tunebtns small"><button class="ub" data-t="-1" title="binnenknop −">−</button><button class="ub" data-t="1" title="binnenknop +">+</button></div><small>PUSH CRSR</small></div></div>
          </div>
          <div class="gnc-keys"><button class="ub" id="gnc-cn">C/N</button><button class="ub" id="gnc-obs">OBS</button><button class="ub" id="gnc-tf">T/F</button><button class="ub" id="gnc-func">FUNC</button><button class="ub" id="gnc-clr">CLR</button><button class="ub" id="gnc-ent">ENT</button></div>
        </div>
        <div class="unit gtx" id="gtx"><div class="unit-brand">GARMIN <small>GTX 335</small></div>
          <div class="gtx-row">
            <div class="gtx-cluster"><button class="ub gtx-m on-top" data-m="ON">ON</button><button class="ub gtx-m sby" data-m="STBY">SBY</button><button class="ub gtx-m alt" data-m="ALT">ALT</button><button class="ub gtx-m offb" data-m="OFF">OFF</button><button class="ub vfr" id="gtx-vfr">VFR</button><button class="ub idnt" id="gtx-idnt">IDNT</button></div>
            <div class="gtx-disp"><div class="gtx-top"><span class="lbl" id="gtx-mode">ALT</span><span class="code" id="gtx-code">7000</span><span class="r" id="gtx-r"></span><span class="fidl" id="gtx-fidl">FLIGHT ID</span><span class="fid" id="gtx-fid">OOKWO</span></div><div class="gtx-bot"><span class="lbl">MSG</span><span id="gtx-msg"></span></div></div>
            <div class="gtx-fkeys"><button class="ub" id="gtx-func">FUNC</button><button class="ub" id="gtx-crsr">CRSR</button><button class="ub" id="gtx-clr">CLR</button><button class="ub" id="gtx-ent">ENT</button></div>
          </div>
          <div class="gtx-keys">${[0, 1, 2, 3, 4, 5, 6, 7].map(d => `<button class="ub gtx-d" data-d="${d}">${d}</button>`).join('')}<button class="ub dim">8▲</button><button class="ub dim">9▼</button></div>
        </div>
      </div>`;
    CK.gauges = $('#ck-gauges');
    // flaps en brandstof
    $('#flap-up').onclick = () => { SIM.setFlaps(SIM.S.ac.flaps - 1); G3X.bus.emit('flaps', SIM.S.ac.flaps); };
    $('#flap-dn').onclick = () => { SIM.setFlaps(SIM.S.ac.flaps + 1); G3X.bus.emit('flaps', SIM.S.ac.flaps); };
    el.querySelectorAll('.fuel').forEach(b => { b.onclick = () => { SIM.setFuelSel(b.dataset.s); G3X.bus.emit('fuelsel', b.dataset.s); }; });
    // GMA 245
    el.querySelectorAll('#gma .gb').forEach(b => { b.onclick = () => { const k = b.dataset.k, g = CK.gma; if (k === 'com1' || k === 'com2' || k === 'nav1' || k === 'nav2') { g[k] = !g[k]; if (k === 'nav1') { AV.A.nav1.audio = g.nav1; G3X.bus.emit('navaudio', 1); } if (k === 'com1') AV.A.com1.mon = g.com1; } else if (k === 'mic1') { g.mic = 1; g.com1 = true; AV.setMic(1); G3X.bus.emit('mic', 1); } else if (k === 'mic2') { g.mic = 2; g.com2 = true; G3X.bus.emit('mic', 2); } else if (k === 'pilot' || k === 'crew') { g.isol = g.isol === k.toUpperCase() ? 'ALL' : k.toUpperCase(); } CK.refreshGma(); }; });
    // GNC 255
    let holdT = null; const flip = $('#gnc-flip');
    flip.addEventListener('pointerdown', () => { holdT = setTimeout(() => { holdT = null; if (CK.gnc.mode === 'COM') { AV.A.com1.active = 121.5; AV.noteRecent(121.5); G3X.bus.emit('freq', { kind: 'COM', n: 1, f: 121.5 }); G3X.bus.emit('swap', 1); CK.refreshGnc(); } }, 1500); });
    const flipUp = () => { if (holdT) { clearTimeout(holdT); holdT = null; if (CK.gnc.mode === 'COM') { AV.swapCom(1); G3X.bus.emit('swap', 1); } else { AV.swapNav(1); G3X.bus.emit('swapnav', 1); } CK.refreshGnc(); } };
    flip.addEventListener('pointerup', flipUp); flip.addEventListener('pointerleave', () => { if (holdT) { clearTimeout(holdT); holdT = null; } });
    $('#gnc-mon').onclick = () => { AV.A.com1.monStby = !AV.A.com1.monStby; G3X.bus.emit('mon', AV.A.com1.monStby); CK.refreshGnc(); };
    $('#gnc-cn').onclick = () => { CK.gnc.mode = CK.gnc.mode === 'COM' ? 'NAV' : 'COM'; CK.gnc.showObs = false; G3X.bus.emit('gncmode', CK.gnc.mode); CK.refreshGnc(); };
    $('#gnc-obs').onclick = () => { CK.gnc.mode = 'NAV'; CK.gnc.showObs = !CK.gnc.showObs; G3X.bus.emit('gncobs', CK.gnc.showObs); CK.refreshGnc(); };
    $('#gnc-tf').onclick = () => { CK.gnc.mode = 'NAV'; CK.gnc.showObs = true; CK.refreshGnc(); };
    $('#gnc-clr').onclick = () => { CK.gnc.showObs = false; CK.refreshGnc(); };
    el.querySelectorAll('.tunebtns .ub').forEach(b => {
      const step = () => gncTune(Math.sign(+b.dataset.t), Math.abs(+b.dataset.t) >= 1000);
      let t; b.addEventListener('pointerdown', () => { step(); t = setInterval(step, 140); }); const stop = () => clearInterval(t); b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop);
    });
    // GTX 335
    el.querySelectorAll('.gtx-m').forEach(b => { b.onclick = () => { AV.setXpdrMode(b.dataset.m); G3X.bus.emit('xpdrmode', b.dataset.m); CK.refreshGtx(); }; });
    el.querySelectorAll('.gtx-d').forEach(b => { b.onclick = () => { const x = AV.A.xpdr; if (x.mode === 'OFF') return; x.pending = ((x.pending || '') + b.dataset.d).slice(0, 4); if (x.pending.length === 4) { AV.setSquawk(x.pending); G3X.bus.emit('squawk', x.pending); x.pending = ''; } CK.refreshGtx(); }; });
    $('#gtx-clr').onclick = () => { AV.A.xpdr.pending = ''; CK.refreshGtx(); };
    $('#gtx-vfr').onclick = () => { if (AV.A.xpdr.mode === 'OFF') return; AV.A.xpdr.pending = ''; AV.setSquawk('7000'); G3X.bus.emit('squawk', '7000'); CK.refreshGtx(); };
    $('#gtx-idnt').onclick = () => { if (AV.A.xpdr.mode === 'OFF' || AV.A.xpdr.mode === 'STBY') return; AV.ident(); G3X.bus.emit('ident'); CK.refreshGtx(); };
    CK.refresh();
  };
  CK.refresh = () => {
    const S = SIM.S;
    document.querySelectorAll('#cockpit .lamp').forEach(l => l.classList.toggle('on', +l.dataset.f === S.ac.flaps && S.eng.master));
    const lever = $('#fuel-lever'); if (lever) lever.style.transform = `rotate(${S.ac.fuelSel === 'R' ? 40 : -40}deg)`;
    document.querySelectorAll('#cockpit .fuel').forEach(b => b.classList.toggle('on', b.dataset.s === S.ac.fuelSel));
    CK.refreshGnc(); CK.refreshGtx(); CK.refreshGma();
  };
  G3X.cockpit = CK;
})();

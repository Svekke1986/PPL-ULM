/* Losse cockpitinstrumenten buiten de G3X, zoals in deze P2008-installatie:
   analoge meters (RPM, CT, olietemperatuur, brandstof L/R), flapschakelaar met lampjes,
   een aparte COM-radio (GTR 200-stijl) en een aparte transponder (TT21/GTX 335-stijl). */
window.G3X = window.G3X || {};
(function () {
  const U = G3X.util, SIM = G3X.sim, AV = G3X.avionics, esc = U.esc;
  const CK = {};
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
    // tankkeuze-indicatie onder de brandstofmeters
    ctx.fillStyle = '#9fb3c8'; ctx.font = '11px "Segoe UI", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('TANK ' + (a.fuelSel === 'L' ? 'LEFT' : a.fuelSel === 'R' ? 'RIGHT' : 'OFF'), 532, 150);
  };

  // ---------- COM-radio ----------
  CK.radio = { entering: false };
  function stationName(f) {
    for (const apt of G3X.nav.AIRPORTS) for (const fr of apt.freqs) if (fr.freq && Math.abs(fr.freq - f) < 0.0005) return `${apt.id} ${fr.type}`;
    if (Math.abs(f - 121.5) < 0.0005) return 'EMERGENCY';
    return '';
  }
  CK.refreshRadio = () => {
    const r = AV.A.com1, S = SIM.S;
    const off = !S.eng.master || S.fail.com1;
    $('#rd-act').textContent = off ? '' : U.fmtFreq(r.active); $('#rd-stby').textContent = off ? '' : U.fmtFreq(r.standby);
    $('#rd-actname').textContent = off ? (S.fail.com1 ? 'FAIL' : '') : stationName(r.active); $('#rd-stbyname').textContent = off ? '' : stationName(r.standby);
    $('#rd-mon').classList.toggle('on', !!r.monStby && !off);
    $('#rd-txrx').textContent = off ? '' : (r.monStby ? 'MON' : 'RX');
  };
  // ---------- transponder ----------
  CK.refreshXpdr = () => {
    const x = AV.A.xpdr, S = SIM.S; const off = !S.eng.master;
    $('#xp-code').textContent = off ? '' : (x.pending ? (x.pending + '____').slice(0, 4) : x.code);
    $('#xp-code').classList.toggle('pending', !!x.pending);
    const mode = x.mode === 'ALT' && S.ac.onGround ? 'GND' : x.mode === 'STBY' ? 'SBY' : x.mode;
    $('#xp-mode').textContent = off ? 'OFF' : mode; $('#xp-r').textContent = x.reply ? 'R' : ''; $('#xp-ident').classList.toggle('on', x.ident > 0);
    $('#xp-fl').textContent = off ? '' : 'FL' + U.pad(Math.max(0, Math.round(SIM.pressureAlt() / 100)), 3);
    document.querySelectorAll('#xpdr .xp-m').forEach(b => b.classList.toggle('on', b.dataset.m === x.mode));
  };

  CK.init = () => {
    const el = $('#cockpit');
    el.innerHTML = `
      <div class="ck-gauges"><div class="ck-title">Motorinstrumenten (analoog)</div><canvas id="ck-gauges" width="660" height="160"></canvas>
        <div class="flapsw"><div class="ck-title">Flaps</div><div class="lamps"><span class="lamp" data-f="0">UP</span><span class="lamp" data-f="1">T/O</span><span class="lamp" data-f="2">LDG</span></div><div class="flapbtns"><button class="acb" id="flap-up">▲</button><button class="acb" id="flap-dn">▼</button></div></div>
      </div>
      <div class="ck-units">
        <div class="unit radio" id="radio"><div class="unit-brand">COM <small>8.33</small></div>
          <div class="rd-disp"><div class="rd-row"><span class="rd-lbl" id="rd-txrx">RX</span><span class="rd-freq" id="rd-act">118.955</span><span class="rd-name" id="rd-actname"></span></div><div class="rd-row stby"><span class="rd-lbl">STBY</span><span class="rd-freq" id="rd-stby">121.500</span><span class="rd-name" id="rd-stbyname"></span></div></div>
          <div class="rd-ctrls"><button class="ub flip" id="rd-flip" title="Actief ⇄ standby (vasthouden = 121.500)">⇄</button><button class="ub" id="rd-mon" title="Standby meeluisteren">MON</button>
            <div class="uknob"><span>MHz</span><button class="ub" data-s="-1000">−</button><button class="ub" data-s="1000">+</button></div><div class="uknob"><span>kHz</span><button class="ub" data-s="-1">−</button><button class="ub" data-s="1">+</button></div></div>
        </div>
        <div class="unit xpdr" id="xpdr"><div class="unit-brand">XPDR <small>Mode S</small></div>
          <div class="xp-disp"><span class="xp-code" id="xp-code">7000</span><span class="xp-mode" id="xp-mode">ALT</span><span class="xp-r" id="xp-r"></span><span class="xp-fl" id="xp-fl"></span></div>
          <div class="xp-ctrls"><div class="xp-modes">${['STBY', 'GND', 'ON', 'ALT'].map(m => `<button class="ub xp-m" data-m="${m}">${m === 'STBY' ? 'SBY' : m}</button>`).join('')}</div>
            <div class="xp-keys">${[0, 1, 2, 3, 4, 5, 6, 7].map(d => `<button class="ub xp-d" data-d="${d}">${d}</button>`).join('')}<button class="ub xp-clr" title="Wis invoer">CLR</button><button class="ub" id="xp-vfr">VFR</button><button class="ub" id="xp-ident">IDENT</button></div></div>
        </div>
      </div>`;
    CK.gauges = $('#ck-gauges');
    // flaps
    $('#flap-up').onclick = () => { SIM.setFlaps(SIM.S.ac.flaps - 1); G3X.bus.emit('flaps', SIM.S.ac.flaps); };
    $('#flap-dn').onclick = () => { SIM.setFlaps(SIM.S.ac.flaps + 1); G3X.bus.emit('flaps', SIM.S.ac.flaps); };
    // radio
    let holdT = null;
    const flip = $('#rd-flip');
    flip.addEventListener('pointerdown', () => { holdT = setTimeout(() => { holdT = null; AV.A.com1.active = 121.5; AV.noteRecent(121.5); G3X.bus.emit('freq', { kind: 'COM', n: 1, f: 121.5 }); G3X.bus.emit('swap', 1); CK.refreshRadio(); }, 1500); });
    const flipUp = () => { if (holdT) { clearTimeout(holdT); holdT = null; AV.swapCom(1); G3X.bus.emit('swap', 1); CK.refreshRadio(); } };
    flip.addEventListener('pointerup', flipUp); flip.addEventListener('pointerleave', () => { if (holdT) { clearTimeout(holdT); holdT = null; } });
    $('#rd-mon').onclick = () => { AV.A.com1.monStby = !AV.A.com1.monStby; G3X.bus.emit('mon', AV.A.com1.monStby); CK.refreshRadio(); };
    el.querySelectorAll('.uknob .ub').forEach(b => {
      const step = () => { const s = +b.dataset.s; AV.A.com1.standby = U.nextCom(AV.A.com1.standby, Math.sign(s), Math.abs(s) >= 1000); G3X.bus.emit('freq', { kind: 'COM', n: 1, f: AV.A.com1.standby }); CK.refreshRadio(); };
      let t; b.addEventListener('pointerdown', () => { step(); t = setInterval(step, 140); }); const stop = () => clearInterval(t); b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop);
    });
    // transponder
    el.querySelectorAll('.xp-m').forEach(b => { b.onclick = () => { AV.setXpdrMode(b.dataset.m); G3X.bus.emit('xpdrmode', b.dataset.m); CK.refreshXpdr(); }; });
    el.querySelectorAll('.xp-d').forEach(b => { b.onclick = () => { const x = AV.A.xpdr; x.pending = ((x.pending || '') + b.dataset.d).slice(0, 4); if (x.pending.length === 4) { AV.setSquawk(x.pending); G3X.bus.emit('squawk', x.pending); x.pending = ''; } CK.refreshXpdr(); }; });
    el.querySelector('.xp-clr').onclick = () => { AV.A.xpdr.pending = ''; CK.refreshXpdr(); };
    $('#xp-vfr').onclick = () => { AV.A.xpdr.pending = ''; AV.setSquawk('7000'); G3X.bus.emit('squawk', '7000'); CK.refreshXpdr(); };
    $('#xp-ident').onclick = () => { AV.ident(); G3X.bus.emit('ident'); CK.refreshXpdr(); };
    CK.refresh();
  };
  CK.refresh = () => {
    document.querySelectorAll('#cockpit .lamp').forEach(l => l.classList.toggle('on', +l.dataset.f === SIM.S.ac.flaps && SIM.S.eng.master));
    CK.refreshRadio(); CK.refreshXpdr();
  };
  G3X.cockpit = CK;
})();

/* Autopilot / flight director in de stijl van de GFC 500 met GMC 507-bedieningspaneel.
   Modi: lateraal ROL, HDG, TRK, NAV (GPS/VOR/LOC), APR, LVL, GA — verticaal PIT, ALT, VS, IAS, GP/GS, VNV, LVL, GA. */
window.G3X = window.G3X || {};
(function () {
  const U = G3X.util, SIM = G3X.sim, AV = G3X.avionics;
  const BANK_LIMIT = 25, PITCH_UP = 15, PITCH_DN = -10;

  const AP = {};
  const ap = () => AV.A.ap;

  // ---------- knoppen ----------
  AP.press = btn => {
    const p = ap(), S = SIM.S, A = AV.A;
    switch (btn) {
      case 'AP':
        if (p.on) AP.disconnect('manual');
        else { p.on = true; p.fd = true; p.disc = 0; if (p.lat === 'LVL' && p.vert === 'LVL') { /* behoud */ } else { if (!['HDG', 'NAV', 'APR', 'GA', 'TRK'].includes(p.lat)) { p.lat = 'ROL'; p.rollRef = Math.abs(S.ac.bank) < 6 ? 0 : S.ac.bank; } if (!['ALT', 'VS', 'IAS', 'GP', 'GS', 'VNV', 'GA'].includes(p.vert)) { p.vert = 'PIT'; p.pitRef = U.clamp(S.ac.pitch, -5, 10); } } if (G3X.audio) G3X.audio.play('click'); }
        break;
      case 'FD':
        if (p.on) break;
        p.fd = !p.fd; if (p.fd) { if (!['HDG', 'NAV', 'APR', 'GA', 'TRK'].includes(p.lat)) { p.lat = 'ROL'; p.rollRef = 0; } if (!['ALT', 'VS', 'IAS', 'GP', 'GS', 'VNV', 'GA'].includes(p.vert)) { p.vert = 'PIT'; p.pitRef = U.clamp(S.ac.pitch, -5, 10); } } else { p.lat = 'ROL'; p.vert = 'PIT'; p.latArm = null; p.vertArm = []; }
        break;
      case 'HDG':
        ensureFd(); p.lat = p.lat === 'HDG' ? 'ROL' : 'HDG'; p.latArm = null; if (p.lat === 'ROL') p.rollRef = 0; break;
      case 'TRK':
        ensureFd(); p.lat = p.lat === 'TRK' ? 'ROL' : 'TRK'; p.latArm = null; break;
      case 'NAV':
        ensureFd();
        if (p.lat === 'NAV' || p.latArm === 'NAV') { p.lat = p.lat === 'NAV' ? 'ROL' : p.lat; p.latArm = null; }
        else { if (navCapturable(S)) { p.lat = 'NAV'; p.latArm = null; } else { p.latArm = 'NAV'; if (p.lat === 'NAV' || p.lat === 'APR') p.lat = 'ROL'; } }
        p.vertArm = p.vertArm.filter(x => x !== 'GP' && x !== 'GS');
        break;
      case 'APR':
        ensureFd();
        if (p.lat === 'APR' || p.latArm === 'APR') { p.lat = p.lat === 'APR' ? 'ROL' : p.lat; p.latArm = null; p.vertArm = p.vertArm.filter(x => x !== 'GP' && x !== 'GS'); if (p.vert === 'GP' || p.vert === 'GS') { p.vert = 'PIT'; p.pitRef = S.ac.pitch; } }
        else {
          if (navCapturable(S)) { p.lat = 'APR'; p.latArm = null; } else { p.latArm = 'APR'; if (p.lat === 'NAV') p.lat = 'ROL'; }
          const src = A.navSource;
          if ((src === 'GPS' && A.nav && A.nav.gpValid) || (src !== 'GPS' && A[src.toLowerCase()].data.loc)) { if (!p.vertArm.includes(src === 'GPS' ? 'GP' : 'GS')) p.vertArm.push(src === 'GPS' ? 'GP' : 'GS'); }
          else if (src === 'GPS') { if (!p.vertArm.includes('GP')) p.vertArm.push('GP'); }
        }
        break;
      case 'ALT':
        ensureFd(); if (p.vert === 'ALT') { p.vert = 'PIT'; p.pitRef = S.ac.pitch; } else { p.vert = 'ALT'; p.altRef = Math.round(AV.indAlt() / 10) * 10; p.vertArm = p.vertArm.filter(x => x !== 'ALTS'); } break;
      case 'VS':
        ensureFd(); if (p.vert === 'VS') { p.vert = 'PIT'; p.pitRef = S.ac.pitch; } else { p.vert = 'VS'; p.vsRef = Math.round(S.ac.vs / 100) * 100; armAlts(); } break;
      case 'IAS':
        ensureFd(); if (p.vert === 'IAS') { p.vert = 'PIT'; p.pitRef = S.ac.pitch; } else { p.vert = 'IAS'; p.iasRef = Math.round(S.ac.ias); armAlts(); } break;
      case 'VNV':
        ensureFd(); if (p.vert === 'VNV' || p.vertArm.includes('VNV')) { p.vert = p.vert === 'VNV' ? 'PIT' : p.vert; p.vertArm = p.vertArm.filter(x => x !== 'VNV'); } else { if (!p.vertArm.includes('VNV')) p.vertArm.push('VNV'); } break;
      case 'LVL':
        p.on = true; p.fd = true; p.lat = 'LVL'; p.vert = 'LVL'; p.latArm = null; p.vertArm = []; p.disc = 0; p.lvl = true; AV.msg('LVL-modus actief', 'ADV', 'lvl'); break;
      case 'GA':
        p.fd = true; p.lat = 'GA'; p.vert = 'GA'; p.latArm = null; p.vertArm = ['ALTS']; p.gaTime = SIM.S.t;
        if (AV.A.fpl.susp) AV.unsuspend();
        if (AV.A.fpl.approach && AV.A.fpl.approach.active && !AV.A.fpl.wpts.some((w, i) => i === AV.A.fpl.active && w.missed)) AV.activateMissed();
        break;
      case 'UP': nudge(1); break;
      case 'DN': nudge(-1); break;
      case 'DISC': AP.disconnect('manual'); break;
    }
  };
  function ensureFd() { const p = ap(); if (!p.fd) { p.fd = true; p.lat = 'ROL'; p.vert = 'PIT'; p.pitRef = U.clamp(SIM.S.ac.pitch, -5, 10); p.rollRef = 0; } }
  function armAlts() { const p = ap(); if (!p.vertArm.includes('ALTS')) p.vertArm.push('ALTS'); }
  function nudge(dir) {
    const p = ap(); ensureFd();
    if (p.vert === 'VS') p.vsRef = U.clamp(p.vsRef + dir * 100, -1500, 1500);
    else if (p.vert === 'IAS') p.iasRef = U.clamp(p.iasRef - dir * 1, 55, 140);
    else if (p.vert === 'PIT' || p.vert === 'LVL' || p.vert === 'GA') { p.vert = 'PIT'; p.pitRef = U.clamp(p.pitRef + dir * 0.5, PITCH_DN, PITCH_UP); }
    else if (p.vert === 'ALT') { p.altRef = Math.round((p.altRef + dir * 20) / 10) * 10; }
  }
  AP.disconnect = reason => { const p = ap(); if (!p.on && reason !== 'manual') return; p.on = false; p.disc = reason === 'manual' ? 3 : 10; p.discReason = reason; p.lvl = false; if (G3X.audio) G3X.audio.play('apdisc'); };
  AP.ackDisc = () => { ap().disc = 0; };

  // kan NAV direct worden gevangen?
  function navCapturable(S) {
    const A = AV.A, src = A.navSource;
    // vangen: dicht bij de koerslijn (ongeacht de hoek) of binnen een ruimer venster terwijl we naar de lijn toe vliegen
    if (src === 'GPS') { const n = A.nav; if (!n || !n.valid) return false; const closing = Math.sign(U.norm180(S.ac.trk - n.dtk)) === -Math.sign(n.xtk) || Math.abs(n.xtk) < 0.05; return Math.abs(n.xtk) < Math.max(0.4, n.scale * 0.6) || (closing && Math.abs(n.xtk) < 2.5 && Math.abs(U.norm180(S.ac.trk - n.dtk)) < 95); }
    const d = A[src.toLowerCase()].data; if (!d.valid) return false;
    return Math.abs(d.dev) < 1.2;
  }

  // ---------- regellus ----------
  AP.step = (S, dt) => {
    const p = ap(), A = AV.A, a = S.ac;
    if (p.disc > 0) p.disc -= dt;
    if (!p.fd && !p.on) { p.bankCmd = 0; p.pitchCmd = 0; return; }
    if (p.on && (S.fail.ahrs || S.fail.adc)) { AP.disconnect(S.fail.ahrs ? 'AHRS' : 'ADC'); AV.msg('AP ontkoppeld: AHRS/ADC-storing', 'WARN', 'apfail'); }
    // --- bewapende modi ---
    if (p.latArm && navCapturable(S)) { p.lat = p.latArm; p.latArm = null; AV.msg(`${p.lat} gevangen`, 'ADV', 'capt' + p.lat); }
    if (p.lat === 'NAV' || p.lat === 'APR') {
      const src = A.navSource; const ok = src === 'GPS' ? (A.nav && A.nav.valid) : A[src.toLowerCase()].data.valid;
      if (!ok) { p.latArm = p.lat; p.lat = 'ROL'; p.rollRef = 0; }
    }
    const indAlt = AV.indAlt();
    // ALTS-capture
    if (p.vertArm.includes('ALTS') && p.vert !== 'ALT') {
      const diff = A.altSel - indAlt;
      const closing = Math.sign(diff) === Math.sign(a.vs) || Math.abs(diff) < 50;
      const capDist = Math.max(60, Math.abs(a.vs) / 6);
      if (closing && Math.abs(diff) < capDist && !(p.vert === 'GP' || p.vert === 'GS')) { p.vert = 'ALT'; p.altRef = A.altSel; p.vertArm = p.vertArm.filter(x => x !== 'ALTS'); AV.msg(`Hoogte ${A.altSel} ft gevangen (ALTS)`, 'ADV', 'alts'); }
    }
    // GP/GS-capture
    if (p.vertArm.includes('GP') && A.navSource === 'GPS' && A.nav && A.nav.gpValid && (p.lat === 'APR')) {
      if (A.nav.vdev != null && Math.abs(A.nav.vdev) < 100 && A.nav.vdev >= -60) { p.vert = 'GP'; p.vertArm = p.vertArm.filter(x => x !== 'GP' && x !== 'ALTS'); AV.msg('Glijpad gevangen (GP)', 'ADV', 'gp'); }
    }
    if (p.vertArm.includes('GS') && A.navSource !== 'GPS' && p.lat === 'APR') {
      const d = A[A.navSource.toLowerCase()].data;
      if (d.gsValid && Math.abs(d.gsDev) < 0.5) { p.vert = 'GS'; p.vertArm = p.vertArm.filter(x => x !== 'GS' && x !== 'ALTS'); AV.msg('Glideslope gevangen (GS)', 'ADV', 'gs'); }
    }
    // VNV-capture
    if (p.vertArm.includes('VNV') && A.nav && A.nav.vnav && A.nav.vnav.todDis <= 0 && A.altSel < a.alt - 150) { p.vert = 'VNV'; p.vertArm = p.vertArm.filter(x => x !== 'VNV'); armAlts(); AV.msg('VNAV-daling gestart', 'ADV', 'vnv'); }
    if (p.vert === 'VNV' && (!A.nav || !A.nav.vnav)) { p.vert = 'ALT'; p.altRef = Math.round(indAlt / 10) * 10; }
    // GA eindigt na 400 ft of op ALT capture
    if (p.vert === 'GA' && S.t - p.gaTime > 45) { p.vert = 'PIT'; p.pitRef = 7; }

    // --- laterale commando ---
    let bankCmd = 0;
    const hdgErrBank = err => U.clamp(err * 1.4, -BANK_LIMIT, BANK_LIMIT);
    switch (p.lat) {
      case 'ROL': bankCmd = Math.abs(p.rollRef || 0) < 6 ? 0 : U.clamp(p.rollRef, -BANK_LIMIT, BANK_LIMIT); break;
      case 'LVL': case 'GA': bankCmd = 0; break;
      case 'HDG': bankCmd = hdgErrBank(U.norm180(A.hdgBug - a.hdg)); break;
      case 'TRK': bankCmd = hdgErrBank(U.norm180(A.hdgBug - a.trk)); break;
      case 'NAV': case 'APR': {
        let dtk, xtk;
        if (A.navSource === 'GPS') { dtk = A.nav.dtk; xtk = A.nav.xtk; }
        else {
          const d = A[A.navSource.toLowerCase()].data; const r = A[A.navSource.toLowerCase()];
          dtk = d.loc ? U.norm360(d.radial + 180) : (d.toFrom === 'TO' ? r.obs : r.obs);
          const full = d.loc ? 2.5 : 10; // graden voor volle uitslag
          const devDeg = -d.dev / 2 * full;
          xtk = Math.tan(devDeg * U.DEG) * Math.max(d.dme || 5, 0.5);
          if (!d.loc && d.toFrom === 'FROM') xtk = xtk; // zelfde teken
        }
        const scale = A.navSource === 'GPS' ? A.nav.scale : 1;
        const icpt = U.clamp(Math.abs(xtk) * (A.nav && A.nav.approachPhase === 'FINAL' ? 120 : 45), 0, 45);
        const trkCmd = U.norm360(dtk - Math.sign(xtk) * icpt + (-xtk * 15 / Math.max(scale, 0.3)) * 0);
        const drift = U.norm180(a.hdg - a.trk);
        bankCmd = hdgErrBank(U.norm180(trkCmd + drift - a.hdg));
        break;
      }
    }
    // --- verticale commando ---
    const vsFromPitch = vsCmd => {
      const err = vsCmd - a.vs;
      return U.clamp(a.pitch + U.clamp(err / 250, -4, 4), PITCH_DN, PITCH_UP);
    };
    let pitchCmd = a.pitch;
    switch (p.vert) {
      case 'PIT': pitchCmd = p.pitRef; break;
      case 'LVL': pitchCmd = vsFromPitch(0); break;
      case 'GA': pitchCmd = 7; break;
      case 'ALT': { const err = p.altRef - indAlt; pitchCmd = vsFromPitch(U.clamp(err * 6, -800, 800)); break; }
      case 'VS': pitchCmd = vsFromPitch(p.vsRef); break;
      case 'IAS': { const err = a.ias - p.iasRef; pitchCmd = U.clamp(a.pitch + U.clamp(err * 0.4, -3, 3), PITCH_DN, PITCH_UP); break; }
      case 'GP': { const n = A.nav; const gsFpm = -a.gs * 101.27 * Math.tan((n.gpAngle || 3) * U.DEG); pitchCmd = vsFromPitch(gsFpm - U.clamp((n.vdev || 0) * 8, -500, 500)); break; }
      case 'GS': { const d = A[A.navSource.toLowerCase()].data; const gsFpm = -a.gs * 101.27 * Math.tan(3 * U.DEG); pitchCmd = vsFromPitch(gsFpm + U.clamp(d.gsDev * 300, -500, 500)); break; }
      case 'VNV': { const v = A.nav.vnav; pitchCmd = vsFromPitch(U.clamp(v.reqFpm - U.clamp(v.vdev * 4, -400, 400), -1200, 0)); break; }
    }
    // snelheidsbescherming
    const AC = SIM.AC;
    if (p.vert !== 'GA' && a.ias < AC.vs1 * 1.15 + 3 && !a.onGround) { pitchCmd = Math.min(pitchCmd, a.pitch - 2); p.uspd = 2; }
    else if (p.uspd > 0) p.uspd -= dt;
    if (a.ias > AC.vno + 8) { pitchCmd = Math.max(pitchCmd, a.pitch + 2); p.ospd = 2; } else if (p.ospd > 0) p.ospd -= dt;
    p.bankCmd = U.clamp(bankCmd, -BANK_LIMIT, BANK_LIMIT);
    p.pitchCmd = U.clamp(pitchCmd, PITCH_DN, PITCH_UP);
    // --- servo's ---
    if (p.on && !a.onGround) {
      const rr = U.clamp((p.bankCmd - a.bank) * 1.5, -6, 6);
      const pr = U.clamp((p.pitchCmd - a.pitch) * 1.2, -2.5, 2.5);
      S.cmds.rollRate = rr; S.cmds.pitchRate = pr; S.cmds.apActive = true;
    } else S.cmds.apActive = false;
  };

  // weergave-informatie voor de PFD-statusbalk
  AP.status = () => {
    const p = ap(), A = AV.A;
    const src = A.navSource;
    const latName = { ROL: 'ROL', HDG: 'HDG', TRK: 'TRK', NAV: src === 'GPS' ? 'GPS' : src === 'NAV1' ? (A.nav1.data.loc ? 'LOC1' : 'VOR1') : (A.nav2.data.loc ? 'LOC2' : 'VOR2'), APR: src === 'GPS' ? 'GPS' : (A[src.toLowerCase()].data.loc ? 'LOC' + src.slice(-1) : 'VOR' + src.slice(-1)), LVL: 'LVL', GA: 'TO/GA' }[p.lat] || p.lat;
    const latArm = p.latArm ? (src === 'GPS' ? 'GPS' : src) : '';
    const vertName = { PIT: 'PIT', ALT: 'ALT', VS: 'VS', IAS: 'IAS', GP: 'GP', GS: 'GS', VNV: 'VPTH', LVL: 'LVL', GA: 'TO/GA' }[p.vert] || p.vert;
    let vertRef = '';
    if (p.vert === 'VS') vertRef = (p.vsRef >= 0 ? '+' : '') + p.vsRef + ' FPM';
    else if (p.vert === 'IAS') vertRef = p.iasRef + ' KT';
    else if (p.vert === 'ALT') vertRef = p.altRef + ' FT';
    else if (p.vert === 'PIT') vertRef = (p.pitRef >= 0 ? '+' : '') + p.pitRef.toFixed(1) + '°';
    return { on: p.on, fd: p.fd, lat: latName, latArm, vert: vertName, vertArm: p.vertArm.join(' '), vertRef, disc: p.disc > 0, lvl: p.lat === 'LVL', uspd: p.uspd > 0, ospd: p.ospd > 0 };
  };

  G3X.autopilot = AP;
})();

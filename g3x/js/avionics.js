/* Avionica-toestand: instellingen, radio's, transponder, vluchtplan, navigatierekenaar, VOR/ILS-ontvanger,
   luchtruim- en terreinwaarschuwingen, berichten (MSG) en CAS-meldingen. */
window.G3X = window.G3X || {};
(function () {
  const U = G3X.util, NAV = G3X.nav, SIM = G3X.sim;

  function defaultAvionics() {
    return {
      // PFD
      baro: 1013, baroStd: false, hdgBug: 60, altSel: 2000, crs1: 60, crs2: 60, minimums: null, minimumsOn: false,
      navSource: 'GPS', brg1: 'OFF', brg2: 'OFF', windMode: 2, svt: true, inset: 'OFF', vspeeds: true,
      hsiMap: false, attIndFull: true,
      // scherm
      mfdPage: 'MAP', prevPage: 'MAP', brightness: 100, reversion: false,
      map: { range: 10, orient: 'TRKUP', declutter: 0, airspace: true, topo: true, trackVector: true, rangeRing: true, obstacles: true, cities: true, water: true, panning: false, pan: null, cursor: null },
      units: { dist: 'NM', alt: 'FT', speed: 'KT', temp: 'C', baro: 'HPA', fuel: 'L' },
      // radio's
      com1: { active: 118.955, standby: 121.500, mic: true, mon: true, monStby: false, vol: 70 },
      com2: { active: 121.500, standby: 123.405, mic: false, mon: false, vol: 70 },
      nav1: { active: 114.60, standby: 113.10, obs: 60, ident: '' },
      nav2: { active: 117.55, standby: 116.95, obs: 60, ident: '' },
      recentCom: [118.955, 121.500, 123.405, 118.955],
      xpdr: { code: '7000', mode: 'ALT', ident: 0, reply: 0, pending: '' },
      // timers
      timer: { running: false, dir: 'UP', value: 0, preset: 0, expired: false },
      flightTimer: 0, clockUtc: false,
      // vluchtplan
      fpl: { wpts: [], active: -1, directTo: null, approach: null, susp: false, obs: false, name: '' },
      storedFpls: [],
      userWpts: [],
      // berichten
      msgs: [], msgNew: false, cas: [],
      // hoogte-alert (geen autopilot in dit toestel)
      altAlert: { t: 0, armed: false, captured: false, devFlag: false },
      // checklists
      checklist: { group: 0, item: 0, done: {} },
      // CAS-bevestigingen
      acked: {},
      // snelle data
      nav: null,
      sound: true,
      traffic: [],
    };
  }

  const AV = { A: defaultAvionics(), defaultAvionics };

  AV.reset = () => {
    const keep = AV.A ? { units: AV.A.units, sound: AV.A.sound, svt: AV.A.svt, storedFpls: AV.A.storedFpls, userWpts: AV.A.userWpts } : null;
    AV.A = defaultAvionics();
    if (keep) Object.assign(AV.A, keep);
    AV.A.hdgBug = Math.round(SIM.S.ac.hdg);
    return AV.A;
  };

  // ---------- berichten ----------
  AV.msg = (text, kind = 'ADV', key) => {
    const A = AV.A;
    key = key || text;
    if (A.msgs.some(m => m.key === key && !m.cleared)) return;
    A.msgs.unshift({ key, text, kind, t: SIM.S.t, time: new Date(), cleared: false });
    if (A.msgs.length > 40) A.msgs.length = 40;
    A.msgNew = true;
    if (G3X.audio) G3X.audio.play(kind === 'WARN' ? 'warn' : kind === 'CAUT' ? 'caution' : 'adv');
  };
  AV.clearMsg = key => { const m = AV.A.msgs.find(x => x.key === key && !x.cleared); if (m) m.cleared = true; };

  // ---------- radio's ----------
  AV.swapCom = n => { const r = AV.A['com' + n]; [r.active, r.standby] = [r.standby, r.active]; AV.noteRecent(r.active); };
  AV.swapNav = n => { const r = AV.A['nav' + n]; [r.active, r.standby] = [r.standby, r.active]; };
  AV.setComStandby = (n, f) => { if (U.isValidCom(f)) { AV.A['com' + n].standby = f; return true; } return false; };
  AV.setNavStandby = (n, f) => { if (U.isValidNav(f)) { AV.A['nav' + n].standby = f; return true; } return false; };
  AV.noteRecent = f => { const A = AV.A; A.recentCom = [f, ...A.recentCom.filter(x => x !== f)].slice(0, 8); };
  AV.setMic = n => { AV.A.com1.mic = n === 1; AV.A.com2.mic = n === 2; AV.A['com' + n].mon = true; };

  // ---------- transponder ----------
  AV.setSquawk = code => { if (/^[0-7]{4}$/.test(code)) { AV.A.xpdr.code = code; return true; } return false; };
  AV.ident = () => { AV.A.xpdr.ident = 18; };
  AV.setXpdrMode = m => { AV.A.xpdr.mode = m; };

  // ---------- vluchtplan ----------
  const F = () => AV.A.fpl;
  const wpCopy = w => ({ id: w.id, name: w.name || '', type: w.type || 'INT', lat: w.lat, lon: w.lon, alt: w.alt ?? null, faf: !!w.faf, map: !!w.map, iaf: !!w.iaf, proc: !!w.proc, hold: !!w.hold, thr: !!w.thr, missed: !!w.missed, user: !!w.user });

  AV.fplAdd = (w, index) => {
    const f = F(); const c = wpCopy(w);
    if (index == null || index > f.wpts.length) index = f.wpts.length;
    f.wpts.splice(index, 0, c);
    if (f.active < 0 && f.wpts.length >= 2) f.active = 1;
    else if (f.active >= 0 && index <= f.active) f.active++;
    if (f.wpts.length === 1) f.active = -1;
    return c;
  };
  AV.fplRemove = index => {
    const f = F();
    if (index < 0 || index >= f.wpts.length) return;
    const w = f.wpts[index];
    f.wpts.splice(index, 1);
    if (f.directTo && f.directTo.to === w) f.directTo = null;
    if (f.wpts.length < 2) f.active = -1;
    else if (index < f.active) f.active--;
    else if (index === f.active) f.active = Math.min(f.active, f.wpts.length - 1), f.active = Math.max(1, f.active);
    if (f.active >= f.wpts.length) f.active = f.wpts.length - 1;
    if (f.active === 0) f.active = 1;
    if (w.proc && !f.wpts.some(x => x.proc)) f.approach = null;
  };
  AV.fplClear = () => { const f = F(); f.wpts = []; f.active = -1; f.directTo = null; f.approach = null; f.susp = false; f.name = ''; };
  AV.fplInvert = () => { const f = F(); f.wpts = f.wpts.filter(w => !w.proc).reverse(); f.approach = null; f.active = f.wpts.length >= 2 ? 1 : -1; f.directTo = null; };
  AV.fplActivateLeg = index => { const f = F(); if (index >= 1 && index < f.wpts.length) { f.active = index; f.directTo = null; f.susp = false; } };
  AV.fplStore = name => { const f = F(); if (!f.wpts.length) return; AV.A.storedFpls.unshift({ name: name || f.wpts.map(w => w.id).join('-'), wpts: f.wpts.filter(w => !w.proc).map(wpCopy) }); AV.A.storedFpls = AV.A.storedFpls.slice(0, 20); AV.save(); };
  AV.fplLoad = i => { const s = AV.A.storedFpls[i]; if (!s) return; AV.fplClear(); s.wpts.forEach(w => AV.fplAdd(w)); F().name = s.name; };
  AV.fplDeleteStored = i => { AV.A.storedFpls.splice(i, 1); AV.save(); };

  AV.directTo = (w, crs) => {
    const f = F(), a = SIM.S.ac;
    const c = wpCopy(w);
    const idx = f.wpts.findIndex(x => x.id === c.id);
    let from = { lat: a.lat, lon: a.lon, id: 'PPOS' };
    if (crs != null) from = Object.assign(U.dest(c, U.norm360(crs + 180), 30), { id: 'PPOS' });
    f.directTo = { from, to: idx >= 0 ? f.wpts[idx] : c, crs: crs ?? null, inFpl: idx >= 0 };
    if (idx >= 0) f.active = Math.max(1, idx);
    f.susp = false; f.obs = false;
    AV.msg(`Direct-To ${c.id}`, 'ADV', 'dto');
  };
  AV.cancelDirectTo = () => { F().directTo = null; };

  // naderingen
  AV.loadApproach = (aptId, apIndex, transition) => {
    const f = F();
    const list = NAV.APPROACHES[aptId]; if (!list) return false;
    const ap = list[apIndex]; if (!ap) return false;
    // verwijder bestaande procedure-waypoints
    f.wpts = f.wpts.filter(w => !w.proc);
    if (f.active >= f.wpts.length) f.active = f.wpts.length - 1;
    let legs = ap.legs.slice();
    const vtf = transition === 'VECTORS';
    if (!vtf) {
      const ti = legs.findIndex(l => l.id === transition);
      if (ti > 0) legs = legs.slice(ti);
      else if (ti < 0) legs = legs.filter(l => !l.iaf || l.id === transition);
    } else legs = legs.filter(l => l.faf || l.map);
    const apt = NAV.find(aptId);
    // destination moet laatste niet-proc wpt zijn
    if (!f.wpts.some(w => w.id === aptId)) AV.fplAdd(apt);
    legs.forEach(l => f.wpts.push(Object.assign(wpCopy(l), { proc: true, name: `${aptId} ${ap.name}` })));
    ap.missed.forEach(l => f.wpts.push(Object.assign(wpCopy(l), { proc: true, missed: true, name: `${aptId} ${ap.name} missed` })));
    f.approach = { apt: aptId, index: apIndex, name: ap.name, type: ap.type, rwy: ap.rwy, freq: ap.freq || null, finalCrs: ap.finalCrs, transition, vtf, active: false, loaded: true };
    if (f.active < 1 && f.wpts.length >= 2) f.active = 1;
    AV.msg(`${ap.name} ${aptId} loaded`, 'ADV', 'apr');
    return true;
  };
  AV.activateApproach = () => {
    const f = F(); if (!f.approach) return false;
    const ap = f.approach;
    ap.active = true; f.susp = false;
    if (ap.vtf) AV.activateVtf();
    else {
      const first = f.wpts.findIndex(w => w.proc && !w.missed);
      if (first > 0) AV.directTo(f.wpts[first]);
    }
    return true;
  };
  AV.activateVtf = () => {
    const f = F(); if (!f.approach) return;
    const fafI = f.wpts.findIndex(w => w.proc && w.faf);
    if (fafI < 0) return;
    f.approach.active = true; f.approach.vtf = true;
    f.active = fafI + 1; // leg FAF -> MAP (verlengd)
    const faf = f.wpts[fafI], mapw = f.wpts[fafI + 1];
    const crs = U.bearing(faf, mapw);
    f.directTo = { from: Object.assign(U.dest(faf, U.norm360(crs + 180), 25), { id: 'VTF' }), to: mapw, crs, inFpl: true, vtf: true };
    f.susp = false;
    AV.msg('Vectors-to-final activated', 'ADV', 'vtf');
  };
  AV.removeApproach = () => { const f = F(); f.wpts = f.wpts.filter(w => !w.proc); f.approach = null; if (f.active >= f.wpts.length) f.active = f.wpts.length - 1; if (f.wpts.length < 2) f.active = -1; if (f.directTo && f.directTo.to.proc) f.directTo = null; };
  AV.activateMissed = () => {
    const f = F(); if (!f.approach) return false;
    const mi = f.wpts.findIndex(w => w.missed);
    if (mi < 0) return false;
    f.susp = false; f.directTo = null; f.active = mi;
    AV.msg('Missed approach activated', 'ADV', 'missed');
    return true;
  };
  AV.unsuspend = () => { const f = F(); if (f.susp) { if (f.wpts[f.active] && f.wpts[f.active].map) AV.activateMissed(); else { f.susp = false; if (f.active < f.wpts.length - 1) f.active++; } } };

  // gebruikerswaypoint
  AV.addUserWaypoint = (lat, lon, id) => {
    const A = AV.A;
    id = (id || ('USR' + U.pad(A.userWpts.length + 1, 3))).toUpperCase();
    const w = { id, name: 'User waypoint', type: 'USER', lat, lon, user: true };
    A.userWpts.push(w); NAV.ALL.push(w); AV.save();
    return w;
  };
  AV.findWpt = id => NAV.find(id) || AV.A.userWpts.find(w => w.id === (id || '').toUpperCase()) || null;

  // ---------- navigatierekenaar ----------
  function navCompute(S) {
    const A = AV.A, f = A.fpl, a = S.ac, pos = { lat: a.lat, lon: a.lon };
    const out = { valid: false, legFrom: null, legTo: null, dtk: null, brg: null, dis: null, ete: null, xtk: 0, scale: 2, scaleLabel: 'ENR', vdev: null, gpValid: false, toFrom: 'TO', destDis: null, destEte: null, destId: null, nextId: null, seq: false, alongLeg: 0, legLen: 0, approachPhase: null, vnav: null };
    if (S.fail.gps) return out;
    let from, to;
    if (f.directTo) { from = f.directTo.from; to = f.directTo.to; }
    else if (f.active >= 1 && f.wpts[f.active]) { from = f.wpts[f.active - 1]; to = f.wpts[f.active]; }
    if (!to) return out;
    out.valid = true; out.legFrom = from; out.legTo = to;
    let dtk = f.directTo && f.directTo.crs != null ? f.directTo.crs : U.bearing(from, to);
    if (f.obs) dtk = A.crs1;
    const brg = U.bearing(pos, to), dis = U.distNm(pos, to);
    const xt = U.xtk(from, to, pos);
    out.dtk = dtk; out.brg = brg; out.dis = dis; out.xtk = xt.xtk; out.alongLeg = xt.along; out.legLen = U.distNm(from, to);
    if (f.obs) { const rel = U.norm180(brg - A.crs1); out.xtk = Math.sin(rel * U.DEG) * dis; out.toFrom = Math.abs(rel) < 90 ? 'TO' : 'FROM'; }
    const gsKt = Math.max(a.gs, 1);
    out.ete = dis / gsKt * 60;
    // CDI-schaal
    const dest = f.wpts.filter(w => !w.proc).slice(-1)[0] || to;
    const dep = f.wpts[0];
    const nearDest = dest && U.distNm(pos, dest) < 30, nearDep = dep && dep !== dest && U.distNm(pos, dep) < 30 && f.wpts.length > 1;
    out.scale = 2; out.scaleLabel = 'ENR';
    if (nearDest || nearDep) { out.scale = 1; out.scaleLabel = 'TERM'; }
    const apr = f.approach;
    if (apr && apr.active) {
      const fafI = f.wpts.findIndex(w => w.proc && w.faf), mapI = f.wpts.findIndex(w => w.proc && w.map);
      const toIdx = f.wpts.indexOf(to);
      if (to.missed) { out.scale = 1; out.scaleLabel = 'MAPR'; out.approachPhase = 'MISSED'; }
      else if (toIdx === mapI || (f.directTo && f.directTo.vtf)) {
        // eindnadering: schaal 0.3 en hoekig naar de drempel (zoals LPV/LNAV+V), met glijpad
        const faf = f.wpts[fafI], mapw = f.wpts[mapI];
        out.scaleLabel = apr.type === 'ILS' ? 'LNAV+V' : 'LNAV+V';
        out.scale = 0.3; out.approachPhase = 'FINAL';
        out.gpValid = true;
        const thrAlt = mapw.alt, fafAlt = faf.alt;
        const total = U.distNm(faf, mapw);
        const angle = Math.atan((fafAlt - thrAlt) * U.FT_M / (total * U.NM_M)) / U.DEG;
        out.gpAngle = Math.max(2.5, angle);
        const distToThr = Math.max(0, U.distNm(pos, mapw));
        const pathAlt = thrAlt + Math.tan(out.gpAngle * U.DEG) * distToThr * U.NM_M / U.FT_M;
        out.vdev = SIM.indicatedAlt(A.baroStd ? 1013.25 : A.baro) - pathAlt - (A.baroStd ? (1013.25 - S.env.qnh) * 27 : (A.baro - S.env.qnh) * 27); // werkelijke afwijking
        out.vdev = a.alt - pathAlt;
        out.pathAlt = pathAlt;
      } else if (fafI >= 0 && toIdx === fafI) {
        out.scale = U.clamp(1 - (1 - 0.3) * Math.max(0, (2 - dis)) / 2, 0.3, 1); out.scaleLabel = 'TERM'; out.approachPhase = 'INTER';
        if (dis < 2) out.scaleLabel = 'APR';
      } else if (toIdx > 0 && toIdx < fafI) { out.scale = 1; out.scaleLabel = 'TERM'; out.approachPhase = 'INITIAL'; }
    }
    // bestemming
    if (dest) {
      let d = 0, p = pos, started = false;
      for (let i = Math.max(f.active, 0); i < f.wpts.length; i++) {
        const w = f.wpts[i]; if (w.proc && w.missed) break;
        if (!started) { d += U.distNm(pos, f.directTo ? f.directTo.to : w); p = f.directTo ? f.directTo.to : w; started = true; if (f.directTo && !f.directTo.inFpl) break; continue; }
        if (i <= (f.wpts.indexOf(f.directTo ? f.directTo.to : f.wpts[f.active]))) continue;
        d += U.distNm(p, w); p = w;
      }
      out.destDis = d; out.destEte = d / gsKt * 60; out.destId = dest.id;
    }
    // VNAV: volgende hoogtebeperking (benadering: naderingswaypoints en handmatige alts)
    const tIdx = f.wpts.indexOf(to);
    let cum = dis, target = null;
    for (let i = Math.max(tIdx, 0); i < f.wpts.length && tIdx >= 0; i++) {
      const w = f.wpts[i];
      if (i > tIdx) cum += U.distNm(f.wpts[i - 1], w);
      if (w.alt != null && w.alt < a.alt - 100 && !w.missed) { target = { wpt: w, alt: w.alt, dis: cum }; break; }
    }
    if (target) {
      const reqFpm = -(a.alt - target.alt) / Math.max(target.dis / gsKt * 60, 0.1);
      const todDis = target.dis - (a.alt - target.alt) / (Math.tan(3 * U.DEG) * U.NM_M / U.FT_M);
      out.vnav = { wpt: target.wpt.id, alt: target.alt, dis: target.dis, reqFpm, todDis, todEte: todDis / gsKt * 60, pathAlt: target.alt + Math.tan(3 * U.DEG) * target.dis * U.NM_M / U.FT_M };
      out.vnav.vdev = a.alt - out.vnav.pathAlt;
    }
    // sequencing
    if (!f.susp && !f.obs) {
      const turnRadiusNm = (gsKt * U.KT_MS) ** 2 / (9.81 * Math.tan(20 * U.DEG)) / U.NM_M;
      const toIdx = f.wpts.indexOf(to);
      const next = toIdx >= 0 && toIdx + 1 < f.wpts.length ? f.wpts[toIdx + 1] : null;
      const flyOver = to.map || to.hold || !next || (f.directTo && !f.directTo.inFpl);
      let anticipate = 0;
      if (!flyOver && next) { const dc = Math.abs(U.norm180(U.bearing(to, next) - dtk)); anticipate = Math.min(turnRadiusNm * Math.tan(Math.min(dc, 120) / 2 * U.DEG), 2); }
      const passed = xt.along >= out.legLen - anticipate - 0.02 || (dis < 0.25) || (Math.abs(U.norm180(brg - dtk)) > 95 && dis < 1.5);
      if (passed) {
        // zonder volgend waypoint alleen 'aangekomen' melden als we er echt dichtbij zijn (niet als we ver dwars van de lijn af staan)
        if (to.map && f.approach && f.approach.active) { f.susp = true; AV.msg('Missed approach point — SUSP. Press SUSP for the missed approach', 'ADV', 'susp'); }
        else if (to.hold) { f.susp = true; AV.msg(`Holding at ${to.id} — SUSP`, 'ADV', 'hold'); }
        else if (f.directTo && !f.directTo.inFpl) { if (dis < 2.5) { f.susp = true; AV.msg(`Arriving at ${to.id}`, 'ADV', 'arrive'); } }
        else if (next) { f.active = toIdx + 1; f.directTo = null; out.seq = true; }
        else if (dis < 2.5) { f.susp = true; AV.msg(`Arriving at destination ${to.id}`, 'ADV', 'arrive'); }
      } else if (out.ete < 0.25 && out.ete > 0 && dis > 0.3) AV.msg(`Approaching ${to.id}`, 'ADV', 'appr-' + to.id);
    }
    out.nextId = to.id;
    if (out.ete > 60 * 100) out.ete = Infinity;
    return out;
  }

  // ---------- VOR/ILS-ontvanger ----------
  function navRadio(S, n) {
    const A = AV.A, r = A['nav' + n], a = S.ac, pos = { lat: a.lat, lon: a.lon };
    const out = { valid: false, ident: '', type: null, radial: null, dme: null, dev: 0, toFrom: 'OFF', gsDev: null, gsValid: false, loc: false, station: null };
    if (S.fail['nav' + n]) return out;
    const f = Math.round(r.active * 100) / 100;
    if (U.isLocFreq(f)) {
      // ILS: zoek baan
      for (const apt of NAV.AIRPORTS) for (const rw of apt.rwys) if (rw.ils) for (const [rid, fr] of Object.entries(rw.ils)) if (Math.abs(fr - f) < 0.001) {
        const re = NAV.runwayEnds(apt, rid); if (!re) continue;
        const d = U.distNm(pos, re.thr);
        const brgToThr = U.bearing(pos, re.thr);
        const off = U.norm180(brgToThr - re.hdg);
        if (d > 25 || Math.abs(off) > 50) continue;
        out.valid = true; out.loc = true; out.type = 'LOC'; out.ident = 'I' + rid.replace(/\D/g, '').slice(-2) + apt.id.slice(2, 3); out.station = { apt, rwy: rid, thr: re.thr, hdg: re.hdg };
        out.dev = U.clamp(off / 2.5, -1, 1) * 2; // in dots (±2 = volledig); + = naald rechts (vlieg naar rechts)
        out.dme = d; out.toFrom = 'TO'; out.radial = U.norm360(re.hdg + 180);
        const gpAlt = apt.elev + 50 + Math.tan(3 * U.DEG) * d * U.NM_M / U.FT_M;
        const ang = Math.atan2(a.alt - gpAlt, Math.max(d, 0.05) * U.NM_M / U.FT_M) / U.DEG;
        out.gsValid = d < 12; out.gsDev = U.clamp(-ang / 0.35, -2, 2); // dots, boven het pad => naald omlaag
        return out;
      }
      return out;
    }
    const st = NAV.NAVAIDS.find(x => x.type === 'VOR' && Math.abs(x.freq - f) < 0.001);
    if (!st) return out;
    const d = U.distNm(pos, st);
    const range = Math.max(25, 1.23 * Math.sqrt(Math.max(a.agl || 0, 50)));
    if (d > range + 20) return out;
    out.valid = true; out.type = 'VOR'; out.ident = st.id; out.station = st;
    out.radial = U.bearing(st, pos); out.dme = st.dme ? d : null;
    const rel = U.norm180(out.radial - r.obs);
    // TO als we de radiaal van OBS vanaf de tegenovergestelde kant naderen
    const toFrom = Math.abs(rel) > 90 ? 'TO' : 'FROM';
    out.toFrom = toFrom;
    let dev = toFrom === 'FROM' ? -rel : U.norm180(rel + 180);
    // tekenconventie: + = naald rechts = koerslijn ligt rechts van het toestel
    out.dev = U.clamp(dev / 10, -1, 1) * 2;
    return out;
  }

  // ---------- waarschuwingen ----------
  function updateAlerts(S, dt) {
    const A = AV.A, a = S.ac, E = S.eng, cas = [];
    const warn = (id, text) => cas.push({ id, text, level: 'WARN' });
    const caut = (id, text) => cas.push({ id, text, level: 'CAUT' });
    const adv = (id, text) => cas.push({ id, text, level: 'ADV' });
    if (E.running || E.rpm > 500) {
      if (E.oilP < (E.rpm > 3500 ? 2 : 0.8)) warn('OILP', 'OIL PRESS LO');
      else if (E.oilP > 5.2) caut('OILPH', 'OIL PRESS HI');
      if (E.fuelP < 0.15) caut('FUELP', 'FUEL PRESS LO');
    }
    if (E.master && E.volts < 12.5) caut('VOLT', 'LOW VOLTS');
    if (E.master && E.amps < -1 && (E.running)) caut('ALTN', 'ALTERNATOR');
    if (S.fail.ahrs) warn('AHRS', 'AHRS FAIL');
    if (S.fail.adc) warn('ADC', 'ADC FAIL');
    if (S.fail.gps) caut('GPS', 'GPS LOI');
    if (S.fail.pitot) caut('PITOT', 'AIRSPEED MISCOMPARE');
    if (!a.onGround && a.ias > SIM.AC.vne) warn('VNE', 'OVERSPEED');
    if (A.timer.expired) adv('TIMER', 'TIMER EXPIRED');
    // terrein
    if (!a.onGround) {
      const look = U.dest(a, a.trk, Math.max(a.gs, 40) / 60 * 1.0); // 1 minuut vooruit
      const tAhead = Math.max(NAV.terrainFt(look.lat, look.lon), NAV.terrainFt(a.lat, a.lon));
      const altAhead = a.alt + a.vs;
      const descending = a.vs < -200;
      if (altAhead - tAhead < 100 && a.agl < 600 && (descending || a.alt - tAhead < 100)) warn('TERR', 'TERRAIN — PULL UP');
      else if (a.alt - tAhead < 300 && a.agl < 900 && !nearAirport(a, 2)) caut('TERRC', 'TERRAIN');
      for (const o of NAV.OBSTACLES) { const d = U.distNm(a, o); if (d < 1.5 && a.alt < o.msl + 300) { caut('OBST', 'OBSTACLE'); break; } }
    }
    // luchtruim
    if (!a.onGround) {
      const now = NAV.airspacesAt(a, a.alt).filter(s => s.type !== 'ATZ');
      if (now.length) adv('ASPC', `IN ${now[0].name.split(' ')[0]} ${now[0].type}`);
      const ahead = U.dest(a, a.trk, Math.max(a.gs, 40) / 60 * 2);
      const soon = NAV.airspacesAt(ahead, a.alt + a.vs * 2).filter(s => s.type !== 'ATZ' && !now.includes(s));
      if (soon.length) { adv('ASPCA', `${soon[0].type} AHEAD`); AV.msg(`Airspace ahead within 2 min: ${soon[0].name} (${soon[0].floor}–${soon[0].ceil} ft)`, 'ADV', 'aspc-' + soon[0].id); }
      for (const s of NAV.AIRSPACES) if (s.type !== 'ATZ' && !now.includes(s) && a.alt >= s.floor - 200 && a.alt <= s.ceil + 200 && NAV.distToAirspace(s, a) < 1.0) { adv('ASPCN', `${s.type} NEAR`); break; }
    }
    // hoogte-alert (1000 ft / 200 ft)
    const al = A.altAlert, indAlt = SIM.indicatedAlt(A.baroStd ? 1013.25 : A.baro);
    const diff = Math.abs(indAlt - A.altSel);
    if (!a.onGround) {
      if (diff <= 1000 && !al.armed && diff > 200) { al.armed = true; al.t = 5; if (G3X.audio) G3X.audio.play('altalert'); }
      if (diff <= 200) { al.captured = true; }
      if (al.captured && diff > 200 && diff < 1000) { if (!al.devFlag) { al.devFlag = true; al.t = 5; if (G3X.audio) G3X.audio.play('altalert'); } }
      if (diff <= 200) al.devFlag = false;
      if (diff > 1000) { al.armed = false; al.captured = false; al.devFlag = false; }
    }
    if (al.t > 0) al.t -= dt;
    // minimums
    if (A.minimumsOn && A.minimums != null && !a.onGround) {
      if (indAlt <= A.minimums && !A.minFlag && a.vs < 0) { A.minFlag = true; AV.msg('MINIMUMS', 'ADV', 'mins'); if (G3X.audio) G3X.audio.play('minimums'); }
      if (indAlt > A.minimums + 100) A.minFlag = false;
    }
    // transponder-reply en ident
    const x = A.xpdr;
    if (x.ident > 0) x.ident -= dt;
    x.reply = (x.mode === 'ALT' || x.mode === 'ON') && !a.onGround && Math.floor(S.t * 1.5) % 4 === 0 ? 1 : 0;
    // timers
    const tm = A.timer;
    if (tm.running) { tm.value += tm.dir === 'UP' ? dt : -dt; if (tm.dir === 'DOWN' && tm.value <= 0) { tm.value = 0; tm.running = false; tm.expired = true; AV.msg('Timer expired', 'ADV', 'timer'); if (G3X.audio) G3X.audio.play('timer'); } }
    if (!a.onGround || a.gs > 30) A.flightTimer += dt;
    // nieuwe CAS-meldingen => bericht + geluid
    for (const c of cas) {
      if (!A.acked[c.id]) { A.acked[c.id] = { t: S.t, seen: false }; if (c.level !== 'ADV') AV.msg(c.text, c.level, 'cas-' + c.id); }
    }
    for (const k of Object.keys(A.acked)) if (!cas.some(c => c.id === k)) { delete A.acked[k]; AV.clearMsg('cas-' + k); }
    A.cas = cas;
  }
  function nearAirport(pos, nm) { return NAV.AIRPORTS.some(ap => U.distNm(pos, ap) < nm); }

  // ---------- NAV-ident en radio's ----------
  function updateRadios(S) {
    const A = AV.A;
    A.nav1.data = navRadio(S, 1); A.nav2.data = navRadio(S, 2);
    A.nav1.ident = A.nav1.data.ident; A.nav2.ident = A.nav2.data.ident;
  }

  AV.step = (S, dt) => {
    updateRadios(S);
    AV.A.nav = navCompute(S);
    updateAlerts(S, dt);
    // verkeer (gesimuleerd, optioneel)
    for (const t of AV.A.traffic) { const p = U.dest(t, t.trk, t.gs * dt / 3600); t.lat = p.lat; t.lon = p.lon; t.alt += t.vs * dt / 60; }
  };

  // ---------- bewaren ----------
  AV.save = () => { try { localStorage.setItem('g3x.persist', JSON.stringify({ units: AV.A.units, sound: AV.A.sound, svt: AV.A.svt, storedFpls: AV.A.storedFpls, userWpts: AV.A.userWpts, map: { orient: AV.A.map.orient, topo: AV.A.map.topo } })); } catch (e) { /* geen opslag */ } };
  AV.load = () => { try { const p = JSON.parse(localStorage.getItem('g3x.persist') || 'null'); if (p) { Object.assign(AV.A.units, p.units || {}); AV.A.sound = p.sound ?? true; AV.A.svt = p.svt ?? true; AV.A.storedFpls = p.storedFpls || []; AV.A.userWpts = p.userWpts || []; AV.A.userWpts.forEach(w => { if (!NAV.find(w.id)) NAV.ALL.push(w); }); if (p.map) Object.assign(AV.A.map, p.map); } } catch (e) { /* negeren */ } };

  // handige getters
  AV.indAlt = () => SIM.indicatedAlt(AV.A.baroStd ? 1013.25 : AV.A.baro);
  AV.baroShown = () => AV.A.baroStd ? 1013 : AV.A.baro;

  // Checklists Tecnam P2008 JC (vereenvoudigd, trainingsdoeleinden)
  AV.CHECKLISTS = [
    { name: 'Before Engine Start', items: ['Preflight inspection — COMPLETED', 'Seats & belts — ADJUSTED, FASTENED', 'Parking brake — SET', 'Fuel selector — LEFT or RIGHT (fullest tank)', 'Throttle — IDLE', 'Choke — AS REQUIRED', 'Avionics master — OFF', 'Master switch — ON', 'Fuel pump — ON, pressure check'] },
    { name: 'Engine Start', items: ['Propeller area — CLEAR', 'Ignition — BOTH', 'Starter — ENGAGE (max 10 s)', 'Oil pressure — RISING within 10 s', 'Throttle — 2000–2500 RPM warm-up', 'Avionics master — ON', 'G3X — SET (baro, fuel on board)', 'Transponder — STBY / code set'] },
    { name: 'Before Takeoff', items: ['Engine run-up 4000 RPM — ignition check (max 300 RPM drop, 120 diff)', 'Oil temp — min 50 °C', 'Oil press — green', 'Flight controls — FREE & CORRECT', 'Trim — TAKEOFF', 'Flaps — T/O', 'Fuel selector — FULLEST TANK, fuel pump ON', 'Baro — SET QNH', 'Transponder — ALT', 'Heading bug / altitude — SET'] },
    { name: 'After Takeoff / Climb', items: ['Flaps — UP above 60 KIAS (300 ft AGL)', 'Fuel pump — OFF above 1000 ft AGL', 'Climb speed — Vy 69 KIAS', 'Engine instruments — GREEN', 'Altimeter — CROSS-CHECK'] },
    { name: 'Cruise', items: ['Power — 4800–5200 RPM', 'Fuel — SWITCH TANK every 30 min, balance', 'Engine instruments — GREEN', 'Fuel quantity & endurance — CHECK', 'Navigation / radios — SET', 'Altimeter — QNH of region'] },
    { name: 'Descent / Approach', items: ['ATIS / field info — OBTAINED', 'Baro — SET QNH', 'Fuel selector — FULLEST TANK', 'Fuel pump — ON', 'Approach briefing — COMPLETE', 'Minimums (if applicable) — SET'] },
    { name: 'Before Landing', items: ['Fuel pump — ON', 'Flaps — AS REQUIRED (VFE 75 KIAS)', 'Approach speed — 60–65 KIAS', 'Trim — SET', 'Landing light — ON'] },
    { name: 'After Landing', items: ['Flaps — UP', 'Fuel pump — OFF', 'Transponder — STBY (per lokale regels)', 'Landing light — OFF'] },
    { name: 'Shutdown', items: ['Parking brake — SET', 'Throttle — IDLE', 'Avionics master — OFF', 'Ignition — OFF', 'Master switch — OFF', 'Fuel selector — OFF'] },
    { name: 'EMERG: Engine Failure in Flight', items: ['Airspeed — BEST GLIDE 65 KIAS', 'Landing field — SELECT (G3X NRST)', 'Fuel selector — SWITCH TANK', 'Fuel pump — ON', 'Ignition — BOTH, check', 'Throttle — CYCLE', 'Restart — ATTEMPT if altitude permits', 'Transponder — 7700', 'Radio — 121.500 MAYDAY', 'Master — OFF before touchdown'] },
    { name: 'EMERG: Oil Pressure Low', items: ['Oil temperature — CHECK', 'If temperature rising: Power — REDUCE', 'Land — AS SOON AS POSSIBLE (NRST)', 'Be prepared for engine failure'] },
    { name: 'EMERG: High CHT / Oil Temp', items: ['Power — REDUCE', 'Airspeed — INCREASE (better cooling)', 'Climb — DISCONTINUE', 'If not decreasing: Land — AS SOON AS PRACTICAL'] },
    { name: 'EMERG: Alternator Failure', items: ['Circuit breaker — CHECK', 'Non-essential electrical — OFF (load shedding)', 'Battery endurance — ca. 30 min', 'Land — AS SOON AS PRACTICAL', 'Transponder / radio — KEEP ON'] },
    { name: 'EMERG: Radio Failure', items: ['Volume / squelch — CHECK', 'Headset — CHECK', 'COM2 — TRY', 'Transponder — 7600', 'Continue VFR, join circuit, watch light signals'] },
    { name: 'EMERG: AHRS / ADC Failure', items: ['Cross-check — standby instruments', 'Attitude — REFERENCE HORIZON (VMC)', 'Autopilot — DISCONNECT (if attitude unreliable)', 'Avoid IMC', 'Land — AS SOON AS PRACTICAL'] },
  ];

  G3X.avionics = AV;
})();

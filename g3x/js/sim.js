/* Simulatie: toestand, vluchtmodel (Tecnam P2008 JC MkII, bij benadering), Rotax 912 S-motormodel,
   omgeving en storingen. Waarden zijn vereenvoudigd en NIET de POH-waarden. */
window.G3X = window.G3X || {};
(function () {
  const U = G3X.util, NAV = G3X.nav;

  // ---------- toestelgegevens (bij benadering) ----------
  const AC = {
    name: 'Tecnam P2008 JC MkII', engine: 'Rotax 912 S2 (100 pk)',
    massKg: 600, wingAreaM2: 14.8, powerW: 73500, propEta: 0.78, staticThrustN: 2300,
    cd0: 0.031, kInd: 0.078, clMaxClean: 1.35, clMaxFlaps: [1.35, 1.6, 1.85], flapCd0: [0, 0.015, 0.045], flapNames: ['UP', 'T/O', 'LDG'],
    // snelheden (KIAS) — bij benadering, raadpleeg de POH
    vs0: 39, vs1: 45, vfe: 75, vfeTo: 93, vno: 108, vne: 146, va: 100, vx: 60, vy: 69, vr: 50, vapp: 62, vglide: 65,
    fuelTankL: 62, fuelUsablePerTank: 60, // liter
    bankRateMax: 40, pitchRateMax: 10,
  };

  // ---------- starttoestand ----------
  function initialState() {
    const home = NAV.HOME;
    return {
      t: 0, paused: false, rate: 1, frame: 0,
      ac: {
        lat: home.lat, lon: home.lon, alt: home.elev, hdg: 60, pitch: 0, bank: 0, ias: 0, tas: 0, gs: 0, trk: 60, vs: 0, aoa: 2,
        onGround: true, flaps: 0, throttle: 0, elevator: 0, aileron: 0, rudder: 0, trim: 0, brakes: false, parkBrake: true,
        fuelL: 45, fuelR: 45, fuelSel: 'L', stall: false, crashed: false, gLoad: 1, slip: 0,
        fuelUsed: 0, odo: 0, maxGs: 0, flightTime: 0, airborneTime: 0,
      },
      eng: { running: false, rpm: 0, oilT: 20, oilP: 0, cht: 20, egt1: 20, egt2: 20, ff: 0, fuelP: 0, volts: 12.4, amps: 0, master: false, hobbs: 1234.5, starterT: 0 },
      env: { qnh: 1018, oatSea: 15, windDir: 240, windSpd: 8, turb: 0.3, gustT: 0, gustV: 0, utcOffset: 2 },
      fail: { ahrs: false, adc: false, gps: false, alternator: false, oilPress: false, chtHigh: false, engine: false, com1: false, nav1: false, pitot: false, fuelLeak: false, engineRough: false, display: false, vacuum: false },
      cmds: { pitchRate: 0, rollRate: 0, yaw: 0 },
    };
  }

  // ---------- lucht ----------
  function airData(S) {
    const a = S.ac, e = S.env;
    const oat = e.oatSea - 1.98 * a.alt / 1000;
    const sigma = U.densityRatio(a.alt, oat);
    return { oat, sigma, rho: 1.225 * sigma };
  }

  // ---------- motor ----------
  function stepEngine(S, dt) {
    const a = S.ac, E = S.eng, F = S.fail, { oat } = airData(S);
    const fuelAvail = (a.fuelSel === 'L' && a.fuelL > 0.3) || (a.fuelSel === 'R' && a.fuelR > 0.3) || (a.fuelSel === 'BOTH' && (a.fuelL + a.fuelR) > 0.3);
    if (E.running && (!fuelAvail || F.engine)) E.running = false;
    if (E.starterT > 0) {
      E.starterT -= dt;
      if (E.starterT <= 0 && fuelAvail && !F.engine && E.master) E.running = true;
    }
    const thr = E.running ? a.throttle : 0;
    const rpmTarget = E.running ? U.clamp(1450 + thr * (3700 + 9 * a.ias) * (F.engineRough ? 0.9 + 0.08 * Math.sin(S.t * 7) : 1), 1400, 5800) : (E.starterT > 0 ? 300 : (a.ias > 60 && !a.onGround ? 1000 : 0));
    E.rpm = U.approach(E.rpm, rpmTarget, 2500, dt);
    const sat = E.running ? thr : 0;
    const cool = a.ias * (a.onGround ? 0.5 : 1);
    const oilTT = E.running || E.rpm > 500 ? U.clamp(72 + 55 * sat - 0.15 * cool + 0.4 * (oat - 15) + (F.chtHigh ? 15 : 0), 40, 150) : Math.max(oat, E.oilT - 0.02 * dt);
    E.oilT = U.approach(E.oilT, oilTT, 0.35, dt);
    const chtT = E.running || E.rpm > 500 ? U.clamp(62 + 50 * sat - 0.12 * cool + 0.4 * (oat - 15) + (F.chtHigh ? 35 : 0), 40, 160) : Math.max(oat, E.cht - 0.02 * dt);
    E.cht = U.approach(E.cht, chtT, 0.4, dt);
    const egtT = E.running ? 520 + 340 * sat : Math.max(oat, E.egt1 - 1 * dt);
    E.egt1 = U.approach(E.egt1, egtT + 8 * Math.sin(S.t * 0.3), 25, dt);
    E.egt2 = U.approach(E.egt2, egtT - 12 + 6 * Math.cos(S.t * 0.4), 25, dt);
    let oilP = E.rpm > 300 ? U.clamp(1.4 + E.rpm / 1900 - (E.oilT - 90) * 0.012, 0, 6) : 0;
    if (F.oilPress) oilP = Math.max(0, oilP - (S.fail.oilPressT = (S.fail.oilPressT || 0) + dt * 0.02));
    E.oilP = U.approach(E.oilP, oilP, 2, dt);
    E.ff = E.running ? 2.6 + 22 * Math.pow(sat, 1.3) + (F.fuelLeak ? 12 : 0) : 0;
    E.fuelP = E.running || E.master ? (fuelAvail ? 0.32 + 0.02 * Math.sin(S.t) : 0.05) : 0;
    const altOk = E.running && E.rpm > 1300 && !F.alternator && E.master;
    E.volts = U.approach(E.volts, altOk ? 14.1 : (E.master ? Math.max(10.5, 12.4 - (S.t - (S.batT || 0)) * 0.0005) : 0), 1.5, dt);
    if (altOk) S.batT = S.t;
    E.amps = U.approach(E.amps, altOk ? 6 + (S.loadAmps || 0) : (E.master ? -(9 + (S.loadAmps || 0)) : 0), 10, dt);
    // brandstofverbruik
    if (E.running) {
      const litres = E.ff / 3600 * dt;
      if (a.fuelSel === 'L') a.fuelL = Math.max(0, a.fuelL - litres);
      else if (a.fuelSel === 'R') a.fuelR = Math.max(0, a.fuelR - litres);
      else if (a.fuelSel === 'BOTH') { a.fuelL = Math.max(0, a.fuelL - litres / 2); a.fuelR = Math.max(0, a.fuelR - litres / 2); }
      a.fuelUsed += litres;
      E.hobbs += dt / 3600;
    }
  }

  // ---------- vluchtmodel ----------
  function stepFlight(S, dt) {
    const a = S.ac, E = S.eng, env = S.env, { rho, sigma } = airData(S);
    const g = 9.81, m = AC.massKg, W = m * g, Sw = AC.wingAreaM2;
    const Vms = Math.max(a.tas * U.KT_MS, 0.1);
    // turbulentie / windstoten
    env.gustT -= dt;
    if (env.gustT <= 0) { env.gustT = U.rnd(2, 8); env.gustV = U.rnd(-1, 1) * env.turb; }
    const turbP = a.onGround ? 0 : env.gustV * 1.5 * Math.sin(S.t * 1.7) + env.turb * 0.6 * Math.sin(S.t * 3.1 + 1);
    const turbR = a.onGround ? 0 : env.gustV * 3 * Math.cos(S.t * 1.3) + env.turb * 1.2 * Math.sin(S.t * 2.3);

    // stuurcommando's -> pitch- en rolsnelheden
    const pr = S.cmds.pitchRate, rr = S.cmds.rollRate;
    if (!a.onGround) {
      a.pitch = U.clamp(a.pitch + (pr + turbP * 0.3) * dt, -60, 60);
      a.bank = U.norm180(a.bank + (rr + turbR * 0.5) * dt);
      // lichte spiraal-/langsstabiliteit
      if (Math.abs(rr) < 0.1) a.bank = U.approach(a.bank, 0, 0.8, dt);
    }

    // aerodynamica
    const q = 0.5 * rho * Vms * Vms;
    const clMax = AC.clMaxFlaps[a.flaps];
    const nz = a.onGround ? 1 : 1 / Math.max(0.3, Math.cos(a.bank * U.DEG));
    let clReq = (W * nz) / Math.max(q * Sw, 1e-3);
    if (a.onGround) clReq = Math.min(clReq, 0.4 + 0.06 * Math.max(0, a.pitch)); // op de grond draagt de vleugel (bijna) niet
    a.stall = false;
    let extraSink = 0;
    if (!a.onGround && clReq > clMax) {
      a.stall = true;
      extraSink = (clReq / clMax - 1) * 1800; // fpm
      clReq = clMax;
      a.pitch -= 6 * dt; // neus zakt
      a.bank += (Math.random() - 0.5) * 20 * dt;
    }
    const alpha = -2 + clReq / 0.095; // graden
    a.aoa = alpha;
    const cd = AC.cd0 + AC.flapCd0[a.flaps] + AC.kInd * clReq * clReq + (a.brakes && a.onGround ? 0.02 : 0);
    const D = cd * q * Sw;
    const T = E.running ? Math.min(AC.staticThrustN * sigma, AC.propEta * AC.powerW * a.throttle * sigma / Math.max(Vms, 12)) * (S.fail.engineRough ? 0.75 : 1) : (E.rpm > 500 ? -80 : -120) * (Vms > 1 ? 1 : 0);

    let gamma; // baanhoek
    if (a.onGround) {
      gamma = 0;
      const roll = 0.03 * W + (a.brakes ? 0.35 * W * (Vms > 0.5 ? 1 : 0) : 0) + (a.parkBrake ? 0.5 * W : 0);
      let acc = (T - D - (Vms > 0.2 ? roll : Math.min(roll, Math.max(0, T - D)))) / m;
      let v = Math.max(0, Vms + acc * dt);
      if (Vms < 0.2 && T - D < roll) v = 0;
      if (S.parked) v = 0; // verkenmodus: het toestel blijft stilstaan (wielblokken)
      a.tas = v / U.KT_MS;
      // rotatie
      const liftOk = 0.5 * rho * v * v * Sw * clMax * 0.92 > W;
      if (!S.parked && S.cmds.pitchRate > 0 && a.tas > AC.vr - 6) a.pitch = U.clamp(a.pitch + 4 * dt, 0, 10);
      else a.pitch = U.approach(a.pitch, 0, 6, dt);
      a.bank = U.approach(a.bank, 0, 20, dt);
      // grondsturing
      a.hdg = U.norm360(a.hdg + S.cmds.yaw * U.clamp(a.tas / 15, 0, 1.4) * 30 * dt);
      if (liftOk && a.pitch > 3) { a.onGround = false; a.vs = 150; a.alt += 1.5; }
      a.vs = a.onGround ? 0 : a.vs;
    } else {
      gamma = a.pitch - alpha;
      const acc = (T - D) / m - g * Math.sin(gamma * U.DEG);
      a.tas = Math.max(20, (Vms + acc * dt) / U.KT_MS);
      const vsTarget = a.tas * 101.27 * Math.sin(gamma * U.DEG) - extraSink;
      a.vs = U.approach(a.vs, vsTarget, 2500, dt);
      // bocht
      const turnRate = (g * Math.tan(a.bank * U.DEG)) / Math.max(Vms, 15) / U.DEG;
      a.hdg = U.norm360(a.hdg + turnRate * dt);
      a.gLoad = nz;
      a.slip = U.clamp(-S.cmds.yaw * 0.6 + a.bank * 0.004 * Math.sign(turnRate) , -1, 1);
    }
    a.ias = a.tas * Math.sqrt(sigma);
    if (S.fail.pitot) a.iasShown = Math.max(0, (a.iasShown ?? a.ias) - 5 * dt); else a.iasShown = a.ias;

    // grondsnelheid en positie (wind)
    const wx = -env.windSpd * Math.sin(env.windDir * U.DEG), wy = -env.windSpd * Math.cos(env.windDir * U.DEG);
    const vx = a.tas * Math.sin(a.hdg * U.DEG) + (a.onGround ? 0 : wx), vy = a.tas * Math.cos(a.hdg * U.DEG) + (a.onGround ? 0 : wy);
    a.gs = Math.hypot(vx, vy);
    a.trk = a.gs > 2 ? U.norm360(Math.atan2(vx, vy) / U.DEG) : a.hdg;
    const dNm = a.gs * dt / 3600;
    if (dNm > 0) { const p = U.dest(a, a.trk, dNm); a.lat = p.lat; a.lon = p.lon; a.odo += dNm; }
    a.maxGs = Math.max(a.maxGs, a.gs);

    // hoogte
    const terrain = NAV.terrainFt(a.lat, a.lon);
    const apt = nearestRunwayElev(a);
    const groundElev = apt != null ? apt : terrain;
    if (!a.onGround) {
      a.alt += a.vs * dt / 60;
      a.airborneTime += dt;
      if (a.alt <= groundElev && a.vs <= 0) {
        a.alt = groundElev;
        const hard = a.vs < -700 || Math.abs(a.bank) > 12 || apt == null || a.tas > 90;
        a.onGround = true; a.vs = 0; a.pitch = Math.max(0, Math.min(a.pitch, 3)); a.bank = 0;
        if (hard) { a.crashed = true; }
        if (apt == null) a.crashed = true;
      }
    } else {
      a.alt = groundElev;
    }
    a.agl = a.alt - terrain;
    a.flightTime += dt;
  }

  // hoogte van het dichtstbijzijnde veld als we er 'boven' zijn (binnen 0.8 nm), anders null
  function nearestRunwayElev(a) {
    let best = null, bd = 0.8;
    for (const ap of NAV.AIRPORTS) {
      const d = U.distNm(a, ap);
      if (d < bd) { bd = d; best = ap.elev; }
    }
    return best;
  }

  // ---------- publieke API ----------
  const SIM = {
    AC, S: initialState(), initialState,
    reset(opts = {}) {
      const S = SIM.S = initialState();
      Object.assign(S.env, opts.env || {});
      if (opts.airborne) {
        const a = S.ac;
        Object.assign(a, { lat: opts.lat, lon: opts.lon, alt: opts.alt, hdg: opts.hdg, trk: opts.hdg, ias: opts.ias || 95, tas: opts.ias || 95, onGround: false, parkBrake: false, throttle: opts.throttle ?? 0.72, fuelL: opts.fuelL ?? 40, fuelR: opts.fuelR ?? 40, fuelSel: opts.fuelSel || 'L', pitch: 2 });
        Object.assign(S.eng, { running: true, master: true, rpm: 4900, oilT: 95, oilP: 3.8, cht: 88, egt1: 760, egt2: 750, volts: 14.1, amps: 7, ff: 17 });
        if (opts.flaps != null) a.flaps = opts.flaps;
      } else {
        const a = S.ac;
        if (opts.lat != null) { a.lat = opts.lat; a.lon = opts.lon; a.alt = opts.alt ?? a.alt; a.hdg = opts.hdg ?? a.hdg; a.trk = a.hdg; }
        if (opts.fuelL != null) { a.fuelL = opts.fuelL; a.fuelR = opts.fuelR; }
        if (opts.engineRunning) { Object.assign(S.eng, { running: true, master: true, rpm: 1500, oilT: 60, oilP: 2.4, cht: 55, egt1: 540, egt2: 530, volts: 14.0, amps: 5, ff: 3 }); }
      }
      if (opts.fail) Object.assign(S.fail, opts.fail);
      S.parked = !!opts.parked;
      // motor laten stabiliseren bij de ingestelde gasstand, zodat meters en vragen bij de start kloppen
      if (S.eng.running) for (let i = 0; i < 400; i++) stepEngine(S, 0.5);
      return S;
    },
    airData,
    step(dtReal) {
      const S = SIM.S;
      if (S.paused) return;
      let total = dtReal * S.rate;
      while (total > 0) {
        const dt = Math.min(0.04, total); total -= dt;
        S.t += dt; S.frame++;
        stepEngine(S, dt);
        stepFlight(S, dt);
        if (S.ac.crashed) S.paused = true;
      }
    },
    // bediening
    setThrottle(v) { SIM.S.ac.throttle = U.clamp(v, 0, 1); },
    setFlaps(i) { SIM.S.ac.flaps = U.clamp(i, 0, 2); },
    startEngine() { const S = SIM.S; if (!S.eng.master) return 'Master schakelaar staat uit'; if (S.eng.running) return 'Motor loopt al'; S.eng.starterT = 1.6; return null; },
    stopEngine() { SIM.S.eng.running = false; },
    toggleMaster() { const S = SIM.S; S.eng.master = !S.eng.master; if (!S.eng.master) S.eng.running = false; },
    setFuelSel(sel) { SIM.S.ac.fuelSel = sel; },
    // geïndiceerde hoogte bij de gekozen baro-instelling
    indicatedAlt(baroHpa) { const S = SIM.S; return S.ac.alt + (baroHpa - S.env.qnh) * 27; },
    pressureAlt() { const S = SIM.S; return S.ac.alt + (1013.25 - S.env.qnh) * 27; },
    oat() { return airData(SIM.S).oat; },
    windAt() { const e = SIM.S.env; return { dir: e.windDir, spd: e.windSpd }; },
    // storingen inschakelen/uitschakelen
    setFail(name, on) { SIM.S.fail[name] = !!on; if (name === 'oilPress' && !on) SIM.S.fail.oilPressT = 0; },
    // "Goede toestand" herstellen (reset temperaturen etc.)
    place(lat, lon, altFt, hdg, ias) {
      const a = SIM.S.ac;
      Object.assign(a, { lat, lon, alt: altFt, hdg, trk: hdg, ias, tas: ias, onGround: false, vs: 0, pitch: 2, bank: 0, crashed: false });
      SIM.S.paused = false;
    }
  };
  G3X.sim = SIM;
})();

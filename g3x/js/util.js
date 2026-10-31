/* Hulpfuncties: wiskunde, geodesie, willekeur, opmaak.
   Alles in één globaal object G3X.util, geen modules zodat het ook via file:// werkt. */
window.G3X = window.G3X || {};
(function () {
  const U = {};
  const R = Math.PI / 180;
  U.DEG = R;
  U.NM_M = 1852;
  U.FT_M = 0.3048;
  U.KT_MS = 0.514444;
  U.EARTH_NM = 3440.065;

  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.norm360 = d => ((d % 360) + 360) % 360;
  U.norm180 = d => { d = U.norm360(d); return d > 180 ? d - 360 : d; };
  U.round = (v, s) => Math.round(v / s) * s;
  U.pad = (n, w, c = '0') => String(n).padStart(w, c);
  U.sign = v => (v < 0 ? -1 : 1);
  U.approach = (cur, target, rate, dt) => {
    const d = target - cur;
    const step = rate * dt;
    return Math.abs(d) <= step ? target : cur + Math.sign(d) * step;
  };
  U.approachAngle = (cur, target, rate, dt) => {
    const d = U.norm180(target - cur);
    const step = rate * dt;
    return U.norm360(Math.abs(d) <= step ? target : cur + Math.sign(d) * step);
  };

  // ---------- geodesie (bol) ----------
  U.distNm = (a, b) => {
    const dLat = (b.lat - a.lat) * R, dLon = (b.lon - a.lon) * R;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * R) * Math.cos(b.lat * R) * Math.sin(dLon / 2) ** 2;
    return 2 * U.EARTH_NM * Math.asin(Math.sqrt(s));
  };
  U.bearing = (a, b) => {
    const la1 = a.lat * R, la2 = b.lat * R, dLon = (b.lon - a.lon) * R;
    const y = Math.sin(dLon) * Math.cos(la2);
    const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
    return U.norm360(Math.atan2(y, x) / R);
  };
  U.dest = (a, brg, dNm) => {
    const d = dNm / U.EARTH_NM, la1 = a.lat * R, lo1 = a.lon * R, th = brg * R;
    const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(th));
    const lo2 = lo1 + Math.atan2(Math.sin(th) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
    return { lat: la2 / R, lon: ((lo2 / R + 540) % 360) - 180 };
  };
  // dwarsafstand (nm, + = rechts van koerslijn) en langsafstand van punt p t.o.v. lijn a->b
  U.xtk = (a, b, p) => {
    const d13 = U.distNm(a, p) / U.EARTH_NM;
    const t13 = U.bearing(a, p) * R, t12 = U.bearing(a, b) * R;
    const xt = Math.asin(Math.sin(d13) * Math.sin(t13 - t12));
    const at = Math.acos(U.clamp(Math.cos(d13) / Math.max(1e-9, Math.cos(xt)), -1, 1));
    const along = at * U.EARTH_NM * (Math.cos(t13 - t12) < 0 ? -1 : 1);
    return { xtk: xt * U.EARTH_NM, along };
  };
  // lokale vlakke projectie rond een referentiepunt (nm oost/noord)
  U.toXY = (ref, p) => ({
    x: (p.lon - ref.lon) * 60 * Math.cos(ref.lat * R),
    y: (p.lat - ref.lat) * 60
  });
  U.fromXY = (ref, x, y) => ({
    lat: ref.lat + y / 60,
    lon: ref.lon + x / (60 * Math.cos(ref.lat * R))
  });

  // ---------- willekeur ----------
  // willekeur, met optioneel zaad zodat een scenario exact herhaald kan worden (mulberry32)
  U.random = Math.random;
  U.seeded = seed => { let t = seed >>> 0; return () => { t = (t + 0x6D2B79F5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; };
  U.withSeed = (seed, fn) => { const prev = U.random; U.random = U.seeded(seed); try { return fn(); } finally { U.random = prev; } };
  U.rnd = (a, b) => a + U.random() * (b - a);
  U.rndInt = (a, b) => Math.floor(U.rnd(a, b + 1));
  U.pick = arr => arr[Math.floor(U.random() * arr.length)];
  U.shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(U.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  U.chance = p => U.random() < p;

  // ---------- opmaak ----------
  U.fmtFreq = f => f.toFixed(3);
  U.fmtNav = f => f.toFixed(2);
  U.fmtHdg = h => U.pad(Math.round(U.norm360(h)) % 360 || 360, 3);
  U.fmtHdg0 = h => U.pad(Math.round(U.norm360(h)) % 360, 3);
  U.fmtDis = d => (d < 10 ? d.toFixed(1) : Math.round(d).toString());
  U.fmtEte = min => {
    if (!isFinite(min) || min < 0) return '__:__';
    if (min >= 600) return '>9:59';
    const h = Math.floor(min / 60), m = Math.floor(min % 60), s = Math.floor((min * 60) % 60);
    return h > 0 ? `${h}:${U.pad(m, 2)}` : `${U.pad(m, 2)}:${U.pad(s, 2)}`;
  };
  U.fmtTime = (d, utc) => {
    const h = utc ? d.getUTCHours() : d.getHours(), m = utc ? d.getUTCMinutes() : d.getMinutes(), s = utc ? d.getUTCSeconds() : d.getSeconds();
    return `${U.pad(h, 2)}:${U.pad(m, 2)}:${U.pad(s, 2)}`;
  };
  U.fmtTimer = sec => {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return `${U.pad(h, 2)}:${U.pad(m, 2)}:${U.pad(s, 2)}`;
  };
  U.fmtLat = lat => `${lat >= 0 ? 'N' : 'S'}${U.pad(Math.floor(Math.abs(lat)), 2)}°${(Math.abs(lat) % 1 * 60).toFixed(2).padStart(5, '0')}'`;
  U.fmtLon = lon => `${lon >= 0 ? 'E' : 'W'}${U.pad(Math.floor(Math.abs(lon)), 3)}°${(Math.abs(lon) % 1 * 60).toFixed(2).padStart(5, '0')}'`;
  U.hpaToInhg = h => h / 33.8639;
  U.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // 8.33 kHz COM-kanalen: geldige eindcijfers per 25 kHz-blok
  U.COM_STEPS = [0, 0.005, 0.010, 0.015];
  U.comChannels = () => {
    const out = [];
    for (let k = 118000; k < 137000; k += 25) for (const s of [0, 5, 10, 15]) out.push((k + s) / 1000);
    return out;
  };
  U.isValidCom = f => {
    const k = Math.round(f * 1000);
    if (k < 118000 || k > 136990) return false;
    const r = k % 25;
    return r === 0 || r === 5 || r === 10 || r === 15;
  };
  U.isValidNav = f => {
    const k = Math.round(f * 100);
    return k >= 10800 && k <= 11795 && k % 5 === 0;
  };
  U.isLocFreq = f => {
    const k = Math.round(f * 100);
    return k >= 10810 && k <= 11195 && (Math.floor(k / 10) % 2 === 1);
  };
  U.nextCom = (f, dir, big) => {
    const k = Math.round(f * 1000);
    let n;
    if (big) n = k + dir * 1000;
    else {
      const base = Math.floor(k / 25) * 25, r = k - base;
      const steps = [0, 5, 10, 15];
      let i = steps.indexOf(r); if (i < 0) i = 0;
      i += dir;
      if (i < 0) n = base - 25 + 15; else if (i > 3) n = base + 25; else n = base + steps[i];
    }
    if (n < 118000) n += 19000; if (n > 136990) n -= 19000;
    return n / 1000;
  };
  U.nextNav = (f, dir, big) => {
    let k = Math.round(f * 100) + dir * (big ? 100 : 5);
    if (k < 10800) k = 11795 - (10800 - k) + 5; if (k > 11795) k = 10800 + (k - 11795) - 5;
    return k / 100;
  };

  // morse voor ident-weergave
  const MORSE = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..' };
  U.morse = s => s.toUpperCase().split('').map(c => MORSE[c] || '').join(' ');

  // ISA
  U.isaTemp = altFt => 15 - 1.98 * altFt / 1000;
  U.densityRatio = (altFt, oatC) => {
    const p = Math.pow(1 - 6.8756e-6 * altFt, 5.2559);
    const tIsa = U.isaTemp(altFt) + 273.15;
    return p * tIsa / (oatC + 273.15);
  };

  G3X.util = U;
})();

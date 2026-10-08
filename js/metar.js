// METAR- en TAF-oefeningen: de site maakt telkens een nieuw, realistisch weerbericht voor een Belgisch vliegveld
// en vraagt wat een bepaald deel betekent of wat je ermee moet doen.
// Werkt zoals de rekenvragen: elke generator geeft { q, o: [juist, fout, fout, fout], e, code, mark, ... } terug.
// code = het weerbericht (wordt in een kader getoond), mark = het deel dat gemarkeerd wordt.

window.METAR = (function () {
  'use strict';

  // ---------- helpers ----------
  const rnd = (min, max, step = 1) => min + step * Math.floor(Math.random() * (Math.floor((max - min) / step) + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pad = (v, n = 2) => String(v).padStart(n, '0');
  const norm = d => ((Math.round(d) % 360) + 360) % 360;
  const diff = (a, b) => { let d = norm(a - b); if (d > 180) d -= 360; return d; };
  const sec = (h, t) => `**${h}**\n${t}\n`;
  const nl = n => String(n).replace('.', ',');

  function Q(o) {
    return {
      q: o.q, o: o.o, c: 0, e: o.e, src: o.src || 'met', ref: o.ref || 'Bijlage V (Part-MET) / ICAO Annex 3 – METAR/TAF-codes',
      lo: o.lo || '', loText: o.loText || '', img: [], review: false, calc: true,
      code: o.code, mark: o.mark || ''
    };
  }

  // Vier unieke opties, de juiste eerst.
  function opts(correct, wrong, fallback = []) {
    const out = [correct];
    for (const w of [...wrong, ...fallback]) if (w && !out.includes(w) && out.length < 4) out.push(w);
    return out;
  }

  // ---------- vliegvelden ----------
  const AIRPORTS = [
    { icao: 'EBBR', name: 'Brussel', rwys: [[25, 7], [1, 19]] },
    { icao: 'EBAW', name: 'Antwerpen', rwys: [[11, 29]] },
    { icao: 'EBOS', name: 'Oostende', rwys: [[8, 26]] },
    { icao: 'EBCI', name: 'Charleroi', rwys: [[7, 25]] },
    { icao: 'EBLG', name: 'Luik', rwys: [[4, 22]] },
    { icao: 'EBKT', name: 'Kortrijk-Wevelgem', rwys: [[6, 24]] }
  ];

  // ---------- betekenis van de codes ----------
  const COVER = {
    FEW: { nl: 'weinig wolken (few)', okta: '1–2 achtsten' },
    SCT: { nl: 'verspreide wolken (scattered)', okta: '3–4 achtsten' },
    BKN: { nl: 'zwaar bewolkt (broken)', okta: '5–7 achtsten' },
    OVC: { nl: 'geheel bewolkt (overcast)', okta: '8 achtsten' }
  };
  const coverText = (cov, h, type) => `${COVER[cov].nl}, ${COVER[cov].okta}, basis op ${(h * 100)} ft boven het vliegveld${type === 'CB' ? ', met cumulonimbus (onweerswolken)' : type === 'TCU' ? ', met torenvormige cumulus (TCU)' : ''}`;

  const WX = {
    '-RA': 'lichte regen', 'RA': 'matige regen', '+RA': 'zware regen',
    '-DZ': 'lichte motregen', 'DZ': 'matige motregen',
    '-SHRA': 'lichte regenbuien', 'SHRA': 'matige regenbuien', '+SHRA': 'zware regenbuien',
    'TSRA': 'onweer met matige regen', '+TSRA': 'onweer met zware regen', '-TSRA': 'onweer met lichte regen',
    '-SN': 'lichte sneeuw', 'SN': 'matige sneeuw', '-SHSN': 'lichte sneeuwbuien',
    '-FZDZ': 'lichte onderkoelde motregen', '-FZRA': 'lichte onderkoelde regen',
    'BR': 'nevel (zicht 1000 tot 5000 m)', 'FG': 'mist (zicht onder 1000 m)', 'BCFG': 'mistbanken', 'MIFG': 'ondiepe mist (grondmist)',
    'HZ': 'heiigheid (droge deeltjes)', 'VCSH': 'buien in de omgeving (8 tot 16 km van het vliegveld)', 'FZFG': 'onderkoelde mist (aanvriezende mist)'
  };
  // Hoe je een weercode opbouwt (voor de uitleg)
  const WX_PARTS = [
    ['-', 'licht'], ['+', 'zwaar'], ['VC', 'in de omgeving (vicinity)'], ['MI', 'ondiep (shallow)'], ['BC', 'banken (patches)'],
    ['SH', 'buien (showers)'], ['TS', 'onweer (thunderstorm)'], ['FZ', 'onderkoeld (freezing)'],
    ['RA', 'regen (rain)'], ['DZ', 'motregen (drizzle)'], ['SN', 'sneeuw (snow)'], ['BR', 'nevel (brume)'], ['FG', 'mist (fog)'], ['HZ', 'heiigheid (haze)']
  ];
  function wxBuild(code) {
    let rest = code, parts = [];
    if (rest[0] === '-' || rest[0] === '+') { parts.push(`${rest[0]} = ${rest[0] === '-' ? 'licht' : 'zwaar'}`); rest = rest.slice(1); }
    else if (!/^(BR|FG|HZ|BCFG|MIFG|VCSH|FZFG)$/.test(code)) parts.push('geen teken = matig');
    while (rest.length) {
      const p = WX_PARTS.find(([k]) => k.length === 2 && rest.startsWith(k));
      if (!p) break;
      parts.push(`${p[0]} = ${p[1]}`);
      rest = rest.slice(2);
    }
    return parts.join(' · ');
  }

  // ---------- weerbericht maken ----------
  // type: cavok | fair | rain | showers | ts | mist | fog | drizzle | snow
  function makeWeather(type, force = {}) {
    const ap = force.ap || pick(AIRPORTS);
    const w = { ap, type, day: rnd(1, 28), hh: rnd(0, 23), mm: pick([20, 50]) };
    const winter = type === 'snow' || Math.random() < 0.3;

    // Wind
    const calmish = type === 'fog' || type === 'mist';
    const spd = force.spd != null ? force.spd : calmish ? rnd(0, 5) : rnd(4, type === 'ts' || type === 'showers' ? 22 : 18);
    w.wind = { dir: force.dir != null ? force.dir : rnd(1, 36) * 10, spd };
    if (spd === 0) w.wind.calm = true;
    else if (spd <= 2 && !force.noVrb) w.wind.vrb = true;
    if (force.gust || (spd >= 12 && Math.random() < 0.45)) w.wind.gust = spd + rnd(10, 16);
    if (force.variable || (!w.wind.calm && !w.wind.vrb && spd >= 3 && Math.random() < 0.15)) {
      const span = rnd(6, 10) * 10, from = norm(Math.round((w.wind.dir - span / 2) / 10) * 10);
      w.wind.varFrom = from || 360; w.wind.varTo = norm(from + span) || 360;
    }

    // Zicht, weer en wolken per type
    w.wx = []; w.clouds = [];
    const lowBase = rnd(4, 14), midBase = rnd(15, 45);
    switch (type) {
      case 'cavok': w.cavok = true; break;
      case 'fair':
        w.vis = 9999;
        if (Math.random() < 0.2) w.nsc = true;
        else { w.clouds.push({ cov: pick(['FEW', 'SCT']), h: rnd(20, 45) }); if (Math.random() < 0.5) w.clouds.push({ cov: pick(['SCT', 'BKN']), h: rnd(50, 120, 5) }); }
        break;
      case 'rain':
        w.vis = pick([9999, 8000, 7000, 6000, 5000, 4000]); w.wx.push(pick(['-RA', 'RA', 'RA', '+RA']));
        if (w.wx[0] === '+RA') w.vis = pick([3000, 2500, 2000]);
        w.clouds.push({ cov: pick(['SCT', 'BKN']), h: lowBase }, { cov: pick(['BKN', 'OVC']), h: Math.max(lowBase + 6, midBase) });
        break;
      case 'showers':
        w.vis = pick([9999, 9999, 8000, 6000, 4000]); w.wx.push(pick(['-SHRA', 'SHRA', '+SHRA', 'VCSH']));
        w.clouds.push({ cov: 'FEW', h: rnd(12, 25), type: pick(['CB', 'TCU']) }, { cov: pick(['SCT', 'BKN']), h: rnd(30, 45) });
        break;
      case 'ts':
        w.vis = pick([9999, 6000, 4000, 3000]); w.wx.push(pick(['TSRA', 'TSRA', '+TSRA', '-TSRA']));
        w.clouds.push({ cov: pick(['SCT', 'BKN']), h: rnd(15, 35), type: 'CB' }, { cov: 'BKN', h: rnd(50, 80, 5) });
        break;
      case 'mist':
        w.vis = rnd(12, 45) * 100; w.wx.push(pick(['BR', 'BR', 'HZ']));
        if (w.wx[0] === 'HZ') w.vis = rnd(30, 50) * 100;
        w.clouds.push({ cov: pick(['BKN', 'OVC']), h: rnd(3, 10) });
        break;
      case 'fog':
        w.vis = pick([100, 150, 200, 300, 400, 500, 600, 700, 800]); w.wx.push(pick(['FG', 'FG', 'BCFG', 'MIFG', 'FZFG']));
        if (w.wx[0] === 'BCFG' || w.wx[0] === 'MIFG') { w.vis = pick([1500, 2000, 3000, 4000]); w.clouds.push({ cov: 'FEW', h: rnd(2, 6) }); }
        else if (Math.random() < 0.5) w.vv = rnd(1, 3); else w.clouds.push({ cov: 'OVC', h: rnd(1, 3) });
        break;
      case 'drizzle':
        w.vis = pick([5000, 4000, 3000, 2500]); w.wx.push(pick(['-DZ', 'DZ', '-FZDZ']));
        w.clouds.push({ cov: 'OVC', h: rnd(3, 8) });
        break;
      case 'snow':
        w.vis = pick([4000, 3000, 2000, 1500, 1200]); w.wx.push(pick(['-SN', 'SN', '-SHSN', '-FZRA']));
        w.clouds.push({ cov: pick(['BKN', 'OVC']), h: rnd(5, 15) });
        break;
    }
    if (force.vis != null) { w.vis = force.vis; w.cavok = false; }
    if (force.clouds) { w.clouds = force.clouds; w.nsc = false; w.vv = null; w.cavok = false; }
    // Zicht en weer moeten bij elkaar passen
    if (!w.cavok) {
      if (w.vis >= 1000) w.wx = w.wx.map(x => x === 'FG' || x === 'FZFG' ? 'BR' : x);
      if (w.vis > 5000) w.wx = w.wx.filter(x => x !== 'BR' && x !== 'HZ');
      if (w.vis >= 8000) w.wx = w.wx.map(x => x[0] === '+' ? x.slice(1) : x);
      if (w.vis < 1000 && !w.wx.some(x => /FG/.test(x))) w.wx = ['FG'];
      if (w.vis < 5000 && !w.wx.length) w.wx = ['BR'];
    }

    // Temperatuur en dauwpunt
    const needFrost = /FZ|SN/.test(w.wx.join(' '));
    let t = needFrost ? rnd(-6, 0) : winter ? rnd(-3, 9) : rnd(8, 27);
    let spread = type === 'fog' || type === 'drizzle' ? rnd(0, 1) : type === 'mist' ? rnd(0, 2) : type === 'rain' || type === 'snow' ? rnd(0, 3) : rnd(2, 12);
    if (force.t != null) t = force.t;
    if (force.spread != null) spread = force.spread;
    w.t = t; w.td = t - spread;

    // QNH
    w.qnh = type === 'cavok' || type === 'fair' ? rnd(1012, 1035) : type === 'ts' || type === 'showers' ? rnd(996, 1015) : rnd(985, 1022);

    // Trend
    w.trend = force.trend || (type === 'showers' ? pick(['NOSIG', `TEMPO ${pick([3000, 4000])} SHRA`, `TEMPO SHRA BKN0${rnd(12, 20)}CB`])
      : type === 'ts' ? pick(['NOSIG', 'TEMPO 3000 +TSRA', 'BECMG NSW'])
        : type === 'fog' ? pick(['NOSIG', 'BECMG 1500 BR', 'BECMG 3000 BR'])
          : type === 'rain' ? pick(['NOSIG', 'NOSIG', 'TEMPO 3000 RA BKN008', 'BECMG 9999 NSW'])
            : pick(['NOSIG', 'NOSIG', 'NOSIG', 'BECMG BKN015', 'TEMPO 4000 SHRA']));
    return w;
  }

  // ---------- naar tekst ----------
  const tok = {
    time: w => `${pad(w.day)}${pad(w.hh)}${pad(w.mm)}Z`,
    wind: w => w.wind.calm ? '00000KT' : `${w.wind.vrb ? 'VRB' : pad(w.wind.dir, 3)}${pad(w.wind.spd)}${w.wind.gust ? 'G' + pad(w.wind.gust) : ''}KT`,
    windVar: w => w.wind.varFrom != null ? `${pad(w.wind.varFrom, 3)}V${pad(w.wind.varTo, 3)}` : '',
    vis: w => w.cavok ? 'CAVOK' : pad(w.vis, 4),
    cloud: c => `${c.cov}${pad(c.h, 3)}${c.type || ''}`,
    clouds: w => w.cavok ? '' : w.vv != null ? `VV${pad(w.vv, 3)}` : w.nsc ? 'NSC' : w.clouds.map(tok.cloud).join(' '),
    temp: v => (v < 0 ? 'M' : '') + pad(Math.abs(v)),
    tt: w => `${tok.temp(w.t)}/${tok.temp(w.td)}`,
    qnh: w => `Q${pad(w.qnh, 4)}`
  };
  function metarText(w) {
    return ['METAR', w.ap.icao, tok.time(w), tok.wind(w), tok.windVar(w), tok.vis(w), ...(w.cavok ? [] : w.wx), tok.clouds(w), tok.tt(w), tok.qnh(w), w.trend]
      .filter(Boolean).join(' ');
  }

  // ---------- uitleg van het hele bericht ----------
  const visText = v => v >= 9999 ? '10 km of meer' : v >= 5000 ? `${v / 1000} km` : `${v} m`;
  const tempText = v => `${v < 0 ? '−' : ''}${Math.abs(v)} °C`;
  function windText(w) {
    if (w.wind.calm) return 'windstil';
    const base = w.wind.vrb ? `wisselende richting, ${w.wind.spd} kt` : `uit ${pad(w.wind.dir, 3)}° (t.o.v. het ware noorden), ${w.wind.spd} kt`;
    return base + (w.wind.gust ? `, windstoten tot ${w.wind.gust} kt` : '');
  }
  function trendText(tr) {
    if (tr === 'NOSIG') return 'geen significante verandering verwacht in de komende 2 uur';
    const [kind, ...rest] = tr.split(' ');
    const what = rest.map(x => x === 'NSW' ? 'einde van het significante weer (no significant weather)'
      : /^\d{4}$/.test(x) ? `zicht ${visText(+x)}` : WX[x] ? WX[x] : /^(FEW|SCT|BKN|OVC)\d{3}/.test(x) ? coverText(x.slice(0, 3), +x.slice(3, 6), x.slice(6)) : x).join(', ');
    return `${kind === 'TEMPO' ? 'tijdelijk' : 'geleidelijk en blijvend'} in de komende 2 uur: ${what}`;
  }
  function decode(w) {
    const rows = [
      ['METAR', 'routinewaarneming (Meteorological Aerodrome Report)'],
      [w.ap.icao, `ICAO-code van het vliegveld (${w.ap.name})`],
      [tok.time(w), `dag ${w.day} van de maand, ${pad(w.hh)}:${pad(w.mm)} UTC`],
      [tok.wind(w), `wind ${windText(w)}`]
    ];
    if (tok.windVar(w)) rows.push([tok.windVar(w), `windrichting wisselt tussen ${pad(w.wind.varFrom, 3)}° en ${pad(w.wind.varTo, 3)}°`]);
    if (w.cavok) rows.push(['CAVOK', 'zicht 10 km of meer, geen wolken onder 5000 ft (of de hoogste MSA), geen CB/TCU en geen significant weer']);
    else {
      rows.push([tok.vis(w), `zicht ${visText(w.vis)}`]);
      w.wx.forEach(x => rows.push([x, WX[x]]));
      if (w.vv != null) rows.push([`VV${pad(w.vv, 3)}`, `hemel onzichtbaar, verticaal zicht ${w.vv * 100} ft`]);
      else if (w.nsc) rows.push(['NSC', 'geen significante bewolking (geen wolken onder 5000 ft, geen CB/TCU)']);
      else w.clouds.forEach(c => rows.push([tok.cloud(c), coverText(c.cov, c.h, c.type)]));
    }
    rows.push([tok.tt(w), `temperatuur ${tempText(w.t)}, dauwpunt ${tempText(w.td)}`]);
    rows.push([tok.qnh(w), `QNH ${w.qnh} hPa`]);
    rows.push([w.trend, trendText(w.trend)]);
    return '**Het volledige bericht ontcijferd:**\n' + rows.map(([k, v]) => `${k} → ${v}`).join('\n');
  }

  // ---------- METAR ontcijferen ----------
  const LO = '30.10.3.1.4';
  const LOTXT = 'METAR en TAF lezen en interpreteren';
  const qText = mark => `Wat betekent "${mark}" in deze METAR?`;

  const metar = [
    {
      id: 'time', name: 'Datum en tijd',
      gen() {
        const w = makeWeather(pick(['fair', 'rain', 'cavok', 'showers']));
        let wrongDay; do { wrongDay = rnd(1, 28); } while (wrongDay === w.day);
        const m = tok.time(w), hhmm = `${pad(w.hh)}:${pad(w.mm)}`;
        const swapOk = w.hh >= 1 && w.hh !== w.day && w.day <= 23;
        const o = opts(`Dag ${w.day} van de maand, om ${hhmm} UTC`, shuffle([
          `Dag ${w.day} van de maand, om ${hhmm} Belgische (lokale) tijd`,
          swapOk ? `Dag ${w.hh} van de maand, om ${pad(w.day)}:${pad(w.mm)} UTC` : null,
          `Dag ${w.day} van de maand, geldig van ${hhmm} tot ${pad((w.hh + 1) % 24)}:${pad(w.mm)} UTC`,
          `Dag ${wrongDay} van de maand, om ${hhmm} UTC`
        ]));
        const e = [
          sec('Opbouw:', `${m} = DD HH MM Z: dag van de maand (${pad(w.day)}), uur (${pad(w.hh)}) en minuten (${pad(w.mm)}).`),
          sec('Z = Zulu = UTC:', 'Alle tijden in METAR en TAF staan in UTC. Belgische tijd = UTC + 1 uur in de winter en UTC + 2 uur in de zomer.'),
          sec('Goed om te weten:', 'Een METAR is een waarneming op dat tijdstip, geen voorspelling met een geldigheidsperiode. In België verschijnt een METAR meestal om :20 en :50 na het uur.'),
          decode(w)
        ].join('\n');
        return Q({ q: qText(m), o, e, code: metarText(w), mark: m, lo: LO, loText: LOTXT });
      }
    },
    {
      id: 'wind', name: 'Wind',
      gen() {
        const kind = pick(['normal', 'gust', 'gust', 'vrb', 'calm', 'var']);
        const w = makeWeather(pick(['fair', 'rain', 'showers', 'cavok']), {
          spd: kind === 'calm' ? 0 : kind === 'vrb' ? rnd(1, 2) : kind === 'gust' ? rnd(12, 20) : rnd(4, 15),
          gust: kind === 'gust', variable: kind === 'var', noVrb: kind !== 'vrb'
        });
        if (kind !== 'gust') delete w.wind.gust;
        if (kind !== 'var') { delete w.wind.varFrom; delete w.wind.varTo; }
        let m, o, e;
        if (kind === 'calm') {
          m = '00000KT';
          o = opts('Windstil', ['Wind uit het noorden (000°), minder dan 5 kt', 'Geen windmeting beschikbaar (sensor defect)', 'Wind uit wisselende richting, minder dan 3 kt']);
          e = sec('Windstil:', '00000KT betekent: richting 000 en snelheid 00 kt, dus geen wind. Een ontbrekende meting zou je als ///// zien.');
        } else if (kind === 'vrb') {
          m = tok.wind(w);
          o = opts(`Wisselende windrichting, ${w.wind.spd} kt`, [`Windstoten tot ${w.wind.spd} kt`, `Wisselende windrichting, ${w.wind.spd * 10} kt`, 'Windstil']);
          e = sec('VRB = variable:', `de richting is niet te bepalen of wisselt sterk; ${pad(w.wind.spd)} = ${w.wind.spd} kt. VRB zie je vooral bij zwakke wind (tot 3 kt) of bij onweer.`);
        } else if (kind === 'var') {
          m = tok.windVar(w);
          o = opts(`De windrichting wisselt tussen ${pad(w.wind.varFrom, 3)}° en ${pad(w.wind.varTo, 3)}°`, [
            `De windsnelheid wisselt tussen ${Math.round(w.wind.varFrom / 10)} en ${Math.round(w.wind.varTo / 10)} kt`,
            `De wind draait in het komende uur van ${pad(w.wind.varFrom, 3)}° naar ${pad(w.wind.varTo, 3)}°`,
            `Windstoten uit ${pad(w.wind.varFrom, 3)}° tot ${pad(w.wind.varTo, 3)}°, gemiddeld uit ${pad(w.wind.dir, 3)}°`
          ]);
          e = sec('dddVddd:', `de windrichting wisselt op dit moment tussen ${pad(w.wind.varFrom, 3)}° en ${pad(w.wind.varTo, 3)}°. Deze groep staat er alleen als de richting 60° of meer schommelt en de wind minstens 3 kt is. De gemiddelde wind staat ervoor: ${tok.wind(w)}.`);
        } else {
          m = tok.wind(w);
          const d = pad(w.wind.dir, 3), s = w.wind.spd, g = w.wind.gust;
          const tail = g ? `, gemiddeld ${s} kt, windstoten tot ${g} kt` : `, ${s} kt`;
          o = opts(`Wind uit ${d}° (ware noorden)${tail}`, [
            `Wind naar ${d}° (ware noorden)${tail}`,
            `Wind uit ${d}° (magnetisch noorden)${tail}`,
            g ? `Wind uit ${d}° (ware noorden), gemiddeld ${s} kt, windstoten van ${g} kt bovenop het gemiddelde (${s + g} kt)` : `Wind uit ${d}° (ware noorden), ${s} km/h`
          ]);
          e = [
            sec('Opbouw:', `${m} = richting ${d}°, snelheid ${pad(s)} kt${g ? `, G${g} = windstoten (gusts) tot ${g} kt` : ''}, KT = knopen.`),
            sec('Uit of naar?', 'De windrichting is altijd de richting waar de wind vandaan komt.'),
            sec('Waar of magnetisch?', 'In METAR en TAF is de windrichting t.o.v. het ware noorden. De toren en de ATIS geven de wind t.o.v. het magnetische noorden (in België scheelt dat maar 1 à 2°).')
          ].join('\n');
        }
        return Q({ q: qText(m), o, e: e + '\n' + decode(w), code: metarText(w), mark: m, lo: LO, loText: LOTXT });
      }
    },
    {
      id: 'vis', name: 'Zicht',
      gen() {
        const kind = pick(['9999', 'km', 'm', 'm']);
        const w = kind === '9999' ? makeWeather(pick(['fair', 'rain', 'showers']), { vis: 9999 })
          : kind === 'km' ? makeWeather(pick(['rain', 'mist', 'snow', 'drizzle']), { vis: pick([1500, 2500, 3000, 4000, 4500, 6000, 7000, 8000]) })
            : makeWeather('fog');
        if (kind === 'm' && w.vis >= 1000) w.vis = pick([200, 300, 500, 700, 800]), w.wx = ['FG'];
        const m = tok.vis(w), v = w.vis;
        let o;
        if (v >= 9999) o = opts('Zicht 10 km of meer', ['Zicht precies 9999 m', 'Zicht onbeperkt (meer dan 50 km)', 'Zicht niet gemeten']);
        else o = opts(`Zicht ${visText(v)}`, shuffle([`Zicht ${v} ft`, `Zicht ${nl(v / 100)} km`, `Wolkenbasis op ${v} ft`]));
        const e = [
          sec('Zicht in meter:', `het zicht staat altijd in 4 cijfers en in meter: ${m} = ${visText(v)}.`),
          sec('9999:', 'betekent 10 km of meer. Een hogere waarde wordt niet gemeld.'),
          v < 5000 && v < 9999 ? sec('Weer bij laag zicht:', `onder 5000 m moet de METAR ook zeggen waardoor het zicht beperkt is (hier ${w.wx.join(' ') || 'zie het weer'}).`) : '',
          decode(w)
        ].filter(Boolean).join('\n');
        return Q({ q: qText(m), o, e, code: metarText(w), mark: m, lo: LO, loText: LOTXT });
      }
    },
    {
      id: 'wx', name: 'Weer (neerslag, mist …)',
      gen() {
        const w = makeWeather(pick(['rain', 'showers', 'ts', 'mist', 'fog', 'drizzle', 'snow']));
        const m = w.wx[0];
        // Foute antwoorden: zelfde soort weer met andere intensiteit of een verwante code
        const near = {
          '-RA': ['RA', '-DZ', '-SHRA'], 'RA': ['+RA', '-RA', 'SHRA'], '+RA': ['RA', '+SHRA', '+TSRA'],
          '-DZ': ['-RA', 'DZ', '-SN'], 'DZ': ['-DZ', 'RA', '-FZDZ'],
          '-SHRA': ['-RA', 'SHRA', '-TSRA'], 'SHRA': ['RA', '+SHRA', 'TSRA'], '+SHRA': ['+RA', 'SHRA', '+TSRA'], 'VCSH': ['SHRA', '-SHRA', 'BCFG'],
          'TSRA': ['SHRA', '+TSRA', 'RA'], '+TSRA': ['TSRA', '+SHRA', '+RA'], '-TSRA': ['-SHRA', 'TSRA', '-RA'],
          '-SN': ['SN', '-RA', '-SHSN'], 'SN': ['-SN', 'RA', '-SHSN'], '-SHSN': ['-SN', '-SHRA', 'SN'],
          '-FZDZ': ['-DZ', '-FZRA', '-SN'], '-FZRA': ['-RA', '-FZDZ', '-SN'],
          'BR': ['FG', 'HZ', 'BCFG'], 'FG': ['BR', 'BCFG', 'MIFG'], 'BCFG': ['MIFG', 'FG', 'BR'], 'MIFG': ['BCFG', 'FG', 'BR'], 'HZ': ['BR', 'FG', 'MIFG'], 'FZFG': ['FG', 'BR', '-FZDZ']
        };
        const o = opts(cap(WX[m]), near[m].map(k => cap(WX[k])));
        const e = [
          sec('Opbouw van de code:', `${m} → ${wxBuild(m)}.`),
          sec('Betekenis:', `${m} = ${WX[m]}.`),
          sec('Ezelsbruggetje:', '− = licht, geen teken = matig, + = zwaar. SH = showers (buien, uit cumuluswolken), TS = onweer, FZ = onderkoeld (bevriest bij contact). BR (nevel) = zicht 1000–5000 m, FG (mist) = zicht onder 1000 m.'),
          decode(w)
        ].join('\n');
        return Q({ q: qText(m), o, e, code: metarText(w), mark: m, lo: LO, loText: LOTXT });
      }
    },
    {
      id: 'cloud', name: 'Bewolking',
      gen() {
        let w;
        do { w = makeWeather(pick(['fair', 'rain', 'showers', 'ts', 'mist', 'drizzle', 'snow'])); } while (!w.clouds.length || w.nsc || w.vv != null);
        const c = pick(w.clouds), m = tok.cloud(c);
        const others = Object.keys(COVER).filter(k => k !== c.cov);
        const o = opts(cap(coverText(c.cov, c.h, c.type)), shuffle([
          cap(coverText(pick(others), c.h, c.type)),
          cap(coverText(c.cov, c.h * 10, c.type)),
          cap(coverText(c.cov, c.h, c.type).replace('boven het vliegveld', 'boven zeeniveau (AMSL)')),
          c.type ? cap(coverText(c.cov, c.h)) : null
        ]));
        const e = [
          sec('Opbouw:', `${m} = bedekking ${c.cov} + hoogte ${pad(c.h, 3)} in honderden voet${c.type ? ` + wolkensoort ${c.type}` : ''}.`),
          sec('Hoogte:', `${pad(c.h, 3)} × 100 = ${(c.h * 100)} ft, gemeten boven het vliegveld (niet boven zeeniveau).`),
          sec('Bedekking in achtsten (okta):', 'FEW = 1–2 · SCT = 3–4 · BKN = 5–7 · OVC = 8. Alleen CB en TCU worden als wolkensoort vermeld.'),
          decode(w)
        ].join('\n');
        return Q({ q: qText(m), o, e, code: metarText(w), mark: m, lo: LO, loText: LOTXT });
      }
    },
    {
      id: 'temp', name: 'Temperatuur en dauwpunt',
      gen() {
        const neg = Math.random() < 0.45;
        const w = makeWeather(neg ? pick(['snow', 'fog', 'fair']) : pick(['fair', 'rain', 'cavok', 'mist']), neg ? { t: rnd(-7, 3), spread: rnd(1, 4) } : { spread: rnd(1, 9) });
        const m = tok.tt(w), T = tempText(w.t), D = tempText(w.td);
        const plain = v => `${Math.abs(v)} °C`;
        const o = opts(`Temperatuur ${T}, dauwpunt ${D}`, shuffle([
          `Temperatuur ${D}, dauwpunt ${T}`,
          (w.t < 0 || w.td < 0) ? `Temperatuur ${plain(w.t)}, dauwpunt ${plain(w.td)}` : `Maximumtemperatuur ${T}, minimumtemperatuur ${D}`,
          `Temperatuur ${T}, relatieve vochtigheid ${Math.abs(w.td)} %`
        ]));
        const e = [
          sec('Opbouw:', `${m} = temperatuur / dauwpunt in °C. Eerst de temperatuur, dan het dauwpunt.`),
          sec('M = minus:', 'een M voor het getal betekent een negatieve waarde, bv. M03 = −3 °C.'),
          sec('Spreiding:', `het verschil is ${w.t - w.td} °C. Hoe kleiner de spreiding, hoe vochtiger de lucht: bij 0–2 °C moet je rekening houden met mist of lage wolken.`),
          decode(w)
        ].join('\n');
        return Q({ q: qText(m), o, e, code: metarText(w), mark: m, lo: LO, loText: LOTXT });
      }
    },
    {
      id: 'qnh', name: 'QNH',
      gen() {
        const w = makeWeather(pick(['fair', 'rain', 'cavok', 'showers', 'mist']));
        if (w.qnh === 1013) w.qnh = pick([1012, 1014]); // 1013 zou ook de standaardinstelling zijn
        const m = tok.qnh(w);
        const o = opts(`QNH ${w.qnh} hPa`, shuffle([`QFE ${w.qnh} hPa`, `Standaardinstelling (QNE) ${w.qnh} hPa`, `Hoogte van het vliegveld: ${w.qnh} ft`]));
        const e = [
          sec('Q = QNH in hPa:', `${m} = QNH ${w.qnh} hPa: de luchtdruk herleid naar zeeniveau. Stel je hoogtemeter hierop in, dan toont hij op de grond de hoogte van het vliegveld boven zeeniveau.`),
          sec('Niet verwarren:', 'QFE = druk op de hoogte van het vliegveld (hoogtemeter toont dan 0 ft op de grond). QNE/1013 hPa = standaardinstelling voor vliegniveaus. In de VS staat de druk als A2992 (inch kwik).'),
          decode(w)
        ].join('\n');
        return Q({ q: qText(m), o, e, code: metarText(w), mark: m, lo: LO, loText: LOTXT });
      }
    },
    {
      id: 'cavok', name: 'CAVOK en NSC',
      gen() {
        const isCavok = Math.random() < 0.65;
        const w = isCavok ? makeWeather('cavok') : (() => { const x = makeWeather('fair'); x.nsc = true; x.clouds = []; return x; })();
        const m = isCavok ? 'CAVOK' : 'NSC';
        const o = isCavok
          ? opts('Zicht 10 km of meer, geen wolken onder 5000 ft (of de hoogste MSA), geen CB/TCU en geen significant weer', [
            'Geen enkele wolk aan de hemel en zicht 10 km of meer',
            'Zicht 5 km of meer en geen wolken onder 1500 ft',
            'Wolken en zicht zijn voldoende voor VFR (minstens 5 km zicht en 1500 ft wolkenbasis)'])
          : opts('Geen significante bewolking: geen wolken onder 5000 ft (of de hoogste MSA) en geen CB/TCU', [
            'Geen enkele wolk aan de hemel',
            'Geen significant weer (geen neerslag, mist …)',
            'Geen bewolking gemeten (sensor defect)']);
        const e = [
          isCavok
            ? sec('CAVOK = Ceiling And Visibility OK:', 'staat in plaats van zicht, weer en wolken als tegelijk geldt: zicht 10 km of meer, geen wolken onder 5000 ft (of onder de hoogste minimum sectorhoogte als die hoger is), geen CB of TCU, en geen significant weer.')
            : sec('NSC = No Significant Cloud:', 'er zijn geen wolken onder 5000 ft (of de hoogste MSA) en geen CB/TCU. Er kunnen dus wel hogere wolken zijn.'),
          sec('Valkuil:', isCavok ? 'CAVOK betekent niet "onbewolkt": boven 5000 ft kunnen er gerust wolken zijn.' : 'NSC gaat alleen over wolken. Geen significant weer heet NSW (in een trend of TAF).'),
          decode(w)
        ].join('\n');
        return Q({ q: qText(m), o, e, code: metarText(w), mark: m, lo: LO, loText: LOTXT });
      }
    },
    {
      id: 'trend', name: 'Trend (NOSIG, TEMPO, BECMG)',
      gen() {
        const kind = pick(['NOSIG', 'TEMPO', 'BECMG']);
        const trend = kind === 'NOSIG' ? 'NOSIG' : kind === 'TEMPO' ? pick(['TEMPO 3000 SHRA', 'TEMPO 4000 RA BKN012', 'TEMPO 2000 +TSRA']) : pick(['BECMG BKN008', 'BECMG 3000 BR', 'BECMG 9999 NSW']);
        const w = makeWeather(kind === 'NOSIG' ? pick(['fair', 'cavok', 'rain']) : kind === 'TEMPO' ? 'showers' : pick(['rain', 'mist']), { trend });
        const m = trend;
        const what = trendText(trend).split(': ').slice(1).join(': ');
        const o = kind === 'NOSIG'
          ? opts('Geen significante verandering verwacht in de komende 2 uur', ['Geen significante verandering verwacht in de komende 24 uur', 'Op dit moment geen significant weer', 'Geen signaal: de automatische waarneming is uitgevallen'])
          : kind === 'TEMPO'
            ? opts(`Tijdelijk (telkens korter dan 1 uur) in de komende 2 uur: ${what}`, [`Geleidelijk en blijvend in de komende 2 uur: ${what}`, `Kans van 30 % in de komende 2 uur: ${what}`, `Op dit moment al: ${what}`])
            : opts(`Geleidelijk en blijvend in de komende 2 uur: ${what}`, [`Tijdelijk (telkens korter dan 1 uur) in de komende 2 uur: ${what}`, `Plots vanaf nu: ${what}`, `Geleidelijk en blijvend in de komende 24 uur: ${what}`]);
        const e = [
          sec('Trend:', 'aan het einde van een METAR staat een korte verwachting (trend) voor de komende 2 uur.'),
          sec('De codes:', 'NOSIG = no significant change: geen belangrijke verandering verwacht.\nTEMPO = tijdelijk: schommelingen die telkens korter dan 1 uur duren en samen minder dan de helft van de periode.\nBECMG = becoming: een geleidelijke, blijvende verandering.\nNSW = no significant weather: het significante weer stopt.'),
          decode(w)
        ].join('\n');
        return Q({ q: qText(m), o, e, code: metarText(w), mark: m, lo: LO, loText: LOTXT });
      }
    }
  ];

  // ---------- METAR toepassen ----------
  const toepassen = [
    {
      id: 'ceiling', name: 'Wolkenbasis (ceiling) bepalen',
      gen() {
        const low = rnd(4, 18), ceil = low + rnd(4, 20), high = ceil + rnd(10, 40);
        const clouds = [{ cov: pick(['FEW', 'SCT']), h: low }, { cov: pick(['BKN', 'OVC']), h: ceil }];
        if (Math.random() < 0.5) clouds.push({ cov: 'OVC', h: high });
        const w = makeWeather(pick(['rain', 'showers', 'fair']), { clouds, vis: pick([9999, 8000, 6000, 5000]) });
        const ft = h => `${(h * 100)} ft`;
        const o = opts(ft(ceil), [ft(low), clouds[2] ? ft(high) : ft(ceil * 10), `${ceil * 100} m`]);
        const e = [
          sec('Ceiling (plafond):', 'de basis van de laagste wolkenlaag die meer dan de helft van de hemel bedekt, dus de laagste BKN- of OVC-laag (onder 20 000 ft).'),
          sec('Toegepast:', `${tok.cloud(clouds[0])} is ${clouds[0].cov} (${COVER[clouds[0].cov].okta}): telt niet mee.\n${tok.cloud(clouds[1])} is ${clouds[1].cov} (${COVER[clouds[1].cov].okta}): dit is de laagste BKN/OVC-laag, dus de ceiling is ${ft(ceil)} boven het vliegveld.`),
          sec('Valkuil:', 'de laagste wolkenlaag is niet altijd de ceiling: FEW en SCT tellen niet mee.'),
          decode(w)
        ].join('\n');
        return Q({ q: 'Wat is de ceiling (wolkenplafond) volgens deze METAR?', o, e, code: metarText(w), mark: '', src: 'sera', ref: 'SERA, artikel 2 – definitie ceiling', lo: LO, loText: LOTXT });
      }
    },
    {
      id: 'vfrctr', name: 'VFR vertrekken uit een controlezone?',
      gen() {
        const outcome = pick(['ok', 'ceil', 'vis', 'both']);
        const ap = pick(AIRPORTS.filter(a => a.icao !== 'EBKT'));
        const ceilOk = outcome === 'ok' || outcome === 'vis', visOk = outcome === 'ok' || outcome === 'ceil';
        const ceil = ceilOk ? rnd(15, 40) : rnd(4, 14);
        const vis = visOk ? pick([5000, 6000, 8000, 9999]) : pick([2000, 3000, 3500, 4000, 4500]);
        const clouds = [{ cov: pick(['FEW', 'SCT']), h: Math.max(3, ceil - rnd(3, 8)) }, { cov: pick(['BKN', 'OVC']), h: ceil }];
        if (Math.random() < 0.3 && ceilOk) clouds[0] = { cov: 'SCT', h: rnd(6, 12) };
        const w = makeWeather(visOk ? pick(['rain', 'showers', 'fair']) : pick(['rain', 'mist', 'drizzle']), { ap, clouds, vis });
        if (vis < 5000 && !w.wx.length) w.wx = ['BR'];
        if (vis >= 5000) w.wx = w.wx.filter(x => !/^(BR|FG|\+RA)$/.test(x));
        const correct = { ok: 'Ja, ceiling en zicht zijn voldoende', ceil: 'Nee, de ceiling is lager dan 1500 ft', vis: 'Nee, het zicht is minder dan 5 km', both: 'Nee, zowel de ceiling als het zicht zijn te laag' };
        const order = [outcome, ...['ok', 'ceil', 'vis', 'both'].filter(k => k !== outcome)];
        const o = order.map(k => correct[k]);
        const e = [
          sec('Regel (SERA.5005(b)):', 'zonder special VFR-klaring mag je niet VFR opstijgen of landen op een vliegveld in een controlezone (of de verkeerszone/het circuit binnenvliegen) als de ceiling lager is dan 1500 ft of het grondzicht minder dan 5 km.'),
          sec('Stap 1 – Ceiling:', `laagste BKN/OVC-laag = ${tok.cloud(clouds[1])} → ${(ceil * 100)} ft. ${ceilOk ? 'Dat is 1500 ft of meer: OK.' : 'Dat is lager dan 1500 ft: te laag.'}${clouds[0].h < ceil ? ` (${tok.cloud(clouds[0])} telt niet mee: ${clouds[0].cov} is geen ceiling.)` : ''}`),
          sec('Stap 2 – Zicht:', `${tok.vis(w)} → ${visText(vis)}. ${visOk ? 'Dat is 5 km of meer: OK.' : 'Dat is minder dan 5 km: te laag.'}`),
          sec('Besluit:', correct[outcome] + '.'),
          decode(w)
        ].join('\n');
        return Q({ q: `Je wilt VFR vertrekken van ${ap.icao} (${ap.name}), dat in een controlezone (CTR) ligt. Mag dat zonder special VFR-klaring?`, o, e, code: metarText(w), mark: '', src: 'sera', ref: 'SERA.5005(b) – VFR in een controlezone' });
      }
    },
    {
      id: 'runway', name: 'Welke baan en welke zijwind?',
      gen() {
        const ap = pick(AIRPORTS), pair = pick(ap.rwys);
        let dir;
        const okAngle = a => (a >= 20 && a <= 70) || (a >= 110 && a <= 160);
        do { dir = rnd(1, 36) * 10; } while (!okAngle(Math.abs(diff(dir, pair[0] * 10))));
        const w = makeWeather(pick(['fair', 'cavok', 'rain']), { ap, dir, spd: rnd(8, 18), noVrb: true });
        delete w.wind.varFrom; delete w.wind.varTo;
        const best = Math.abs(diff(dir, pair[0] * 10)) < 90 ? pair[0] : pair[1], other = best === pair[0] ? pair[1] : pair[0];
        const d = diff(dir, best * 10), side = d > 0 ? 'rechts' : 'links', oside = side === 'rechts' ? 'links' : 'rechts';
        const R = n => `Baan ${pad(n)}`;
        const o = [`${R(best)}, zijwind van ${side}`, `${R(best)}, zijwind van ${oside}`, `${R(other)}, zijwind van ${oside}`, `${R(other)}, zijwind van ${side}`];
        const e = [
          sec('Stap 1 – Welke baan?', `je landt en vertrekt met tegenwind. De wind komt uit ${pad(dir, 3)}°. Baan ${pad(best)} wijst naar ${pad(best * 10, 3)}°: het verschil is ${Math.abs(d)}°, dus tegenwind. Baan ${pad(other)} (${pad(other * 10, 3)}°) zou meewind geven.`),
          sec('Stap 2 – Van welke kant?', `de wind (${pad(dir, 3)}°) ligt ${Math.abs(d)}° ${d > 0 ? 'rechtsom' : 'linksom'} van de baanrichting (${pad(best * 10, 3)}°), dus de wind komt van ${side}.`),
          sec('Ezelsbruggetje:', 'windrichting groter dan de baanrichting (rechtsom) → wind van rechts; kleiner (linksom) → wind van links.'),
          sec('Goed om te weten:', 'de wind in de METAR is t.o.v. het ware noorden, de baannummers zijn magnetisch. In België scheelt dat maar 1 à 2°, dus hier speelt het geen rol.'),
          decode(w)
        ].join('\n');
        return Q({ q: `Op ${ap.icao} (${ap.name}) zijn de banen ${pad(pair[0])} en ${pad(pair[1])} beschikbaar. Welke baan gebruik je, en van welke kant komt de zijwind?`, o, e, code: metarText(w), mark: tok.wind(w), lo: LO, loText: LOTXT });
      }
    },
    {
      id: 'cloudbase', name: 'Cumulusbasis schatten',
      gen() {
        const spread = rnd(2, 9);
        const agl = spread * 400, cu = Math.max(3, spread * 4 + rnd(-2, 2)); // gemelde cumulusbasis ligt rond de schatting
        const w = makeWeather('fair', { spread, t: rnd(10, 26), clouds: [{ cov: pick(['FEW', 'SCT']), h: cu }] });
        w.hh = rnd(10, 15); // cumulus = overdag
        const o = opts(`${agl} ft`, [`${spread * 125} ft`, `${spread * 1000} ft`, `${w.t * 400} ft`], [`${w.td * 400} ft`, `${agl + 1000} ft`, `${agl * 2} ft`]);
        const e = [
          sec('Vuistregel:', 'cumulusbasis ≈ spreiding (temperatuur − dauwpunt) × 400 ft (of × 125 m) boven de grond.'),
          sec('Stap 1 – Spreiding:', `${tok.tt(w)} → ${tempText(w.t)} − ${tempText(w.td)} = ${spread} °C.`),
          sec('Stap 2 – Basis:', `${spread} × 400 ft = ${agl} ft boven het vliegveld.`),
          sec('Controle:', `de METAR meldt ${tok.cloud(w.clouds[0])} (basis ${cu * 100} ft): de vuistregel zit er dus dicht bij.`),
          sec('Valkuil:', '× 125 geeft de basis in meter, niet in voet.'),
          decode(w)
        ].join('\n');
        return Q({ q: 'Schat met de temperatuur en het dauwpunt uit deze METAR de basis van de cumuluswolken boven het vliegveld.', o, e, code: metarText(w), mark: tok.tt(w), lo: '30.4.1.1.3', loText: 'Wolkenbasis uit temperatuur en dauwpunt' });
      }
    }
  ];

  // ---------- TAF ----------
  function makeTaf() {
    const ap = pick(AIRPORTS);
    const day = rnd(2, 26), start = pick([0, 6, 12, 18]), len = ap.icao === 'EBBR' || ap.icao === 'EBLG' ? 30 : 24;
    const end = start + len;
    // H = aantal uur sinds dag "day" 00:00 UTC. Een eindtijd op middernacht schrijf je als 24 van de vorige dag.
    const at = (H, isEnd) => isEnd && H % 24 === 0 ? `${pad(day + H / 24 - 1)}24` : `${pad(day + Math.floor(H / 24))}${pad(H % 24)}`;
    const issue = start === 0 ? `${pad(day - 1)}2300Z` : `${pad(day)}${pad(start - 1)}00Z`;
    const base = makeWeather(pick(['fair', 'cavok']), { ap });
    const g1s = start + rnd(2, 6), g1e = g1s + rnd(3, 6);
    const g2s = g1e + rnd(1, 4), g2e = g2s + 2;
    const g3s = Math.min(end - 4, g2e + rnd(2, 5)), g3e = g3s + rnd(2, 4);
    const tempoVis = pick([2500, 3000, 4000]), becmgH = rnd(5, 12), probVis = pick([300, 500, 800]);
    const groups = [
      { kind: 'TEMPO', s: g1s, e: g1e, text: `TEMPO ${at(g1s)}/${at(g1e, true)} ${pad(tempoVis, 4)} SHRA BKN0${rnd(12, 20)}CB`, vis: tempoVis, what: `zicht ${visText(tempoVis)} in regenbuien, ${COVER.BKN.nl} met CB` },
      { kind: 'BECMG', s: g2s, e: g2e, text: `BECMG ${at(g2s)}/${at(g2e, true)} BKN${pad(becmgH, 3)}`, what: coverText('BKN', becmgH) },
      { kind: 'PROB30', s: g3s, e: g3e, text: `PROB30 ${at(g3s)}/${at(g3e, true)} ${pad(probVis, 4)} FG`, vis: probVis, what: `zicht ${visText(probVis)} in mist` }
    ];
    const validity = `${at(start)}/${at(end, true)}`;
    const endDay = +validity.slice(5, 7), endHh = +validity.slice(7, 9);
    const head = ['TAF', ap.icao, issue, validity, tok.wind(base), tok.vis(base), tok.clouds(base)].filter(Boolean).join(' ');
    return { ap, base, day, start, end, endDay, endHh, groups, text: head + ' ' + groups.map(g => g.text).join(' '), validity, issue };
  }
  const tafWhen = (t, h) => `dag ${t.day + Math.floor(h / 24)} om ${pad(h % 24)}:00 UTC`;
  const tafSrc = { src: 'met', ref: 'Bijlage V (Part-MET) / ICAO Annex 3 – TAF', lo: LO, loText: LOTXT };
  function tafDecode(t) {
    return '**De TAF ontcijferd:**\n' + [
      `TAF ${t.ap.icao} → verwachting voor ${t.ap.name}`,
      `${t.issue} → opgesteld op dag ${+t.issue.slice(0, 2)} om ${t.issue.slice(2, 4)}:00 UTC`,
      `${t.validity} → geldig van dag ${t.day} ${pad(t.start)}:00 tot dag ${t.endDay} ${pad(t.endHh)}:00 UTC`,
      `${[tok.wind(t.base), tok.vis(t.base), tok.clouds(t.base)].filter(Boolean).join(' ')} → basisverwachting: wind ${windText(t.base)}, ${t.base.cavok ? 'CAVOK' : 'zicht ' + visText(t.base.vis) + (t.base.nsc ? ', geen significante bewolking' : t.base.clouds.length ? ', ' + t.base.clouds.map(c => coverText(c.cov, c.h, c.type)).join('; ') : '')}`,
      ...t.groups.map(g => `${g.text} → ${g.kind === 'TEMPO' ? 'tijdelijk' : g.kind === 'BECMG' ? 'geleidelijk en blijvend' : 'kans van 30 %'} tussen ${tafWhen(t, g.s)} en ${tafWhen(t, g.e)}: ${g.what}`)
    ].join('\n');
  }

  const taf = [
    {
      id: 'validity', name: 'Geldigheid van de TAF',
      gen() {
        const t = makeTaf(), m = t.validity;
        const o = opts(`Van dag ${t.day} om ${pad(t.start)}:00 UTC tot dag ${t.endDay} om ${pad(t.endHh)}:00 UTC`, shuffle([
          `Van dag ${t.day} om ${pad(t.start)}:00 tot dag ${t.endDay} om ${pad(t.endHh)}:00 Belgische (lokale) tijd`,
          `Op dag ${t.day}, van ${pad(t.day)}:${pad(t.start)} tot ${pad(t.endDay)}:${pad(t.endHh % 24)} UTC`,
          `Van dag ${t.day} om ${pad(t.start)}:00 UTC, ${t.end - t.start + 6} uur lang`
        ]));
        const e = [
          sec('Opbouw:', `${m} = DDHH/DDHH: van dag ${t.day} om ${pad(t.start)}:00 tot dag ${t.endDay} om ${pad(t.endHh)}:00, in UTC.`),
          sec('Duur:', `deze TAF is ${t.end - t.start} uur geldig. In België gelden TAFs van 9, 24 of 30 uur.`),
          sec('Niet verwarren:', `${t.issue} is het tijdstip waarop de TAF is opgesteld, niet het begin van de geldigheid.`),
          tafDecode(t)
        ].join('\n');
        return Q(Object.assign({ q: `Wat betekent "${m}" in deze TAF?`, o, e, code: t.text, mark: m }, tafSrc));
      }
    },
    {
      id: 'groups', name: 'TEMPO, BECMG en PROB',
      gen() {
        const t = makeTaf(), g = pick(t.groups), m = g.text;
        const from = tafWhen(t, g.s), to = tafWhen(t, g.e);
        const txt = { TEMPO: `Tijdelijk (telkens korter dan 1 uur) tussen ${from} en ${to}: ${g.what}`, BECMG: `Geleidelijk en blijvend tussen ${from} en ${to}: ${g.what}`, PROB30: `Kans van 30 % tussen ${from} en ${to}: ${g.what}` };
        const o = opts(txt[g.kind], shuffle([
          ...Object.keys(txt).filter(k => k !== g.kind).map(k => txt[k]),
          // tijdgroep verkeerd gelezen als uur:minuut
          `${txt[g.kind].split(' tussen ')[0]} tussen ${m.split(' ')[1].slice(0, 2)}:${m.split(' ')[1].slice(2, 4)} en ${m.split(' ')[1].slice(5, 7)}:${m.split(' ')[1].slice(7, 9)} UTC: ${g.what}`
        ]));
        const e = [
          sec('Tijd:', `${m.split(' ')[1]} = van ${from} tot ${to}.`),
          sec('De codes:', 'TEMPO = tijdelijke schommelingen, telkens korter dan 1 uur en samen minder dan de helft van de periode.\nBECMG = geleidelijke, blijvende verandering binnen de periode; daarna geldt het nieuwe weer.\nPROB30 / PROB40 = kans van 30 % of 40 % dat het gebeurt.'),
          tafDecode(t)
        ].join('\n');
        return Q(Object.assign({ q: `Wat betekent "${m}" in deze TAF?`, o, e, code: t.text, mark: m }, tafSrc));
      }
    },
    {
      id: 'worst', name: 'Slechtste zicht in een periode',
      gen() {
        const t = makeTaf(), g = t.groups[0];
        const baseVis = t.base.cavok ? 'zicht 10 km of meer' : `zicht ${visText(t.base.vis)}`;
        const o = opts(cap(visText(g.vis)), [cap(t.base.cavok || t.base.vis >= 9999 ? '10 km of meer' : visText(t.base.vis)), cap(visText(t.groups[2].vis)), `${g.vis} ft`], ['1.500 m', '5 km']);
        const e = [
          sec('Stap 1 – Basis:', `de basisverwachting geeft ${baseVis}.`),
          sec('Stap 2 – Welke groepen vallen in de periode?', `${g.text}: tijdelijk tussen ${tafWhen(t, g.s)} en ${tafWhen(t, g.e)} → zicht ${visText(g.vis)}. De PROB30-groep met mist valt later en telt hier niet mee.`),
          sec('Besluit:', `plan met het slechtste zicht in die periode: ${visText(g.vis)}. Ook een TEMPO-verslechtering moet je in je planning meenemen.`),
          tafDecode(t)
        ].join('\n');
        return Q(Object.assign({ q: `Wat is het laagste zicht waarmee je volgens deze TAF moet rekenen tussen ${tafWhen(t, g.s)} en ${tafWhen(t, g.e)}?`, o, e, code: t.text, mark: '' }, tafSrc));
      }
    }
  ];

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  const GENERATORS = { metar, toepassen, taf };
  const GROUPS = {
    metar: { name: 'METAR ontcijferen', icon: '🌦️', desc: 'Wat betekent dit deel van de METAR?' },
    toepassen: { name: 'METAR toepassen', icon: '🛫', desc: 'Ceiling, VFR-minima, baan en zijwind, wolkenbasis' },
    taf: { name: 'TAF lezen', icon: '📅', desc: 'Geldigheid, TEMPO/BECMG/PROB en planning' }
  };

  function generate(group, typeId) {
    const list = GENERATORS[group] || [];
    const g = list.find(x => x.id === typeId) || pick(list);
    const q = g.gen();
    q.type = g.id;
    q.typeName = g.name;
    return q;
  }

  return { GENERATORS, GROUPS, generate, _internal: { makeWeather, metarText, makeTaf } };
})();

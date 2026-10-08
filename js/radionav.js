// Radionavigatie-oefeningen (VOR/CDI, ADF/RBI, RMI) met zelf getekende instrumenten.
// Werkt zoals de rekenvragen: elke generator geeft { q, o: [juist, fout, fout, fout], e, img, ... } terug.

window.RADIONAV = (function () {
  'use strict';

  // ---------- helpers ----------
  const rnd = (min, max, step = 1) => min + step * Math.floor(Math.random() * (Math.floor((max - min) / step) + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const norm = d => ((Math.round(d) % 360) + 360) % 360;
  const brg = d => String(norm(d)).padStart(3, '0') + '°';
  const rad = d => d * Math.PI / 180;
  const diff = (a, b) => { let d = norm(a - b); if (d > 180) d -= 360; return d; }; // a − b in (−180, 180]

  function options(correct, wrong, fmt) {
    const out = [fmt(correct)];
    for (const w of wrong) { const s = fmt(w); if (!out.includes(s) && out.length < 4) out.push(s); }
    for (let k = 1; out.length < 4 && k < 40; k++) {
      for (const c of [correct + 10 * k, correct - 10 * k]) { const s = fmt(c); if (!out.includes(s) && out.length < 4) out.push(s); }
    }
    return out;
  }

  const svgUri = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

  function Q(o) {
    return {
      q: o.q, o: o.o, c: 0, e: o.e, src: o.src || 'syl', ref: o.ref || '', lo: o.lo || '', loText: o.loText || '',
      img: o.img ? [svgUri(o.img)] : [], review: false, calc: true
    };
  }

  // ---------- instrument drawing ----------
  const C = 150; // centre of a 300×300 drawing

  // Compass card: value v is drawn at angle (v − top) clockwise from the top.
  function card(top, r, opts = {}) {
    let s = '';
    for (let v = 0; v < 360; v += 5) {
      const a = rad(v - top);
      const len = v % 10 === 0 ? 12 : 6;
      const x1 = C + Math.sin(a) * r, y1 = C - Math.cos(a) * r;
      const x2 = C + Math.sin(a) * (r - len), y2 = C - Math.cos(a) * (r - len);
      s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#fff" stroke-width="${v % 10 === 0 ? 2 : 1.2}"/>`;
    }
    for (let v = 0; v < 360; v += 30) {
      const a = rad(v - top);
      const tr = r - 26;
      const x = C + Math.sin(a) * tr, y = C - Math.cos(a) * tr;
      const label = opts.letters && v % 90 === 0 ? 'NESW'[v / 90] : String(v / 10);
      s += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" fill="#fff" font-size="17" font-family="Arial, Helvetica, sans-serif" font-weight="bold" text-anchor="middle" dominant-baseline="central" transform="rotate(${(v - top).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})">${label}</text>`;
    }
    return s;
  }

  function frame(inner, label) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 330" width="300" height="330">
      <rect x="0" y="0" width="300" height="300" rx="26" fill="#6d5f52"/>
      <circle cx="150" cy="150" r="138" fill="#3b322b"/>
      <circle cx="150" cy="150" r="130" fill="#0b0b0b"/>
      ${inner}
      <text x="4" y="324" font-size="18" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-style="italic" fill="#888">${label}</text>
    </svg>`;
  }

  // VOR-indicator (CDI) zoals NAV-022/NAV-024: OBS bovenaan, naald, 5 dots per kant (2° per dot), TO/FR-vlag.
  function cdiSvg(obs, needle /* −1..+1, + = rechts */, toFlag) {
    let dots = '';
    for (let i = 1; i <= 5; i++) {
      for (const sgn of [-1, 1]) dots += `<rect x="${C + sgn * i * 17 - 2}" y="${C - 8}" width="4" height="16" fill="#fff"/>`;
    }
    const nx = C + Math.max(-1, Math.min(1, needle)) * 85;
    const flag = toFlag
      ? `<polygon points="${C + 48},${C - 52} ${C + 39},${C - 36} ${C + 57},${C - 36}" fill="#fff"/>`
      : `<polygon points="${C + 48},${C + 52} ${C + 39},${C + 36} ${C + 57},${C + 36}" fill="#fff"/>`;
    const inner = `${card(obs, 124)}
      <polygon points="${C},${C - 128} ${C - 9},${C - 142} ${C + 9},${C - 142}" fill="#fff"/>
      <polygon points="${C},${C + 128} ${C - 6},${C + 138} ${C + 6},${C + 138}" fill="#fff"/>
      ${dots}
      <rect x="${C - 1}" y="${C - 3}" width="2" height="6" fill="#fff"/>
      <text x="${C + 48}" y="${C - 58}" fill="#fff" font-size="14" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">TO</text>
      <text x="${C + 48}" y="${C + 68}" fill="#fff" font-size="14" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">FR</text>
      ${flag}
      <line x1="${nx.toFixed(1)}" y1="${C - 92}" x2="${nx.toFixed(1)}" y2="${C + 92}" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
      <circle cx="40" cy="262" r="20" fill="#444" stroke="#222" stroke-width="3"/>
      <text x="40" y="267" fill="#ddd" font-size="13" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">OBS</text>`;
    return frame(inner, 'VOR / CDI');
  }

  // ADF met vaste kaart (RBI): 0 bovenaan, naald wijst de relatieve peiling aan.
  function rbiSvg(rb) {
    const a = rad(rb);
    const hx = C + Math.sin(a) * 100, hy = C - Math.cos(a) * 100;
    const tx = C - Math.sin(a) * 100, ty = C + Math.cos(a) * 100;
    const inner = `${card(0, 124)}
      <polygon points="${C},${C - 128} ${C - 9},${C - 142} ${C + 9},${C - 142}" fill="#f5a623"/>
      <path d="M150 112 L156 140 L188 156 L188 164 L156 156 L154 178 L164 186 L164 192 L150 188 L136 192 L136 186 L146 178 L144 156 L112 164 L112 156 L144 140 Z" fill="#9aa0a6"/>
      <line x1="${tx.toFixed(1)}" y1="${ty.toFixed(1)}" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}" stroke="#e8463a" stroke-width="5" stroke-linecap="round"/>
      <polygon points="${(C + Math.sin(a) * 112).toFixed(1)},${(C - Math.cos(a) * 112).toFixed(1)} ${(C + Math.sin(a - 0.12) * 92).toFixed(1)},${(C - Math.cos(a - 0.12) * 92).toFixed(1)} ${(C + Math.sin(a + 0.12) * 92).toFixed(1)},${(C - Math.cos(a + 0.12) * 92).toFixed(1)}" fill="#e8463a"/>
      <circle cx="150" cy="150" r="6" fill="#ddd"/>`;
    return frame(inner, 'ADF (RBI)');
  }

  // RMI: kaart draait met de koers (koers bovenaan), naald wijst naar het station (QDM), staart = QDR.
  function rmiSvg(heading, qdm) {
    const a = rad(qdm - heading);
    const hx = C + Math.sin(a) * 104, hy = C - Math.cos(a) * 104;
    const tx = C - Math.sin(a) * 104, ty = C + Math.cos(a) * 104;
    const inner = `${card(heading, 124, { letters: true })}
      <polygon points="${C},${C - 128} ${C - 9},${C - 142} ${C + 9},${C - 142}" fill="#f5a623"/>
      <line x1="${tx.toFixed(1)}" y1="${ty.toFixed(1)}" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}" stroke="#4fc3f7" stroke-width="5" stroke-linecap="round"/>
      <polygon points="${(C + Math.sin(a) * 116).toFixed(1)},${(C - Math.cos(a) * 116).toFixed(1)} ${(C + Math.sin(a - 0.12) * 94).toFixed(1)},${(C - Math.cos(a - 0.12) * 94).toFixed(1)} ${(C + Math.sin(a + 0.12) * 94).toFixed(1)},${(C - Math.cos(a + 0.12) * 94).toFixed(1)}" fill="#4fc3f7"/>
      <line x1="150" y1="132" x2="150" y2="172" stroke="#f5a623" stroke-width="3"/>
      <line x1="134" y1="146" x2="166" y2="146" stroke="#f5a623" stroke-width="3"/>
      <circle cx="150" cy="150" r="6" fill="#ddd"/>`;
    return frame(inner, 'RMI');
  }

  // ---------- VOR logica ----------
  // Positie op radiaal R, OBS ingesteld → TO/FROM en naalduitslag (graden, + = naald rechts).
  function cdiState(R, obs) {
    const d = diff(R, obs);
    if (Math.abs(d) < 90) return { to: false, dev: -d };          // FROM: radiaal rechtsom van OBS → naald links
    const d2 = diff(R, obs + 180);
    return { to: true, dev: d2 };                                 // TO: rechtsom van de inkomende radiaal → naald rechts
  }
  const needleTxt = dev => (Math.abs(dev) < 0.5 ? 'gecentreerd' : `${Math.min(5, Math.round(Math.abs(dev) / 2))} dot${Math.round(Math.abs(dev) / 2) === 1 ? '' : 's'} ${dev > 0 ? 'rechts' : 'links'}${Math.abs(dev) >= 10 ? ' (volle uitslag)' : ''}`);
  const QUAD = { NO: 'Noordoosten', ZO: 'Zuidoosten', ZW: 'Zuidwesten', NW: 'Noordwesten' };
  const quadOf = R => (R < 90 ? 'NO' : R < 180 ? 'ZO' : R < 270 ? 'ZW' : 'NW');
  const COMPASS = { 0: 'noord', 90: 'oost', 180: 'zuid', 270: 'west' };

  const vor = [
    {
      id: 'quadrant', name: 'Positie ten opzichte van de VOR', lo: '92.2.3.2.7',
      gen() {
        const obs = pick([0, 90, 180, 270]);
        let R; do { R = rnd(0, 359); } while ([0, 90, 180, 270, 360].some(c => Math.abs(R - c) < 15));
        const st = cdiState(R, obs);
        const half = st.to ? norm(obs + 180) : obs;          // kant van het station waar je zit
        const side = st.dev < 0 ? norm(obs + 90) : norm(obs - 90); // naald links → je zit rechts van de koers
        const steps = [
          `Stap 1 – de vlag (TO/FROM) vertelt aan welke kant van het station je zit. Stel je voor dat je de OBS-koers ${brg(obs)} vliegt: ${st.to
            ? `de vlag TO zegt dat je dan naar het station toe vliegt. Het station ligt dus ${COMPASS[obs]} van je, en jij zit aan de ${COMPASS[half]}kant van het station.`
            : `de vlag FROM zegt dat je dan van het station weg vliegt. Het station ligt dus achter je, en jij zit aan de ${COMPASS[half]}kant van het station.`}`,
          `Stap 2 – de naald wijst altijd naar de gekozen koerslijn (de lijn door het station in richting ${brg(obs)}). Naald ${st.dev < 0 ? 'links' : 'rechts'}: de lijn ligt ${st.dev < 0 ? 'links' : 'rechts'} van je, dus jij zit ${st.dev < 0 ? 'rechts' : 'links'} van die lijn. Als je ${brg(obs)} vliegt, is ${st.dev < 0 ? 'rechts' : 'links'} het ${COMPASS[side]}en: je zit aan de ${COMPASS[side]}kant.`,
          `Conclusie: ${COMPASS[half]}kant + ${COMPASS[side]}kant = ${QUAD[quadOf(R)].toLowerCase()} van de VOR (in dit voorbeeld radiaal ${brg(R)}).`,
          'Let op: de koers die het vliegtuig echt vliegt speelt geen rol. Een VOR-indicator toont alleen waar je zit ten opzichte van de gekozen koers (OBS).'
        ];
        const q = 'Waar bevindt het luchtvaartuig zich ten opzichte van de VOR? (de koers van het vliegtuig speelt geen rol)';
        const right = QUAD[quadOf(R)];
        const o = [right, ...Object.values(QUAD).filter(x => x !== right)];
        return Q({ q, o, e: steps.join('\n'), img: cdiSvg(obs, st.dev / 10, st.to), lo: this.lo, loText: 'VOR-informatie aflezen en interpreteren' });
      }
    },
    {
      id: 'radial', name: 'Op welke radiaal ben je?', lo: '92.2.3.2.7',
      gen() {
        const obs = rnd(0, 71) * 5;
        const to = Math.random() < 0.5;
        const dev = pick([-8, -6, -4, -2, 0, 2, 4, 6, 8]);
        // FROM: naald rechts (dev>0) → R = OBS − dev ; TO: naald rechts → R = OBS + 180 + dev
        const R = to ? norm(obs + 180 + dev) : norm(obs - dev);
        const base = to ? norm(obs + 180) : obs;
        const steps = [
          to ? `Stap 1 – vlag TO: met koers ${brg(obs)} vlieg je naar het station toe, dus je zit aan de andere kant: op de radiaal OBS + 180° = ${brg(base)}.`
             : `Stap 1 – vlag FROM: met koers ${brg(obs)} vlieg je van het station weg, dus je zit op de radiaal die gelijk is aan de OBS: ${brg(obs)}.`,
          dev === 0 ? 'Stap 2 – de naald staat in het midden: je zit precies op die radiaal.'
            : `Stap 2 – de naald staat ${needleTxt(dev)}. Elke dot is 2°, dus je wijkt ${Math.abs(dev)}° af van radiaal ${brg(base)}.`,
          dev === 0 ? `Antwoord: radiaal ${brg(R)}.`
            : `Stap 3 – welke kant? De naald wijst naar de koerslijn: naald ${dev > 0 ? 'rechts' : 'links'} = de lijn ligt ${dev > 0 ? 'rechts' : 'links'} van je (als je ${brg(obs)} vliegt). Dat betekent hier dat je radiaal ${(dev > 0) === to ? 'groter' : 'kleiner'} is: ${brg(base)} ${(dev > 0) === to ? '+' : '−'} ${Math.abs(dev)}° = ${brg(R)}.`,
          `Valkuil: ${to ? `bij TO is de OBS-waarde (${brg(obs)}) niet je radiaal maar je koers naar het station.` : `bij FROM is de OBS-waarde wel je radiaal; ${brg(obs + 180)} zou de koers naar het station zijn.`}`
        ];
        const wrong = [to ? obs + 180 - dev : obs + dev, to ? obs + dev : obs + 180 - dev, to ? obs - dev : obs + 180 + dev];
        return Q({ q: 'Op welke VOR-radiaal bevindt het luchtvaartuig zich?', o: options(R, wrong.map(norm), brg), e: steps.join('\n'),
          img: cdiSvg(obs, dev / 10, to), lo: this.lo, loText: 'VOR-informatie aflezen (geselecteerde koers, naald, TO/FROM)' });
      }
    },
    {
      id: 'direct', name: 'Koers om rechtstreeks naar de VOR te vliegen', lo: '92.2.3.2.7',
      gen() {
        const obs = rnd(0, 71) * 5, to = Math.random() < 0.5;
        const qdm = to ? obs : norm(obs + 180);
        const steps = [
          `De naald staat in het midden: je zit precies op de lijn van de gekozen koers ${brg(obs)}.`,
          to ? `Vlag TO: als je ${brg(obs)} vliegt, kom je recht bij het station uit. De koers naar het station (QDM) is dus ${brg(qdm)}.`
             : `Vlag FROM: als je ${brg(obs)} vliegt, vlieg je juist van het station weg. Naar het station is het de tegenovergestelde richting: ${brg(obs)} ± 180° = ${brg(qdm)}.`,
          to ? 'Bij windstil weer vlieg je die koers en blijft de naald gecentreerd.' : `Tip: draai de OBS naar ${brg(qdm)}; de vlag springt dan naar TO en de naald blijft in het midden.`
        ];
        return Q({ q: 'Het is windstil. Welke magnetische koers moet je vliegen om rechtstreeks naar de VOR te gaan?', o: options(qdm, [norm(qdm + 180), norm(qdm + 90), norm(qdm - 90)], brg),
          e: steps.join('\n'), img: cdiSvg(obs, 0, to), lo: this.lo, loText: 'VOR-informatie aflezen (koers naar het station)' });
      }
    },
    {
      id: 'indication', name: 'Welke aanwijzing verwacht je?', lo: '92.2.3.2.4',
      gen() {
        let R, obs, st;
        do { R = rnd(0, 359); obs = rnd(0, 71) * 5; st = cdiState(R, obs); } while (Math.abs(st.dev) < 3 || Math.abs(Math.abs(diff(R, obs)) - 90) < 8);
        const label = (to, right) => `${to ? 'TO' : 'FROM'}, naald ${right ? 'rechts' : 'links'}`;
        const right = st.dev > 0;
        const steps = [
          `Stap 1 – TO of FROM? Vergelijk je radiaal (${brg(R)}) met de OBS (${brg(obs)}): ze verschillen ${Math.abs(diff(R, obs))}°. ${st.to
            ? 'Meer dan 90°: de gekozen koers wijst naar het station toe, dus de vlag toont TO.'
            : 'Minder dan 90°: je zit aan de kant waar de gekozen koers naartoe wijst, dus de vlag toont FROM.'}`,
          st.to
            ? `Stap 2 – naald: de lijn naar het station toe is radiaal ${brg(obs + 180)}. Jouw radiaal ligt ${Math.abs(st.dev)}° ${right ? 'rechtsom (grotere waarde)' : 'linksom (kleinere waarde)'} daarvan. Als je ${brg(obs)} naar het station vliegt, is dat ${right ? 'links' : 'rechts'} van de lijn. De lijn ligt dus ${right ? 'rechts' : 'links'} van je: naald ${right ? 'rechts' : 'links'}.`
            : `Stap 2 – naald: jouw radiaal ligt ${Math.abs(st.dev)}° ${right ? 'linksom (kleinere waarde)' : 'rechtsom (grotere waarde)'} van radiaal ${brg(obs)}. Als je ${brg(obs)} van het station weg vliegt, is dat ${right ? 'links' : 'rechts'} van de lijn. De lijn ligt dus ${right ? 'rechts' : 'links'} van je: naald ${right ? 'rechts' : 'links'}.`,
          `Stap 3 – uitslag: ${Math.abs(st.dev) >= 10 ? `${Math.abs(st.dev)}° is meer dan 10°, dus volle uitslag.` : `${Math.abs(st.dev)}° ≈ ${Math.round(Math.abs(st.dev) / 2)} dots (2° per dot).`}`,
          'De koers die het vliegtuig vliegt speelt geen rol: een VOR-indicator hangt alleen af van je positie en de OBS-instelling.'
        ];
        const o = [label(st.to, right), label(st.to, !right), label(!st.to, right), label(!st.to, !right)];
        return Q({ q: `Je bevindt je op radiaal ${brg(R)} van een VOR en stelt de OBS in op ${brg(obs)}. Wat toont de VOR-indicator?`, o, e: steps.join('\n'),
          lo: this.lo, loText: 'Werking van de VOR-indicator (TO/FROM en naalduitslag)' });
      }
    }
  ];

  const adf = [
    {
      id: 'qdm', name: 'QDM uit koers en relatieve peiling', lo: '92.2.2.2.2',
      gen() {
        const mh = rnd(0, 71) * 5;
        let rb; do { rb = rnd(0, 71) * 5; } while (rb === 0 || rb === 180);
        const qdm = norm(mh + rb);
        const steps = [
          `Een ADF met vaste kaart heeft altijd 0 bovenaan (de neus van het vliegtuig). De naald toont dus de relatieve peiling: de hoek van je neus naar het NDB, rechtsom gemeten. Hier ${brg(rb)}${rb > 180 ? `, dus ${360 - rb}° links van de neus` : `, dus ${rb}° rechts van de neus`}.`,
          `QDM (magnetische koers naar het NDB) = magnetische koers + relatieve peiling = ${brg(mh)} + ${brg(rb)} = ${brg(qdm)}${mh + rb >= 360 ? ' (360° afgetrokken)' : ''}.`,
          `Controle: ${brg(mh)} ${rb > 180 ? '−' : '+'} ${rb > 180 ? 360 - rb : rb}° = ${brg(qdm)}. Valkuil: ${brg(rb)} is alleen de relatieve peiling, niet de QDM.`
        ];
        return Q({ q: `Je vliegt een magnetische koers van ${brg(mh)}. Wat is de QDM naar het NDB?`, o: options(qdm, [norm(mh - rb), rb, norm(qdm + 180)], brg),
          e: steps.join('\n'), img: rbiSvg(rb), lo: this.lo, loText: 'Aanwijzingen van RBI en RMI interpreteren' });
      }
    },
    {
      id: 'qdr', name: 'QDR (peiling vanaf het NDB)', lo: '92.2.2.2.2',
      gen() {
        const mh = rnd(0, 71) * 5;
        let rb; do { rb = rnd(0, 71) * 5; } while (rb === 0 || rb === 180);
        const qdm = norm(mh + rb), qdr = norm(qdm + 180);
        const steps = [
          `De naald van de vaste-kaart-ADF toont de relatieve peiling: ${brg(rb)}.`,
          `Eerst de QDM (koers naar het NDB): ${brg(mh)} + ${brg(rb)} = ${brg(qdm)}.`,
          `De QDR is de tegenovergestelde richting, van het NDB naar jou: ${brg(qdm)} ± 180° = ${brg(qdr)}.`
        ];
        return Q({ q: `Je vliegt een magnetische koers van ${brg(mh)}. Op welke QDR (magnetische peiling vanaf het NDB) bevind je je?`, o: options(qdr, [qdm, norm(rb + 180), norm(mh - rb + 180)], brg),
          e: steps.join('\n'), img: rbiSvg(rb), lo: this.lo, loText: 'Aanwijzingen van RBI en RMI interpreteren' });
      }
    },
    {
      id: 'turn', name: 'Draaien naar het NDB', lo: '92.2.2.2.2',
      gen() {
        const mh = rnd(0, 71) * 5;
        let rb; do { rb = rnd(2, 70) * 5; } while (Math.abs(rb - 180) < 20);
        const qdm = norm(mh + rb), dir = rb < 180 ? 'rechts' : 'links', amt = rb < 180 ? rb : 360 - rb;
        const steps = [
          `De naald wijst ${brg(rb)} relatief: het NDB ligt ${amt}° ${dir === 'rechts' ? 'rechts' : 'links'} van je neus.`,
          `Draai ${amt}° naar ${dir} tot de naald recht vooruit wijst (0 bovenaan): ${brg(mh)} ${dir === 'rechts' ? '+' : '−'} ${amt}° = ${brg(qdm)}.`,
          'Die nieuwe koers is de QDM. Bij windstil weer vlieg je zo rechtstreeks naar het NDB (homing).'
        ];
        const fmt = v => `${dir === 'rechts' ? 'Naar rechts' : 'Naar links'} naar ${brg(v)}`;
        const wrongDir = v => `${dir === 'rechts' ? 'Naar links' : 'Naar rechts'} naar ${brg(v)}`;
        const o = [];
        for (const v of [fmt(qdm), wrongDir(qdm), fmt(norm(mh - rb)), fmt(rb), wrongDir(norm(mh - rb)), fmt(norm(qdm + 20)), fmt(norm(qdm - 20))]) {
          if (!o.includes(v) && o.length < 4) o.push(v);
        }
        return Q({ q: `Je vliegt een magnetische koers van ${brg(mh)} en wil (windstil) rechtstreeks naar het NDB. Wat doe je?`, o,
          e: steps.join('\n'), img: rbiSvg(rb), lo: this.lo, loText: 'Homing naar een NDB' });
      }
    }
  ];

  const rmi = [
    {
      id: 'qdm', name: 'QDM aflezen op de RMI', lo: '92.2.2.2.2',
      gen() {
        const hdg = rnd(0, 71) * 5;
        let qdm; do { qdm = rnd(0, 71) * 5; } while (Math.abs(diff(qdm, hdg)) < 20 || Math.abs(diff(qdm, hdg)) > 160);
        const rb = norm(qdm - hdg);
        const steps = [
          `Bij een RMI draait de kompasroos mee met het vliegtuig: bovenaan staat altijd je koers (hier ${brg(hdg)}).`,
          `Daardoor wijst de kop van de naald rechtstreeks de magnetische peiling naar het station aan: lees af waar de kop op de roos staat → QDM ${brg(qdm)}.`,
          `De staart van de naald wijst de QDR / radiaal aan (${brg(qdm + 180)}).`,
          `Valkuil: ${brg(rb)} is de relatieve peiling (QDM − koers). Die lees je af op een ADF met vaste kaart, niet op een RMI.`
        ];
        return Q({ q: 'Wat is de QDM naar het station volgens de RMI?', o: options(qdm, [norm(qdm + 180), rb, hdg], brg),
          e: steps.join('\n'), img: rmiSvg(hdg, qdm), lo: this.lo, loText: 'Aanwijzingen van RBI en RMI interpreteren' });
      }
    },
    {
      id: 'radial', name: 'Radiaal / QDR aflezen op de RMI', lo: '92.2.2.2.2',
      gen() {
        const hdg = rnd(0, 71) * 5;
        let qdm; do { qdm = rnd(0, 71) * 5; } while (Math.abs(diff(qdm, hdg)) < 20 || Math.abs(diff(qdm, hdg)) > 160);
        const qdr = norm(qdm + 180);
        const steps = [
          `Bij een RMI draait de kompasroos mee met de koers (bovenaan ${brg(hdg)}). De naald toont dus echte magnetische richtingen.`,
          `De kop van de naald wijst naar het station: QDM ${brg(qdm)}.`,
          `De radiaal is de richting van het station naar jou, dus de staart van de naald: ${brg(qdr)}.`,
          `Valkuil: de kop (${brg(qdm)}) is de koers naar het station, niet je radiaal.`
        ];
        return Q({ q: 'De naald van de RMI is gekoppeld aan een VOR. Op welke radiaal bevind je je?', o: options(qdr, [qdm, norm(qdm - hdg), norm(qdr - hdg)], brg),
          e: steps.join('\n'), img: rmiSvg(hdg, qdm), lo: this.lo, loText: 'Aanwijzingen van RBI en RMI interpreteren' });
      }
    }
  ];

  const GENERATORS = { vor, adf, rmi };
  const GROUPS = {
    vor: { name: 'VOR (CDI)', icon: '📡', code: 'VOR', desc: 'Radiaal, TO/FROM, naalduitslag en positie aflezen' },
    adf: { name: 'ADF (RBI, vaste kaart)', icon: '🧭', code: 'ADF', desc: 'Relatieve peiling, QDM, QDR en homing' },
    rmi: { name: 'RMI', icon: '🎯', code: 'RMI', desc: 'QDM en radiaal aflezen met draaiende kaart' }
  };

  function generate(group, typeId) {
    const list = GENERATORS[group] || [];
    const g = list.find(x => x.id === typeId) || pick(list);
    const q = g.gen();
    q.type = g.id;
    q.typeName = g.name;
    return q;
  }

  // Voor tests
  const _internal = { cdiState };

  return { GENERATORS, GROUPS, generate, _internal };
})();

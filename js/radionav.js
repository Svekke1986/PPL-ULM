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
      img: o.img ? [svgUri(o.img)] : [], eImg: o.eImg ? svgUri(o.eImg) : '', review: false, calc: true
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
  const dots = dev => Math.min(5, Math.round(Math.abs(dev) / 2));
  const needleTxt = dev => (Math.abs(dev) < 0.5 ? 'in het midden' : `${dots(dev)} dot${dots(dev) === 1 ? '' : 's'} ${dev > 0 ? 'rechts' : 'links'}${Math.abs(dev) >= 10 ? ' (volle uitslag)' : ''}`);
  const QUAD = { NO: 'Noordoosten', ZO: 'Zuidoosten', ZW: 'Zuidwesten', NW: 'Noordwesten' };
  const quadOf = R => (R < 90 ? 'NO' : R < 180 ? 'ZO' : R < 270 ? 'ZW' : 'NW');
  // Windrichting (8 streken) van een richting in graden, bv. 145 → 'zuidoosten'
  const DIR8 = ['noorden', 'noordoosten', 'oosten', 'zuidoosten', 'zuiden', 'zuidwesten', 'westen', 'noordwesten'];
  const dir8 = d => DIR8[Math.round(norm(d) / 45) % 8];
  const DIRADJ = { noorden: 'noord', oosten: 'oost', zuiden: 'zuid', westen: 'west' };
  const kant = d => (DIRADJ[dir8(d)] || dir8(d).replace(/en$/, '')) + 'kant'; // 'oostkant', 'zuidoostkant'
  // Bereik van radialen binnen 90° van een richting, rechtsom geschreven: "005° tot 185°"
  const range90 = d => `${brg(d - 90)} tot ${brg(d + 90)}`;

  // Uitleg-blok: kopje in het vet + tekst. In de app wordt **…** vet weergegeven.
  const sec = (h, t) => `**${h}** ${t}`;

  // Algemene uitleg van de OBS-lijn (komt bij elke VOR-oefening terug)
  const obsLine = obs =>
    sec('De OBS-lijn:', `met de OBS op ${brg(obs)} legt de VOR-indicator één rechte lijn door het station: radiaal ${brg(obs)} aan de ene kant en radiaal ${brg(obs + 180)} aan de andere kant (${brg(obs)} ± 180°). Een radiaal wijst altijd vanaf het station naar buiten.`);

  function flagSec(obs, to, R) {
    const recip = norm(obs + 180);
    if (R === undefined) {
      // Vlag is gegeven (op het instrument): leg uit wat ze betekent.
      return sec('TO of FROM:', to
        ? `de vlag staat op TO. Dat betekent: als je koers ${brg(obs)} zou vliegen, kom je bij het station uit (het station ligt vóór je). Je zit dus aan de overkant van het station, in de TO-helft rond radiaal ${brg(recip)}: de ${kant(recip)} van het station (groene helft in de schets).`
        : `de vlag staat op FROM. Dat betekent: als je koers ${brg(obs)} zou vliegen, vlieg je van het station weg (het station ligt achter je). Je zit dus in de FROM-helft rond radiaal ${brg(obs)}: de ${kant(obs)} van het station (blauwe helft in de schets).`);
    }
    // Radiaal is gegeven: bepaal de vlag met één eenvoudige regel.
    const d = Math.abs(diff(R, obs));
    return sec('TO of FROM:', `vergelijk je radiaal met de OBS-waarde. Radiaal ${brg(R)} en OBS ${brg(obs)} liggen ${d}° uit elkaar.\n` +
      `• Minder dan 90° → FROM (je zit aan de kant waar de OBS-koers naartoe wijst).\n` +
      `• Meer dan 90° → TO (je zit aan de overkant; de OBS-koers brengt je naar het station).\n` +
      `${d}° is ${to ? 'meer' : 'minder'} dan 90°, dus ${to ? 'TO' : 'FROM'}. In de schets: de grens tussen TO en FROM is de lijn ${brg(obs - 90)}–${brg(obs + 90)}, haaks op de OBS-lijn. Radiaal ${brg(R)} ligt in de ${to ? 'groene TO-helft (rond radiaal ' + brg(recip) + ')' : 'blauwe FROM-helft (rond radiaal ' + brg(obs) + ')'}.`);
  }

  function needleSec(obs, dev) {
    if (Math.abs(dev) < 0.5) return sec('Naald:', 'de naald staat in het midden, dus je zit precies op de OBS-lijn.');
    const lineSide = dev > 0 ? 'rechts' : 'links', youSide = dev > 0 ? 'links' : 'rechts';
    const youDir = dev > 0 ? obs - 90 : obs + 90;
    return sec('Naald:', `de naald wijst altijd naar de OBS-lijn. Kijk in de richting van koers ${brg(obs)} (naar het ${dir8(obs)}): de naald staat ${lineSide}, dus de lijn ligt ${lineSide} van je en jij zit ${youSide} ervan. ${youSide[0].toUpperCase() + youSide.slice(1)} van koers ${brg(obs)} is de ${kant(youDir)}.`);
  }

  function deflSec(dev) {
    if (Math.abs(dev) < 0.5) return '';
    return sec('Uitslag:', Math.abs(dev) >= 10
      ? `je zit ${Math.abs(Math.round(dev))}° naast de lijn. Vanaf 10° staat de naald van een VOR volledig uit (volle uitslag).`
      : `elke dot is 2° (volle uitslag = 5 dots = 10°). ${needleTxt(dev)[0].toUpperCase() + needleTxt(dev).slice(1)} betekent dus ${Math.abs(Math.round(dev))}° naast de lijn.`);
  }

  const headingNote = sec('Let op:', 'de koers die het vliegtuig echt vliegt heeft geen invloed op een VOR-indicator. Alleen je positie (de radiaal) en de OBS-instelling bepalen wat je ziet.');
  const mnemonic = obs => sec('Ezelsbruggetje:', `TO-koers − 180° = de radiaal waarop je zit (${brg(obs)} − 180° = ${brg(obs + 180)}). Bij FROM is de OBS-waarde zelf je radiaal.`);

  // Schets voor de uitleg: station, OBS-lijn met beide radialen, TO-/FROM-kant en jouw positie.
  function sketchSvg(obs, R) {
    const c = 130, r = 100;
    const P = (a, rr) => [c + Math.sin(rad(a)) * rr, c - Math.cos(rad(a)) * rr];
    const pt = (a, rr) => P(a, rr).map(v => v.toFixed(1)).join(',');
    const recip = norm(obs + 180);
    const half = (centre, fill) => {
      const [x1, y1] = P(centre - 90, r), [x2, y2] = P(centre + 90, r);
      return `<path d="M${c},${c} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 0 1 ${x2.toFixed(1)},${y2.toFixed(1)} Z" fill="${fill}"/>`;
    };
    const lbl = (a, rr, t, col = '#334') => { const [x, y] = P(a, rr); return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="11" font-family="Arial, sans-serif" fill="${col}" text-anchor="middle" dominant-baseline="central">${t}</text>`; };
    const [ax, ay] = P(R, 72);
    const [ox, oy] = P(obs, 45), [ox2, oy2] = P(obs, 60);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 270" width="260" height="270">
      <rect width="260" height="270" rx="10" fill="#ffffff"/>
      ${half(recip, '#d9f2e1')}${half(obs, '#dde8fb')}
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#9aa4b2" stroke-width="1"/>
      ${lbl(0, r + 12, 'N', '#000')}${lbl(90, r + 12, 'O', '#000')}${lbl(180, r + 12, 'Z', '#000')}${lbl(270, r + 12, 'W', '#000')}
      ${lbl(recip + 40, 60, 'TO-kant', '#1d7a3e')}${lbl(obs + 40, 60, 'FROM-kant', '#1d4fa8')}
      <line x1="${P(obs, r).map(v => v.toFixed(1)).join('" y1="')}" x2="${P(recip, r)[0].toFixed(1)}" y2="${P(recip, r)[1].toFixed(1)}" stroke="#222" stroke-width="2"/>
      ${lbl(obs - 14, r - 12, 'R' + brg(obs).replace('°', ''), '#222')}${lbl(recip - 14, r - 12, 'R' + brg(recip).replace('°', ''), '#222')}
      <line x1="${ox.toFixed(1)}" y1="${oy.toFixed(1)}" x2="${ox2.toFixed(1)}" y2="${oy2.toFixed(1)}" stroke="#d97706" stroke-width="3"/>
      <polygon points="${pt(obs, 68)} ${pt(obs - 6, 56)} ${pt(obs + 6, 56)}" fill="#d97706"/>
      <polygon points="${pt(0, 8)} ${pt(120, 8)} ${pt(240, 8)}" fill="#fff" stroke="#222" stroke-width="2"/>
      <line x1="${c}" y1="${c}" x2="${ax.toFixed(1)}" y2="${ay.toFixed(1)}" stroke="#d64545" stroke-width="1.5" stroke-dasharray="4 3"/>
      <circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="6" fill="#d64545"/>
      <text x="${(ax + (ax > c ? -10 : 10)).toFixed(1)}" y="${(ay - 10).toFixed(1)}" font-size="12" font-weight="bold" font-family="Arial, sans-serif" fill="#d64545" text-anchor="${ax > c ? 'end' : 'start'}">jij</text>
      <text x="8" y="262" font-size="10.5" font-family="Arial, sans-serif" fill="#555">oranje pijl = OBS ${brg(obs)} · rode stip = jij (radiaal ${brg(R)})</text>
    </svg>`;
  }

  // Schets voor ADF/RMI: vliegtuig in het midden met zijn koers, richting naar het station (QDM).
  function bearingSketch(hdg, qdm) {
    const c = 130, r = 100;
    const P = (a, rr) => [c + Math.sin(rad(a)) * rr, c - Math.cos(rad(a)) * rr];
    const lbl = (a, rr, t, col = '#334') => { const [x, y] = P(a, rr); return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="11" font-family="Arial, sans-serif" fill="${col}" text-anchor="middle" dominant-baseline="central">${t}</text>`; };
    const [hx, hy] = P(hdg, 55), [sx, sy] = P(qdm, 88), [tx, ty] = P(qdm + 180, 60);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 270" width="260" height="270">
      <rect width="260" height="270" rx="10" fill="#ffffff"/>
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#9aa4b2" stroke-width="1"/>
      ${lbl(0, r + 12, 'N', '#000')}${lbl(90, r + 12, 'O', '#000')}${lbl(180, r + 12, 'Z', '#000')}${lbl(270, r + 12, 'W', '#000')}
      <line x1="${c}" y1="${c}" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}" stroke="#d97706" stroke-width="4"/>
      ${lbl(hdg - 16, 50, 'koers ' + brg(hdg), '#d97706')}
      <line x1="${c}" y1="${c}" x2="${sx.toFixed(1)}" y2="${sy.toFixed(1)}" stroke="#1d7a3e" stroke-width="2"/>
      <line x1="${c}" y1="${c}" x2="${tx.toFixed(1)}" y2="${ty.toFixed(1)}" stroke="#1d4fa8" stroke-width="2" stroke-dasharray="4 3"/>
      <rect x="${(sx - 7).toFixed(1)}" y="${(sy - 7).toFixed(1)}" width="14" height="14" fill="#1d7a3e" transform="rotate(45 ${sx.toFixed(1)} ${sy.toFixed(1)})"/>
      ${lbl(qdm + 16, 66, 'QDM ' + brg(qdm), '#1d7a3e')}${lbl(qdm + 196, 66, 'QDR ' + brg(qdm + 180), '#1d4fa8')}
      <circle cx="${c}" cy="${c}" r="5" fill="#d64545"/>
      <text x="8" y="262" font-size="11" font-family="Arial, sans-serif" fill="#555">rood = jij · groen = station (QDM) · blauw = QDR</text>
    </svg>`;
  }

  const vor = [
    {
      id: 'quadrant', name: 'Positie ten opzichte van de VOR', lo: '92.2.3.2.7',
      gen() {
        const obs = pick([0, 90, 180, 270]);
        let R; do { R = rnd(0, 359); } while ([0, 90, 180, 270, 360].some(c => Math.abs(R - c) < 15));
        const st = cdiState(R, obs);
        const half = st.to ? norm(obs + 180) : obs;
        const side = st.dev < 0 ? norm(obs + 90) : norm(obs - 90);
        const steps = [
          obsLine(obs),
          flagSec(obs, st.to),
          needleSec(obs, st.dev),
          sec('Conclusie:', `${kant(half)} + ${kant(side)} = ${QUAD[quadOf(R)].toLowerCase()} van de VOR. In dit voorbeeld zat je op radiaal ${brg(R)} (zie schets).`),
          headingNote
        ];
        const q = 'Waar bevindt het luchtvaartuig zich ten opzichte van de VOR?';
        const right = QUAD[quadOf(R)];
        const o = [right, ...Object.values(QUAD).filter(x => x !== right)];
        return Q({ q, o, e: steps.join('\n\n'), eImg: sketchSvg(obs, R), img: cdiSvg(obs, st.dev / 10, st.to), lo: this.lo, loText: 'VOR-informatie aflezen en interpreteren' });
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
        const bigger = (dev > 0) === to;
        const steps = [
          obsLine(obs),
          flagSec(obs, to),
          dev === 0 ? sec('Naald:', `de naald staat in het midden, dus je zit precies op radiaal ${brg(base)}.`)
            : sec('Naald (hoeveel):', `de naald staat ${needleTxt(dev)}. Elke dot is 2°, dus je zit ${Math.abs(dev)}° naast radiaal ${brg(base)}.`),
          dev === 0 ? '' : sec('Naald (welke kant):', `kijk in de richting van koers ${brg(obs)}. De naald staat ${dev > 0 ? 'rechts' : 'links'}, dus de lijn ligt ${dev > 0 ? 'rechts' : 'links'} van je en jij zit ${dev > 0 ? 'links' : 'rechts'} ervan, aan de ${kant(dev > 0 ? obs - 90 : obs + 90)}. Vanaf radiaal ${brg(base)} is dat een stukje ${bigger ? 'rechtsom (grotere waarde)' : 'linksom (kleinere waarde)'}: ${brg(base)} ${bigger ? '+' : '−'} ${Math.abs(dev)}° = ${brg(R)}.`),
          sec('Antwoord:', `radiaal ${brg(R)}.`),
          to ? mnemonic(obs) : sec('Valkuil:', `bij FROM is de OBS-waarde (${brg(obs)}) je radiaal. ${brg(obs + 180)} is de koers die je naar het station zou moeten vliegen.`)
        ].filter(Boolean);
        const wrong = [to ? obs + 180 - dev : obs + dev, to ? obs + dev : obs + 180 - dev, to ? obs - dev : obs + 180 + dev];
        return Q({ q: 'Op welke VOR-radiaal bevindt het luchtvaartuig zich?', o: options(R, wrong.map(norm), brg), e: steps.join('\n\n'), eImg: sketchSvg(obs, R),
          img: cdiSvg(obs, dev / 10, to), lo: this.lo, loText: 'VOR-informatie aflezen (geselecteerde koers, naald, TO/FROM)' });
      }
    },
    {
      id: 'direct', name: 'Koers om rechtstreeks naar de VOR te vliegen', lo: '92.2.3.2.7',
      gen() {
        const obs = rnd(0, 71) * 5, to = Math.random() < 0.5;
        const qdm = to ? obs : norm(obs + 180);
        const R = norm(qdm + 180);
        const steps = [
          obsLine(obs),
          sec('Naald:', `de naald staat in het midden, dus je zit precies op de OBS-lijn, op radiaal ${brg(R)}.`),
          to ? sec('TO of FROM:', `de vlag staat op TO: als je ${brg(obs)} vliegt, kom je recht bij het station uit. De koers naar het station (QDM) is dus ${brg(qdm)}.`)
             : sec('TO of FROM:', `de vlag staat op FROM: als je ${brg(obs)} vliegt, vlieg je juist van het station weg. Naar het station moet je de andere kant op: ${brg(obs)} ± 180° = ${brg(qdm)}.`),
          to ? sec('Ezelsbruggetje:', `bij TO + naald in het midden is de OBS-waarde meteen je koers naar het station.`)
             : sec('Tip:', `draai de OBS naar ${brg(qdm)}. De vlag springt dan naar TO en de naald blijft in het midden: zo vlieg je met koers ${brg(qdm)} naar het station.`)
        ];
        return Q({ q: 'Het is windstil. Welke magnetische koers moet je vliegen om rechtstreeks naar de VOR te gaan?', o: options(qdm, [norm(qdm + 180), norm(qdm + 90), norm(qdm - 90)], brg),
          e: steps.join('\n\n'), eImg: sketchSvg(obs, R), img: cdiSvg(obs, 0, to), lo: this.lo, loText: 'VOR-informatie aflezen (koers naar het station)' });
      }
    },
    {
      id: 'indication', name: 'Welke aanwijzing verwacht je?', lo: '92.2.3.2.4',
      gen() {
        let R, obs, st;
        do { R = rnd(0, 359); obs = rnd(0, 71) * 5; st = cdiState(R, obs); } while (Math.abs(st.dev) < 3 || Math.abs(Math.abs(diff(R, obs)) - 90) < 8);
        const label = (to, right) => `${to ? 'TO' : 'FROM'}, naald ${right ? 'rechts' : 'links'}`;
        const right = st.dev > 0;
        const youDir = right ? obs - 90 : obs + 90;
        const steps = [
          obsLine(obs),
          flagSec(obs, st.to, R),
          sec('Naald:', `op radiaal ${brg(R)} sta je ten ${dir8(R)} van het station, aan de ${kant(youDir)} van de lijn ${brg(obs)}/${brg(obs + 180)}. Kijk in de richting van koers ${brg(obs)} (naar het ${dir8(obs)}): de lijn ligt dan ${right ? 'rechts' : 'links'} van je. De naald wijst naar de lijn, dus naald ${right ? 'rechts' : 'links'}.`),
          deflSec(st.dev),
          headingNote
        ];
        const o = [label(st.to, right), label(st.to, !right), label(!st.to, right), label(!st.to, !right)];
        return Q({ q: `Je bevindt je op radiaal ${brg(R)} van een VOR en stelt de OBS in op ${brg(obs)}. Wat toont de VOR-indicator?`, o, e: steps.join('\n\n'), eImg: sketchSvg(obs, R),
          lo: this.lo, loText: 'Werking van de VOR-indicator (TO/FROM en naalduitslag)' });
      }
    }
  ];

  const adfIntro = rb => sec('Wat toont de ADF?', `bij een ADF met vaste kaart staat 0 altijd bovenaan, en dat is de neus van het vliegtuig. De naald toont dus niet de richting op het kompas, maar de relatieve peiling: de hoek van je neus naar het NDB, rechtsom gemeten. Hier ${brg(rb)}, dus het NDB ligt ${rb > 180 ? `${360 - rb}° links` : `${rb}° rechts`} van je neus.`);

  const adf = [
    {
      id: 'qdm', name: 'QDM uit koers en relatieve peiling', lo: '92.2.2.2.2',
      gen() {
        const mh = rnd(0, 71) * 5;
        let rb; do { rb = rnd(0, 71) * 5; } while (rb === 0 || rb === 180);
        const qdm = norm(mh + rb);
        const steps = [
          adfIntro(rb),
          sec('Berekening:', `QDM (de magnetische koers naar het NDB) = je koers + de relatieve peiling = ${brg(mh)} + ${brg(rb)} = ${brg(qdm)}${mh + rb >= 360 ? ' (boven 360°, dus 360° aftrekken)' : ''}.`),
          sec('Controle:', `het NDB ligt ${rb > 180 ? `${360 - rb}° links` : `${rb}° rechts`} van je neus: ${brg(mh)} ${rb > 180 ? '−' : '+'} ${rb > 180 ? 360 - rb : rb}° = ${brg(qdm)}.`),
          sec('Valkuil:', `${brg(rb)} is alleen de relatieve peiling. De QDM krijg je pas als je je eigen koers erbij telt.`)
        ];
        return Q({ q: `Je vliegt een magnetische koers van ${brg(mh)}. Wat is de QDM naar het NDB?`, o: options(qdm, [norm(mh - rb), rb, norm(qdm + 180)], brg),
          e: steps.join('\n\n'), eImg: bearingSketch(mh, qdm), img: rbiSvg(rb), lo: this.lo, loText: 'Aanwijzingen van RBI en RMI interpreteren' });
      }
    },
    {
      id: 'qdr', name: 'QDR bepalen', lo: '92.2.2.2.2',
      gen() {
        const mh = rnd(0, 71) * 5;
        let rb; do { rb = rnd(0, 71) * 5; } while (rb === 0 || rb === 180);
        const qdm = norm(mh + rb), qdr = norm(qdm + 180);
        const steps = [
          adfIntro(rb),
          sec('Stap 1 – QDM:', `koers + relatieve peiling = ${brg(mh)} + ${brg(rb)} = ${brg(qdm)}. Dat is de richting van jou naar het NDB.`),
          sec('Stap 2 – QDR:', `de QDR is de omgekeerde richting, van het NDB naar jou: ${brg(qdm)} ± 180° = ${brg(qdr)}.`),
          sec('Ezelsbruggetje:', 'QDM = de koers die je vliegt om bij het station te komen (naar het station). QDR = de radiaal, altijd vanaf het station naar jou. Ze verschillen altijd precies 180°.')
        ];
        return Q({ q: `Je vliegt een magnetische koers van ${brg(mh)}. Wat is de QDR van het NDB?`, o: options(qdr, [qdm, norm(rb + 180), norm(mh - rb + 180)], brg),
          e: steps.join('\n\n'), eImg: bearingSketch(mh, qdm), img: rbiSvg(rb), lo: this.lo, loText: 'Aanwijzingen van RBI en RMI interpreteren' });
      }
    },
    {
      id: 'turn', name: 'Draaien naar het NDB', lo: '92.2.2.2.2',
      gen() {
        const mh = rnd(0, 71) * 5;
        let rb; do { rb = rnd(2, 70) * 5; } while (Math.abs(rb - 180) < 20);
        const qdm = norm(mh + rb), dir = rb < 180 ? 'rechts' : 'links', amt = rb < 180 ? rb : 360 - rb;
        const steps = [
          adfIntro(rb),
          sec('Welke kant?', `de naald staat ${dir === 'rechts' ? 'rechts' : 'links'} van de neus (${brg(rb)} ${rb < 180 ? 'is tussen 000° en 180°' : 'is tussen 180° en 360°'}), dus je draait naar ${dir}, de kortste weg.`),
          sec('Hoeveel?', `${amt}°: ${brg(mh)} ${dir === 'rechts' ? '+' : '−'} ${amt}° = ${brg(qdm)}. Draai tot de naald recht vooruit wijst (0 bovenaan).`),
          sec('Resultaat:', `je nieuwe koers ${brg(qdm)} is de QDM. Bij windstil weer vlieg je zo rechtstreeks naar het NDB (homing).`)
        ];
        const fmt = v => `${dir === 'rechts' ? 'Naar rechts' : 'Naar links'} naar ${brg(v)}`;
        const wrongDir = v => `${dir === 'rechts' ? 'Naar links' : 'Naar rechts'} naar ${brg(v)}`;
        const o = [];
        for (const v of [fmt(qdm), wrongDir(qdm), fmt(norm(mh - rb)), fmt(rb), wrongDir(norm(mh - rb)), fmt(norm(qdm + 20)), fmt(norm(qdm - 20))]) {
          if (!o.includes(v) && o.length < 4) o.push(v);
        }
        return Q({ q: `Je vliegt een magnetische koers van ${brg(mh)} en wil rechtstreeks naar het NDB vliegen. Het is windstil. Wat doe je?`, o,
          e: steps.join('\n\n'), eImg: bearingSketch(mh, qdm), img: rbiSvg(rb), lo: this.lo, loText: 'Homing naar een NDB' });
      }
    }
  ];

  const rmiIntro = hdg => sec('Wat toont de RMI?', `bij een RMI draait de kompasroos mee met het vliegtuig: bovenaan staat altijd je koers (hier ${brg(hdg)}). Daardoor toont de naald echte magnetische richtingen. Je hoeft niets op te tellen, alleen af te lezen.`);

  const rmi = [
    {
      id: 'qdm', name: 'QDM aflezen op de RMI', lo: '92.2.2.2.2',
      gen() {
        const hdg = rnd(0, 71) * 5;
        let qdm; do { qdm = rnd(0, 71) * 5; } while (Math.abs(diff(qdm, hdg)) < 20 || Math.abs(diff(qdm, hdg)) > 160);
        const rb = norm(qdm - hdg);
        const steps = [
          rmiIntro(hdg),
          sec('Kop van de naald:', `wijst naar het station. Lees af waar de kop op de roos staat: QDM ${brg(qdm)}.`),
          sec('Staart van de naald:', `wijst de omgekeerde richting aan, de QDR / radiaal: ${brg(qdm + 180)}.`),
          sec('Valkuil:', `${brg(rb)} is de relatieve peiling (QDM − koers). Die zie je op een ADF met vaste kaart, niet op een RMI.`)
        ];
        return Q({ q: 'Wat is de QDM naar het station volgens de RMI?', o: options(qdm, [norm(qdm + 180), rb, hdg], brg),
          e: steps.join('\n\n'), eImg: bearingSketch(hdg, qdm), img: rmiSvg(hdg, qdm), lo: this.lo, loText: 'Aanwijzingen van RBI en RMI interpreteren' });
      }
    },
    {
      id: 'radial', name: 'Radiaal / QDR aflezen op de RMI', lo: '92.2.2.2.2',
      gen() {
        const hdg = rnd(0, 71) * 5;
        let qdm; do { qdm = rnd(0, 71) * 5; } while (Math.abs(diff(qdm, hdg)) < 20 || Math.abs(diff(qdm, hdg)) > 160);
        const qdr = norm(qdm + 180);
        const steps = [
          rmiIntro(hdg),
          sec('Kop van de naald:', `wijst naar het station: QDM ${brg(qdm)}.`),
          sec('Staart van de naald:', `een radiaal wijst altijd vanaf het station naar buiten, dus naar jou toe. Dat is de staart van de naald: radiaal ${brg(qdr)}.`),
          sec('Valkuil:', `de kop (${brg(qdm)}) is de koers naar het station, niet je radiaal. Ze verschillen altijd 180°.`)
        ];
        return Q({ q: 'De naald van de RMI is gekoppeld aan een VOR. Op welke radiaal bevind je je?', o: options(qdr, [qdm, norm(qdm - hdg), norm(qdr - hdg)], brg),
          e: steps.join('\n\n'), eImg: bearingSketch(hdg, qdm), img: rmiSvg(hdg, qdm), lo: this.lo, loText: 'Aanwijzingen van RBI en RMI interpreteren' });
      }
    }
  ];

  const GENERATORS = { vor, adf, rmi };
  const GROUPS = {
    vor: { name: 'VOR (CDI)', icon: '📡', code: 'VOR', desc: 'Radiaal, TO/FROM, naalduitslag en positie aflezen' },
    adf: { name: 'ADF (RBI)', icon: '🧭', code: 'ADF', desc: 'Relatieve peiling, QDM, QDR en homing' },
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

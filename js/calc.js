// Rekenvragen: de site genereert zelf oefeningen met willekeurige waarden.
// Het juiste antwoord wordt berekend; de foute antwoorden zijn typische denkfouten.
// Elke generator geeft { q, o: [juist, fout, fout, fout], e, src, ref, lo, loText } terug.

window.CALC = (function () {
  'use strict';

  // ---------- helpers ----------
  const rnd = (min, max, step = 1) => min + step * Math.floor(Math.random() * (Math.floor((max - min) / step) + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const rad = d => d * Math.PI / 180;
  const deg = r => r * 180 / Math.PI;
  const norm = d => ((Math.round(d) % 360) + 360) % 360;
  const hdg = d => String(norm(d) === 0 ? 360 : norm(d)).padStart(3, '0') + '°';
  const brg = d => String(norm(d)).padStart(3, '0') + '°';
  const num = (x, dec = 0) => x.toFixed(dec).replace('.', ',');
  const pad2 = n => String(n).padStart(2, '0');
  const clock = mins => { const m = ((Math.round(mins) % 1440) + 1440) % 1440; return pad2(Math.floor(m / 60)) + pad2(m % 60); };
  const hmin = mins => { const m = Math.round(mins); return `${Math.floor(m / 60)}:${pad2(m % 60)} h`; };
  const ew = v => `${Math.abs(v)}° ${v >= 0 ? 'E' : 'W'}`;
  const signed = v => (v >= 0 ? '+' : '−') + Math.abs(v);
  // Uitleg voor ware → magnetisch (variatie) of magnetisch → kompas (deviatie):
  // oost aftrekken ("East is least"), west optellen ("West is best").
  const ewStep = (kind, fromName, fromVal, v, toName, toVal) =>
    `${kind[0].toUpperCase() + kind.slice(1)} ${ew(v)}: ${v > 0 ? `oost${kind} trek je af ("East is least")` : `west${kind} tel je op ("West is best")`}.\n` +
    `${toName} = ${fromName} ${v > 0 ? '−' : '+'} ${kind} = ${hdg(fromVal)} ${v > 0 ? '−' : '+'} ${Math.abs(v)}° = ${hdg(toVal)}.`;

  // Build the 4 options: correct first, then distinct distractors (fallback: correct ± k·step).
  function options(correct, wrong, fmt, step, minGap = 0) {
    const out = [fmt(correct)];
    for (const w of wrong) {
      if (Math.abs(w - correct) < minGap) continue;
      const s = fmt(w);
      if (!out.includes(s) && out.length < 4) out.push(s);
    }
    for (let k = 1; out.length < 4 && k < 50; k++) {
      for (const cand of [correct + k * step, correct - k * step]) {
        const s = fmt(cand);
        if (!out.includes(s) && out.length < 4) out.push(s);
      }
    }
    return out;
  }

  function Q(o) {
    return {
      q: o.q, o: o.o, c: 0, e: o.e, src: o.src || 'syl', ref: o.ref || '',
      lo: o.lo || '', loText: o.loText || '', img: [], review: false, calc: true
    };
  }

  // ======================================================================
  // NAVIGATIE
  // ======================================================================
  const navigation = [
    {
      id: 'wind', name: 'Windcorrectie: luchtkoers en grondsnelheid', lo: '91.3.3.2.1',
      gen() {
        let tt, tas, wd, ws, angle, xw;
        do {
          tt = rnd(5, 360, 5); tas = rnd(80, 140, 5); wd = rnd(10, 360, 10); ws = rnd(10, 30, 5);
          angle = rad(wd - tt); xw = ws * Math.sin(angle);
        } while (Math.abs(xw) < 5 || Math.abs(ws * Math.cos(angle)) < 5);
        const hw = ws * Math.cos(angle);                 // + = tegenwind
        const wca = deg(Math.asin(xw / tas));            // + = naar rechts opsturen
        const th = tt + wca;
        const gs = tas * Math.cos(rad(wca)) - hw;
        const W = Math.round(wca);
        const steps = [
          `Hoek tussen wind en grondkoers: ${wd}° − ${tt}° = ${norm(wd - tt)}°.`,
          `Zijwindcomponent = ${ws} × sin(${norm(wd - tt)}°) ≈ ${num(Math.abs(xw), 1)} kt (wind van ${xw > 0 ? 'rechts' : 'links'}).`,
          `Opstuurhoek (WCA) = arcsin(${num(Math.abs(xw), 1)} / ${tas}) ≈ ${Math.abs(W)}° naar ${W > 0 ? 'rechts' : 'links'} (vuistregel: zijwind × 60 / TAS).`,
          `${hw >= 0 ? 'Tegenwindcomponent' : 'Rugwindcomponent'} = ${ws} × |cos(${norm(wd - tt)}°)| ≈ ${num(Math.abs(hw), 1)} kt.`,
          `TH = TT ${W >= 0 ? '+' : '−'} ${Math.abs(W)}° = ${hdg(th)}; GS ≈ TAS × cos(WCA) ${hw >= 0 ? '−' : '+'} ${num(Math.abs(hw), 1)} ≈ ${Math.round(gs)} kt.`
        ];
        const askGs = Math.random() < 0.5;
        const q = `Ware grondkoers (TT): ${hdg(tt)}, TAS: ${tas} kt, wind: ${brg(wd)}/${ws} kt. ` +
          (askGs ? 'Wat is de grondsnelheid (GS)?' : 'Wat is de ware luchtkoers (TH)?');
        const o = askGs
          ? options(Math.round(gs), [Math.round(tas + hw), tas, Math.round(gs + (hw >= 0 ? -ws : ws))], v => `${v} kt`, 6, 4)
          : options(norm(th), [norm(tt - wca), tt, norm(tt + 2 * wca)], hdg, 3);
        return Q({ q, o, e: steps.join('\n'), lo: this.lo, loText: 'Windcorrectie met de winddriehoek (opstuurhoek en grondsnelheid)' });
      }
    },
    {
      id: 'eta', name: 'Vliegtijd en aankomsttijd (ETA)', lo: '91.3.1.4.1',
      gen() {
        let dist, tas, hw, gs;
        do { dist = rnd(40, 240, 5); tas = rnd(85, 140, 5); hw = rnd(-25, 25, 5); gs = tas - hw; } while (hw === 0);
        const etd = rnd(7 * 60, 17 * 60, 1);
        const t = dist / gs * 60;
        const wrongHours = Math.floor(dist / gs) * 60 + Math.round((dist / gs % 1) * 100); // decimale uren als minuten gelezen
        const steps = [
          `GS = TAS ${hw > 0 ? '−' : '+'} ${hw > 0 ? 'tegenwind' : 'rugwind'} = ${tas} ${hw > 0 ? '−' : '+'} ${Math.abs(hw)} = ${gs} kt.`,
          `Vliegtijd = afstand / GS = ${dist} / ${gs} = ${num(dist / gs, 3)} h ≈ ${Math.round(t)} min.`,
          `ETA = ETD + vliegtijd = ${clock(etd)} + ${Math.round(t)} min = ${clock(etd + t)} UTC.`,
          'Let op: 0,5 h is 30 minuten, niet 50.'
        ];
        const q = `Afstand: ${dist} NM, TAS: ${tas} kt, ${hw > 0 ? 'tegenwindcomponent' : 'rugwindcomponent'}: ${Math.abs(hw)} kt, ETD: ${clock(etd)} UTC. Wat is de ETA?`;
        const o = options(etd + t, [etd + dist / tas * 60, etd + dist / (tas + hw) * 60, etd + wrongHours], v => `${clock(v)} UTC`, 4);
        return Q({ q, o, e: steps.join('\n'), lo: this.lo, loText: 'Berekeningen met grondsnelheid, afstand en tijd' });
      }
    },
    {
      id: 'headings', name: 'Koersen: TT, TH, MH, CH (variatie en deviatie)', lo: '91.4.1.1.2',
      gen() {
        const tt = rnd(5, 360, 1);
        let wca; do { wca = rnd(-12, 12); } while (Math.abs(wca) < 2);
        let v; do { v = rnd(-8, 8); } while (v === 0);
        let dv; do { dv = rnd(-4, 4); } while (dv === 0);
        const th = tt + wca, mh = th - v, ch = mh - dv;
        const ask = pick(['MH', 'CH']);
        const ans = ask === 'MH' ? mh : ch;
        const steps = [
          `Opstuurhoek ${signed(wca)}° (${wca > 0 ? 'naar rechts' : 'naar links'}): TH = TT ${wca >= 0 ? '+' : '−'} WCA = ${hdg(tt)} ${wca >= 0 ? '+' : '−'} ${Math.abs(wca)}° = ${hdg(th)}.`,
          ewStep('variatie', 'TH', th, v, 'MH', mh),
          ask === 'CH' ? ewStep('deviatie', 'MH', mh, dv, 'CH', ch) : ''
        ].filter(Boolean);
        const q = `Gegeven: TT ${hdg(tt)}, opstuurhoek (WCA) ${signed(wca)}°, variatie ${ew(v)}, deviatie ${ew(dv)}. Wat is de ${ask === 'MH' ? 'magnetische luchtkoers (MH)' : 'kompaskoers (CH)'}?`;
        const wrong = ask === 'MH'
          ? [th + v, tt - v, tt - wca - v]
          : [mh + dv, th + v - dv, th + v + dv];
        return Q({ q, o: options(norm(ans), wrong.map(norm), hdg, 2), e: steps.join('\n'), lo: this.lo, loText: 'Omzetting tussen ware, magnetische en kompaskoersen' });
      }
    },
    {
      id: 'qcodes', name: 'Q-codes: QDM, QDR, QTE, QUJ', lo: '91.2.3.5.2',
      gen() {
        const qdr = rnd(0, 359);
        let v; do { v = rnd(-10, 10); } while (v === 0);
        const val = { QDR: qdr, QDM: qdr + 180, QTE: qdr + v, QUJ: qdr + 180 + v };
        const keys = Object.keys(val);
        const given = pick(keys);
        let ask; do { ask = pick(keys); } while (ask === given);
        const magGiven = given === 'QDR' || given === 'QDM', magAsk = ask === 'QDR' || ask === 'QDM';
        const fromGiven = given === 'QDR' || given === 'QTE', fromAsk = ask === 'QDR' || ask === 'QTE';
        const g = val[given], ans = val[ask];
        const flip = fromGiven !== fromAsk ? 180 : 0;
        const varTerm = magGiven === magAsk ? 0 : (magAsk ? -v : v);
        const kind = (m, f) => `${m ? 'magnetische' : 'ware'} ${f ? 'peiling vanaf' : 'koers naar'} het station`;
        const east = v > 0;

        // Stap 1: vanaf ↔ naar
        const mid = g + flip;
        const step1 = flip
          ? `${given} is ${fromGiven ? 'vanaf' : 'naar'} het station, ${ask} is ${fromAsk ? 'vanaf' : 'naar'} het station: de richting draait om, dus ±180°.\n${brg(g)} ${norm(g) < 180 ? '+' : '−'} 180° = ${brg(mid)}.`
          : `${given} en ${ask} zijn allebei ${fromAsk ? 'vanaf' : 'naar'} het station: de richting blijft dezelfde, dus geen 180°.\nWe blijven op ${brg(mid)}.`;
        // Stap 2: waar ↔ magnetisch
        const step2 = varTerm === 0
          ? `${given} en ${ask} zijn allebei ${magAsk ? 'magnetisch' : 'waar'}: de variatie (${ew(v)}) speelt hier geen rol. Ze staat er alleen om je op het verkeerde been te zetten.`
          : magAsk
            ? `Van waar naar magnetisch: ${east ? 'oostvariatie trek je af ("East is least")' : 'westvariatie tel je op ("West is best")'}.\n${brg(mid)} ${east ? '−' : '+'} ${Math.abs(v)}° = ${brg(ans)}.`
            : `Van magnetisch naar waar: omgekeerd, dus ${east ? 'oostvariatie tel je op' : 'westvariatie trek je af'}.\n${brg(mid)} ${east ? '+' : '−'} ${Math.abs(v)}° = ${brg(ans)}.`;

        // Foute antwoorden = typische denkfouten (met uitleg in de valkuilen)
        const traps = flip
          ? [[g + varTerm, '180° vergeten: je blijft dan in de verkeerde richting (vanaf/naar)']]
          : [[g + 180 + varTerm, '180° bijgeteld, terwijl de richting (vanaf/naar) dezelfde blijft']];
        if (varTerm) {
          traps.push([g + flip - varTerm, 'variatie de verkeerde kant op toegepast']);
          traps.push([g + flip, 'variatie vergeten']);
        } else {
          const both = magAsk ? 'magnetisch' : 'waar';
          traps.push([g + flip + Math.abs(v), `variatie toch toegepast (+${Math.abs(v)}°), terwijl beide al ${both} zijn`]);
          traps.push([g + flip - Math.abs(v), `variatie toch toegepast (−${Math.abs(v)}°), terwijl beide al ${both} zijn`]);
        }
        traps.push([g + flip + 2 * varTerm, 'variatie twee keer toegepast']);
        const o = options(norm(ans), traps.map(t => norm(t[0])), brg, 5);
        const seen = new Set([brg(ans)]);
        const pit = traps.filter(([val2]) => { const k = brg(val2); if (!o.includes(k) || seen.has(k)) return false; seen.add(k); return true; })
          .map(([val2, why]) => `${brg(val2)}: ${why}.`);

        const steps = [
          `**De vier Q-codes:**\nQDM = ${kind(true, false)} · QDR = ${kind(true, true)}\nQUJ = ${kind(false, false)} · QTE = ${kind(false, true)}\n`,
          `**Wat is gegeven en gevraagd?**\n${given} ${brg(g)} = ${kind(magGiven, fromGiven)}. Gevraagd: ${ask} = ${kind(magAsk, fromAsk)}.\n`,
          `**Stap 1 – Vanaf of naar het station?**\n${step1}\n`,
          `**Stap 2 – Waar of magnetisch?**\n${step2}\n`,
          `**Antwoord:**\n${ask} = ${brg(ans)}.`,
          ...(pit.length ? [`\n**Valkuilen:**\n${pit.join('\n')}`] : [])
        ];
        const q = `Gegeven: ${given} ${brg(g)}, variatie ${ew(v)}. Wat is de ${ask}?`;
        return Q({ q, o, e: steps.join('\n'), lo: this.lo, loText: "De termen 'QTE', 'QUJ', 'QDM', 'QDR' omzetten" });
      }
    },
    {
      id: 'latitude', name: 'Afstand langs een meridiaan (breedtegraden)', lo: '91.1.2.3.3',
      gen() {
        const lat1 = rnd(40, 60), m1 = rnd(0, 59);
        const dNm = rnd(30, 400, 10);
        const north = Math.random() < 0.5;
        const total1 = lat1 * 60 + m1, total2 = total1 + (north ? dNm : -dNm);
        const fmtLat = t => `${Math.floor(t / 60)}°${pad2(t % 60)}'N`;
        const steps = [
          "1° breedte = 60 NM, dus 1' (boogminuut) = 1 NM.",
          `${dNm} NM = ${dNm}' = ${Math.floor(dNm / 60)}°${pad2(dNm % 60)}'.`,
          `${fmtLat(total1)} ${north ? '+' : '−'} ${Math.floor(dNm / 60)}°${pad2(dNm % 60)}' = ${fmtLat(total2)}.`
        ];
        const q = `Een vliegtuig vertrekt op ${fmtLat(total1)} en vliegt ${dNm} NM recht naar het ${north ? 'noorden' : 'zuiden'} langs de meridiaan. Op welke breedtegraad komt het aan?`;
        const s = north ? 1 : -1;
        const wrong = [total1 - s * dNm, total1 + s * Math.round(dNm / 111 * 60), total1 + s * Math.round(dNm / 1.852)];
        return Q({ q, o: options(total2, wrong, fmtLat, 10), e: steps.join('\n'), lo: this.lo, loText: 'Afstand in NM tussen twee punten op dezelfde meridiaan' });
      }
    },
    {
      id: 'time', name: 'Tijd: lengtegraad en UTC', lo: '91.1.3.4.6',
      gen() {
        if (Math.random() < 0.5) {
          const d = rnd(5, 45, 5);
          const mins = d * 4;
          const steps = ['De aarde draait 360° in 24 h: 15° per uur, dus 1° = 4 minuten.', `${d}° × 4 min = ${mins} min = ${hmin(mins)}.`];
          const q = `Wat is het verschil in zonnetijd tussen twee plaatsen die ${d}° in lengte van elkaar liggen?`;
          return Q({ q, o: options(mins, [d * 15, d * 6, d], hmin, 4), e: steps.join('\n'), lo: '91.1.3.1.3', loText: 'Dagelijkse beweging van de zon' });
        }
        const summer = Math.random() < 0.5;
        const off = summer ? 2 : 1;
        const local = rnd(6 * 60, 20 * 60, 5);
        const steps = [`${summer ? 'Zomertijd (CEST)' : 'Wintertijd (CET)'} = UTC+${off}.`, `UTC = lokale tijd − ${off} h = ${clock(local)} − ${off} h = ${clock(local - off * 60)} UTC.`];
        const q = `In België is het ${clock(local)} lokale tijd (${summer ? 'zomertijd' : 'wintertijd'}). Hoe laat is het in UTC?`;
        return Q({ q, o: options(local - off * 60, [local + off * 60, local - (3 - off) * 60, local], v => `${clock(v)} UTC`, 60), e: steps.join('\n'), lo: this.lo, loText: 'Omzetten tussen lokale tijd en UTC' });
      }
    },
    {
      id: 'scale', name: 'Kaartschaal', lo: '91.3.1.1.2',
      gen() {
        const scale = pick([250000, 500000, 1000000]);
        const cm = rnd(40, 400, 5) / 10;
        const km = cm * scale / 100000;
        const nm = km / 1.852;
        const steps = [
          `Op een kaart 1:${scale.toLocaleString('nl-BE')} is 1 cm = ${num(scale / 100000, 1)} km.`,
          `${num(cm, 1)} cm × ${num(scale / 100000, 1)} km = ${num(km, 1)} km.`,
          `${num(km, 1)} km / 1,852 = ${num(nm, 1)} NM.`
        ];
        const q = `Op een kaart met schaal 1:${scale.toLocaleString('nl-BE')} meet je ${num(cm, 1)} cm tussen twee punten. Hoeveel NM is dat?`;
        return Q({ q, o: options(Math.round(nm), [Math.round(km), Math.round(nm * 10), Math.round(km * 1.852)], v => `${v} NM`, 3), e: steps.join('\n'), lo: this.lo, loText: 'Rekenen met kaartschaal' });
      }
    },
    {
      id: 'onein60', name: 'Koerscorrectie met de 1-op-60-regel', lo: '91.4.2.1.3',
      gen() {
        const flown = rnd(20, 60, 5), remain = rnd(20, 80, 5);
        const off = rnd(2, 8);
        const right = Math.random() < 0.5;
        const a = off * 60 / flown, b = off * 60 / remain;
        const total = Math.round(a + b);
        const side = right ? 'rechts' : 'links', back = right ? 'links' : 'rechts';
        const steps = [
          `**De 1-op-60-regel:**\n1 NM naast de koers na 60 NM gevlogen ≈ 1° afwijking. Daarom: hoek (°) = afwijking (NM) × 60 / afstand (NM). De 60 komt van 1 radiaal ≈ 57,3°, voor het gemak afgerond naar 60.\n`,
          `**Stap 1 – Afwijkingshoek (track error):**\nNa ${flown} NM zit je ${off} NM ${side}: ${off} × 60 / ${flown} ≈ ${num(a, 1)}°. Draai je alleen dit bij, dan vlieg je evenwijdig aan de route en blijf je ${off} NM ${side}.\n`,
          `**Stap 2 – Hoek naar de bestemming (closing angle):**\nDie ${off} NM moet je goedmaken over de resterende ${remain} NM: ${off} × 60 / ${remain} ≈ ${num(b, 1)}°.\n`,
          `**Stap 3 – Totaal:**\n${num(a, 1)}° + ${num(b, 1)}° ≈ ${total}°, naar **${back}** (je zit ${side} van de route, dus terug naar ${back}).`
        ];
        const q = `Na ${flown} NM stel je vast dat je ${off} NM ${right ? 'rechts' : 'links'} van de geplande koers zit. Er resten nog ${remain} NM tot de bestemming. Hoeveel graden moet je de koers aanpassen om rechtstreeks naar de bestemming te vliegen?`;
        const dir = right ? 'links' : 'rechts', wdir = right ? 'rechts' : 'links';
        const fmt = v => (v > 0 ? `${v}° naar ${dir}` : `${-v}° naar ${wdir}`);
        return Q({ q, o: options(total, [Math.round(a), Math.round(b), -total], fmt, 2), e: steps.join('\n'), lo: this.lo, loText: 'Koerscorrectie na een afwijking (1-op-60-regel)' });
      }
    },
    {
      id: 'descent', name: 'Daalplanning', lo: '91.3.1.5.1',
      gen() {
        const from = rnd(45, 95, 5) * 100, to = rnd(10, 25, 5) * 100;
        const rod = rnd(4, 8) * 100, gs = rnd(90, 140, 10);
        const t = (from - to) / rod, d = t * gs / 60;
        const steps = [
          `Te dalen hoogte: ${from} − ${to} = ${from - to} ft.`,
          `Daaltijd = ${from - to} / ${rod} = ${num(t, 1)} min.`,
          `Afstand = GS × tijd = ${gs} kt × ${num(t, 1)} / 60 h = ${num(d, 1)} NM.`
        ];
        const q = `Je wil dalen van ${from} ft naar ${to} ft met ${rod} ft/min bij een grondsnelheid van ${gs} kt. Hoeveel NM voor het punt waar je ${to} ft wil bereiken, moet je de daling beginnen?`;
        return Q({ q, o: options(Math.round(d), [Math.round(from / rod * gs / 60), Math.round(t), Math.round(d * 2)], v => `${v} NM`, 2), e: steps.join('\n'), lo: this.lo, loText: 'Daaltijd en -afstand berekenen' });
      }
    },
    {
      id: 'tas', name: 'TAS met de vuistregel', lo: '91.3.1.2.2',
      gen() {
        const ias = rnd(80, 140, 5), alt = rnd(2, 10) * 1000;
        const tas = ias * (1 + 0.02 * alt / 1000);
        const steps = [`Vuistregel: TAS ≈ IAS + 2% per 1000 ft.`, `${alt} ft → ${2 * alt / 1000}%: ${ias} × ${num(1 + 0.02 * alt / 1000, 2)} ≈ ${Math.round(tas)} kt.`];
        const q = `IAS ${ias} kt op ${alt} ft (ISA, instrument- en positiefouten verwaarloosd). Wat is de TAS volgens de vuistregel?`;
        return Q({ q, o: options(Math.round(tas), [Math.round(ias * (1 - 0.02 * alt / 1000)), Math.round(ias * (1 + 0.1 * alt / 1000)), ias], v => `${v} kt`, 4), e: steps.join('\n'), lo: this.lo, loText: 'Omzetting IAS/CAS naar TAS' });
      }
    },
    {
      id: 'units', name: 'Eenheden omrekenen', lo: '91.1.5.2.2',
      gen() {
        const t = pick(['ft2m', 'm2ft', 'nm2km', 'km2nm']);
        if (t === 'ft2m') {
          const ft = rnd(10, 120) * 100, m = ft * 0.3048;
          return Q({ q: `Hoeveel meter is ${ft} ft?`, o: options(Math.round(m / 10) * 10, [Math.round(ft / 0.3048 / 10) * 10, Math.round(ft * 3.28 / 10) * 10, Math.round(ft / 3 / 10) * 10 + 100], v => `${v} m`, 50),
            e: `1 ft = 0,3048 m (≈ 0,3).\n${ft} × 0,3048 ≈ ${Math.round(m)} m.`, lo: this.lo, loText: 'Omrekenen tussen ft en m' });
        }
        if (t === 'm2ft') {
          const m = rnd(5, 60) * 100, ft = m / 0.3048;
          return Q({ q: `Hoeveel ft is ${m} m?`, o: options(Math.round(ft / 100) * 100, [Math.round(m * 0.3048 / 100) * 100, Math.round(m * 3 / 100) * 100 + 500, Math.round(m * 4 / 100) * 100], v => `${v} ft`, 200),
            e: `1 m = 3,28 ft.\n${m} × 3,28 ≈ ${Math.round(ft)} ft.`, lo: this.lo, loText: 'Omrekenen tussen ft en m' });
        }
        if (t === 'nm2km') {
          const nm = rnd(10, 300, 5), km = nm * 1.852;
          return Q({ q: `Hoeveel km is ${nm} NM?`, o: options(Math.round(km), [Math.round(nm / 1.852), Math.round(nm * 1.609), Math.round(nm * 1.1)], v => `${v} km`, 5),
            e: `1 NM = 1,852 km.\n${nm} × 1,852 ≈ ${Math.round(km)} km. (1,609 is de factor voor landmijlen, SM.)`, lo: this.lo, loText: 'Omrekenen tussen NM en km' });
        }
        const km = rnd(20, 500, 10), nm = km / 1.852;
        return Q({ q: `Hoeveel NM is ${km} km?`, o: options(Math.round(nm), [Math.round(km * 1.852), Math.round(km / 1.609), Math.round(km / 1.1)], v => `${v} NM`, 5),
          e: `1 NM = 1,852 km.\n${km} / 1,852 ≈ ${Math.round(nm)} NM.`, lo: this.lo, loText: 'Omrekenen tussen NM en km' });
      }
    }
  ];

  // ======================================================================
  // VLUCHTPRESTATIES EN -PLANNING
  // ======================================================================
  const flight_performance = [
    {
      id: 'rwywind', name: 'Kop- en zijwindcomponent op de baan', lo: '72.2.2.1.3',
      gen() {
        const rwy = rnd(1, 36);
        const rwyHdg = rwy * 10;
        let diff; do { diff = rnd(-80, 80, 10); } while (diff === 0);
        const wd = norm(rwyHdg + diff) || 360, ws = rnd(8, 30, 2);
        const head = ws * Math.cos(rad(diff)), cross = ws * Math.sin(rad(Math.abs(diff)));
        const askCross = Math.random() < 0.5;
        const steps = [
          `Baan ${pad2(rwy)} ≈ ${hdg(rwyHdg)}. Hoek tussen wind en baan: ${Math.abs(diff)}°.`,
          `Kopwind = ${ws} × cos ${Math.abs(diff)}° ≈ ${num(head, 1)} kt.`,
          `Zijwind = ${ws} × sin ${Math.abs(diff)}° ≈ ${num(cross, 1)} kt (van ${diff > 0 ? 'rechts' : 'links'}).`,
          'Vuistregel zijwind: 30° → ½, 45° → ¾ (0,7), 60° en meer → bijna volledig.'
        ];
        const q = `Je stijgt op van baan ${pad2(rwy)}. Gerapporteerde wind: ${brg(wd)}/${ws} kt. Wat is de ${askCross ? 'zijwindcomponent' : 'kopwindcomponent'}?`;
        const o = askCross
          ? options(Math.round(cross), [Math.round(head), ws, Math.round(ws / 2) === Math.round(cross) ? Math.round(ws * 0.9) : Math.round(ws / 2)], v => `${v} kt`, 2)
          : options(Math.round(head), [Math.round(cross), ws, -Math.round(head)], v => (v < 0 ? `${-v} kt rugwind` : `${v} kt`), 2);
        return Q({ q, o, e: steps.join('\n'), lo: this.lo, loText: 'Kop- en zijwindcomponenten berekenen' });
      }
    },
    {
      id: 'cg', name: 'Zwaartepunt (massa en balans)', lo: '71.5.1.1.1',
      gen() {
        const items = [
          { n: 'Basis leegmassa', m: rnd(520, 700, 5), a: rnd(200, 230) / 100 },
          { n: 'Piloot + passagier voor', m: rnd(140, 190, 5), a: rnd(205, 215) / 100 },
          { n: 'Passagiers achter', m: rnd(0, 160, 10), a: rnd(290, 305) / 100 },
          { n: 'Bagage', m: rnd(5, 40, 5), a: rnd(340, 365) / 100 }
        ];
        const fuelL = rnd(60, 150, 10);
        items.push({ n: `Brandstof (${fuelL} l AVGAS, 0,72 kg/l)`, m: Math.round(fuelL * 0.72), a: rnd(220, 245) / 100 });
        const M = items.reduce((s, i) => s + i.m, 0);
        const Mom = items.reduce((s, i) => s + i.m * i.a, 0);
        const cg = Mom / M;
        const avgArm = items.reduce((s, i) => s + i.a, 0) / items.length;
        const noFuel = (Mom - items[4].m * items[4].a) / (M - items[4].m);
        const table = items.map(i => `${i.n}: ${i.m} kg op ${num(i.a, 2)} m`).join('\n');
        const steps = items.map(i => `${i.n}: ${i.m} × ${num(i.a, 2)} = ${num(i.m * i.a, 1)} kg·m`);
        steps.push(`Totale massa = ${M} kg, totaal moment = ${num(Mom, 1)} kg·m.`, `CG = moment / massa = ${num(Mom, 1)} / ${M} ≈ ${num(cg, 3)} m achter het referentiepunt.`);
        const q = `Bereken het zwaartepunt (armen gemeten vanaf het referentiepunt):\n${table}`;
        return Q({ q, o: options(Math.round(cg * 1000) / 1000, [avgArm, noFuel, Mom / (M - items[2].m)].map(v => Math.round(v * 1000) / 1000), v => `${num(v, 3)} m`, 0.03, 0.025), e: steps.join('\n'), lo: this.lo, loText: 'Het zwaartepunt berekenen met massa’s en armen' });
      }
    },
    {
      id: 'fuelconv', name: 'Brandstof: liter, kg, USG en lbs', lo: '71.2.1.2.3',
      gen() {
        const t = pick(['l2kg', 'usg2l', 'kg2lbs']);
        if (t === 'l2kg') {
          const l = rnd(40, 250, 5), kg = l * 0.72;
          return Q({ q: `Hoeveel kg weegt ${l} liter AVGAS 100LL?`, o: options(Math.round(kg), [Math.round(l / 0.72), Math.round(l * 0.72 * 2.2), Math.round(l * 0.8)], v => `${v} kg`, 3),
            e: `Massa = volume × dichtheid = ${l} × 0,72 ≈ ${Math.round(kg)} kg.`, lo: this.lo, loText: 'Eenheden voor brandstof' });
        }
        if (t === 'usg2l') {
          const g = rnd(10, 60), l = g * 3.785;
          return Q({ q: `Hoeveel liter is ${g} US gallon (USG)?`, o: options(Math.round(l), [Math.round(g * 4.546), Math.round(g / 3.785), Math.round(g * 3)], v => `${v} l`, 3),
            e: `1 USG = 3,785 l.\n${g} × 3,785 ≈ ${Math.round(l)} l. (4,546 l is een imperial gallon.)`, lo: this.lo, loText: 'Eenheden voor brandstof' });
        }
        const kg = rnd(20, 200, 5), lbs = kg * 2.2046;
        return Q({ q: `Hoeveel lbs is ${kg} kg?`, o: options(Math.round(lbs), [Math.round(kg / 2.2046), Math.round(kg * 0.72), Math.round(kg * 1.5)], v => `${v} lbs`, 4),
          e: `1 kg = 2,2 lbs.\n${kg} × 2,2046 ≈ ${Math.round(lbs)} lbs.`, lo: this.lo, loText: 'Eenheden voor massa' });
      }
    },
    {
      id: 'fuelplan', name: 'Brandstofplanning (block fuel)', lo: '74.2.2.1.10',
      gen() {
        const tripMin = rnd(40, 180, 5), ff = rnd(18, 36, 1), taxi = rnd(2, 6), night = Math.random() < 0.3;
        const resMin = night ? 45 : 30;
        const trip = tripMin / 60 * ff, res = resMin / 60 * ff, total = taxi + trip + res;
        const steps = [
          `Tripbrandstof = ${tripMin} min × ${ff} l/h = ${num(trip, 1)} l.`,
          `Eindreserve ${night ? "'s nachts" : 'overdag'} VFR: ${resMin} min × ${ff} l/h = ${num(res, 1)} l.`,
          `Taxi: ${taxi} l.`,
          `Totaal = ${taxi} + ${num(trip, 1)} + ${num(res, 1)} ≈ ${Math.round(total)} l.`
        ];
        const q = `VFR-vlucht ${night ? "'s nachts" : 'overdag'} met een vliegtuig (geen uitwijkhaven nodig). Vliegtijd ${tripMin} min, verbruik ${ff} l/h, taxibrandstof ${taxi} l. Hoeveel brandstof heb je minimaal nodig bij vertrek?`;
        return Q({ q, o: options(Math.round(total), [Math.round(trip + res), Math.round(taxi + trip), Math.round(taxi + trip + (night ? 30 : 45) / 60 * ff)], v => `${v} l`, 3),
          e: steps.join('\n'), src: 'nco', ref: 'Part-NCO, NCO.OP.125 – Fuel and oil supply (aeroplanes): VFR overdag 30 min, ’s nachts 45 min reserve', lo: this.lo, loText: 'Brandstof voor een vlucht berekenen' });
      }
    },
    {
      id: 'endurance', name: 'Resterende vliegtijd tijdens de vlucht', lo: '74.5.1.2.2',
      gen() {
        const start = rnd(80, 160, 5), mins = rnd(20, 60, 5);
        const used = rnd(15, 40, 1) * mins / 60;
        const rem = Math.round(start - used);
        const reserve = rnd(10, 20, 1);
        const flow = (start - rem) / mins;
        const maxT = (rem - reserve) / flow;
        const steps = [
          `Verbruik = (${start} − ${rem}) l / ${mins} min = ${num(flow, 3)} l/min (${num(flow * 60, 1)} l/h).`,
          `Bruikbaar zonder de reserve aan te spreken: ${rem} − ${reserve} = ${rem - reserve} l.`,
          `Resterende vliegtijd = ${rem - reserve} / ${num(flow, 3)} ≈ ${Math.round(maxT)} min.`
        ];
        const q = `Bij het opstijgen had je ${start} l aan boord. Na ${mins} minuten is er nog ${rem} l over. De eindreserve is ${reserve} l. Hoe lang kun je bij hetzelfde verbruik nog vliegen voor je aan de reserve begint?`;
        return Q({ q, o: options(Math.round(maxT), [Math.round(rem / flow), Math.round((rem - reserve) / (start / mins)), Math.round(maxT - mins)], v => `${v} min`, 5), e: steps.join('\n'), lo: this.lo, loText: 'Brandstofcontrole tijdens de vlucht' });
      }
    },
    {
      id: 'cruiselevel', name: 'VFR-kruishoogte (semicirculaire regel)', lo: '74.3.1.4.1',
      gen() {
        const tt = rnd(5, 359);
        let v; do { v = rnd(-8, 8); } while (v === 0);
        const mt = norm(tt - v);
        if (mt === 0 || mt === 179 || mt === 180 || mt === 359) return this.gen();
        const min = rnd(5, 8) * 1000; // boven de Belgische overgangshoogte (4500 ft)
        const east = mt < 180;
        // VFR: oost (000-179) oneven duizendtallen + 500, west (180-359) even + 500
        let fl = 35; while (!(fl * 100 > min && ((Math.floor(fl / 10) % 2 === 1) === east))) fl += 10;
        const other = fl + 10;
        const ttEast = tt < 180;
        let flTT = 35; while (!(flTT * 100 > min && ((Math.floor(flTT / 10) % 2 === 1) === ttEast))) flTT += 10;
        const steps = [
          ewStep('variatie', 'TT', tt, v, 'MT', mt),
          `VFR boven 3000 ft: MT 000°-179° → oneven duizendtallen + 500 ft (FL55, FL75, FL95…), MT 180°-359° → even duizendtallen + 500 ft (FL65, FL85…).`,
          `${brg(mt)} valt in ${east ? '000°-179°' : '180°-359°'}. Het laagste geschikte niveau boven ${min} ft is FL${String(fl).padStart(3, '0')}.`,
          'De regel gebruikt de magnetische grondkoers, niet de ware koers.'
        ];
        const fmt = f => `FL${String(f).padStart(3, '0')}`;
        const q = `Ware grondkoers ${hdg(tt)}, variatie ${ew(v)}. Wat is het laagste VFR-vliegniveau boven ${min} ft?`;
        return Q({ q, o: options(fl, [other, flTT === fl ? fl + 20 : flTT, fl + 5], fmt, 20), e: steps.join('\n'), src: 'sera', ref: 'SERA.5005(g) en Appendix 3 – Tabel van kruishoogtes', lo: this.lo, loText: 'Een geschikte hoogte/vliegniveau kiezen' });
      }
    },
    {
      id: 'overweight', name: 'Massa reduceren tot de maximale startmassa', lo: '71.2.2.1.1',
      gen() {
        const mtom = rnd(900, 1200, 5), over = rnd(3, 15);
        const ramp = mtom + over;
        const l = over / 0.72;
        const steps = [`Te veel: ${ramp} − ${mtom} = ${over} kg.`, `Dat is ${over} / 0,72 ≈ ${num(l, 1)} l AVGAS die je tijdens het taxiën moet verbruiken (of je laadt minder).`];
        const q = `Je taximassa is ${ramp} kg, de maximale startmassa (MTOM) is ${mtom} kg. Hoeveel liter AVGAS moet je minstens verbruiken voor het opstijgen?`;
        return Q({ q, o: options(Math.ceil(l), [over, Math.round(over * 0.72), Math.ceil(l) * 2], v => `${v} l`, 2), e: steps.join('\n'), lo: this.lo, loText: 'Maximale taximassa en startmassa' });
      }
    }
  ];

  // ======================================================================
  // METEOROLOGIE
  // ======================================================================
  const meteorology = [
    {
      id: 'cloudbase', name: 'Wolkenbasis uit temperatuur en dauwpunt', lo: '30.4.1.1.3',
      gen() {
        const t = rnd(8, 30), spread = rnd(2, 12), td = t - spread, elev = rnd(0, 15) * 100;
        const agl = spread * 400;
        const amsl = Math.random() < 0.5;
        const ans = amsl ? agl + elev : agl;
        const steps = [
          `Spreiding = T − Td = ${t} − ${td} = ${spread} °C.`,
          'Vuistregel cumulusbasis: spreiding × 400 ft (of × 125 m) boven de grond.',
          `${spread} × 400 = ${agl} ft AGL${amsl ? `; + terreinhoogte ${elev} ft = ${agl + elev} ft AMSL` : ''}.`
        ];
        const q = `Op een vliegveld (${elev} ft AMSL) is de temperatuur ${t} °C en het dauwpunt ${td} °C. Waar ligt ongeveer de basis van de cumuluswolken ${amsl ? 'boven zeeniveau (AMSL)' : 'boven de grond (AGL)'}?`;
        return Q({ q, o: options(ans, [amsl ? agl : agl + elev, spread * 125 + (amsl ? elev : 0), spread * 1000 + (amsl ? elev : 0)], v => `${v} ft`, 200), e: steps.join('\n'), lo: this.lo, loText: 'De hoogte van de wolkenbasis' });
      }
    },
    {
      id: 'isa', name: 'ISA-temperatuur en ISA-afwijking', lo: '30.1.5.1.1',
      gen() {
        const alt = rnd(2, 12) * 1000, isaT = 15 - 2 * alt / 1000;
        const dev = rnd(-15, 15);
        const oat = isaT + dev;
        if (Math.random() < 0.5) {
          return Q({ q: `Wat is de ISA-temperatuur op ${alt} ft?`, o: options(isaT, [15 - 0.65 * alt / 100 * 0.3048, 15 - alt / 1000, 15 - 3 * alt / 1000].map(Math.round), v => `${v} °C`, 2),
            e: `ISA: +15 °C op zeeniveau, −2 °C per 1000 ft (0,65 °C/100 m).\n15 − 2 × ${alt / 1000} = ${isaT} °C.`, lo: this.lo, loText: 'Temperatuurafname in de ISA' });
        }
        return Q({ q: `Op ${alt} ft is de buitenluchttemperatuur ${oat} °C. Wat is de ISA-afwijking?`, o: options(dev, [-dev, oat - 15, oat], v => `ISA ${v >= 0 ? '+' : '−'}${Math.abs(v)} °C`, 2),
          e: `ISA-temperatuur op ${alt} ft = 15 − 2 × ${alt / 1000} = ${isaT} °C.\nAfwijking = OAT − ISA = ${oat} − (${isaT}) = ${dev >= 0 ? '+' : ''}${dev} °C.`, lo: this.lo, loText: 'Afwijking ten opzichte van de ISA' });
      }
    },
    {
      id: 'pa', name: 'Drukhoogte en QFE', lo: '30.1.6.3.1',
      gen() {
        const elev = rnd(3, 30) * 100, qnh = rnd(990, 1035);
        const pa = elev + (1013 - qnh) * 30;
        if (Math.random() < 0.5) {
          return Q({ q: `Vliegveldhoogte ${elev} ft, QNH ${qnh} hPa. Wat is de drukhoogte van het vliegveld?`, o: options(pa, [elev - (1013 - qnh) * 30, elev, (1013 - qnh) * 30], v => `${v} ft`, 60),
            e: `Vuistregel: 1 hPa ≈ 30 ft.\nDrukhoogte = hoogte + (1013 − QNH) × 30 ft = ${elev} + (${1013 - qnh}) × 30 = ${pa} ft.\nLagere druk dan standaard geeft een hogere drukhoogte.`, lo: this.lo, loText: 'Drukhoogte berekenen' });
        }
        const qfe = qnh - elev / 30;
        return Q({ q: `Vliegveldhoogte ${elev} ft, QNH ${qnh} hPa. Wat is ongeveer de QFE?`, o: options(Math.round(qfe), [Math.round(qnh + elev / 30), qnh, Math.round(qnh - elev / 8)], v => `${v} hPa`, 2),
          e: `Vuistregel: 1 hPa ≈ 30 ft.\n${elev} ft / 30 ft per hPa ≈ ${Math.round(elev / 30)} hPa.\nQFE = QNH − ${Math.round(elev / 30)} ≈ ${Math.round(qfe)} hPa (op het vliegveld is de druk lager dan op zeeniveau).`, lo: '30.1.6.2.2', loText: 'QNH en QFE' });
      }
    },
    {
      id: 'truealt', name: 'Ware hoogte (temperatuurcorrectie)', lo: '30.1.6.3.1',
      gen() {
        const ind = rnd(30, 90, 5) * 100;
        let dev; do { dev = rnd(-20, 20, 5); } while (dev === 0);
        const corr = 4 * dev * ind / 1000;
        const tru = Math.round((ind + corr) / 50) * 50;
        const steps = [
          'Vuistregel: 4 ft per 1000 ft per °C ISA-afwijking (4% per 10 °C).',
          `Correctie = 4 × (${dev}) × ${num(ind / 1000, 1)} ≈ ${Math.round(corr)} ft.`,
          `Ware hoogte ≈ ${ind} ${corr >= 0 ? '+' : '−'} ${Math.abs(Math.round(corr))} ≈ ${tru} ft. Koud = lager dan aangewezen.`
        ];
        const q = `Je hoogtemeter (op QNH) wijst ${ind} ft aan. De luchtmassa is ISA ${dev >= 0 ? '+' : '−'}${Math.abs(dev)} °C. Wat is ongeveer je ware hoogte?`;
        return Q({ q, o: options(tru, [Math.round((ind - corr) / 50) * 50, ind, Math.round((ind + corr * 2.5) / 50) * 50], v => `${v} ft`, 100), e: steps.join('\n'), lo: this.lo, loText: 'Ware hoogte bepalen' });
      }
    },
    {
      id: 'da', name: 'Dichtheidshoogte (density altitude)', lo: '30.1.6.3.1',
      gen() {
        const elev = rnd(0, 40) * 100, qnh = rnd(995, 1030), oat = rnd(5, 38);
        const pa = elev + (1013 - qnh) * 30;
        const isaT = 15 - 2 * pa / 1000;
        const dev = oat - isaT;
        const da = Math.round((pa + 120 * dev) / 100) * 100;
        const steps = [
          `Drukhoogte = ${elev} + (1013 − ${qnh}) × 30 = ${pa} ft.`,
          `ISA-temperatuur op ${pa} ft ≈ ${num(isaT, 1)} °C; afwijking = ${oat} − ${num(isaT, 1)} = ${num(dev, 1)} °C.`,
          `Dichtheidshoogte ≈ drukhoogte + 120 ft × afwijking = ${pa} + 120 × ${num(dev, 1)} ≈ ${da} ft.`
        ];
        const q = `Vliegveld op ${elev} ft, QNH ${qnh} hPa, temperatuur ${oat} °C. Wat is ongeveer de dichtheidshoogte?`;
        return Q({ q, o: options(da, [Math.round((pa - 120 * dev) / 100) * 100, Math.round(pa / 100) * 100, Math.round((elev + 120 * dev) / 100) * 100], v => `${v} ft`, 300), e: steps.join('\n'), lo: this.lo, loText: 'Dichtheidshoogte en prestaties' });
      }
    },
    {
      id: 'foehn', name: 'Adiabatische processen en Föhn', lo: '30.1.2.4.3',
      gen() {
        const t0 = rnd(10, 25), base = rnd(5, 15) * 100, top = base + rnd(10, 25) * 100;
        const tBase = t0 - base / 100, tTop = tBase - 0.6 * (top - base) / 100, tLee = tTop + top / 100;
        const steps = [
          `Droog-adiabatisch tot de wolkenbasis: ${t0} − ${base / 100} × 1 °C = ${num(tBase, 1)} °C op ${base} m.`,
          `Nat-adiabatisch in de wolk tot de top: −0,6 °C/100 m × ${(top - base) / 100} = ${num(tBase - tTop, 1)} °C → ${num(tTop, 1)} °C op ${top} m.`,
          `Aan de lijzijde daalt de (nu droge) lucht droog-adiabatisch: +1 °C/100 m × ${top / 100} = +${top / 100} °C → ${num(tLee, 1)} °C op zeeniveau.`,
          'De lucht is aan de lijzijde warmer en droger: het Föhn-effect.'
        ];
        const q = `Lucht van ${t0} °C op zeeniveau stroomt over een bergkam van ${top} m. De wolkenbasis aan de loefzijde ligt op ${base} m. Welke temperatuur heeft de lucht aan de lijzijde terug op zeeniveau?`;
        return Q({ q, o: options(Math.round(tLee), [t0, Math.round(tTop + 0.6 * top / 100), Math.round(tLee + 3)], v => `${v} °C`, 2), e: steps.join('\n'), lo: this.lo, loText: 'Droog- en nat-adiabatische temperatuurgradiënt' });
      }
    }
  ];

  // ======================================================================
  // ALGEMENE KENNIS VAN HET LUCHTVAARTUIG
  // ======================================================================
  const aircraft_general = [
    {
      id: 'subscale', name: 'Hoogtemeter-subschaal verstellen', lo: '82.2.3.4.1',
      gen() {
        const a = rnd(990, 1030);
        let b; do { b = rnd(990, 1030); } while (Math.abs(b - a) < 3);
        const d = (b - a) * 30;
        const fmt = v => (v > 0 ? `${v} ft hoger` : `${-v} ft lager`);
        const q = `Je verstelt de subschaal van de hoogtemeter van ${a} hPa naar ${b} hPa. Hoe verandert de aanwijzing?`;
        return Q({ q, o: options(d, [-d, (b - a) * 8, (b - a) * 300], fmt, 30),
          e: `Vuistregel: 1 hPa ≈ 30 ft.\nVerschil: ${b} − ${a} = ${b - a} hPa × 30 ft = ${Math.abs(d)} ft.\nEen hogere subschaalwaarde geeft een hogere aanwijzing (en omgekeerd).`, lo: this.lo, loText: 'Verandering van de hoogtemeteraanwijzing bij een andere instelling' });
      }
    },
    {
      id: 'wrongqnh', name: 'Verkeerd ingestelde QNH', lo: '82.2.3.3.2',
      gen() {
        const actual = rnd(995, 1030);
        let set; do { set = rnd(995, 1030); } while (Math.abs(set - actual) < 3);
        const ind = rnd(20, 60, 5) * 100;
        const tru = ind - (set - actual) * 30;
        const steps = [
          `De hoogtemeter staat ${Math.abs(set - actual)} hPa te ${set > actual ? 'hoog' : 'laag'} ingesteld: ${Math.abs(set - actual)} × 30 = ${Math.abs(set - actual) * 30} ft.`,
          `Te hoge instelling → aanwijzing te hoog → je vliegt lager dan je denkt (en omgekeerd).`,
          `Werkelijke hoogte = ${ind} ${set > actual ? '−' : '+'} ${Math.abs(set - actual) * 30} = ${tru} ft.`
        ];
        const q = `Je hoogtemeter staat op ${set} hPa en wijst ${ind} ft aan, maar de werkelijke QNH is ${actual} hPa. Wat is je werkelijke hoogte boven zeeniveau?`;
        return Q({ q, o: options(tru, [ind + (set - actual) * 30, ind, ind - (set - actual) * 8], v => `${v} ft`, 30), e: steps.join('\n'), lo: this.lo, loText: 'Gevolgen van een verkeerd ingestelde hoogtemeter' });
      }
    },
    {
      id: 'electric', name: 'Elektrisch systeem: vermogen, stroom en batterij', lo: '81.8.1.1.4',
      gen() {
        const volt = pick([12, 14, 24, 28]);
        if (Math.random() < 0.5) {
          const watt = rnd(5, 40) * 10, amp = watt / volt;
          return Q({ q: `Een toestel verbruikt ${watt} W op een boordnet van ${volt} V. Welke stroom trekt het?`, o: options(Math.round(amp * 10) / 10, [watt * volt, volt / watt * 100, watt / 12 === amp ? watt / 24 : watt / 12].map(v => Math.round(v * 10) / 10), v => `${num(v, 1)} A`, 0.5),
            e: `P = U × I, dus I = P / U = ${watt} / ${volt} ≈ ${num(amp, 1)} A.`, lo: this.lo, loText: 'Elektrisch vermogen' });
        }
        const ah = pick([15, 20, 24, 30, 35]), load = rnd(4, 15);
        const t = ah / load * 60;
        return Q({ q: `Na een alternatoruitval levert enkel de batterij (${ah} Ah) nog stroom. De resterende verbruikers trekken ${load} A. Hoe lang kan de (volle) batterij dat theoretisch volhouden?`,
          o: options(Math.round(t), [Math.round(load / ah * 60), Math.round(ah * load), Math.round(ah / load * 100)], hmin, 10),
          e: `Tijd = capaciteit / stroom = ${ah} Ah / ${load} A = ${num(ah / load, 2)} h ≈ ${hmin(t)}.\nIn de praktijk minder: een batterij is zelden volledig vol en de spanning zakt.`, lo: '81.8.6.1.6', loText: 'Gevolgen van het uitvallen van de alternator' });
      }
    }
  ];

  // ======================================================================
  // BEGINSELEN VAN HET VLIEGEN
  // ======================================================================
  const principles_of_flight = [
    {
      id: 'loadfactor', name: 'Belastingsfactor en overtreksnelheid in een bocht', lo: '51.1.7.2.9',
      gen() {
        const bank = pick([20, 30, 40, 45, 50, 60]);
        const n = 1 / Math.cos(rad(bank));
        if (Math.random() < 0.5) {
          return Q({ q: `Wat is de belastingsfactor (n) in een gecoördineerde horizontale bocht met ${bank}° helling?`, o: options(Math.round(n * 100) / 100, [Math.round(Math.cos(rad(bank)) * 100) / 100, Math.round(1 / Math.sin(rad(bank)) * 100) / 100, Math.round(Math.sqrt(n) * 100) / 100], v => num(v, 2), 0.1),
            e: `n = 1 / cos(helling) = 1 / cos ${bank}° = 1 / ${num(Math.cos(rad(bank)), 3)} ≈ ${num(n, 2)}.\nBij 60° helling is n = 2.`, lo: this.lo, loText: 'Belastingsfactor in een bocht' });
        }
        const vs = rnd(45, 60);
        const vt = vs * Math.sqrt(n);
        return Q({ q: `De overtreksnelheid in rechtlijnige vlucht is ${vs} kt. Wat is ze ongeveer in een horizontale bocht met ${bank}° helling?`, o: options(Math.round(vt), [Math.round(vs * n), Math.round(vs / Math.sqrt(n)), vs], v => `${v} kt`, 2),
          e: `n = 1 / cos ${bank}° ≈ ${num(n, 2)}.\nVs(bocht) = Vs × √n = ${vs} × ${num(Math.sqrt(n), 3)} ≈ ${Math.round(vt)} kt.`, lo: this.lo, loText: 'Overtreksnelheid in een bocht' });
      }
    },
    {
      id: 'stallmass', name: 'Overtreksnelheid en massa', lo: '51.1.7.2.2',
      gen() {
        const vs = rnd(45, 60), m1 = rnd(900, 1150, 10);
        const m2 = m1 - rnd(100, 300, 10);
        const v2 = vs * Math.sqrt(m2 / m1);
        return Q({ q: `Bij ${m1} kg is de overtreksnelheid ${vs} kt. Wat is ze ongeveer bij ${m2} kg?`, o: options(Math.round(v2), [Math.round(vs * m2 / m1), Math.round(vs * Math.sqrt(m1 / m2)), vs], v => `${v} kt`, 1),
          e: `Vs is evenredig met √(massa).\nVs2 = ${vs} × √(${m2}/${m1}) = ${vs} × ${num(Math.sqrt(m2 / m1), 3)} ≈ ${Math.round(v2)} kt.`, lo: this.lo, loText: 'Verandering van de overtreksnelheid met de massa' });
      }
    },
    {
      id: 'rateone', name: 'Hellingshoek voor een rate-one-bocht', lo: '51.6.1.5.8',
      gen() {
        const tas = rnd(70, 150, 5), bank = tas / 10 + 7;
        return Q({ q: `Welke hellingshoek heb je ongeveer nodig voor een rate-one-bocht bij ${tas} kt TAS?`, o: options(Math.round(bank), [Math.round(tas / 10), Math.round(tas / 10 + 15), Math.round(tas / 5)], v => `${v}°`, 3),
          e: `Een rate-one-bocht is een bocht van 3° per seconde: 360° in 2 minuten.\nVuistregel: helling ≈ TAS/10 + 7 = ${tas}/10 + 7 ≈ ${Math.round(bank)}°.\nDe helling hangt af van de TAS: hoe sneller, hoe meer helling nodig.`, lo: this.lo, loText: 'Hellingshoek voor een rate-one-bocht' });
      }
    },
    {
      id: 'glide', name: 'Glijafstand', lo: '51.1.5.4.2',
      gen() {
        const e = rnd(8, 12), h = rnd(20, 60, 5) * 100;
        const nm = h * e / 6076;
        return Q({ q: `Je motor valt uit op ${h} ft boven de grond. De glijverhouding is 1:${e} (windstil). Hoe ver kun je ongeveer glijden?`, o: options(Math.round(nm * 10) / 10, [h * e / 1000, h * e * 0.3048 / 1000, h / e / 100].map(v => Math.round(v * 10) / 10), v => `${num(v, 1)} NM`, 0.5),
          e: `Afstand = hoogte × glijverhouding = ${h} × ${e} = ${h * e} ft.\n${h * e} / 6076 ft per NM ≈ ${num(nm, 1)} NM (${num(h * e * 0.3048 / 1000, 1)} km).`, lo: this.lo, loText: 'Glijverhouding en beste glijsnelheid' });
      }
    },
    {
      id: 'drag', name: 'Parasitaire weerstand en snelheid', lo: '51.1.5.2.2',
      gen() {
        const f = pick([1.5, 2, 3]);
        const d = f * f;
        return Q({ q: `Hoe verandert de parasitaire weerstand ongeveer als de snelheid ${num(f, 1)} keer zo groot wordt (rest gelijk)?`, o: options(d, [f, f * f * f, Math.sqrt(f)], v => `× ${num(v, 2)}`, 0.5),
          e: `Parasitaire weerstand is evenredig met v².\n(${num(f, 1)})² = ${num(d, 2)}.`, lo: this.lo, loText: 'Parasitaire weerstand neemt toe met het kwadraat van de snelheid' });
      }
    }
  ];

  // ======================================================================
  // MENSELIJKE PRESTATIES
  // ======================================================================
  const human_performance = [
    {
      id: 'alcohol', name: 'Afbraak van alcohol', lo: '20.2.3.4.3',
      gen() {
        const bac = rnd(3, 15) / 10; // promille
        const h = bac / 0.1;
        return Q({ q: `Na een feestje heb je een bloedalcoholgehalte van ${num(bac, 1)} ‰. Na hoeveel uur is de alcohol ongeveer volledig afgebroken?`, o: options(Math.round(h), [Math.round(bac / 0.3), Math.round(h / 2), Math.round(h) + 8], v => `${v} h`, 2),
          e: `Het lichaam breekt ongeveer 0,1 ‰ (0,01%) per uur af, en dat gaat niet sneller met koffie of slaap.\n${num(bac, 1)} / 0,1 = ${Math.round(h)} h.\nVlieg nooit onder invloed; houd ook rekening met de minimumtijd tussen drinken en vliegen.`, src: 'med', ref: 'Part-MED, MED.A.020 – Decrease in medical fitness', lo: this.lo, loText: 'De afbraak van alcohol' });
      }
    },
    {
      id: 'o2', name: 'Partiële zuurstofdruk op hoogte', lo: '20.2.1.1.2',
      gen() {
        const p = pick([[0, 1013], [5000, 843], [10000, 697], [18000, 506], [8000, 753]]);
        const po2 = p[1] * 0.21;
        return Q({ q: `Op ${p[0]} ft is de luchtdruk in de ISA ongeveer ${p[1]} hPa. Wat is ongeveer de partiële zuurstofdruk?`, o: options(Math.round(po2), [Math.round(p[1] * 0.78), Math.round(1013 * 0.21), Math.round(p[1] * 0.21 / 2)], v => `${v} hPa`, 10),
          e: `Lucht bevat op elke hoogte ongeveer 21% zuurstof.\npO₂ = 0,21 × ${p[1]} ≈ ${Math.round(po2)} hPa.\nHet percentage blijft gelijk; de partiële druk daalt met de hoogte (vandaar hypoxie).`, lo: this.lo, loText: 'Samenstelling van de atmosfeer en partiële drukken' });
      }
    }
  ];

  // ======================================================================
  // LUCHTVAARTWETGEVING
  // ======================================================================
  const air_law = [
    {
      id: 'medical', name: 'Geldigheid medisch certificaat klasse 2', lo: '10.4.2.2.3',
      gen() {
        const age = pick([rnd(18, 37), rnd(42, 49), rnd(52, 70)]);
        const months = age < 40 ? 60 : age < 50 ? 24 : 12;
        return Q({ q: `Hoe lang is een nieuw medisch certificaat klasse 2 geldig voor een piloot van ${age} jaar?`, o: options(months, [60, 24, 12, 48], v => `${v} maanden`, 12),
          e: `Klasse 2: 60 maanden tot 40 jaar, 24 maanden tussen 40 en 50 jaar, 12 maanden vanaf 50 jaar.\n(Een certificaat afgegeven vóór 40 jaar vervalt ten laatste op 42 jaar.)\n${age} jaar → ${months} maanden.`, src: 'med', ref: 'Part-MED, MED.A.045 – Validity of medical certificates', lo: this.lo, loText: 'Geldigheid van een medisch certificaat klasse 2' });
      }
    }
  ];

  const GENERATORS = { navigation, flight_performance, meteorology, aircraft_general, principles_of_flight, human_performance, air_law };
  // Voor welke opleiding is het vak relevant?
  const LICENCE_TAGS = {
    navigation: ['PPL'], flight_performance: ['PPL'], meteorology: ['PPL', 'ULM'],
    aircraft_general: ['PPL'], principles_of_flight: ['PPL'], human_performance: ['PPL', 'ULM'], air_law: ['PPL']
  };

  function generate(subject, typeId) {
    const list = GENERATORS[subject] || [];
    const g = list.find(x => x.id === typeId) || pick(list);
    const q = g.gen();
    q.type = g.id;
    q.typeName = g.name;
    return q;
  }

  return { GENERATORS, LICENCE_TAGS, generate };
})();

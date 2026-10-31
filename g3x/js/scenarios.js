/* Scenario-motor en scenario-generatoren. Elk scenario wordt bij het starten opnieuw gegenereerd met willekeurige
   gegevens (vliegvelden, frequenties, QNH, codes, storingen …). Controle gebeurt op de toestand van de simulator
   en op gebeurtenissen van de interface (G3X.bus). */
window.G3X = window.G3X || {};
(function () {
  const U = G3X.util, NAV = G3X.nav, SIM = G3X.sim, AV = G3X.avionics, esc = U.esc;
  const HOME = NAV.HOME;

  // ---------- hulpjes voor generatoren ----------
  const R = {
    qnh: () => U.rndInt(988, 1034),
    squawk: () => { let c; do { c = [0, 0, 0, 0].map(() => U.rndInt(0, 7)).join(''); } while (['7500', '7600', '7700', '7000', '0000', '1200', '2000'].includes(c)); return c; },
    hdg: () => U.rndInt(1, 36) * 10,
    alt: (min = 1500, max = 4500) => U.rndInt(min / 500, max / 500) * 500,
    // kies willekeurig binnen een afstandsband; valt terug op het dichtstbijzijnde item als de band leeg is
    pickBand: (items, from, min, max) => { const all = items.map(x => ({ x, d: U.distNm(from, x) })).sort((p, q) => p.d - q.d); const band = all.filter(e => e.d >= min && e.d <= max); return band.length ? U.pick(band).x : (all[0] ? all[0].x : null); },
    apt: (opts = {}) => { const from = opts.from || HOME; const items = NAV.AIRPORTS.filter(a => a.id !== (opts.not || '') && a.id !== (from.id || '') && (!opts.kinds || opts.kinds.includes(a.kind)) && (!opts.withApr || NAV.APPROACHES[a.id])); return R.pickBand(items, from, opts.min ?? 8, opts.max ?? 45) || HOME; },
    vor: (opts = {}) => { const from = opts.from || HOME; return R.pickBand(NAV.NAVAIDS.filter(n => n.type === 'VOR'), from, opts.min ?? 5, opts.max ?? 45); },
    vrp: (opts = {}) => { const from = opts.from || HOME; return R.pickBand(NAV.WAYPOINTS.filter(w => w.type === 'VRP'), from, opts.min ?? 4, opts.max ?? 30); },
    wind: () => ({ windDir: U.rndInt(1, 36) * 10, windSpd: U.rndInt(3, 18) }),
    env: () => Object.assign({ qnh: R.qnh(), oatSea: U.rndInt(2, 26), turb: U.pick([0.1, 0.25, 0.4, 0.7]) }, R.wind()),
    // startpositie in de lucht in de buurt van een punt
    airborne: (near = HOME, opts = {}) => { const brg = opts.brg ?? U.rnd(0, 360), d = opts.dist ?? U.rnd(3, 12); const p = U.dest(near, brg, d); return Object.assign({ airborne: true, lat: p.lat, lon: p.lon, alt: opts.alt ?? R.alt(1500, 3500), hdg: opts.hdg ?? R.hdg(), ias: opts.ias ?? 95, env: opts.env || R.env(), fuelL: opts.fuelL ?? U.rndInt(25, 55), fuelR: opts.fuelR ?? U.rndInt(25, 55), fuelSel: opts.fuelSel || U.pick(['L', 'R']) }, opts.extra || {}); },
    onRunway: (apt = HOME, rwyId) => { const rw = apt.rwys[0]; const ids = rw.id.split('/'); const id = rwyId || U.pick(ids); const re = NAV.runwayEnds(apt, id); return { airborne: false, lat: re.thr.lat, lon: re.thr.lon, alt: apt.elev, hdg: re.hdg, env: R.env(), fuelL: U.rndInt(30, 58), fuelR: U.rndInt(30, 58), rwy: id, re }; },
    fmtF: f => f.toFixed(3),
  };
  const mainFreq = apt => NAV.mainFreq(apt);
  // "houd gedurende n seconden": check met geheugen
  const hold = (fn, secs) => { let acc = 0; return (S, A, ctx) => { if (fn(S, A, ctx)) { acc += ctx.dt; ctx.progress = Math.min(1, acc / secs); if (acc >= secs) return true; } else { acc = 0; ctx.progress = 0; } return false; }; };
  const once = fn => { let done = false; return (S, A, ctx) => { if (done) return true; if (fn(S, A, ctx)) done = true; return done; }; };
  const ev = (name, pred) => (S, A, ctx) => ctx.has(name, pred);
  const near = (v, t, tol) => Math.abs(v - t) <= tol;
  const hdgNear = (v, t, tol) => Math.abs(U.norm180(v - t)) <= tol;
  const q = (text, options, correct, explain) => ({ text, question: { options, correct, explain } });
  // meerkeuzeopties rond een numerieke waarde
  const numOpts = (val, step, fmt = v => String(v)) => { const base = val; const offs = U.shuffle([0, -step, step, 2 * step]); const correctIdx = offs.indexOf(0); return { options: offs.map(o => fmt(base + o)), correct: correctIdx }; };
  const mk = (text, hint, check, extra = {}) => Object.assign({ text, hint, check }, extra);
  const chatter = (who, text) => `<div class="atc"><b>${esc(who)}</b> ${esc(text)}</div>`;

  // ---------- scenario-generatoren ----------
  const GEN = [];
  const add = (id, cat, name, fn) => GEN.push({ id, cat, name, fn });

  // === Basis & PFD ===
  add('pfd_baro', 'Basis & PFD', 'QNH, heading bug en hoogte instellen', () => {
    const qnh = R.qnh(), hdg = R.hdg(), alt = R.alt(1500, 4000);
    const start = R.airborne(HOME); start.env.qnh = qnh;
    return { title: 'QNH, heading bug en hoogte', start, intro: chatter('Brussels Information', `Tecnam OO-XYZ, QNH ${qnh}. Vlieg heading ${U.fmtHdg(hdg)}, hoogte ${alt} ft.`),
      steps: [
        mk(`Stel de baro in op <b>${qnh} hPa</b>.`, 'Tik op het baro-veld onder de hoogtetape, of draai de buitenring van de linkerknop na één keer drukken (BARO/CRS).', (S, A) => !A.baroStd && A.baro === qnh),
        mk(`Zet de heading bug op <b>${U.fmtHdg(hdg)}°</b>.`, 'Buitenring van de linkerknop (HDG), of tik op de HSI en voer de waarde in.', (S, A) => A.hdgBug === hdg),
        mk(`Zet de geselecteerde hoogte op <b>${alt} ft</b>.`, 'Binnenring van de linkerknop (ALT) of tik op het cyaan hoogtevak boven de hoogtetape.', (S, A) => A.altSel === alt),
        mk('Vlieg zelf naar de ingestelde heading (±5°) en hoogte (±100 ft) en houd dat 15 s vast. Je mag de autopilot gebruiken.', 'AP-balk aantikken → HDG en ALT/VS. Of handmatig met de pijltjestoetsen.', hold((S, A) => hdgNear(S.ac.hdg, hdg, 5) && near(AV.indAlt(), alt, 100), 15)),
      ] };
  });
  add('pfd_std', 'Basis & PFD', 'Transitiehoogte: STD en terug naar QNH', () => {
    const qnh = R.qnh(); const start = R.airborne(HOME, { alt: 4000 }); start.env.qnh = qnh;
    return { title: 'STD boven de transitiehoogte', start, intro: chatter('Brussels Information', `OO-XYZ, klim naar FL 55, transitiehoogte 4500 ft. Bij de daling: QNH ${qnh}.`),
      steps: [
        mk('Klim door de transitiehoogte (4500 ft) en zet de hoogtemeter op <b>STD</b> (1013).', 'Tik op het baro-veld → STD.', (S, A) => A.baroStd && AV.indAlt() > 4500),
        mk('Bereik FL 55 (±150 ft op STD) en houd 10 s.', 'Zet 5500 in het hoogtevak en gebruik ALT/VS op de AP.', hold((S, A) => A.baroStd && near(AV.indAlt(), 5500, 150), 10)),
        mk(`Daal en zet bij het passeren van het transitieniveau weer <b>QNH ${qnh}</b>.`, 'Baro-veld → cijfers invoeren → Enter.', (S, A) => !A.baroStd && A.baro === qnh && AV.indAlt() < 5300),
        q('Waarom gebruik je STD boven de transitiehoogte?', ['Zodat alle toestellen dezelfde referentie gebruiken voor verticale separatie', 'Omdat de QNH daar niet meer geldt', 'Omdat de hoogtemeter anders te snel verandert', 'Omdat de GPS-hoogte dan nauwkeuriger is'], 0, 'Boven de transitiehoogte vliegt iedereen op flight levels (1013,25 hPa), zodat verticale separatie klopt ongeacht de lokale QNH.'),
      ] };
  });
  add('pfd_minimums', 'Basis & PFD', 'Minimums instellen en respecteren', () => {
    const apt = R.apt({ withApr: true, max: 40 }); const mins = apt.elev + U.pick([400, 500, 600]); const start = R.airborne(apt, { alt: apt.elev + 2500, dist: 8 });
    return { title: `Minimums ${apt.id}`, start, intro: `<p>Briefing voor een nadering op <b>${esc(apt.name)}</b> (hoogte ${apt.elev} ft). De beslissingshoogte is <b>${mins} ft</b>.</p>`,
      steps: [
        mk(`Stel de minimums in op <b>${mins} ft</b> en schakel ze in.`, 'Tik op de snelheidstape → PFD Options → Minimums Altitude.', (S, A) => A.minimumsOn && A.minimums === mins),
        mk('Daal tot de melding MINIMUMS verschijnt (de minimums-bug op de hoogtetape wordt geel).', 'Daal met VS −500 of handmatig.', (S, A) => A.minFlag === true),
        mk(`Vlieg een go-around: klim tot minstens <b>${mins + 800} ft</b>.`, 'Vol gas, neus omhoog, of AP → GA (TO/GA).', (S, A) => AV.indAlt() > mins + 800),
        q('Wat doe je bij een circling/visuele nadering als je op minimums de baan niet ziet?', ['Doorstarten (missed approach)', 'Nog 100 ft verder dalen', 'Op dezelfde hoogte doorvliegen tot je de baan ziet', 'De snelheid verlagen'], 0, 'Zonder visuele referentie op de beslissingshoogte voer je de missed approach uit.'),
      ] };
  });
  add('pfd_wind', 'Basis & PFD', 'Windvector aflezen', () => {
    const start = R.airborne(HOME); const w = start.env;
    return { title: 'Windvector', start, intro: '<p>De windvector staat linksonder in de HSI. Tik erop om van weergave te wisselen.</p>',
      steps: [
        mk('Zet de windweergave op <b>componenten</b> (tegen-/zijwind, modus 1).', 'Tik op het windvak tot je twee pijltjes met getallen ziet, of via PFD Options → Wind Vector.', (S, A) => A.windMode === 1),
        (() => { const rel = U.norm180(w.windDir - start.hdg); const cross = Math.abs(Math.round(w.windSpd * Math.sin(rel * U.DEG))); const o = numOpts(cross, 4, v => Math.max(0, v) + ' kt'); return q(`Hoe groot is de dwarswindcomponent ongeveer bij je huidige heading (${U.fmtHdg(start.hdg)}°)?`, o.options, o.correct, `Wind ${U.fmtHdg(w.windDir)}°/${w.windSpd} kt. Zijwind ≈ snelheid × sin(hoek) = ${cross} kt.`); })(),
        mk('Zet de windweergave op <b>richting/snelheid</b> (modus 3).', 'Nog twee keer tikken op het windvak.', (S, A) => A.windMode === 3),
        q('Van welke kant komt de wind t.o.v. je neus?', [(() => { const rel = U.norm180(w.windDir - start.hdg); return Math.abs(rel) < 45 ? 'Van voren' : Math.abs(rel) > 135 ? 'Van achteren' : rel > 0 ? 'Van rechts' : 'Van links'; })(), 'Van de andere kant', 'Precies van opzij, geen tegen- of rugwind', 'De wind is nul'], 0, 'De pijl in het windvak wijst in de richting waarin de wind waait, gezien vanaf je heading.'),
      ] };
  });
  add('pfd_read', 'Basis & PFD', 'Instrumenten aflezen (quiz)', () => {
    const start = R.airborne(HOME);
    const mkQ = (label, getter, step, fmt) => Object.assign({ dynamic: true }, { text: label, makeQuestion: (S, A) => { const v = getter(S, A); const o = numOpts(Math.round(v / step) * step, step, fmt); return { options: o.options, correct: o.correct, explain: `Afgelezen: ${fmt(Math.round(v / step) * step)}.` }; } });
    return { title: 'Aflezen van de PFD', start, intro: '<p>Lees de gevraagde waarden af op de PFD. Antwoord binnen de tolerantie.</p>',
      steps: [
        mkQ('Wat is je <b>grondsnelheid</b> (GS, databalk bovenaan)?', S => S.ac.gs, 5, v => v + ' kt'),
        mkQ('Wat is je <b>track</b> (TRK)?', S => S.ac.trk, 10, v => U.fmtHdg(v) + '°'),
        mkQ('Wat is de <b>OAT</b>?', () => SIM.oat(), 2, v => v + ' °C'),
        mkQ('Wat is je <b>ware luchtsnelheid</b> (TAS, onder de snelheidstape)?', S => S.ac.tas, 5, v => v + ' kt'),
        mkQ('Wat is je <b>geïndiceerde hoogte</b> (afgerond op 100 ft)?', () => AV.indAlt(), 100, v => v + ' ft'),
        q('Wat betekent de magenta lijn naast de snelheidstape?', ['Trendvector: de snelheid over ±6 s als de versnelling gelijk blijft', 'De geselecteerde snelheid van de autopilot', 'De maximale structurele snelheid', 'De snelheid van de wind'], 0, 'De trendvector toont waar de snelheid (of hoogte) over 6 seconden zal zijn.'),
      ] };
  });
  add('pfd_settings', 'Basis & PFD', 'PFD-opties: SVT, bearing pointers, V-snelheden', () => {
    const vor = R.vor(); const start = R.airborne(HOME);
    const svtOff = U.chance(0.5);
    return { title: 'PFD-opties', start, intro: '<p>Pas de PFD aan via het optiemenu (tik op de snelheidstape of druk op MENU bij een volledig PFD).</p>',
      steps: [
        mk(`Zet Synthetic Vision <b>${svtOff ? 'UIT' : 'AAN'}</b>.`, 'PFD Options → Synthetic Vision.', (S, A) => A.svt === !svtOff),
        mk(`Stem NAV1 af op <b>${vor.id} ${U.fmtNav(vor.freq)}</b> en maak actief.`, 'Tik op de NAV1-standbyfrequentie linksonder op de PFD, voer de frequentie in, tik dan op het actieve veld om te wisselen (XFER).', (S, A) => near(A.nav1.active, vor.freq, 0.001)),
        mk('Zet <b>bearing pointer 1</b> op NAV1.', 'Tik rechts naast de HSI op BRG1 (of PFD Options).', (S, A) => A.brg1 === 'NAV1' && A.nav1.data.valid),
        (() => ({ text: `Op welke <b>radiaal</b> van ${vor.id} bevind je je ongeveer? (De staart van bearing pointer 1 wijst de radiaal aan.)`, makeQuestion: S => { const r = Math.round(U.bearing(vor, S.ac) / 10) * 10; const o = numOpts(r, 20, v => U.fmtHdg(v) + '°'); return { options: o.options, correct: o.correct, explain: `Peiling naar het station ${U.fmtHdg(U.bearing(S.ac, vor))}° → radiaal ${U.fmtHdg(r)}° (tegenovergestelde).` }; } }))(),
        mk('Zet bearing pointer 2 op <b>GPS</b> en schakel de V-snelheden <b>uit</b>.', 'BRG2-vak naast de HSI; V-snelheden via PFD Options.', (S, A) => A.brg2 === 'GPS' && A.vspeeds === false),
      ] };
  });
  add('pfd_units', 'Basis & PFD', 'Eenheden omschakelen', () => {
    const start = R.airborne(HOME); const toKm = U.chance(0.5);
    return { title: 'Eenheden', start, intro: '<p>Een collega vliegt liever metrisch. Pas de eenheden aan via Main Menu (MENU 2×) → Setup.</p>',
      steps: [
        mk(`Zet afstand op <b>${toKm ? 'KM' : 'NM'}</b> en snelheid op <b>${toKm ? 'KM/H' : 'KT'}</b>.`, 'Main Menu (MENU 2×) → Setup → Units.', (S, A) => A.units.dist === (toKm ? 'KM' : 'NM') && A.units.speed === (toKm ? 'KMH' : 'KT')),
        mk('Zet de baro-eenheid op <b>inHg</b>.', 'Setup → Baro → inHg. Het baro-veld toont nu bv. 29.92 IN.', (S, A) => A.units.baro === 'INHG'),
        (() => ({ text: 'Welke baro-instelling in inHg komt overeen met de huidige QNH in hPa?', makeQuestion: S => { const v = U.hpaToInhg(S.env.qnh); const o = numOpts(Math.round(v * 100) / 100, 0.1, x => x.toFixed(2) + ' inHg'); return { options: o.options, correct: o.correct, explain: `${S.env.qnh} hPa ÷ 33,86 = ${v.toFixed(2)} inHg.` }; } }))(),
        mk('Zet alle eenheden terug: NM, KT, FT, °C, hPa, liter.', 'Setup → Units.', (S, A) => A.units.dist === 'NM' && A.units.speed === 'KT' && A.units.alt === 'FT' && A.units.temp === 'C' && A.units.baro === 'HPA' && A.units.fuel === 'L'),
      ] };
  });

  // === Radio & transponder ===
  add('com_tune', 'Radio & transponder', 'COM afstemmen en wisselen', () => {
    const apt = R.apt(); const f = mainFreq(apt); const start = R.airborne(HOME);
    return { title: `COM: ${apt.id}`, start, intro: chatter('Brussels Information', `OO-XYZ, contact ${apt.name} ${R.fmtF(f)}. Monitor 121.500 op COM2.`),
      steps: [
        mk(`Zet <b>${R.fmtF(f)}</b> in COM1 standby.`, 'Tik op de cyaan COM1-standbyfrequentie in de bovenbalk → toetsenbord. Je kunt ook de lijst “Nearest” gebruiken.', (S, A) => near(A.com1.standby, f, 0.0005)),
        mk('Maak de frequentie actief (XFER / wissel).', 'Tik op de actieve COM1-frequentie om te wisselen met standby.', (S, A) => near(A.com1.active, f, 0.0005)),
        mk('Zet <b>121.500</b> actief op COM2.', 'COM2-standby → 121.500 (snelknop) → wisselen.', (S, A) => near(A.com2.active, 121.5, 0.0005)),
        mk('Selecteer COM1 als zendradio (MIC).', 'Tik op het audiovak (MIC) in de bovenbalk → COM1.', (S, A) => A.com1.mic),
        q('Wat betekent “8,33 kHz-kanaalafstand” voor het invoeren van frequenties?', ['Je voert kanalen als 118.955 in: eindcijfers 005/010/015 bestaan ook', 'Alleen frequenties eindigend op 00, 25, 50, 75 zijn geldig', 'De radio werkt alleen boven FL 195', 'Je moet de 8,33-modus apart inschakelen per vlucht'], 0, 'In Europa zijn 8,33 kHz-kanalen verplicht; een “kanaal” zoals 118.955 is een naam, geen exacte frequentie.'),
      ] };
  });
  add('com_nearest', 'Radio & transponder', 'Frequentie opzoeken via Nearest', () => {
    const start = R.airborne(R.apt({ max: 25 }), { dist: U.rnd(2, 5) });
    return { title: 'Nearest → frequentie', start, intro: '<p>Je wilt het dichtstbijzijnde vliegveld oproepen maar kent de frequentie niet uit het hoofd.</p>',
      steps: [
        mk('Open de pagina <b>Nearest</b> (Airports).', 'Toets NRST op de bezel, tab Vliegvelden.', (S, A, ctx) => ctx.has('page', p => p === 'NRST')),
        mk('Zet de hoofdfrequentie van het <b>dichtstbijzijnde vliegveld</b> actief in COM1.', 'Tik op de rij → Waypoint Info → tik op de frequentie (gaat naar COM1 standby) → wissel.', (S, A) => { const n = NAV.nearest(S.ac, 'APT', 1)[0].item; return near(A.com1.active, mainFreq(n), 0.0005); }),
        (() => ({ text: 'Hoe ver is dat vliegveld ongeveer (nm)?', makeQuestion: S => { const n = NAV.nearest(S.ac, 'APT', 1)[0]; const d = Math.round(n.dist); const o = numOpts(d, 3, v => Math.max(0, v) + ' NM'); return { options: o.options, correct: o.correct, explain: `${n.item.id} op ${n.dist.toFixed(1)} nm, peiling ${U.fmtHdg(n.brg)}°.` }; } }))(),
      ] };
  });
  add('xpdr_code', 'Radio & transponder', 'Transponder: code, modus, IDENT, VFR', () => {
    const code = R.squawk(); const start = R.airborne(HOME); start.extra = {};
    return { title: 'Transponder', start, intro: chatter('Brussels Information', `OO-XYZ, squawk ${code}.`),
      steps: [
        mk(`Stel code <b>${code}</b> in.`, 'Tik op het XPDR-vak (bovenbalk of rechtsonder op de PFD) → cijfers 0–7 → Enter.', (S, A) => A.xpdr.code === code),
        mk('Zorg dat de transponder in <b>ALT</b> staat (mode C).', 'In het transponderdialoog: ALT.', (S, A) => A.xpdr.mode === 'ALT', { fail: (S, A) => A.xpdr.mode === 'STBY' ? 'Transponder op STBY tijdens de vlucht: ATC ziet je niet.' : null }),
        mk('ATC vraagt: <i>“squawk ident”</i>. Druk op <b>IDENT</b>.', 'Transponderdialoog → IDENT.', ev('ident')),
        mk('Je verlaat de gecontroleerde zone: zet de <b>VFR-code 7000</b>.', 'Transponderdialoog → knop VFR.', (S, A) => A.xpdr.code === '7000'),
        q('Welke code gebruik je bij radio-uitval?', ['7600', '7700', '7500', '7000'], 0, '7500 kaping, 7600 radio-uitval, 7700 noodgeval.'),
      ] };
  });
  add('nav_vor', 'Radio & transponder', 'VOR afstemmen, identificeren en radiaal onderscheppen', () => {
    const vor = R.vor({ min: 8, max: 35 }); const start = R.airborne(vor, { dist: U.rnd(10, 18), alt: 3000 });
    const inbound = U.norm360(Math.round(U.bearing(start, vor) / 10) * 10 + U.pick([-20, 20]));
    return { title: `VOR ${vor.id}`, start, intro: `<p>Navigeer op de VOR <b>${esc(vor.name)}</b> (${vor.id}). Onderschep de inbound koers <b>${U.fmtHdg(inbound)}°</b> (radiaal ${U.fmtHdg(inbound + 180)}).</p>`,
      steps: [
        mk(`Stem NAV1 af op <b>${U.fmtNav(vor.freq)}</b> en maak actief.`, 'NAV1-standbyfrequentie (PFD linksonder) linksboven → frequentie → XFER.', (S, A) => near(A.nav1.active, vor.freq, 0.001)),
        q(`Welke morse-ident hoort bij ${vor.id}? (De G3X toont de gedecodeerde ident onder NAV1.)`, U.shuffle([U.morse(vor.id), U.morse(vor.id.split('').reverse().join('')), U.morse(vor.id.slice(1) + vor.id[0]), U.morse('XYZ')]).map(x => x), null, `Ident ${vor.id} = ${U.morse(vor.id)}.`),
        mk('Zet de CDI-bron op <b>NAV1</b> (VOR1).', 'Tik op het bronlabel links boven de HSI (GPS → NAV1).', (S, A) => A.navSource === 'NAV1'),
        mk(`Zet CRS op <b>${U.fmtHdg(inbound)}°</b> (TO).`, 'CRS-veld rechts naast de HSI of binnenring linkerknop (BARO/CRS).', (S, A) => hdgNear(A.nav1.obs, inbound, 2)),
        mk('Onderschep de koers: naald gecentreerd (binnen ½ dot) met TO-vlag, 15 s lang.', 'Vlieg naar de naald toe met een onderscheppingshoek van ca. 30–45°. AP: NAV-modus werkt ook met VOR.', hold((S, A) => A.nav1.data.valid && Math.abs(A.nav1.data.dev) < 0.5 && A.nav1.data.toFrom === 'TO', 15)),
      ] };
  });
  // corrigeer: voor de morse-vraag zetten we correct dynamisch
  GEN.find(g => g.id === 'nav_vor').post = sc => { const st = sc.steps[1]; const vorId = sc.title.split(' ')[1]; st.question.correct = st.question.options.indexOf(U.morse(vorId)); };
  add('nav_ils', 'Radio & transponder', 'ILS afstemmen en localizer onderscheppen', () => {
    const cands = NAV.AIRPORTS.filter(a => a.rwys.some(r => r.ils) && U.distNm(HOME, a) < 60); const apt = U.pick(cands);
    const rw = apt.rwys.find(r => r.ils); const [rid, freq] = Object.entries(rw.ils)[0]; const re = NAV.runwayEnds(apt, rid);
    const start = { airborne: true, ...U.dest(re.thr, U.norm360(re.hdg + 180 + U.pick([-25, 25])), 9), alt: apt.elev + 2200, hdg: U.norm360(re.hdg + U.pick([-40, 40])), ias: 90, env: R.env(), fuelL: 35, fuelR: 35, fuelSel: 'L' };
    return { title: `ILS ${rid} ${apt.id}`, start, intro: chatter(`${apt.name} Approach`, `OO-XYZ, cleared ILS approach runway ${rid}, localizer ${U.fmtNav(freq)}, final course ${U.fmtHdg(re.hdg)}.`),
      steps: [
        mk(`Stem NAV1 af op <b>${U.fmtNav(freq)}</b> (actief).`, 'NAV1-standby (PFD linksonder) → frequentie → XFER. Tip: de ILS-frequentie staat ook in de waypoint-info van het vliegveld.', (S, A) => near(A.nav1.active, freq, 0.001)),
        mk('CDI-bron op <b>NAV1</b>; de ident verschijnt als de localizer wordt ontvangen.', 'Bronlabel boven de HSI.', (S, A) => A.navSource === 'NAV1' && A.nav1.data.loc),
        mk(`Zet CRS op de eindkoers <b>${U.fmtHdg(re.hdg)}°</b>.`, 'CRS-veld naast de HSI.', (S, A) => hdgNear(A.nav1.obs, re.hdg, 2)),
        mk('Onderschep de localizer: naald binnen ½ dot gedurende 10 s.', 'AP → APR met NAV1 als bron, of handmatig.', hold((S, A) => A.nav1.data.loc && Math.abs(A.nav1.data.dev) < 0.5, 10)),
        mk('Volg de glideslope: verticale afwijking binnen 1 dot gedurende 15 s (onder 1500 ft AGL).', 'Daal met ca. 300–400 fpm bij 70–80 kt; AP: APR vangt GS.', hold((S, A) => A.nav1.data.gsValid && Math.abs(A.nav1.data.gsDev) < 1 && S.ac.agl < 1500, 15)),
      ] };
  });
  add('com_8_33', 'Radio & transponder', 'Nauwkeurig 8,33-kanaal invoeren en MIC wisselen', () => {
    const chans = U.comChannels(); const f = U.pick(chans.filter(c => Math.round(c * 1000) % 25 !== 0 && c > 118 && c < 132));
    const start = R.airborne(HOME);
    return { title: '8,33 kHz-kanaal', start, intro: chatter('Brussels Information', `OO-XYZ, contact Hasselt Radio op ${R.fmtF(f)}. Correct read back verwacht.`),
      steps: [
        mk(`Zet <b>${R.fmtF(f)}</b> actief op <b>COM2</b>.`, 'COM2 STBY (bovenbalk) → cijfers → Enter → wissel.', (S, A) => near(A.com2.active, f, 0.0005)),
        mk('Zet <b>COM2</b> als MIC (zendradio).', 'Tik op het audiovak (MIC) in de bovenbalk → COM2.', (S, A) => A.com2.mic),
        q(`Welk kanaal ligt één stap boven ${R.fmtF(f)} (8,33-raster)?`, (() => { const nx = U.nextCom(f, 1, false); const o = U.shuffle([R.fmtF(nx), R.fmtF(f + 0.025), R.fmtF(f + 0.001), R.fmtF(f + 0.01 + (Math.round(f * 1000) % 25 === 15 ? 0.005 : 0))]); return o; })(), null, 'De 8,33-kanalen binnen een 25 kHz-blok eindigen op .x00, .x05, .x10, .x15.'),
      ] };
  });
  GEN.find(g => g.id === 'com_8_33').post = sc => { const f = parseFloat(sc.intro.match(/op (\d{3}\.\d{3})/)[1]); const nx = R.fmtF(U.nextCom(f, 1, false)); const st = sc.steps[2]; st.question.correct = st.question.options.indexOf(nx); if (st.question.correct < 0) { st.question.options[0] = nx; st.question.correct = 0; } };

  // === Navigatie (GPS) ===
  add('dto_apt', 'Navigatie (GPS)', 'Direct-To en CDI volgen', () => {
    const apt = R.apt({ min: 10, max: 35 }); const start = R.airborne(HOME);
    return { title: `Direct-To ${apt.id}`, start, intro: `<p>Vlieg rechtstreeks naar <b>${esc(apt.name)} (${apt.id})</b>.</p>`,
      steps: [
        mk(`Activeer <b>Direct-To ${apt.id}</b>.`, 'Toets D→ op de bezel → typ de ID (of tabblad Nearest Airports) → Activate.', (S, A) => A.fpl.directTo && A.fpl.directTo.to.id === apt.id),
        mk('Draai naar de DTK en houd de CDI gecentreerd (XTK < 0,3 nm) gedurende 20 s.', 'Lees DTK af in de databalk; stuur tot de magenta naald in het midden staat. AP: NAV.', hold((S, A) => A.nav && A.nav.valid && Math.abs(A.nav.xtk) < 0.3 && hdgNear(S.ac.trk, A.nav.dtk, 15), 20)),
        (() => ({ text: 'Wat is de ETE naar het waypoint (minuten, afgerond)?', makeQuestion: (S, A) => { const m = Math.round(A.nav.ete); const o = numOpts(m, 3, v => Math.max(0, v) + ' min'); return { options: o.options, correct: o.correct, explain: `DIS ${A.nav.dis.toFixed(1)} nm ÷ GS ${Math.round(S.ac.gs)} kt × 60 = ${m} min.` }; } }))(),
        mk('Zet het bereik van de kaart zo dat het waypoint zichtbaar is (bereik ≥ afstand) en op <b>Track up</b>.', 'Rechterknop (buiten) = bereik; Menu op de kaart = Orientation.', (S, A) => A.map.range >= A.nav.dis * 0.9 && A.map.orient === 'TRKUP'),
      ] };
  });
  add('dto_nrst', 'Navigatie (GPS)', 'Nearest → Direct-To (uitwijkhaven)', () => {
    const start = R.airborne(R.apt({ max: 30 }), { dist: U.rnd(3, 7) });
    return { title: 'Uitwijken naar het dichtstbijzijnde veld', start, intro: '<p>Het weer verslechtert snel. Vlieg naar het dichtstbijzijnde vliegveld.</p>',
      steps: [
        mk('Open <b>Nearest → Airports</b> en activeer een <b>Direct-To naar het dichtstbijzijnde</b> vliegveld.', 'NRST-toets → tik op de eerste rij → Direct-To.', (S, A) => { const n = NAV.nearest(S.ac, 'APT', 1)[0].item; return A.fpl.directTo && A.fpl.directTo.to.id === n.id; }),
        mk('Zet de hoofdfrequentie van dat veld in COM1 (actief) en de hoogte van het circuit (veldhoogte + 1000 ft, afgerond op 100) als geselecteerde hoogte.', 'Waypoint Info → frequentie; hoogtevak → waarde.', (S, A) => { const n = A.fpl.directTo && NAV.find(A.fpl.directTo.to.id); if (!n) return false; return near(A.com1.active, mainFreq(n), 0.0005) && near(A.altSel, Math.round((n.elev + 1000) / 100) * 100, 60); }),
        (() => ({ text: 'Welke baan is in gebruik (meeste tegenwind)?', makeQuestion: (S, A) => { const n = NAV.find(A.fpl.directTo.to.id); const w = SIM.windAt(); const ends = n.rwys.flatMap(r => r.id.split('/').map((id, i) => ({ id, hdg: i ? U.norm360(r.hdg + 180) : r.hdg }))); const best = ends.map(e => ({ e, hw: w.spd * Math.cos((w.dir - e.hdg) * U.DEG) })).sort((a, b) => b.hw - a.hw); const opts = U.shuffle(ends.map(e => e.id)).slice(0, 4); while (opts.length < 4) opts.push(['00', '18', '27', '36'][opts.length]); if (!opts.includes(best[0].e.id)) opts[0] = best[0].e.id; return { options: opts, correct: opts.indexOf(best[0].e.id), explain: `Wind ${U.fmtHdg(w.dir)}°/${Math.round(w.spd)} kt → baan ${best[0].e.id}.` }; } }))(),
        mk('Kom binnen 2 nm van het veld op circuit-hoogte ±200 ft.', 'Daal tijdig: 3° ≈ 300 ft per nm.', (S, A) => { const n = NAV.find(A.fpl.directTo ? A.fpl.directTo.to.id : ''); return n && U.distNm(S.ac, n) < 2 && near(AV.indAlt(), n.elev + 1000, 200); }),
      ] };
  });
  add('fpl_build', 'Navigatie (GPS)', 'Vluchtplan opbouwen en bewerken', () => {
    const a1 = R.vrp({ min: 5, max: 20 }); const b = R.apt({ min: 15, max: 40, not: HOME.id }); const c = R.vrp({ from: b, min: 4, max: 15 });
    const start = R.onRunway(HOME); start.engineRunning = true;
    return { title: `Vluchtplan ${HOME.id} → ${a1.id} → ${b.id}`, start, intro: `<p>Je plant een vlucht van <b>${HOME.id}</b> via <b>${a1.id}</b> (${esc(a1.name)}) naar <b>${b.id}</b> (${esc(b.name)}). Je staat op de baan met draaiende motor.</p>`,
      steps: [
        mk(`Maak het vluchtplan <b>${HOME.id} → ${a1.id} → ${b.id}</b> (in die volgorde).`, 'Main Menu (MENU 2×) → Active FPL → + Waypoint, drie keer.', (S, A) => A.fpl.wpts.map(w => w.id).join(',') === [HOME.id, a1.id, b.id].join(',')),
        mk(`Voeg <b>${c.id}</b> in <b>vóór</b> ${b.id}.`, 'Tik op de rij van ' + b.id + ' → Insert Before.', (S, A) => A.fpl.wpts.map(w => w.id).join(',') === [HOME.id, a1.id, c.id, b.id].join(',')),
        mk(`Activeer de leg naar <b>${c.id}</b>.`, 'Tik op de rij → Activate Leg.', (S, A) => A.fpl.active === 2 && !A.fpl.directTo),
        mk(`Verwijder <b>${a1.id}</b> uit het plan.`, 'Rij → Remove.', (S, A) => A.fpl.wpts.map(w => w.id).join(',') === [HOME.id, c.id, b.id].join(',')),
        mk('Sla het vluchtplan op (Store Flight Plan).', 'FPL → Menu → Store Flight Plan.', ev('fplstore')),
        (() => ({ text: 'Hoe lang is de totale route nu (nm)?', makeQuestion: (S, A) => { const w = A.fpl.wpts; const d = Math.round(w.reduce((t, x, i) => i ? t + U.distNm(w[i - 1], x) : 0, 0)); const o = numOpts(d, 5, v => v + ' NM'); return { options: o.options, correct: o.correct, explain: 'De totale afstand staat rechtsboven op de vluchtplanpagina.' }; } }))(),
      ] };
  });
  add('fpl_store', 'Navigatie (GPS)', 'Vluchtplan opslaan, wissen en laden', () => {
    const a1 = R.vrp(); const b = R.apt({ min: 12, max: 35 }); const start = R.airborne(HOME);
    const av = A => { AV.fplClear(); AV.fplAdd(HOME); AV.fplAdd(a1); AV.fplAdd(b); A.storedFpls = A.storedFpls.filter(s => s.name !== [HOME.id, a1.id, b.id].join('-')); };
    return { title: 'Vluchtplannen beheren', start, av, intro: `<p>Er staat al een vluchtplan ${HOME.id} → ${a1.id} → ${b.id} in het toestel.</p>`,
      steps: [
        mk('Sla het actieve vluchtplan op.', 'FPL → Menu → Store Flight Plan.', ev('fplstore')),
        mk('Wis het actieve vluchtplan.', 'FPL → Menu → Delete Flight Plan.', (S, A) => A.fpl.wpts.length === 0),
        mk('Laad het opgeslagen plan opnieuw uit de lijst.', 'Main Menu (MENU 2×) → FPL List → tik op het plan.', (S, A) => A.fpl.wpts.map(w => w.id).join(',') === [HOME.id, a1.id, b.id].join(',')),
        mk('Keer het vluchtplan om (terugvlucht).', 'FPL → Menu → Invert Flight Plan.', (S, A) => A.fpl.wpts.map(w => w.id).join(',') === [b.id, a1.id, HOME.id].join(',')),
      ] };
  });
  add('fpl_dto_crs', 'Navigatie (GPS)', 'Direct-To met koers (inbound radiaal)', () => {
    const vor = R.vor({ min: 10, max: 30 }); const start = R.airborne(vor, { dist: 14, alt: 3000 });
    const crs = U.norm360(Math.round(U.bearing(start, vor) / 10) * 10 + U.pick([-30, 30]));
    return { title: `Direct-To ${vor.id} met koers ${U.fmtHdg(crs)}`, start, intro: chatter('Liège Approach', `OO-XYZ, route direct ${vor.id}, intercept inbound course ${U.fmtHdg(crs)}.`),
      steps: [
        mk(`Activeer Direct-To <b>${vor.id}</b> met koers <b>${U.fmtHdg(crs)}°</b>.`, 'D→ → Waypoint → ID ' + vor.id + ' → “Course To” → voer de koers in.', (S, A) => A.fpl.directTo && A.fpl.directTo.to.id === vor.id && A.fpl.directTo.crs != null && hdgNear(A.fpl.directTo.crs, crs, 2)),
        mk('Onderschep de koers: XTK < 0,2 nm gedurende 15 s.', 'Vlieg met 30–45° onderschepping naar de magenta lijn. AP: NAV (eerst gewapend, dan gevangen).', hold((S, A) => A.nav && A.nav.valid && Math.abs(A.nav.xtk) < 0.2, 15)),
        q('Wat is het verschil tussen een gewone Direct-To en Direct-To met koers?', ['Met koers vlieg je eerst naar een vastgelegde lijn door het waypoint, i.p.v. een rechte lijn vanaf je huidige positie', 'Met koers is sneller', 'Met koers gebruikt de VOR in plaats van GPS', 'Er is geen verschil'], 0, 'Met een koers legt de G3X een lijn door het waypoint; handig voor een inbound radiaal of een verlengde baanas.'),
      ] };
  });
  add('fpl_obs', 'Navigatie (GPS)', 'OBS-modus op een GPS-waypoint', () => {
    const vrp = R.vrp({ min: 6, max: 20 }); const start = R.airborne(vrp, { dist: 9 });
    const crs = U.norm360(Math.round(U.bearing(start, vrp) / 10) * 10 + U.pick([-40, 40]));
    const av = () => { AV.fplClear(); AV.fplAdd(HOME); AV.fplAdd(vrp); };
    return { title: `OBS ${vrp.id}`, start, av, intro: `<p>Je wilt <b>${vrp.id}</b> naderen via koers <b>${U.fmtHdg(crs)}°</b> (zoals een VOR-radiaal) en daar niet automatisch doorsequencen.</p>`,
      steps: [
        mk('Schakel <b>OBS</b> in op het actieve waypoint.', 'Tik op het DTK/CRS-veld naast de HSI → OBS On. Of FPL → Menu → OBS Mode.', (S, A) => A.fpl.obs),
        mk(`Zet de koers op <b>${U.fmtHdg(crs)}°</b>.`, 'CRS-veld of binnenring linkerknop (BARO/CRS).', (S, A) => A.fpl.obs && hdgNear(A.crs1, crs, 2)),
        mk('Centreer de CDI (XTK < 0,3 nm) gedurende 10 s.', 'Vlieg naar de lijn toe.', hold((S, A) => A.fpl.obs && A.nav && Math.abs(A.nav.xtk) < 0.3, 10)),
        mk('Schakel OBS weer uit (normaal sequencen).', 'OBS-vak op de HSI of CRS-veld → OBS Off.', (S, A) => !A.fpl.obs),
      ] };
  });
  add('map_opts', 'Navigatie (GPS)', 'Kaart: bereik, oriëntatie, declutter en luchtruim', () => {
    const start = R.airborne(HOME); const range = U.pick([8, 10, 15, 20]); const orient = U.pick(['NORTH', 'HDGUP']); const asp = NAV.AIRSPACES.find(s => s.id === 'EBBL-CTR');
    return { title: 'Kaartinstellingen', start, intro: '<p>Stel de kaart in zoals gevraagd en lees het luchtruim af.</p>',
      steps: [
        mk(`Zet het kaartbereik op <b>${range} NM</b>.`, 'Buitenring rechterknop, of −/+ rechtsonder op de kaart.', (S, A) => A.map.range === range && A.mfdPage === 'MAP'),
        mk(`Zet de oriëntatie op <b>${orient === 'NORTH' ? 'North up' : 'Heading up'}</b>.`, 'MENU op de kaart → Orientation.', (S, A) => A.map.orient === orient),
        mk('Zet <b>declutter niveau 2</b> (minder tekst) en daarna terug naar <b>alles</b>.', 'MENU → Declutter.', (() => { let was2 = false; return (S, A) => { if (A.map.declutter === 2) was2 = true; return was2 && A.map.declutter === 0; }; })()),
        q(`Wat is het plafond van de <b>${asp.name}</b> (zie kaartlabel of Nearest → Airspace)?`, U.shuffle([`${asp.ceil} ft`, `${asp.ceil + 1000} ft`, `${asp.ceil - 1000} ft`, 'FL 95']), null, `${asp.name}: ${asp.floor === 0 ? 'GND' : asp.floor} – ${asp.ceil} ft, klasse ${asp.cls}.`),
        mk('Schakel de <b>topografie uit</b> en weer <b>aan</b>.', 'MENU → Topo.', (() => { let off = false; return (S, A) => { if (!A.map.topo) off = true; return off && A.map.topo; }; })()),
      ] };
  });
  GEN.find(g => g.id === 'map_opts').post = sc => { const st = sc.steps[3]; const asp = NAV.AIRSPACES.find(s => s.id === 'EBBL-CTR'); st.question.correct = st.question.options.indexOf(`${asp.ceil} ft`); };
  add('map_cursor', 'Navigatie (GPS)', 'Kaartcursor: meten en gebruikerswaypoint', () => {
    const city = U.pick(NAV.CITIES.filter(c => U.distNm(HOME, { lat: c[1], lon: c[2] }) < 25 && c[3] <= 1)); const start = R.airborne(HOME, { dist: 3 });
    return { title: 'Kaartcursor', start, intro: `<p>Gebruik de kaartcursor (tik of sleep op de kaart, of druk de rechterknop in) om te meten.</p>`,
      steps: [
        mk('Activeer de cursor op de kaart (tik op een lege plek of druk op de rechterknop).', 'Linksonder verschijnt peiling en afstand vanaf het vliegtuig.', (S, A) => A.map.panning && A.mfdPage === 'MAP'),
        (() => ({ text: `Wat is ongeveer de <b>afstand</b> van je positie tot <b>${esc(city[0])}</b>? (Zet de cursor op de stad.)`, makeQuestion: S => { const d = Math.round(U.distNm(S.ac, { lat: city[1], lon: city[2] })); const o = numOpts(d, 3, v => Math.max(0, v) + ' NM'); return { options: o.options, correct: o.correct, explain: `Peiling ${U.fmtHdg(U.bearing(S.ac, { lat: city[1], lon: city[2] }))}°, ${d} nm.` }; } }))(),
        mk('Maak een <b>gebruikerswaypoint</b> op de cursorpositie.', 'Cursormenu → Create User Waypoint (of rechterknop indrukken → menu).', ev('userwpt')),
        mk('Activeer een Direct-To naar dat nieuwe waypoint.', 'D→ → Waypoint → typ de USR-ID (of tabblad Recent).', (S, A) => A.fpl.directTo && A.fpl.directTo.to.user),
        mk('Zet de cursor uit (Back).', 'Toets BACK.', (S, A) => !A.map.panning),
      ] };
  });
  add('wpt_info', 'Navigatie (GPS)', 'Waypoint-informatie opzoeken', () => {
    const apt = R.apt({ min: 5, max: 60 }); const start = R.airborne(HOME);
    const rw = apt.rwys[0];
    return { title: `Info ${apt.id}`, start, intro: `<p>Zoek de gegevens van <b>${apt.id}</b> op in het toestel.</p>`,
      steps: [
        mk(`Open de waypoint-informatie van <b>${apt.id}</b>.`, 'Main Menu (MENU 2×) → Waypoint Info → Search Waypoint → typ de ID. Of tik het veld aan op de kaart.', (S, A, ctx) => ctx.has('wptinfo', id => id === apt.id)),
        q(`Wat is de veldhoogte van ${apt.id}?`, (() => { const o = numOpts(apt.elev, 150, v => Math.max(0, v) + ' ft'); return o.options; })(), null, `${apt.name}: ${apt.elev} ft.`),
        q(`Hoe lang is baan ${rw.id}?`, U.shuffle([`${rw.len} m`, `${rw.len + 300} m`, `${Math.max(300, rw.len - 300)} m`, `${rw.len + 700} m`]), null, `${rw.id}: ${rw.len} m ${rw.surf}.`),
        mk(`Zet de hoofdfrequentie van ${apt.id} in COM1 standby.`, 'In het infovenster: tik op de frequentie.', (S, A) => near(A.com1.standby, mainFreq(apt), 0.0005)),
      ] };
  });
  GEN.find(g => g.id === 'wpt_info').post = sc => { const id = sc.title.split(' ')[1]; const apt = NAV.find(id); sc.steps[1].question.correct = sc.steps[1].question.options.indexOf(apt.elev + ' ft'); sc.steps[2].question.correct = sc.steps[2].question.options.indexOf(apt.rwys[0].len + ' m'); };
  add('vnav', 'Navigatie (GPS)', 'VNAV: hoogtebeperking en gestuurde daling', () => {
    const vrp = R.vrp({ min: 12, max: 25 }); const start = R.airborne(vrp, { dist: 14, alt: 4000, brg: U.rnd(0, 360) }); start.hdg = Math.round(U.bearing(start, vrp));
    const target = U.pick([1500, 2000]);
    const av = () => { AV.fplClear(); AV.fplAdd(HOME); AV.fplAdd(vrp); AV.directTo(vrp); };
    return { title: `VNAV naar ${vrp.id}`, start, av, intro: `<p>Je nadert <b>${vrp.id}</b> op 4000 ft en wilt daar op <b>${target} ft</b> aankomen met een VNAV-daling.</p>`,
      steps: [
        mk(`Stel bij <b>${vrp.id}</b> in het vluchtplan de hoogte <b>${target} ft</b> in.`, 'FPL → rij ' + vrp.id + ' → Set Altitude (VNAV).', (S, A) => A.fpl.wpts.some(w => w.id === vrp.id && w.alt === target)),
        mk(`Zet de geselecteerde hoogte op <b>${target} ft</b>, schakel de AP in met NAV + ALT en <b>arm VNV</b>.`, 'AP-balk → AP, NAV, ALT, VNV. Hoogtevak → ' + target + '.', (S, A) => A.ap.on && A.altSel === target && (A.ap.vertArm.includes('VNV') || A.ap.vert === 'VNV')),
        mk('Wacht op het top-of-descent (TOD): de AP gaat naar VPTH en daalt op het 3°-profiel.', 'Let op de verticale afwijkingsindicator (V) naast de hoogtetape.', (S, A) => A.ap.vert === 'VNV' || (A.ap.vert === 'ALT' && near(A.ap.altRef, target, 50) && AV.indAlt() < target + 200)),
        mk(`Bereik ${vrp.id} binnen 2 nm op ${target} ±150 ft.`, 'Laat de AP het werk doen; controleer snelheid en vermogen.', (S, A) => U.distNm(S.ac, vrp) < 2 && near(AV.indAlt(), target, 150)),
      ] };
  });
  add('nrst_airspace', 'Navigatie (GPS)', 'Luchtruim in de buurt opzoeken', () => {
    const start = R.airborne(HOME, { alt: 2000 });
    return { title: 'Nearest → Airspace', start, intro: '<p>Je wilt weten welk gecontroleerd luchtruim het dichtst bij is en wat de grenzen zijn.</p>',
      steps: [
        mk('Open <b>Nearest → Airspace</b>.', 'NRST-toets → tab Airspace.', (S, A, ctx) => ctx.has('nrsttab', t => t === 'ASPC')),
        (() => ({ text: 'Welk luchtruim (niet-ATZ) is het dichtst bij of ben je al in?', makeQuestion: S => { const list = NAV.AIRSPACES.filter(s => s.type !== 'ATZ').map(s => ({ s, d: NAV.inside(s, S.ac) ? 0 : NAV.distToAirspace(s, S.ac) })).sort((x, y) => x.d - y.d); const opts = list.slice(0, 4).map(x => x.s.name); const sh = U.shuffle(opts); return { options: sh, correct: sh.indexOf(list[0].s.name), explain: `${list[0].s.name}: ${list[0].d === 0 ? 'je bent erin' : list[0].d.toFixed(1) + ' nm'}.` }; } }))(),
        (() => ({ text: 'Wat is de ondergrens (vloer) van dat luchtruim?', makeQuestion: S => { const list = NAV.AIRSPACES.filter(s => s.type !== 'ATZ').map(s => ({ s, d: NAV.inside(s, S.ac) ? 0 : NAV.distToAirspace(s, S.ac) })).sort((x, y) => x.d - y.d); const s = list[0].s; const corr = s.floor === 0 ? 'GND' : s.floor + ' ft'; const opts = U.shuffle([corr, s.floor === 0 ? '1500 ft' : 'GND', `${s.floor + 1000} ft`, `${s.ceil} ft`]); return { options: opts, correct: opts.indexOf(corr), explain: `${s.name}: ${corr} – ${s.ceil} ft.` }; } }))(),
        q('Wat moet je doen vóór je een CTR (klasse D) binnenvliegt?', ['Tweezijdig radiocontact en klaring van de toren krijgen', 'Alleen luisteren op de frequentie', 'Niets, VFR mag altijd onder 1500 ft', 'Transponder op STBY zetten'], 0, 'Klasse D: ATC-klaring vereist voor alle vluchten; VFR krijgt verkeersinformatie.'),
      ] };
  });

  // === Autopilot ===
  add('ap_hdg_alt', 'Autopilot', 'AP: HDG en hoogte houden, klimmen met VS', () => {
    const hdg = R.hdg(); const start = R.airborne(HOME, { alt: 2000 }); const alt2 = 2000 + U.pick([1000, 1500]);
    return { title: 'AP HDG / ALT / VS', start, intro: `<p>Oefen de basismodi van de GFC 500. Bedieningspaneel: tik op de AP-statusbalk of gebruik het paneel onder het scherm.</p>`,
      steps: [
        mk(`Zet de heading bug op <b>${U.fmtHdg(hdg)}°</b>, schakel de <b>AP</b> in met <b>HDG</b> en <b>ALT</b>.`, 'AP-balk → AP → HDG → ALT. Groene modi: HDG / ALT.', (S, A) => A.ap.on && A.ap.lat === 'HDG' && A.ap.vert === 'ALT' && A.hdgBug === hdg),
        mk('Wacht tot het toestel op heading is (±3°) en de hoogte binnen 50 ft wordt gehouden, 10 s.', 'Geduld: de AP draait met max. 25° bank.', hold((S, A) => hdgNear(S.ac.hdg, hdg, 3) && near(AV.indAlt(), A.ap.altRef, 50), 10)),
        mk(`Zet de geselecteerde hoogte op <b>${alt2} ft</b> en klim met <b>VS +500 fpm</b>. Verhoog het vermogen!`, 'Hoogtevak → ' + alt2 + '. AP → VS, dan NOSE UP tot +500. ALTS wordt wit gewapend.', (S, A) => A.altSel === alt2 && A.ap.vert === 'VS' && A.ap.vsRef >= 400 && A.ap.vsRef <= 700, { fail: S => S.ac.ias < 60 ? 'Snelheid te laag in de klim: meer vermogen of minder VS.' : null }),
        mk('Laat de AP de hoogte vangen (ALTS → ALT) en houd ze 10 s binnen 50 ft.', 'Bij nadering van de hoogte schakelt de AP automatisch naar ALT.', hold((S, A) => A.ap.vert === 'ALT' && near(AV.indAlt(), alt2, 50), 10)),
        q('Wat betekent een witte “ALTS” in de AP-balk?', ['De hoogtevangst is gewapend: bij de geselecteerde hoogte gaat de AP over naar ALT', 'De hoogte wordt nu gehouden', 'De AP is uitgeschakeld', 'De hoogtemeter is defect'], 0, 'Wit = gewapend (armed), groen = actief.'),
      ] };
  });
  add('ap_ias', 'Autopilot', 'AP: klimmen in IAS-modus (beste klimsnelheid)', () => {
    const start = R.airborne(HOME, { alt: 1500, ias: 85 }); const alt2 = U.pick([3000, 3500, 4000]);
    return { title: 'AP IAS-klim', start, intro: '<p>Klim met constante snelheid (Vy ≈ 69 kt) naar de opgegeven hoogte. De AP regelt de pitch, jij het vermogen.</p>',
      steps: [
        mk(`Hoogte <b>${alt2} ft</b> selecteren, AP aan (HDG of ROL), verticaal <b>IAS 69 kt</b> (±2), vol gas.`, 'AP → IAS; met NOSE UP/DN pas je de referentiesnelheid aan (1 kt per stap).', (S, A) => A.ap.on && A.altSel === alt2 && A.ap.vert === 'IAS' && near(A.ap.iasRef, 69, 2) && S.ac.throttle > 0.9),
        mk('Houd de klim: snelheid 69 ±5 kt en VS > +300 fpm gedurende 15 s.', 'Controleer de motorinstrumenten (CHT) tijdens de klim.', hold((S, A) => near(S.ac.ias, 69, 5) && S.ac.vs > 300, 15)),
        mk(`Laat de hoogte vangen op ${alt2} ft en verminder het vermogen naar kruisvermogen (4800–5200 rpm).`, 'ALTS → ALT. Daarna gas terug.', hold((S, A) => A.ap.vert === 'ALT' && near(AV.indAlt(), alt2, 60) && S.eng.rpm >= 4700 && S.eng.rpm <= 5300, 6)),
        q('Waarom IAS-modus in plaats van VS in een lange klim?', ['De snelheid blijft veilig; met VS kan de snelheid wegzakken als het vermogen afneemt op hoogte', 'IAS klimt altijd sneller', 'VS werkt niet boven 3000 ft', 'IAS gebruikt minder brandstof'], 0, 'VS houdt de stijgsnelheid vast ongeacht de luchtsnelheid — gevaarlijk bij afnemend vermogen.'),
      ] };
  });
  add('ap_nav', 'Autopilot', 'AP: GPS-koers onderscheppen (NAV)', () => {
    const vrp = R.vrp({ min: 10, max: 25 }); const start = R.airborne(vrp, { dist: 12, alt: 2500 });
    const av = () => { AV.fplClear(); AV.fplAdd(HOME); AV.fplAdd(vrp); const from = U.dest(vrp, U.norm360(U.bearing(vrp, SIM.S.ac) + U.pick([-35, 35])), 20); AV.A.fpl.directTo = { from: Object.assign(from, { id: 'PPOS' }), to: AV.A.fpl.wpts[1], crs: U.bearing(from, vrp), inFpl: true }; };
    return { title: `NAV-onderschepping ${vrp.id}`, start, av, intro: `<p>Er ligt een magenta koerslijn naar <b>${vrp.id}</b>; je zit er naast. Onderschep met de AP.</p>`,
      steps: [
        mk('Zet een heading bug met 30–45° onderscheppingshoek naar de koerslijn en schakel AP + HDG in.', 'Kijk op de HSI aan welke kant de naald staat; draai die kant op.', (S, A) => A.ap.on && A.ap.lat === 'HDG' && A.nav && Math.abs(U.norm180(A.hdgBug - A.nav.dtk)) >= 20 && Math.sign(U.norm180(A.hdgBug - A.nav.dtk)) === Math.sign(A.nav.xtk) * -1),
        mk('Arm <b>NAV</b> (wit) en wacht tot de koers gevangen is (groen GPS).', 'AP → NAV. Zolang je ver van de lijn bent blijft NAV gewapend.', (S, A) => A.ap.lat === 'NAV'),
        mk('Volg de koers met XTK < 0,15 nm gedurende 20 s.', 'De AP corrigeert zelf voor wind.', hold((S, A) => A.ap.lat === 'NAV' && Math.abs(A.nav.xtk) < 0.15, 20)),
        q('De AP staat in NAV, maar je ziet dat de CDI naar GPS LOI gaat. Wat gebeurt er?', ['De AP valt terug naar ROL (koers houden); je moet zelf navigeren', 'De AP volgt de laatste koers tot het waypoint', 'De AP schakelt automatisch naar VOR', 'Niets, GPS LOI is alleen informatief'], 0, 'Zonder geldige navigatiebron kan NAV niet sturen; de modus wordt gewapend/ROL.'),
      ] };
  });
  add('ap_lvl', 'Autopilot', 'Ongewone stand: LVL-herstel', () => {
    const start = R.airborne(HOME, { alt: 3200, ias: 110 }); const bank = U.pick([-50, 50]), pitch = U.pick([-18, 22]);
    start.extra = { bank, pitch };
    return { title: 'LVL-herstel', start, intro: '<p>Je raakte gedesoriënteerd in slecht zicht. Het toestel zit in een ongewone stand. Gebruik de <b>LVL</b>-knop.</p>',
      steps: [
        mk('Druk op <b>LVL</b>.', 'AP-paneel → LVL (of toets L).', (S, A) => A.ap.lat === 'LVL' && A.ap.on, { fail: S => S.ac.stall ? 'Overtrek! Druk zo snel mogelijk op LVL en verminder de aanvalshoek.' : null }),
        mk('Wacht tot bank < 5° en VS binnen ±200 fpm, 8 s lang.', 'LVL brengt vleugels horizontaal en stopt klimmen/dalen.', hold(S => Math.abs(S.ac.bank) < 5 && Math.abs(S.ac.vs) < 200, 8)),
        mk('Schakel over naar <b>HDG</b> en <b>ALT</b> en zet een veilige hoogte (≥ 2500 ft) als referentie.', 'AP → HDG, ALT; hoogtevak → bv. 3000.', (S, A) => A.ap.lat === 'HDG' && A.ap.vert === 'ALT' && A.altSel >= 2500),
        q('Wanneer is LVL vooral bedoeld?', ['Als noodknop bij desoriëntatie of verlies van controle: vleugels recht, nul VS', 'Om preciezer op hoogte te vliegen dan ALT', 'Voor de landing', 'Om het toestel te trimmen'], 0, 'LVL (Level Mode) is een veiligheidsfunctie van de GFC 500.'),
      ] };
  });
  add('ap_disc', 'Autopilot', 'AP ontkoppelen en handmatig overnemen', () => {
    const hdg = R.hdg(); const alt = R.alt(2000, 3500); const start = R.airborne(HOME, { alt, hdg });
    const av = A => { A.ap.on = true; A.ap.fd = true; A.ap.lat = 'HDG'; A.ap.vert = 'ALT'; A.ap.altRef = alt; A.hdgBug = hdg; };
    return { title: 'AP ontkoppelen', start, av, intro: `<p>De AP vliegt HDG ${U.fmtHdg(hdg)}° op ${alt} ft. Neem over en vlieg handmatig verder.</p>`,
      steps: [
        mk('Ontkoppel de AP (AP DISC). Bevestig de gele “AP”-melding door nogmaals te drukken of te wachten.', 'AP-paneel → AP DISC, of toets A / spatie. De ontkoppeltoon klinkt.', (S, A) => !A.ap.on),
        mk(`Houd handmatig heading ${U.fmtHdg(hdg)}° ±8° en hoogte ${alt} ±100 ft gedurende 25 s.`, 'Pijltjes: ↑ neus omlaag, ↓ neus omhoog, ←→ rol. Kleine correcties!', hold(S => hdgNear(S.ac.hdg, hdg, 8) && near(AV.indAlt(), alt, 100), 25)),
        mk('Schakel de <b>flight director</b> in zonder AP (FD) en volg de magenta commandobalk 10 s binnen 50 ft/5°.', 'AP-paneel → FD → HDG/ALT. De balk toont wat de AP zou doen.', hold((S, A) => A.ap.fd && !A.ap.on && Math.abs(A.ap.pitchCmd - S.ac.pitch) < 2 && Math.abs(A.ap.bankCmd - S.ac.bank) < 6, 10)),
      ] };
  });
  add('ap_apr_rnp', 'Autopilot', 'RNP-nadering met APR en glijpad', () => {
    const apts = Object.keys(NAV.APPROACHES).filter(id => NAV.APPROACHES[id].some(p => p.type === 'RNP')); const aptId = U.pick(apts); const apt = NAV.find(aptId);
    const idx = NAV.APPROACHES[aptId].findIndex(p => p.type === 'RNP'); const ap = NAV.APPROACHES[aptId][idx]; const iaf = ap.legs[0];
    const start = { airborne: true, ...U.dest(iaf, U.norm360(U.bearing(ap.legs[1], iaf) + U.rnd(-30, 30)), 8), alt: iaf.alt + 500, hdg: Math.round(U.bearing(U.dest(iaf, U.bearing(ap.legs[1], iaf), 8), iaf)), ias: 90, env: R.env(), fuelL: 35, fuelR: 35, fuelSel: 'R' };
    const av = () => { AV.fplClear(); AV.fplAdd(HOME); AV.fplAdd(apt); };
    return { title: `RNP ${ap.rwy} ${aptId}`, start, av, intro: chatter(`${apt.name}`, `OO-XYZ, cleared ${ap.name} approach via ${iaf.id}. Report established.`),
      steps: [
        mk(`Laad de <b>${ap.name}</b> op ${aptId} met transitie <b>${iaf.id}</b> en activeer ze.`, 'FPL → PROC (of Main Menu (MENU 2×) → Procedures) → vliegveld, nadering, transitie → Load & Activate.', (S, A) => A.fpl.approach && A.fpl.approach.apt === aptId && A.fpl.approach.name === ap.name && A.fpl.approach.transition === iaf.id && A.fpl.approach.active),
        mk(`Zet de hoogte van de FAF (<b>${ap.legs.find(l => l.faf).alt} ft</b>) als geselecteerde hoogte, AP aan met <b>NAV</b> en ALT/VS.`, 'Daal tijdig naar de FAF-hoogte.', (S, A) => A.ap.on && (A.ap.lat === 'NAV' || A.ap.latArm === 'NAV' || A.ap.lat === 'APR' || A.ap.latArm === 'APR') && A.altSel === ap.legs.find(l => l.faf).alt),
        mk('Druk vóór de FAF op <b>APR</b>: GP wordt gewapend (wit).', 'AP → APR. De CDI-schaal gaat naar APR/LNAV+V.', (S, A) => (A.ap.lat === 'APR' || A.ap.latArm === 'APR') && (A.ap.vertArm.includes('GP') || A.ap.vert === 'GP')),
        mk('Glijpad gevangen (GP groen) en gevolgd: verticale afwijking < 100 ft gedurende 15 s. Snelheid 70–85 kt, flaps T/O.', 'Vermogen terug tot ca. 3800–4200 rpm voor 3° bij 75 kt.', hold((S, A) => A.ap.vert === 'GP' && A.nav && Math.abs(A.nav.vdev || 0) < 100, 15), { fail: S => S.ac.ias > 95 ? 'Te snel op de eindnadering (> 95 kt).' : null }),
        mk(`Op het MAP (${ap.legs.find(l => l.map).id}): druk op <b>GA</b> en volg de missed approach (SUSP opgeheven, klim).`, 'Bij SUSP: knop GA in het AP-paneel of toets G. Vol gas!', (S, A) => A.ap.lat === 'GA' || (A.fpl.wpts[A.fpl.active] && A.fpl.wpts[A.fpl.active].missed)),
        mk(`Klim naar de missed-approach-hoogte (${ap.missed[0].alt} ft) ±150 ft.`, 'Zet de hoogte in het hoogtevak; ALTS vangt ze.', (S, A) => near(AV.indAlt(), ap.missed[0].alt, 150) && A.altSel === ap.missed[0].alt),
      ] };
  });
  add('ap_apr_ils', 'Autopilot', 'ILS-nadering met APR (LOC/GS)', () => {
    const cands = NAV.AIRPORTS.filter(a => a.rwys.some(r => r.ils) && NAV.APPROACHES[a.id] && NAV.APPROACHES[a.id].some(p => p.type === 'ILS')); const apt = U.pick(cands);
    const idx = NAV.APPROACHES[apt.id].findIndex(p => p.type === 'ILS'); const ap = NAV.APPROACHES[apt.id][idx]; const re = NAV.runwayEnds(apt, ap.rwy);
    const start = { airborne: true, ...U.dest(re.thr, U.norm360(re.hdg + 180 + U.pick([-30, 30])), 11), alt: apt.elev + 2500, hdg: U.norm360(re.hdg + U.pick([-45, 45])), ias: 90, env: R.env(), fuelL: 35, fuelR: 35, fuelSel: 'L' };
    const av = () => { AV.fplClear(); AV.fplAdd(HOME); AV.fplAdd(apt); };
    return { title: `ILS ${ap.rwy} ${apt.id} met AP`, start, av, intro: chatter(`${apt.name} Approach`, `OO-XYZ, turn heading ${U.fmtHdg(re.hdg + (U.norm180(start.hdg - re.hdg) > 0 ? 30 : -30))}, cleared ILS ${ap.rwy}, localizer ${U.fmtNav(ap.freq)}.`),
      steps: [
        mk(`NAV1 op <b>${U.fmtNav(ap.freq)}</b> actief, CDI-bron <b>NAV1</b>, CRS <b>${U.fmtHdg(re.hdg)}°</b>.`, 'NAV1-vak linksonder op de PFD → frequentie → XFER; bronlabel; CRS-veld.', (S, A) => near(A.nav1.active, ap.freq, 0.001) && A.navSource === 'NAV1' && hdgNear(A.nav1.obs, re.hdg, 2)),
        mk('AP aan in HDG met een onderscheppingskoers (≤ 45° op de eindkoers) en druk op <b>APR</b> (LOC/GS gewapend).', 'AP → AP, HDG, APR.', (S, A) => A.ap.on && (A.ap.lat === 'APR' || A.ap.latArm === 'APR') && A.ap.vertArm.includes('GS')),
        mk('Localizer gevangen (LOC1 groen).', 'Wachten tot de naald binnenkomt.', (S, A) => A.ap.lat === 'APR'),
        mk('Glideslope gevangen (GS groen) en gevolgd gedurende 15 s binnen 1 dot.', 'Vermogen verminderen, flaps T/O, 75 kt.', hold((S, A) => A.ap.vert === 'GS' && Math.abs(A.nav1.data.gsDev) < 1, 15)),
        mk('Op 500 ft AGL: ontkoppel de AP en land/doorstart handmatig (daal tot < 300 ft AGL of druk GA).', 'AP DISC; of GA voor de missed approach.', (S, A) => (!A.ap.on && S.ac.agl < 300) || A.ap.lat === 'GA'),
      ] };
  });
  add('ap_ga', 'Autopilot', 'Go-around vanaf korte final', () => {
    const apt = U.pick([HOME, NAV.find('EBST'), NAV.find('EBZW')]); const rwId = U.pick(apt.rwys[0].id.split('/')); const re = NAV.runwayEnds(apt, rwId);
    const start = { airborne: true, ...U.dest(re.thr, U.norm360(re.hdg + 180), 1.8), alt: apt.elev + 550, hdg: re.hdg, ias: 65, env: R.env(), fuelL: 30, fuelR: 30, fuelSel: 'L', flaps: 2, throttle: 0.35 };
    return { title: `Go-around ${apt.id} ${rwId}`, start, intro: chatter(`${apt.name} Radio`, `OO-XYZ, go around, I say again go around, traffic on the runway.`),
      steps: [
        mk('Druk op <b>GA</b> (TO/GA): FD commandeert 7° neus omhoog, vleugels recht. Vol gas!', 'AP-paneel → GA, of toets G. Gas: PageUp / schuifregelaar.', (S, A) => A.ap.lat === 'GA' && S.ac.throttle > 0.9),
        mk('Flaps naar <b>T/O</b> zodra je positief klimt, dan <b>UP</b> boven 60 kt en 300 ft AGL.', 'Toets F/V of knoppen in het paneel.', (S, A) => S.ac.vs > 200 && S.ac.flaps === 0 && S.ac.agl > 250, { fail: S => S.ac.ias > 80 && S.ac.flaps === 2 ? 'VFE overschreden met volle flaps!' : null }),
        mk(`Klim naar circuit-hoogte (${apt.elev + 1000} ft ±100) en selecteer die hoogte; AP mag met HDG/ALT.`, 'Hoogtevak → ' + (apt.elev + 1000) + '.', (S, A) => near(AV.indAlt(), apt.elev + 1000, 100) && near(A.altSel, apt.elev + 1000, 60)),
        q('Wat doet TO/GA met een gewapende nadering (SUSP op het MAP)?', ['De sequencing wordt hervat en de missed approach wordt actief', 'Het vluchtplan wordt gewist', 'De AP koppelt af', 'Niets, GA is enkel een FD-stand'], 0, 'GA heft SUSP op en activeert de missed-approach-legs.'),
      ] };
  });

  // === Motor & systemen ===
  add('eis_cht', 'Motor & systemen (EIS)', 'Hoge CHT in de klim', () => {
    const start = R.airborne(HOME, { alt: 1200, ias: 65 }); start.throttle = 1; start.env.oatSea = U.rndInt(24, 32);
    return { title: 'CHT te hoog', start, fail: { chtHigh: true }, intro: `<p>Warme dag (${start.env.oatSea} °C), steile klim met vol vermogen. Let op de motorinstrumenten links.</p>`,
      steps: [
        mk('Wacht op de CAS-melding <b>CHT</b> (geel) en bevestig ze (tik op het meldingenvenster).', 'De melding stopt met knipperen na bevestiging.', (S, A) => A.cas.some(c => c.id === 'CHTC' || c.id === 'CHT') && Object.values(A.acked).some(x => x.seen)),
        mk('Verminder het vermogen (<b>&lt; 4600 rpm</b>) en verhoog de snelheid (<b>&gt; 85 kt</b>) voor betere koeling; 15 s.', 'Gas terug (PageDown), neus omlaag.', hold(S => S.eng.rpm < 4600 && S.ac.ias > 85, 15)),
        mk('Open de checklist <b>EMERG: High CHT / Oil Temp</b> en werk ze af.', 'Main Menu (MENU 2×) → Checklist → kies de EMERG-checklist → tik elk item aan.', (S, A, ctx) => ctx.has('chkdone', g => /High CHT/.test(g))),
        mk('Wacht tot de CHT weer onder <b>120 °C</b> is (melding verdwijnt).', 'Het duurt even; houd de snelheid hoog.', S => S.eng.cht < 120),
        q('Waarom helpt een hogere snelheid tegen hoge cilinderkoptemperatuur?', ['Meer luchtstroom door de koelers/koelribben', 'De motor draait trager', 'Het mengsel wordt rijker', 'De olie wordt dunner'], 0, 'Koeling van de Rotax hangt af van luchtstroom door de radiator en koelribben.'),
      ], onTick: (S, A, ctx) => { if (ctx.stepIndex >= 1 && S.eng.rpm < 4600 && S.ac.ias > 85 && !ctx.flag) { S.fail.chtHigh = false; ctx.flag = true; } } };
  });
  add('eis_oilp', 'Motor & systemen (EIS)', 'Oliedruk zakt weg', () => {
    const start = R.airborne(R.apt({ max: 30 }), { dist: U.rnd(5, 9), alt: 2500 });
    return { title: 'Oliedruk laag', start, fail: { oilPress: true }, intro: '<p>Tijdens de kruisvlucht zie je de oliedruk langzaam dalen.</p>',
      steps: [
        mk('Wacht op de rode melding <b>OIL PRESS LO</b> en bevestig ze.', 'Tik op het CAS-venster.', (S, A) => A.cas.some(c => c.id === 'OILP') && A.acked.OILP && A.acked.OILP.seen),
        mk('Open de checklist <b>EMERG: Oil Pressure Low</b> en werk ze af.', 'Main Menu (MENU 2×) → Checklist.', (S, A, ctx) => ctx.has('chkdone', g => /Oil Pressure/.test(g))),
        mk('Verminder het vermogen (< 4300 rpm) en kies via <b>Nearest</b> een Direct-To naar het dichtstbijzijnde vliegveld.', 'NRST-toets → rij → Direct-To.', (S, A) => S.eng.rpm < 4300 && A.fpl.directTo && NAV.nearest(S.ac, 'APT', 2).some(n => n.item.id === A.fpl.directTo.to.id)),
        mk('Squawk <b>7700</b> en zet <b>121.500</b> actief op COM1 (of de frequentie van het veld).', 'XPDR-veld; COM1-standby → 121.500.', (S, A) => A.xpdr.code === '7700' && (near(A.com1.active, 121.5, 0.001) || (A.fpl.directTo && near(A.com1.active, mainFreq(NAV.find(A.fpl.directTo.to.id)), 0.001)))),
        mk('Kom binnen 3 nm van het veld, nog met draaiende motor (of in glijvlucht).', 'Hoogte bewaren: glijd zo nodig met 65 kt.', (S, A) => A.fpl.directTo && U.distNm(S.ac, A.fpl.directTo.to) < 3),
      ] };
  });
  add('eis_fuel', 'Motor & systemen (EIS)', 'Brandstofbeheer: tank wisselen en brandstofcomputer', () => {
    const start = R.airborne(HOME, { fuelL: U.rndInt(6, 12), fuelR: U.rndInt(38, 55), fuelSel: 'L' });
    return { title: 'Brandstofbeheer', start, intro: '<p>Je vliegt al een tijdje op de linkertank. Kijk naar de brandstofmeters in de EIS-strook.</p>',
      steps: [
        mk('Er is een <b>FUEL IMBALANCE</b>. Wissel naar de <b>rechtertank</b>.', 'Paneel “Vliegtuig” → tankkraan R, of Engine-pagina → Fuel Selector.', S => S.ac.fuelSel === 'R'),
        (() => ({ text: 'Hoeveel vliegtijd heb je nog (endurance) bij het huidige verbruik, ongeveer?', makeQuestion: S => { const e = G3X.eis.endurance(S); const m = Math.round(e * 60 / 10) * 10; const o = numOpts(m, 30, v => U.fmtEte(Math.max(0, v))); return { options: o.options, correct: o.correct, explain: `Bruikbaar ≈ ${Math.round(S.ac.fuelL + S.ac.fuelR - 4)} L ÷ ${S.eng.ff.toFixed(1)} L/h.` }; } }))(),
        mk('Open de <b>Engine</b>-pagina (volledig) en lees de brandstofcomputer.', 'Tik op de EIS-strook of Main Menu (MENU 2×) → Engine.', (S, A) => A.mfdPage === 'ENG' || A.pfdPage === 'ENG'),
        mk('Stel een <b>timer van 30 minuten</b> in (aftellend, gestart) als herinnering om opnieuw te wisselen.', 'Main Menu (MENU 2×) → Timer → Set… 30:00 → Start.', (S, A) => A.timer.running && A.timer.dir === 'DOWN' && near(A.timer.preset, 1800, 60)),
        q('Waarom wissel je regelmatig van tank in de P2008?', ['Om de massabalans (laterale trim) en gelijke brandstofverdeling te bewaren', 'Omdat de motor anders te heet wordt', 'Omdat de kraan anders vastloopt', 'Dat is niet nodig'], 0, 'De P2008 heeft een L/R/OFF-kraan: wissel elke ~30 minuten.'),
      ] };
  });
  add('eis_alt_fail', 'Motor & systemen (EIS)', 'Alternatorstoring en load shedding', () => {
    const start = R.airborne(R.apt({ max: 35 }), { dist: U.rnd(8, 14), alt: 2500 });
    return { title: 'Alternator uitgevallen', start, fail: { alternator: true }, intro: '<p>Plotseling zie je de ampèremeter negatief gaan.</p>',
      steps: [
        mk('Herken de melding <b>ALTERNATOR</b> / <b>LOW VOLTS</b> en bevestig ze.', 'CAS-venster aantikken.', (S, A) => A.cas.some(c => c.id === 'ALTN' || c.id === 'VOLT') && Object.values(A.acked).some(x => x.seen)),
        mk('Werk de checklist <b>EMERG: Alternator Failure</b> af.', 'Main Menu (MENU 2×) → Checklist.', (S, A, ctx) => ctx.has('chkdone', g => /Alternator/.test(g))),
        mk('Load shedding: zet de schermhelderheid op <b>40 %</b>.', 'Setup → Brightness.', (S, A) => A.brightness === 40),
        mk('Vlieg naar het dichtstbijzijnde geschikte vliegveld (Direct-To binnen 15 nm) en zet zijn frequentie actief.', 'NRST-toets → Direct-To; frequentie via info.', (S, A) => A.fpl.directTo && U.distNm(S.ac, A.fpl.directTo.to) < 15 && NAV.find(A.fpl.directTo.to.id) && near(A.com1.active, mainFreq(NAV.find(A.fpl.directTo.to.id)), 0.001)),
        q('Hoe lang werkt de avionica ongeveer nog op de batterij na een alternatorstoring?', ['Ongeveer 30 minuten (afhankelijk van load shedding)', 'Onbeperkt', 'Ongeveer 2 minuten', 'Tot de motor stopt'], 0, 'Een typische batterij geeft ~30 min; verminder de belasting om tijd te winnen.'),
      ] };
  });
  add('eis_start', 'Motor & systemen (EIS)', 'Koude start en instellen vóór taxi', () => {
    const start = R.onRunway(HOME); start.engineRunning = false; const qnh = start.env.qnh; const code = R.squawk();
    const av = A => { A.baro = qnh + U.pick([-7, 5, 9]); A.xpdr.mode = 'STBY'; A.xpdr.code = '7000'; };
    return { title: 'Koude start', start, av, intro: `<p>Je zit in het toestel op ${HOME.id}. Gebruik het paneel <b>Vliegtuig</b> onder het scherm voor master, starter en tankkraan. QNH ${qnh}. Hasselt Radio gaf code ${code} (lokale afspraak).</p>`,
      steps: [
        mk('Zet de <b>master</b> aan.', 'Paneel Vliegtuig → Master.', S => S.eng.master),
        mk('Tankkraan op de <b>volste tank</b>.', 'Paneel → L/R.', S => (S.ac.fuelL >= S.ac.fuelR ? S.ac.fuelSel === 'L' : S.ac.fuelSel === 'R')),
        mk('Werk de checklist <b>Before Engine Start</b> af.', 'Main Menu (MENU 2×) → Checklist.', (S, A, ctx) => ctx.has('chkdone', g => /Before Engine Start/.test(g))),
        mk('Start de motor (gas op idle).', 'Paneel → Start. Oliedruk moet binnen 10 s stijgen.', S => S.eng.running, { fail: S => S.ac.throttle > 0.3 && !S.eng.running ? 'Starten met te veel gas.' : null }),
        mk('Warmdraaien op <b>2000–2500 rpm</b>, 10 s.', 'Gas iets open.', hold(S => S.eng.rpm >= 1950 && S.eng.rpm <= 2550, 10)),
        mk(`Baro op <b>${qnh}</b>, hoogtevak op circuit-hoogte <b>${HOME.elev + 1000 - (HOME.elev + 1000) % 100 + 100} ft</b>, heading bug op de baanrichting (${U.fmtHdg(start.hdg)}°).`, 'Baro-veld, hoogtevak, HSI.', (S, A) => A.baro === qnh && !A.baroStd && A.altSel === HOME.elev + 1000 - (HOME.elev + 1000) % 100 + 100 && hdgNear(A.hdgBug, start.hdg, 3)),
        mk(`Transponder code <b>${code}</b>, modus <b>ALT</b>.`, 'XPDR-veld.', (S, A) => A.xpdr.code === code && A.xpdr.mode === 'ALT'),
        mk('Brandstofcomputer: stel <b>brandstof aan boord</b> in op de werkelijke hoeveelheid (totaal beide tanks, ±3 L).', 'Engine-pagina → Fuel on Board. De werkelijke inhoud zie je op de meters.', (S, A, ctx) => ctx.has('fob', v => near(v, S.ac.fuelL + S.ac.fuelR, 3))),
        mk(`Zet Hasselt Radio <b>${R.fmtF(mainFreq(HOME))}</b> actief op COM1 en start de vluchttimer (algemene timer omhoog).`, 'COM1-veld; Main Menu (MENU 2×) → Timer → Start.', (S, A) => near(A.com1.active, mainFreq(HOME), 0.001) && A.timer.running && A.timer.dir === 'UP'),
      ] };
  });
  add('eis_runup', 'Motor & systemen (EIS)', 'Run-up en before-takeoff checks', () => {
    const start = R.onRunway(HOME); start.engineRunning = true;
    return { title: 'Run-up', start, intro: '<p>Motor loopt warm. Voer de run-up uit en zet de G3X klaar voor vertrek.</p>',
      steps: [
        mk('Wacht tot de olietemperatuur ≥ <b>50 °C</b> (verhoog eventueel het toerental naar 2500).', 'EIS-strook: OIL T.', S => S.eng.oilT >= 50),
        mk('Run-up: <b>4000 rpm ±150</b> gedurende 8 s, rem vast (parkeerrem).', 'Gas open; parkeerrem staat aan.', hold(S => near(S.eng.rpm, 4000, 150) && S.ac.parkBrake, 8)),
        q('Wat is de maximale toerentaldaling per ontstekingscircuit bij de magneetcheck van de Rotax 912 (bij benadering)?', ['300 rpm, max 120 rpm verschil tussen beide', '50 rpm', '1000 rpm', 'Er mag geen daling zijn'], 0, 'Rotax 912: max. 300 rpm daling, max. 120 rpm verschil (controleer de POH).'),
        mk('Gas terug naar idle; <b>flaps T/O</b>, <b>transponder ALT</b>, heading bug op de baanrichting.', 'Toets F; XPDR-veld; HSI.', (S, A) => S.eng.rpm < 2200 && S.ac.flaps === 1 && A.xpdr.mode === 'ALT' && hdgNear(A.hdgBug, start.hdg, 5)),
        mk('Werk de checklist <b>Before Takeoff</b> af.', 'Main Menu (MENU 2×) → Checklist.', (S, A, ctx) => ctx.has('chkdone', g => /Before Takeoff/.test(g))),
        mk('Parkeerrem los, vol gas, roteer bij 50 kt en klim naar 500 ft AGL met flaps UP boven 60 kt.', 'Paneel → parkeerrem; PageUp; ↓ voor rotatie; F voor flaps.', S => S.ac.agl > 500 && S.ac.flaps === 0 && !S.ac.onGround),
      ] };
  });

  // === Noodgevallen & storingen ===
  add('fail_ahrs', 'Noodgevallen & storingen', 'AHRS-storing: rode X over de horizon', () => {
    const start = R.airborne(HOME, { alt: 3000 });
    return { title: 'AHRS FAIL', start, fail: {}, intro: '<p>Na 10 seconden valt de AHRS uit. De attitude verdwijnt; de AP koppelt af. Vlieg op track en VS.</p>',
      onTick: (S, A, ctx) => { if (ctx.t > 10 && !S.fail.ahrs && !ctx.recovered) S.fail.ahrs = true; if (ctx.stepIndex >= 3 && !ctx.recovered) { S.fail.ahrs = false; ctx.recovered = true; } },
      steps: [
        mk('Herken de storing (rode X, ATTITUDE FAIL) en bevestig de AP-ontkoppeling.', 'De HSI toont nu de GPS-track in plaats van de heading.', (S, A) => S.fail.ahrs && A.cas.some(c => c.id === 'AHRS') && A.acked.AHRS && A.acked.AHRS.seen),
        mk('Houd het toestel 30 s recht: track-verandering < 15° en VS binnen ±300 fpm.', 'Gebruik de track op de HSI en de VSI: kleine inputs.', hold((S, A, ctx) => { if (ctx.ref == null) ctx.ref = S.ac.trk; return Math.abs(U.norm180(S.ac.trk - ctx.ref)) < 15 && Math.abs(S.ac.vs) < 300; }, 30)),
        mk('Werk de checklist <b>EMERG: AHRS / ADC Failure</b> af.', 'Main Menu (MENU 2×) → Checklist.', (S, A, ctx) => ctx.has('chkdone', g => /AHRS/.test(g))),
        mk('De AHRS herstelt. Schakel de AP weer in met HDG en ALT.', 'AP-paneel.', (S, A) => !S.fail.ahrs && A.ap.on && A.ap.lat === 'HDG' && A.ap.vert === 'ALT'),
      ] };
  });
  add('fail_adc', 'Noodgevallen & storingen', 'ADC-storing: geen snelheid en hoogte', () => {
    const start = R.airborne(HOME, { alt: 2500 });
    return { title: 'ADC FAIL', start, intro: '<p>De air data computer valt uit: snelheid, hoogte en VSI tonen een rode X. Gebruik GPS-gegevens.</p>',
      onTick: (S, A, ctx) => { if (ctx.t > 5 && !S.fail.adc && !ctx.rec) S.fail.adc = true; },
      steps: [
        mk('Bevestig <b>ADC FAIL</b>.', 'CAS-venster.', (S, A) => S.fail.adc && A.acked.ADC && A.acked.ADC.seen),
        (() => ({ text: 'Wat is je <b>GPS-hoogte</b> (Trip Computer) afgerond op 100 ft?', makeQuestion: S => { const v = Math.round(S.ac.alt / 100) * 100; const o = numOpts(v, 100, x => x + ' ft'); return { options: o.options, correct: o.correct, explain: 'Main Menu (MENU 2×) → Trip Computer → GPS altitude. GPS-hoogte ≠ barometrische hoogte, maar bruikbaar als back-up.' }; } }))(),
        mk('Houd de grondsnelheid (GS, databalk) tussen <b>85 en 105 kt</b> gedurende 20 s met een gezond toerental (4500–5300).', 'Zonder IAS: vlieg op vermogen + houding (pitch) en GS.', hold(S => S.ac.gs >= 85 && S.ac.gs <= 105 && S.eng.rpm >= 4500 && S.eng.rpm <= 5300, 20)),
        q('Waarom is GS geen vervanging voor IAS bij de landing?', ['Wind en dichtheid beïnvloeden GS; overtrek hangt af van IAS', 'GS is altijd lager dan IAS', 'GPS werkt niet laag bij de grond', 'GS wordt in km/h gemeten'], 0, 'Met tegenwind kan je GS laag zijn terwijl je IAS prima is — en omgekeerd.'),
      ] };
  });
  add('fail_gps', 'Noodgevallen & storingen', 'GPS-verlies (LOI): terug naar de VOR', () => {
    const vor = R.vor({ min: 8, max: 30 }); const start = R.airborne(vor, { dist: 12, alt: 3000 });
    const av = () => { AV.fplClear(); AV.fplAdd(HOME); AV.fplAdd(vor); AV.directTo(vor); };
    return { title: 'GPS LOI', start, av, fail: {}, intro: `<p>Je navigeert met GPS naar ${vor.id}. Na 8 seconden valt de GPS-integriteit weg (LOI).</p>`,
      onTick: (S, A, ctx) => { if (ctx.t > 8 && !ctx.set) { S.fail.gps = true; ctx.set = true; } },
      steps: [
        mk('Herken <b>GPS LOI</b> (gele melding, kaart zonder positie).', 'De CDI-bron GPS geeft geen afwijking meer.', (S, A) => S.fail.gps && A.acked.GPS),
        mk(`Stem NAV1 af op <b>${vor.id} ${U.fmtNav(vor.freq)}</b>, zet de CDI-bron op NAV1 en de CRS op de peiling naar het station (TO).`, 'NAV1-vak linksonder op de PFD; bronlabel; CRS zo draaien dat de naald centreert met TO.', (S, A) => near(A.nav1.active, vor.freq, 0.001) && A.navSource === 'NAV1' && A.nav1.data.valid && A.nav1.data.toFrom === 'TO' && Math.abs(A.nav1.data.dev) < 0.6),
        (() => ({ text: `Op welke radiaal van ${vor.id} zit je (afgerond op 10°)?`, makeQuestion: S => { const r = Math.round(U.bearing(vor, S.ac) / 10) * 10 % 360; const o = numOpts(r, 20, v => U.fmtHdg(v) + '°'); return { options: o.options, correct: o.correct, explain: `Radiaal = peiling vanaf het station = TO-koers + 180°.` }; } }))(),
        mk('Vlieg naar het station: DME < 3 nm.', 'Houd de naald gecentreerd.', (S, A) => A.nav1.data.valid && A.nav1.data.dme != null && A.nav1.data.dme < 3),
      ] };
  });
  add('fail_engine', 'Noodgevallen & storingen', 'Motorstoring: glijvlucht, NRST, 7700', () => {
    const start = R.airborne(R.apt({ max: 25, kinds: ['civil', 'intl', 'mil'] }), { dist: U.rnd(2.5, 4.5), alt: 3500, fuelL: 1.5, fuelR: 40, fuelSel: 'L' });
    return { title: 'Motorstoring', start, intro: '<p>De motor begint te sputteren en valt stil. Werk de noodprocedure af. (Tip: kijk goed naar de brandstofmeters.)</p>',
      steps: [
        mk('Zet de beste glijsnelheid aan: <b>65 kt ±5</b> gedurende 8 s.', 'Neus omlaag. De V-snelheidsbug “G” staat op de snelheidstape.', hold(S => near(S.ac.ias, 65, 5), 8), { fail: S => S.ac.stall ? 'Overtrek! Neus omlaag.' : null }),
        mk('Kies via <b>Nearest</b> het dichtstbijzijnde vliegveld en activeer Direct-To.', 'NRST-toets → rij → Direct-To.', (S, A) => A.fpl.directTo && NAV.nearest(S.ac, 'APT', 2).some(n => n.item.id === A.fpl.directTo.to.id)),
        mk('Herstartpoging: wissel naar de <b>andere tank</b> (brandstofpomp aan) en start.', 'Paneel Vliegtuig → tankkraan R → Start.', S => S.ac.fuelSel === 'R' && S.eng.running),
        mk('Squawk <b>7700</b>, <b>121.500</b> actief op COM1.', 'XPDR-veld; COM1-standby → 121.500 → wissel.', (S, A) => A.xpdr.code === '7700' && near(A.com1.active, 121.5, 0.001)),
        mk('Werk de checklist <b>EMERG: Engine Failure in Flight</b> af.', 'Main Menu (MENU 2×) → Checklist.', (S, A, ctx) => ctx.has('chkdone', g => /Engine Failure/.test(g))),
        q('Wat was de meest waarschijnlijke oorzaak van de motorstoring?', ['Brandstofgebrek: de geselecteerde (linker)tank was leeg', 'Oververhitting', 'Een elektrische storing', 'IJsvorming in de carburateur'], 0, 'De linkertank stond op ~1,5 L. Tankbeheer is deel van elke kruisvluchtcheck.'),
      ] };
  });
  add('fail_radio', 'Noodgevallen & storingen', 'COM1 uitgevallen: COM2 en 7600', () => {
    const apt = R.apt({ max: 25 }); const f = mainFreq(apt); const start = R.airborne(apt, { dist: U.rnd(6, 10) });
    return { title: 'Radiostoring', start, fail: { com1: true }, intro: `<p>Je roept ${esc(apt.name)} op ${R.fmtF(f)} maar COM1 reageert niet (rood). Je hebt een tweede radio.</p>`,
      steps: [
        mk(`Zet <b>${R.fmtF(f)}</b> actief op <b>COM2</b> en selecteer COM2 als MIC.`, 'COM2-standby → frequentie → wissel; tik op het label COM2.', (S, A) => near(A.com2.active, f, 0.0005) && A.com2.mic),
        mk('Werk de checklist <b>EMERG: Radio Failure</b> af.', 'Main Menu (MENU 2×) → Checklist.', (S, A, ctx) => ctx.has('chkdone', g => /Radio Failure/.test(g))),
        mk('Stel dat ook COM2 faalt: squawk <b>7600</b>.', 'XPDR-veld.', (S, A) => A.xpdr.code === '7600'),
        q('Wat doe je VFR bij volledige radio-uitval nabij een ongecontroleerd veld?', ['Blijf VFR, voeg in het circuit in met extra uitkijk, let op lichtsignalen', 'Land onmiddellijk rechtuit', 'Klim naar FL 100', 'Stijg uit het luchtruim en wacht'], 0, 'Transponder 7600, standaard circuit, lichtsignalen bij gecontroleerde velden.'),
      ] };
  });
  add('fail_display', 'Noodgevallen & storingen', 'Schermstoring en reversionary mode', () => {
    const start = R.airborne(HOME);
    return { title: 'Display fail', start, intro: '<p>Na enkele seconden valt het scherm uit. In een installatie met twee schermen neem je over op het andere scherm (reversionary). Hier: knop <b>Reversionary</b> in het paneel Vliegtuig.</p>',
      onTick: (S, A, ctx) => { if (ctx.t > 4 && !ctx.set) { S.fail.display = true; ctx.set = true; } },
      steps: [
        mk('Scherm uitgevallen: activeer <b>reversionary</b> (paneel Vliegtuig).', 'Bij een echte G3X met twee GDU’s schakelt het andere scherm automatisch naar een gecombineerde PFD/EIS-weergave.', (S, A, ctx) => ctx.has('reversionary')),
        mk('Controleer dat PFD én EIS zichtbaar zijn (gesplitste weergave) en vlieg 15 s recht (bank < 5°).', 'MENU → Split Screen.', hold((S, A) => !S.fail.display && A.layout === 'SPLIT' && Math.abs(S.ac.bank) < 5, 15)),
        q('Wat toont een G3X Touch in reversionary mode?', ['PFD met EIS-strook op één scherm', 'Alleen de kaart', 'Alleen de motorinstrumenten', 'Een zwart scherm met de klok'], 0, 'Reversionary combineert de essentiële vlieg- en motorinformatie op het resterende scherm.'),
      ] };
  });
  add('airspace_avoid', 'Noodgevallen & storingen', 'Luchtruim vermijden zonder klaring', () => {
    const ctr = U.pick(NAV.AIRSPACES.filter(s => s.type === 'CTR' && U.distNm(HOME, s.shape.circle || { lat: s.shape.poly[0][0], lon: s.shape.poly[0][1] }) < 40));
    const c = ctr.shape.circle || { lat: ctr.shape.poly.reduce((t, p) => t + p[0], 0) / ctr.shape.poly.length, lon: ctr.shape.poly.reduce((t, p) => t + p[1], 0) / ctr.shape.poly.length };
    const brg = U.rnd(0, 360); const p = U.dest(c, brg, (ctr.shape.r || 10) + 6); const start = { airborne: true, lat: p.lat, lon: p.lon, alt: ctr.ceil - 500, hdg: Math.round(U.norm360(brg + 180)), ias: 95, env: R.env(), fuelL: 35, fuelR: 35, fuelSel: 'L' };
    return { title: `${ctr.name} vermijden`, start, intro: `<p>Je vliegt richting de <b>${esc(ctr.name)}</b> (${ctr.floor === 0 ? 'GND' : ctr.floor}–${ctr.ceil} ft) zonder klaring. De radio is druk; je krijgt geen antwoord.</p>`,
      steps: [
        mk('Wacht op de melding <b>CTR AHEAD</b> (binnen 2 minuten) en lees het luchtruim op de kaart.', 'De knop Messages onderaan knippert; kaartlabel toont vloer/plafond.', (S, A) => A.msgs.some(m => m.key && m.key.startsWith('aspc-' + ctr.id))),
        mk('Blijf 3 minuten buiten de CTR: wijk uit (koerswijziging) of klim boven het plafond (+300 ft).', 'Draai 45° weg of klim. Controleer de positie op de kaart.', hold(S => true, 180), { fail: S => NAV.inside(ctr, S.ac) && S.ac.alt < ctr.ceil ? `Je bent de ${ctr.name} binnengevlogen zonder klaring (luchtruimschending).` : null }),
        q(`Op welke frequentie vraag je klaring voor de ${ctr.name}?`, U.shuffle([R.fmtF(ctr.freq || 122.105), '121.500', R.fmtF(mainFreq(HOME)), '123.405']), null, `Zie Nearest → Airspace of de kaartinfo: ${R.fmtF(ctr.freq || 122.105)}.`),
      ] };
  });
  GEN.find(g => g.id === 'airspace_avoid').post = sc => { const ctr = NAV.AIRSPACES.find(s => sc.title.startsWith(s.name)); const f = R.fmtF(ctr.freq || 122.105); const st = sc.steps[2]; st.question.correct = st.question.options.indexOf(f); };
  add('terrain', 'Noodgevallen & storingen', 'Terreinwaarschuwing in de Ardennen', () => {
    const spa = NAV.find('EBSP'); const start = R.airborne(spa, { dist: 10, brg: U.rnd(120, 240), alt: spa.elev + 700, hdg: U.rnd(0, 360) }); start.hdg = Math.round(U.bearing(start, { lat: 50.30, lon: 6.0 }));
    return { title: 'TERRAIN', start, intro: '<p>Laaghangende bewolking dwingt je laag over de Ardennen. Het terrein stijgt voor je uit.</p>',
      steps: [
        mk('Open de <b>Terrain</b>-pagina (Main Menu (MENU 2×) → Terrain) en bekijk de kleuren (rood = < 100 ft onder je, geel = < 1000 ft).', 'Main Menu (MENU 2×) → Terrain.', (S, A) => A.mfdPage === 'TERRAIN'),
        mk('Reageer op de terreinwaarschuwing: klim tot er geen gele/rode TERRAIN-melding meer is en AGL > 1000 ft.', 'Vol gas, Vy 69 kt, eventueel wegdraaien naar lager terrein.', (S, A) => !A.cas.some(c => c.id === 'TERR' || c.id === 'TERRC') && S.ac.agl > 1000 && S.t > 20),
        q('Wat is de minimale VFR-hoogte boven onbewoond gebied volgens SERA.5005(f)?', ['500 ft boven grond of water (en 150 m van obstakels/personen)', '1000 ft boven het hoogste obstakel binnen 600 m', '300 ft', 'Er is geen minimum'], 0, 'SERA.5005(f)(2): 150 m (500 ft) boven grond/water buiten bebouwing; (f)(1): 300 m boven bebouwing/mensenmassa.'),
      ] };
  });
  add('traffic', 'Noodgevallen & storingen', 'Verkeer op de kaart en uitwijken', () => {
    const start = R.airborne(HOME, { alt: 2500 });
    const av = () => { const a = SIM.S.ac; const side = U.pick([-1, 1]); const brg = U.norm360(a.hdg + side * U.rnd(40, 70)); const p = U.dest(a, brg, 4.5); AV.A.traffic = [{ id: 'TFC1', lat: p.lat, lon: p.lon, alt: a.alt + U.pick([-300, 0, 200]), trk: U.norm360(brg + 180 - side * 20), gs: 100, vs: 0 }]; };
    return { title: 'Verkeer', start, av, intro: '<p>Er is verkeer gesimuleerd (zoals ADS-B-in zou tonen). Zoek het op de kaart en wijk uit.</p>',
      steps: [
        (() => ({ text: 'Aan welke kant zit het verkeer t.o.v. je neus?', makeQuestion: (S, A) => { const t = A.traffic[0]; const rel = U.norm180(U.bearing(S.ac, t) - S.ac.hdg); const corr = rel > 0 ? 'Rechts (richting 1–3 uur)' : 'Links (richting 9–11 uur)'; const opts = ['Links (richting 9–11 uur)', 'Rechts (richting 1–3 uur)', 'Recht vooruit (12 uur)', 'Achter je (6 uur)']; return { options: opts, correct: opts.indexOf(corr), explain: `Relatieve peiling ${Math.round(rel)}°; ${t.alt > S.ac.alt ? 'boven' : t.alt < S.ac.alt ? 'onder' : 'op gelijke hoogte'} (${Math.round((t.alt - S.ac.alt) / 100)}00 ft).` }; } }))(),
        mk('Open de pagina <b>Traffic</b> (Main Menu (MENU 2×) → Traffic) voor afstand en hoogteverschil.', 'Main Menu (MENU 2×) → Traffic.', (S, A) => A.mfdPage === 'TRAFFIC'),
        mk('Wijk uit: wijzig je heading minstens <b>30°</b> t.o.v. de startheading (bij voorkeur naar rechts) en houd > 1 nm afstand.', 'Zie het gele symbool op de kaart als het dichtbij komt.', (S, A, ctx) => { if (ctx.h0 == null) ctx.h0 = start.hdg; return Math.abs(U.norm180(S.ac.hdg - ctx.h0)) >= 30; }, { fail: (S, A) => A.traffic.length && U.distNm(S.ac, A.traffic[0]) < 0.3 && Math.abs(A.traffic[0].alt - S.ac.alt) < 200 ? 'Bijna-botsing!' : null }),
        q('Bij convergerende koersen op gelijke hoogte: wie wijkt uit (SERA.3210)?', ['Het toestel dat het andere aan zijn rechterkant heeft, wijkt uit', 'Het snelste toestel', 'Het toestel dat het hoogst vliegt', 'Beide draaien naar links'], 0, 'Convergeren: wie het andere rechts van zich heeft, wijkt. Frontaal: beiden naar rechts.'),
      ] };
  });

  // === Volledige vluchten ===
  add('flight_local', 'Volledige vluchten', 'Lokale vlucht EBZH → VRP → EBZH', () => {
    const vrp = R.vrp({ min: 6, max: 14 }); const start = R.onRunway(HOME); start.engineRunning = true; const qnh = start.env.qnh; const code = R.squawk();
    const circ = HOME.elev + 1000 - (HOME.elev + 1000) % 100 + 100;
    return { title: `Lokale vlucht via ${vrp.id}`, start, intro: `<p>Vertrek van baan ${start.rwy} op ${HOME.id}, vlieg naar <b>${vrp.id}</b> (${esc(vrp.name)}) op 2000 ft en keer terug naar het veld op circuithoogte ${circ} ft. QNH ${qnh}, code ${code}.</p>`,
      steps: [
        mk(`Vertrekvoorbereiding: baro ${qnh}, heading bug ${U.fmtHdg(start.hdg)}°, hoogte 2000, squawk ${code} ALT, COM1 ${R.fmtF(mainFreq(HOME))}, flaps T/O.`, 'Alle velden op de PFD.', (S, A) => A.baro === qnh && hdgNear(A.hdgBug, start.hdg, 3) && A.altSel === 2000 && A.xpdr.code === code && A.xpdr.mode === 'ALT' && near(A.com1.active, mainFreq(HOME), 0.001) && S.ac.flaps === 1),
        mk('Stijg op en klim naar 2000 ft (±100), flaps UP.', 'Parkeerrem los, vol gas, roteren bij 50 kt.', (S, A) => !S.ac.onGround && near(AV.indAlt(), 2000, 100) && S.ac.flaps === 0),
        mk(`Direct-To <b>${vrp.id}</b> en vlieg ernaartoe (binnen 1 nm).`, 'D→ → ID → Activate. AP toegestaan (NAV + ALT).', (S, A) => U.distNm(S.ac, vrp) < 1),
        mk(`Direct-To <b>${HOME.id}</b>; stel COM1 op Hasselt Radio (al goed) en selecteer circuithoogte ${circ} ft.`, 'D→ → EBZH → Activate; hoogtevak.', (S, A) => A.fpl.directTo && A.fpl.directTo.to.id === HOME.id && A.altSel === circ),
        mk(`Kom aan boven het veld (< 1,5 nm) op ${circ} ±150 ft.`, 'Daal tijdig; 3° ≈ 300 ft/nm.', (S, A) => U.distNm(S.ac, HOME) < 1.5 && near(AV.indAlt(), circ, 150)),
        mk('Squawk 7000 en zet de transponder op GND of STBY ná de landing (of blijf ALT in het circuit): hier volstaat code 7000.', 'XPDR-veld → VFR.', (S, A) => A.xpdr.code === '7000'),
      ] };
  });
  add('flight_cross', 'Volledige vluchten', 'Overlandvlucht met vluchtplan en AP', () => {
    const dest = R.apt({ min: 20, max: 45, kinds: ['civil', 'intl'] }); const via = R.vrp({ from: HOME, min: 5, max: 15 }); const cruise = U.pick([2500, 3000, 3500]);
    const start = R.airborne(HOME, { dist: 2, alt: 1500, hdg: Math.round(U.bearing(HOME, via)) });
    return { title: `${HOME.id} → ${via.id} → ${dest.id}`, start, intro: `<p>Net opgestegen van ${HOME.id}. Vlieg via <b>${via.id}</b> naar <b>${dest.id}</b> (${esc(dest.name)}) op ${cruise} ft.</p>`,
      steps: [
        mk(`Maak het vluchtplan <b>${HOME.id} → ${via.id} → ${dest.id}</b> en activeer de leg naar ${via.id}.`, 'FPL → + Waypoint ×3 → rij ' + via.id + ' → Activate Leg.', (S, A) => A.fpl.wpts.map(w => w.id).join(',') === [HOME.id, via.id, dest.id].join(',') && A.fpl.active === 1),
        mk(`AP: NAV + klim naar ${cruise} ft (VS of IAS), hoogte geselecteerd.`, 'AP-paneel.', (S, A) => A.ap.on && (A.ap.lat === 'NAV' || A.ap.latArm === 'NAV') && A.altSel === cruise),
        mk(`Passeer ${via.id} (automatische sequencing naar ${dest.id}) op kruishoogte ±150 ft.`, 'De leg naar ' + dest.id + ' wordt magenta.', (S, A) => A.fpl.active === 2 && near(AV.indAlt(), cruise, 150)),
        mk(`Zet de frequentie van ${dest.id} (${R.fmtF(mainFreq(dest))}) in COM1 standby en de ATIS/info indien aanwezig in COM2.`, 'Waypoint Info → frequenties.', (S, A) => near(A.com1.standby, mainFreq(dest), 0.0005) || near(A.com1.active, mainFreq(dest), 0.0005)),
        (() => ({ text: `Welke baan verwacht je op ${dest.id} (meeste tegenwind)?`, makeQuestion: () => { const w = SIM.windAt(); const ends = dest.rwys.flatMap(r => r.id.split('/').map((id, i) => ({ id, hdg: i ? U.norm360(r.hdg + 180) : r.hdg }))); const best = ends.map(e => ({ e, hw: w.spd * Math.cos((w.dir - e.hdg) * U.DEG) })).sort((a, b) => b.hw - a.hw)[0].e.id; let opts = U.shuffle(ends.map(e => e.id)).slice(0, 4); if (!opts.includes(best)) opts[0] = best; while (opts.length < 4) opts.push(['09', '18', '27', '36'].find(x => !opts.includes(x))); return { options: opts, correct: opts.indexOf(best), explain: `Wind ${U.fmtHdg(w.dir)}°/${Math.round(w.spd)} kt.` }; } }))(),
        mk(`Daal zodat je binnen 5 nm van ${dest.id} op circuithoogte (${dest.elev + 1000} ±200 ft) bent; TOD ≈ 3 nm per 1000 ft.`, 'Hoogtevak → circuithoogte, VS −500.', (S, A) => U.distNm(S.ac, dest) < 5 && near(AV.indAlt(), dest.elev + 1000, 200)),
        mk('Ontkoppel de AP voor de visuele nadering en maak COM1 actief op de veldfrequentie.', 'AP DISC; COM1 wisselen.', (S, A) => !A.ap.on && near(A.com1.active, mainFreq(dest), 0.0005)),
      ] };
  });
  add('flight_ifr', 'Volledige vluchten', 'Complete RNP-nadering met hold op de missed', () => {
    const aptId = U.pick(['EBLG', 'EBAW', 'EHBK', 'EBKT', 'EBOS', 'EBCI']); const apt = NAV.find(aptId); const idx = NAV.APPROACHES[aptId].findIndex(p => p.type === 'RNP') >= 0 ? NAV.APPROACHES[aptId].findIndex(p => p.type === 'RNP') : 0; const ap = NAV.APPROACHES[aptId][idx]; const iaf = ap.legs[0];
    const start = { airborne: true, ...U.dest(iaf, U.norm360(U.bearing(ap.legs[1], iaf) + U.rnd(-40, 40)), 14), alt: iaf.alt + 1000, hdg: 0, ias: 100, env: R.env(), fuelL: 40, fuelR: 40, fuelSel: 'L' }; start.hdg = Math.round(U.bearing(start, iaf));
    const av = () => { AV.fplClear(); AV.fplAdd(HOME); AV.fplAdd(apt); };
    return { title: `${ap.name} ${aptId} compleet`, start, av, intro: chatter(`${apt.name} Approach`, `OO-XYZ, cleared ${ap.name} via ${iaf.id}, descend ${iaf.alt} ft, QNH ${start.env.qnh}. After the missed approach, hold at ${ap.missed[ap.missed.length - 1].id}.`),
      steps: [
        mk(`Baro ${start.env.qnh}; laad en activeer <b>${ap.name}</b> via <b>${iaf.id}</b>; AP NAV; daal naar ${iaf.alt} ft.`, 'PROC-pagina; AP-paneel; hoogtevak.', (S, A) => A.baro === start.env.qnh && A.fpl.approach && A.fpl.approach.active && A.fpl.approach.transition === iaf.id && A.ap.on && (A.ap.lat === 'NAV' || A.ap.latArm === 'NAV' || A.ap.lat === 'APR' || A.ap.latArm === 'APR') && A.altSel === iaf.alt),
        mk(`Vóór de FAF: APR gewapend, hoogte FAF (${ap.legs.find(l => l.faf).alt} ft) geselecteerd, minimums ${apt.elev + 400} ft ingesteld.`, 'APR; hoogtevak; PFD Options → Minimums.', (S, A) => (A.ap.lat === 'APR' || A.ap.latArm === 'APR') && A.altSel === ap.legs.find(l => l.faf).alt && A.minimumsOn && A.minimums === apt.elev + 400),
        mk('GP gevangen en gevolgd (< 100 ft afwijking) gedurende 20 s; snelheid 70–85 kt.', 'Vermogen 3800–4200 rpm, flaps T/O.', hold((S, A) => A.ap.vert === 'GP' && Math.abs(A.nav.vdev || 0) < 100 && S.ac.ias >= 68 && S.ac.ias <= 88, 20)),
        mk('Bij MINIMUMS zonder zicht: <b>GA</b>, vol gas, flaps UP boven 60 kt, missed approach actief.', 'GA-knop; F.', (S, A) => A.ap.lat === 'GA' && S.ac.throttle > 0.9 && (A.fpl.wpts[A.fpl.active] && A.fpl.wpts[A.fpl.active].missed)),
        mk(`Klim naar ${ap.missed[0].alt} ft en volg de missed approach met NAV tot het holdingfix ${ap.missed[ap.missed.length - 1].id} (< 1 nm).`, 'Na GA: NAV opnieuw selecteren; hoogtevak.', (S, A) => (A.ap.lat === 'NAV' || A.ap.lat === 'GA') && U.distNm(S.ac, ap.missed[ap.missed.length - 1]) < 1 && AV.indAlt() > ap.missed[0].alt - 200),
        mk('In de hold (SUSP): zet een 1-minuten-timer en vlieg 60 s een outbound leg (heading bug op de reciproke van de inbound koers, HDG-modus).', 'Timer → Set… 01:00 (Count Down); HDG op tegengestelde koers.', (S, A) => A.fpl.susp && A.timer.running && A.timer.dir === 'DOWN' && A.ap.lat === 'HDG'),
      ] };
  });
  add('free', 'Vrij vliegen', 'In de lucht bij EBZH (2000 ft, kruisvlucht)', () => {
    const start = R.airborne(HOME, { alt: 2000, dist: U.rnd(2, 6) });
    return { title: 'Verkennen — in de lucht bij EBZH', start, intro: '<p>Geen opdrachten: verken en verander alles wat je wilt. Met <b>Reset</b> keer je terug naar deze startsituatie.</p>', steps: [] };
  });
  add('free_ground', 'Vrij vliegen', 'Op de baan van EBZH, koud en donker', () => {
    const start = R.onRunway(HOME); start.engineRunning = false;
    return { title: 'Verkennen — op de grond op EBZH', start, intro: '<p>Koud en donker op de baan van Kiewit. Paneel Vliegtuig: Master → Start → gas.</p>', steps: [] };
  });
  add('free_ground_run', 'Vrij vliegen', 'Op de baan van EBZH, motor draait', () => {
    const start = R.onRunway(HOME); start.engineRunning = true;
    return { title: 'Verkennen — klaar voor vertrek op EBZH', start, intro: '<p>Motor loopt, parkeerrem staat aan. Parkeerrem los, vol gas, roteren bij 50 kt.</p>', steps: [] };
  });
  add('free_apr', 'Vrij vliegen', 'In de lucht bij een vliegveld met naderingen', () => {
    const apt = R.apt({ withApr: true, max: 60 }); const start = R.airborne(apt, { alt: apt.elev + 2500, dist: U.rnd(8, 14) });
    return { title: `Verkennen — bij ${apt.id}`, start, intro: `<p>Je bent in de buurt van <b>${esc(apt.name)}</b>. Probeer PROC → een nadering laden en de autopilot in APR.</p>`, steps: [] };
  });

  // ---------- scenario-motor ----------
  const T = { GEN, current: null, stepIndex: 0, steps: [], stepStart: 0, started: 0, hints: 0, errors: [], done: false, failed: false, lastRunKey: null, best: {} };
  try { T.best = JSON.parse(localStorage.getItem('g3x.scores') || '{}'); } catch (e) { T.best = {}; }
  T.categories = () => { const out = []; GEN.forEach(g => { if (g.cat !== 'Vrij vliegen' && !out.includes(g.cat)) out.push(g.cat); }); return out; };
  T.exploreOptions = () => GEN.filter(g => g.cat === 'Vrij vliegen');

  // modus: 'scenario' (stappen volgen) of 'explore' (vrij verkennen); explore gebruikt de 'free*'-generatoren
  T.mode = 'scenario';
  T.exploreStart = 'free';
  T.startExplore = (which, seed) => { T.mode = 'explore'; T.exploreStart = which || T.exploreStart; return T.start(T.exploreStart, seed); };
  // reset: zelfde scenario met exact dezelfde gegevens (zelfde zaad)
  T.reset = () => { if (T.current) T.start(T.current.id, T.seed); };
  T.start = (id, seed) => {
    const gen = GEN.find(g => g.id === id) || U.pick(GEN.filter(g => g.cat !== 'Vrij vliegen'));
    if (gen.cat === 'Vrij vliegen') T.mode = 'explore'; else T.mode = 'scenario';
    T.seed = seed ?? Math.floor(Math.random() * 2 ** 31);
    const sc = U.withSeed(T.seed, () => { const s = gen.fn(); if (gen.post) gen.post(s); return s; });
    sc.id = gen.id; sc.cat = gen.cat; sc.genName = gen.name;
    // simulator en avionica terugzetten
    const S = SIM.reset(Object.assign({}, sc.start, { fail: sc.fail || {} }));
    if (sc.start.extra) Object.assign(S.ac, sc.start.extra);
    if (sc.start.throttle != null) S.ac.throttle = sc.start.throttle;
    if (sc.start.flaps != null) S.ac.flaps = sc.start.flaps;
    const A = AV.reset();
    A.baro = sc.start.env && sc.start.env.qnh ? sc.start.env.qnh + U.pick([0, 0, -4, 6]) : 1013;
    A.altSel = Math.round(S.ac.alt / 100) * 100; A.hdgBug = Math.round(S.ac.hdg);
    A.com1.active = NAV.mainFreq(HOME); A.com1.standby = 121.5;
    if (sc.av) sc.av(A);
    G3X.bus.log.length = 0;
    T.current = sc; T.steps = sc.steps.map(s => Object.assign({ status: 'todo', errors: [] }, s)); T.stepIndex = 0; T.stepStart = S.t; T.started = S.t; T.hints = 0; T.errors = []; T.done = false; T.failed = false; T.ctx = { flag: false }; T.msg = null;
    T.enterStep();
    if (G3X.main) G3X.main.onScenarioStart();
    return sc;
  };
  T.enterStep = () => {
    const st = T.steps[T.stepIndex]; if (!st) return;
    st.status = 'active'; st.t0 = SIM.S.t; st.ctx = { dt: 0, t: 0, has: (name, pred) => G3X.bus.since(st.t0, name).some(e => !pred || (typeof pred === 'function' ? pred(e.data) : e.data === pred)), progress: 0 };
    if (st.makeQuestion) { st.question = st.makeQuestion(SIM.S, AV.A); }
    st.answered = null;
  };
  T.tick = dt => {
    if (!T.current || T.done) return;
    const S = SIM.S, A = AV.A;
    const ctx = T.ctx; ctx.t = S.t - T.started; ctx.stepIndex = T.stepIndex;
    if (T.current.onTick) T.current.onTick(S, A, ctx);
    if (S.ac.crashed && !T.failed) { T.failed = true; T.done = true; T.errors.push('Crash / harde landing'); T.finish(); return; }
    // globale fouten
    if (S.ac.stall && !S.ac.onGround) T.flagError('Overtrekwaarschuwing (STALL)', 20);
    if (S.ac.ias > SIM.AC.vne) T.flagError('VNE overschreden', 20);
    const st = T.steps[T.stepIndex]; if (!st) return;
    const c = st.ctx; c.dt = dt; c.t = S.t - st.t0;
    if (st.fail) { const m = st.fail(S, A, c); if (m) T.flagError(m, 30, st); }
    if (st.question) return; // wacht op antwoord
    let ok = false;
    try { ok = st.check(S, A, c); } catch (e) { console.error('check', e); }
    if (ok) T.completeStep();
  };
  T.flagError = (msg, cooldown, st) => { const now = SIM.S.t; T.errT = T.errT || {}; if (T.errT[msg] && now - T.errT[msg] < cooldown) return; T.errT[msg] = now; T.errors.push(msg); if (st) st.errors.push(msg); if (G3X.audio) G3X.audio.play('fail'); if (G3X.main) G3X.main.onTrainerUpdate(); };
  T.completeStep = () => {
    const st = T.steps[T.stepIndex]; st.status = 'done'; st.dur = SIM.S.t - st.t0;
    if (G3X.audio) G3X.audio.play('ok');
    T.stepIndex++;
    if (T.stepIndex >= T.steps.length) { T.done = true; T.finish(); }
    else T.enterStep();
    if (G3X.main) G3X.main.onTrainerUpdate();
  };
  T.answer = i => {
    const st = T.steps[T.stepIndex]; if (!st || !st.question || st.answered != null) return;
    st.answered = i;
    if (i === st.question.correct) { st.feedback = { ok: true, text: st.question.explain }; setTimeout(() => { if (T.steps[T.stepIndex] === st) T.completeStep(); }, 1200); }
    else {
      st.feedback = { ok: false, text: st.question.explain };
      T.errors.push('Fout antwoord: ' + st.text.replace(/<[^>]+>/g, '').slice(0, 60)); st.errors.push('fout antwoord');
      // na een fout antwoord: opties opnieuw schudden, juiste antwoord bijhouden
      const correctText = st.question.options[st.question.correct];
      setTimeout(() => { st.answered = null; st.feedback = null; st.question.options = U.shuffle(st.question.options); st.question.correct = st.question.options.indexOf(correctText); if (G3X.main) G3X.main.onTrainerUpdate(); }, 2500);
    }
    if (G3X.main) G3X.main.onTrainerUpdate();
  };
  T.hint = () => { const st = T.steps[T.stepIndex]; if (!st) return; if (!st.hintShown) { st.hintShown = true; T.hints++; } if (G3X.main) G3X.main.onTrainerUpdate(); };
  T.skip = () => { const st = T.steps[T.stepIndex]; if (!st) return; st.status = 'skipped'; T.errors.push('Stap overgeslagen'); T.stepIndex++; if (T.stepIndex >= T.steps.length) { T.done = true; T.finish(); } else T.enterStep(); if (G3X.main) G3X.main.onTrainerUpdate(); };
  T.finish = () => {
    const dur = SIM.S.t - T.started; const score = Math.max(0, 100 - T.errors.length * 12 - T.hints * 5 - (T.failed ? 50 : 0));
    const stars = T.failed ? 0 : score >= 90 ? 3 : score >= 65 ? 2 : 1;
    T.result = { dur, score, stars, errors: T.errors.slice(), hints: T.hints };
    const key = T.current.id; const b = T.best[key]; if (!b || score > b.score) T.best[key] = { score, stars, dur, date: Date.now() };
    T.best[key].runs = (b && b.runs ? b.runs : 0) + 1;
    try { localStorage.setItem('g3x.scores', JSON.stringify(T.best)); } catch (e) { /* geen opslag */ }
    if (G3X.audio) G3X.audio.play(T.failed ? 'fail' : 'ok');
    if (G3X.main) G3X.main.onTrainerUpdate();
  };

  G3X.trainer = T;
})();

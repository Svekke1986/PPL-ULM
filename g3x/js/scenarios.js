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
  // meerkeuzeopties rond een numerieke waarde; 'values' maakt live beoordeling mogelijk (zie T.answer)
  const numOpts = (val, step, fmt = v => String(v)) => { const base = val; const offs = U.shuffle([0, -step, step, 2 * step]); const correctIdx = offs.indexOf(0); return { options: offs.map(o => fmt(base + o)), values: offs.map(o => base + o), step, correct: correctIdx }; };
  // afleesvraag: de opties worden bij het tonen gemaakt, maar het juiste antwoord is wat de meter toont op het moment van antwoorden
  const liveQ = (text, getter, step, fmt, explain) => ({ text, makeQuestion: (S, A) => { const v = getter(S, A); const o = numOpts(Math.round(v / step) * step, step, fmt); return { options: o.options, values: o.values, step, correct: o.correct, get: () => getter(SIM.S, AV.A), fmt, explain }; } });
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
        mk(`Stel de baro in op <b>${qnh} hPa</b>.`, 'Tik op het baro-veld onder de hoogtetape, of draai de binnenknop van de rechterknop op het PFD-scherm (Baro).', (S, A) => !A.baroStd && A.baro === qnh),
        mk(`Zet de heading bug op <b>${U.fmtHdg(hdg)}°</b>.`, 'Buitenring van de linkerknop op het PFD-scherm (Heading), of tik op de HSI → Heading Bug.', (S, A) => A.hdgBug === hdg),
        mk(`Zet de geselecteerde hoogte op <b>${alt} ft</b>.`, 'Binnenknop van de linkerknop op het PFD-scherm (Altitude), of tik op het cyaan hoogtevak boven de hoogtetape.', (S, A) => A.altSel === alt),
        mk('Vlieg naar de ingestelde heading (±5°) en hoogte (±100 ft) en houd dat 15 s vast.', 'Pijltjestoetsen of stuurknuppel; kleine correcties. De heading bug en de hoogtebug op de tapes helpen je.', hold((S, A) => hdgNear(S.ac.hdg, hdg, 5) && near(AV.indAlt(), alt, 100), 15)),
      ] };
  });
  add('pfd_std', 'Basis & PFD', 'Transitiehoogte: STD en terug naar QNH', () => {
    const qnh = R.qnh(); const start = R.airborne(HOME, { alt: 4000 }); start.env.qnh = qnh;
    return { title: 'STD boven de transitiehoogte', start, intro: chatter('Brussels Information', `OO-XYZ, klim naar FL 55, transitiehoogte 4500 ft. Bij de daling: QNH ${qnh}.`),
      steps: [
        mk('Klim door de transitiehoogte (4500 ft) en zet de hoogtemeter op <b>STD</b> (1013).', 'Tik op het baro-veld → STD.', (S, A) => A.baroStd && AV.indAlt() > 4500),
        mk('Bereik FL 55 (±150 ft op STD) en houd 10 s.', 'Zet 5500 in het hoogtevak: de hoogtebug toont dan je doel op de tape.', hold((S, A) => A.baroStd && near(AV.indAlt(), 5500, 150), 10)),
        mk(`Daal en zet bij het passeren van het transitieniveau weer <b>QNH ${qnh}</b>.`, 'Baro-veld → cijfers invoeren → Enter.', (S, A) => !A.baroStd && A.baro === qnh && AV.indAlt() < 5300),
        q('Waarom gebruik je STD boven de transitiehoogte?', ['Zodat alle toestellen dezelfde referentie gebruiken voor verticale separatie', 'Omdat de QNH daar niet meer geldt', 'Omdat de hoogtemeter anders te snel verandert', 'Omdat de GPS-hoogte dan nauwkeuriger is'], 0, 'Boven de transitiehoogte vliegt iedereen op flight levels (1013,25 hPa), zodat verticale separatie klopt ongeacht de lokale QNH.'),
      ] };
  });
  add('pfd_minimums', 'Basis & PFD', 'Minimums instellen en respecteren', () => {
    const apt = R.apt({ withApr: true, max: 40 }); const mins = apt.elev + U.pick([400, 500, 600]); const start = R.airborne(apt, { alt: apt.elev + 2500, dist: 8 });
    return { title: `Minimums ${apt.id}`, start, intro: `<p>Briefing voor een nadering op <b>${esc(apt.name)}</b> (hoogte ${apt.elev} ft). De beslissingshoogte is <b>${mins} ft</b>.</p>`,
      steps: [
        mk(`Stel de minimums in op <b>${mins} ft</b> en schakel ze in.`, 'MENU op het PFD-scherm → PFD Options → Minimums Altitude.', (S, A) => A.minimumsOn && A.minimums === mins),
        mk('Daal tot de melding MINIMUMS verschijnt (de minimums-bug op de hoogtetape wordt geel).', 'Daal met VS −500 of handmatig.', (S, A) => A.minFlag === true),
        mk(`Vlieg een go-around: klim tot minstens <b>${mins + 800} ft</b>.`, 'Vol gas, neus omhoog (Vy 69 kt), flaps op.', (S, A) => AV.indAlt() > mins + 800),
        q('Wat doe je bij een circling/visuele nadering als je op minimums de baan niet ziet?', ['Doorstarten (missed approach)', 'Nog 100 ft verder dalen', 'Op dezelfde hoogte doorvliegen tot je de baan ziet', 'De snelheid verlagen'], 0, 'Zonder visuele referentie op de beslissingshoogte voer je de missed approach uit.'),
      ] };
  });
  add('pfd_wind', 'Basis & PFD', 'Windvector aflezen', () => {
    const start = R.airborne(HOME); const w = start.env;
    return { title: 'Windvector', start, intro: '<p>De windvector staat linksonder in de HSI. Tik erop om van weergave te wisselen.</p>',
      steps: [
        mk('Zet de windweergave op <b>componenten</b> (tegen-/zijwind, modus 1).', 'Tik op het windvak tot je twee pijltjes met getallen ziet, of MENU op het PFD-scherm → Wind Vector.', (S, A) => A.windMode === 1),
        (() => { const rel = U.norm180(w.windDir - start.hdg); const cross = Math.abs(Math.round(w.windSpd * Math.sin(rel * U.DEG))); const o = numOpts(cross, 4, v => Math.max(0, v) + ' kt'); return q(`Hoe groot is de dwarswindcomponent ongeveer bij je huidige heading (${U.fmtHdg(start.hdg)}°)?`, o.options, o.correct, `Wind ${U.fmtHdg(w.windDir)}°/${w.windSpd} kt. Zijwind ≈ snelheid × sin(hoek) = ${cross} kt.`); })(),
        mk('Zet de windweergave op <b>richting/snelheid</b> (modus 3).', 'Nog twee keer tikken op het windvak.', (S, A) => A.windMode === 3),
        q('Van welke kant komt de wind t.o.v. je neus?', [(() => { const rel = U.norm180(w.windDir - start.hdg); return Math.abs(rel) < 45 ? 'Van voren' : Math.abs(rel) > 135 ? 'Van achteren' : rel > 0 ? 'Van rechts' : 'Van links'; })(), 'Van de andere kant', 'Precies van opzij, geen tegen- of rugwind', 'De wind is nul'], 0, 'De pijl in het windvak wijst in de richting waarin de wind waait, gezien vanaf je heading.'),
      ] };
  });
  add('pfd_read', 'Basis & PFD', 'Instrumenten aflezen (quiz)', () => {
    const start = R.airborne(HOME);
    const mkQ = (label, getter, step, fmt) => liveQ(label, getter, step, fmt);
    return { title: 'Aflezen van de PFD', start, intro: '<p>Lees de gevraagde waarden af op de PFD. Antwoord binnen de tolerantie.</p>',
      steps: [
        mkQ('Wat is je <b>grondsnelheid</b> (GS, databalk bovenaan)?', S => S.ac.gs, 5, v => v + ' kt'),
        mkQ('Wat is je <b>track</b> (TRK)?', S => S.ac.trk, 10, v => U.fmtHdg(v) + '°'),
        mkQ('Wat is de <b>OAT</b>?', () => SIM.oat(), 2, v => v + ' °C'),
        mkQ('Wat is je <b>ware luchtsnelheid</b> (TAS, onder de snelheidstape)?', S => S.ac.tas, 5, v => v + ' kt'),
        mkQ('Wat is je <b>geïndiceerde hoogte</b> (afgerond op 100 ft)?', () => AV.indAlt(), 100, v => v + ' ft'),
        q('Wat betekent de magenta lijn naast de snelheidstape?', ['Trendvector: de snelheid over ±6 s als de versnelling gelijk blijft', 'De geselecteerde snelheid', 'De maximale structurele snelheid', 'De snelheid van de wind'], 0, 'De trendvector toont waar de snelheid (of hoogte) over 6 seconden zal zijn.'),
      ] };
  });
  add('pfd_settings', 'Basis & PFD', 'PFD-opties: SVT, bearing pointers, V-snelheden', () => {
    const vor = R.vor(); const start = R.airborne(HOME);
    const svtOff = U.chance(0.5);
    return { title: 'PFD-opties', start, intro: '<p>Pas de PFD aan via het optiemenu (tik op de snelheidstape of druk op MENU bij een volledig PFD).</p>',
      steps: [
        mk(`Zet Synthetic Vision <b>${svtOff ? 'UIT' : 'AAN'}</b>.`, 'MENU op het PFD-scherm → Synthetic Vision.', (S, A) => A.svt === !svtOff),
        mk(`Stem NAV1 af op <b>${vor.id} ${U.fmtNav(vor.freq)}</b> en maak actief.`, 'GNC 255: C/N naar NAV, TUNE-knop → frequentie, ⇄. (Ook via het NAV1-vak linksonder op de PFD.)', (S, A) => near(A.nav1.active, vor.freq, 0.001)),
        mk('Zet <b>bearing pointer 1</b> op NAV1.', 'Tik op de HSI → Bearing Pointer 1, of op het BRG1-vak rechts naast de HSI.', (S, A) => A.brg1 === 'NAV1' && A.nav1.data.valid),
        (() => ({ text: `Op welke <b>radiaal</b> van ${vor.id} bevind je je ongeveer? (De staart van bearing pointer 1 wijst de radiaal aan.)`, makeQuestion: S => { const r = Math.round(U.bearing(vor, S.ac) / 10) * 10; const o = numOpts(r, 20, v => U.fmtHdg(v) + '°'); return { options: o.options, correct: o.correct, explain: `Peiling naar het station ${U.fmtHdg(U.bearing(S.ac, vor))}° → radiaal ${U.fmtHdg(r)}° (tegenovergestelde).` }; } }))(),
        mk('Zet bearing pointer 2 op <b>GPS</b> en schakel de V-snelheden <b>uit</b>.', 'HSI → Bearing Pointer 2; V-snelheden via MENU op het PFD-scherm.', (S, A) => A.brg2 === 'GPS' && A.vspeeds === false),
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
    return { title: `COM: ${apt.id}`, start, intro: chatter('Brussels Information', `OO-XYZ, contact ${apt.name} ${R.fmtF(f)}. Monitor 121.500 in standby.`),
      steps: [
        mk(`Zet <b>${R.fmtF(f)}</b> in standby op de GNC 255 (COM).`, 'GNC 255 onder het scherm (C/N op COM): draai met de TUNE-knop (buiten = MHz, binnen = kHz) de standby-frequentie in.', (S, A) => near(A.com1.standby, f, 0.0005)),
        mk('Maak de frequentie actief met de wisselknop (⇄).', 'Knop ⇄ op de GNC 255 wisselt actief en standby.', (S, A) => near(A.com1.active, f, 0.0005)),
        mk('Zet <b>121.500</b> in standby op de GNC 255 en luister ze mee met <b>MON</b>.', 'TUNE → 121.500; knop MON op de GNC 255.', (S, A) => near(A.com1.standby, 121.5, 0.0005) && A.com1.monStby),
        q('Wat betekent “8,33 kHz-kanaalafstand” voor het invoeren van frequenties?', ['Je voert kanalen als 118.955 in: eindcijfers 005/010/015 bestaan ook', 'Alleen frequenties eindigend op 00, 25, 50, 75 zijn geldig', 'De radio werkt alleen boven FL 195', 'Je moet de 8,33-modus apart inschakelen per vlucht'], 0, 'In Europa zijn 8,33 kHz-kanalen verplicht; een “kanaal” zoals 118.955 is een naam, geen exacte frequentie.'),
      ] };
  });
  add('com_nearest', 'Radio & transponder', 'Frequentie opzoeken via Nearest', () => {
    const start = R.airborne(R.apt({ max: 25 }), { dist: U.rnd(2, 5) });
    return { title: 'Nearest → frequentie', start, intro: '<p>Je wilt het dichtstbijzijnde vliegveld oproepen maar kent de frequentie niet uit het hoofd.</p>',
      steps: [
        mk('Open de pagina <b>Nearest</b> (Airports).', 'Toets NRST op de bezel, tab Vliegvelden.', (S, A, ctx) => ctx.has('page', p => p === 'NRST')),
        mk('Zet de hoofdfrequentie van het <b>dichtstbijzijnde vliegveld</b> actief op de GNC 255.', 'Tik op de rij → Waypoint Info → lees de frequentie af; zet ze met de TUNE-knop van de GNC 255 in standby en wissel (⇄).', (S, A) => { const n = NAV.nearest(S.ac, 'APT', 1)[0].item; return near(A.com1.active, mainFreq(n), 0.0005); }),
        liveQ('Hoe ver is dat vliegveld ongeveer (nm)?', S => NAV.nearest(S.ac, 'APT', 1)[0].dist, 3, v => Math.max(0, v) + ' NM', 'Afstand staat in de Nearest-lijst.'),
      ] };
  });
  add('xpdr_code', 'Radio & transponder', 'Transponder: code, modus, IDENT, VFR', () => {
    const code = R.squawk(); const start = R.airborne(HOME); start.extra = {};
    return { title: 'Transponder', start, intro: chatter('Brussels Information', `OO-XYZ, squawk ${code}.`),
      steps: [
        mk(`Stel code <b>${code}</b> in.`, 'GTX 335 onder het scherm: toets de vier cijfers (0–7) in.', (S, A) => A.xpdr.code === code),
        mk('Zorg dat de transponder in <b>ALT</b> staat (mode C).', 'Knop ALT op de GTX 335.', (S, A) => A.xpdr.mode === 'ALT', { fail: (S, A) => A.xpdr.mode === 'STBY' ? 'Transponder op STBY tijdens de vlucht: ATC ziet je niet.' : null }),
        mk('ATC vraagt: <i>“squawk ident”</i>. Druk op <b>IDENT</b>.', 'Knop IDNT op de GTX 335.', ev('ident')),
        mk('Je verlaat de gecontroleerde zone: zet de <b>VFR-code 7000</b>.', 'Knop VFR op de GTX 335.', (S, A) => A.xpdr.code === '7000'),
        q('Welke code gebruik je bij radio-uitval?', ['7600', '7700', '7500', '7000'], 0, '7500 kaping, 7600 radio-uitval, 7700 noodgeval.'),
      ] };
  });
  add('nav_vor', 'Radio & transponder', 'VOR afstemmen, identificeren en radiaal onderscheppen', () => {
    const vor = R.vor({ min: 8, max: 35 }); const start = R.airborne(vor, { dist: U.rnd(10, 18), alt: 3000 });
    const inbound = U.norm360(Math.round(U.bearing(start, vor) / 10) * 10 + U.pick([-20, 20]));
    return { title: `VOR ${vor.id}`, start, intro: `<p>Navigeer op de VOR <b>${esc(vor.name)}</b> (${vor.id}). Onderschep de inbound koers <b>${U.fmtHdg(inbound)}°</b> (radiaal ${U.fmtHdg(inbound + 180)}).</p>`,
      steps: [
        mk(`Stem NAV1 af op <b>${U.fmtNav(vor.freq)}</b> en maak actief.`, 'GNC 255: C/N naar NAV → TUNE → ⇄ (of NAV1-veld linksonder op de PFD).', (S, A) => near(A.nav1.active, vor.freq, 0.001)),
        q(`Welke morse-ident hoort bij ${vor.id}? (De G3X toont de gedecodeerde ident onder NAV1.)`, U.shuffle([U.morse(vor.id), U.morse(vor.id.split('').reverse().join('')), U.morse(vor.id.slice(1) + vor.id[0]), U.morse('XYZ')]).map(x => x), null, `Ident ${vor.id} = ${U.morse(vor.id)}.`),
        mk('Zet de CDI-bron op <b>VOR1</b> (NAV1).', 'Tik op de HSI → HSI Options → CDI Source VOR1 (of op het bronlabel links boven de HSI).', (S, A) => A.navSource === 'NAV1'),
        mk(`Zet CRS op <b>${U.fmtHdg(inbound)}°</b> (TO).`, 'Buitenring van de rechterknop op het PFD-scherm (Course), het CRS-veld naast de HSI, of OBS op de GNC 255.', (S, A) => hdgNear(A.nav1.obs, inbound, 2)),
        mk('Onderschep de koers: naald gecentreerd (binnen ½ dot) met TO-vlag, 15 s lang.', 'Vlieg naar de naald toe met een onderscheppingshoek van ca. 30–45°.', hold((S, A) => A.nav1.data.valid && Math.abs(A.nav1.data.dev) < 0.5 && A.nav1.data.toFrom === 'TO', 15)),
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
        mk(`Stem NAV1 af op <b>${U.fmtNav(freq)}</b> (actief).`, 'GNC 255: C/N naar NAV → TUNE → ⇄. Tip: de ILS-frequentie staat ook in de waypoint-info van het vliegveld.', (S, A) => near(A.nav1.active, freq, 0.001)),
        mk('CDI-bron op <b>NAV1</b>; de ident verschijnt als de localizer wordt ontvangen.', 'Tik op de HSI → CDI Source, of op het bronlabel.', (S, A) => A.navSource === 'NAV1' && A.nav1.data.loc),
        mk(`Zet CRS op de eindkoers <b>${U.fmtHdg(re.hdg)}°</b>.`, 'CRS-veld naast de HSI.', (S, A) => hdgNear(A.nav1.obs, re.hdg, 2)),
        mk('Onderschep de localizer: naald binnen ½ dot gedurende 10 s.', 'Onderschep met max. 30° hoek; verklein de correctie naarmate de naald centreert.', hold((S, A) => A.nav1.data.loc && Math.abs(A.nav1.data.dev) < 0.5, 10)),
        mk('Volg de glideslope: verticale afwijking binnen 1 dot gedurende 15 s (onder 1500 ft AGL).', 'Daal met ca. 300–400 fpm bij 70–80 kt: naald omhoog = jij zit te laag.', hold((S, A) => A.nav1.data.gsValid && Math.abs(A.nav1.data.gsDev) < 1 && S.ac.agl < 1500, 15)),
      ] };
  });
  add('com_8_33', 'Radio & transponder', 'Nauwkeurig 8,33-kanaal invoeren', () => {
    const chans = U.comChannels(); const f = U.pick(chans.filter(c => Math.round(c * 1000) % 25 !== 0 && c > 118 && c < 132));
    const start = R.airborne(HOME);
    return { title: '8,33 kHz-kanaal', start, intro: chatter('Brussels Information', `OO-XYZ, contact Hasselt Radio op ${R.fmtF(f)}. Correct read back verwacht.`),
      steps: [
        mk(`Zet <b>${R.fmtF(f)}</b> actief op de radio.`, 'TUNE buiten voor de megahertz, binnen voor de 8,33-stappen; dan ⇄.', (S, A) => near(A.com1.active, f, 0.0005)),
        q(`Welk kanaal ligt één stap boven ${R.fmtF(f)} (8,33-raster)?`, (() => { const nx = U.nextCom(f, 1, false); const o = U.shuffle([R.fmtF(nx), R.fmtF(f + 0.025), R.fmtF(f + 0.001), R.fmtF(f + 0.01 + (Math.round(f * 1000) % 25 === 15 ? 0.005 : 0))]); return o; })(), null, 'De 8,33-kanalen binnen een 25 kHz-blok eindigen op .x00, .x05, .x10, .x15.'),
      ] };
  });
  GEN.find(g => g.id === 'com_8_33').post = sc => { const f = parseFloat(sc.intro.match(/op (\d{3}\.\d{3})/)[1]); const nx = R.fmtF(U.nextCom(f, 1, false)); const st = sc.steps.find(x => x.question); st.question.correct = st.question.options.indexOf(nx); if (st.question.correct < 0) { st.question.options[0] = nx; st.question.correct = 0; } };

  // === Navigatie (GPS) ===
  add('dto_apt', 'Navigatie (GPS)', 'Direct-To en CDI volgen', () => {
    const apt = R.apt({ min: 10, max: 35 }); const start = R.airborne(HOME);
    return { title: `Direct-To ${apt.id}`, start, intro: `<p>Vlieg rechtstreeks naar <b>${esc(apt.name)} (${apt.id})</b>.</p>`,
      steps: [
        mk(`Activeer <b>Direct-To ${apt.id}</b>.`, 'Toets D→ op de bezel → typ de ID (of tabblad Nearest Airports) → Activate.', (S, A) => A.fpl.directTo && A.fpl.directTo.to.id === apt.id),
        mk('Draai naar de DTK en houd de CDI gecentreerd (XTK < 0,3 nm) gedurende 20 s.', 'Lees DTK af in de databalk; stuur tot de magenta naald in het midden staat.', hold((S, A) => A.nav && A.nav.valid && Math.abs(A.nav.xtk) < 0.3 && hdgNear(S.ac.trk, A.nav.dtk, 15), 20)),
        liveQ('Wat is de ETE naar het waypoint (minuten, afgerond)?', (S, A) => A.nav && A.nav.valid ? A.nav.ete : 0, 3, v => Math.max(0, v) + ' min', 'ETE = DIS ÷ GS × 60; lees ze af in de bovenbalk van het MFD.'),
        mk('Zet het bereik van de kaart zo dat het waypoint zichtbaar is (bereik ≥ afstand) en op <b>Track up</b>.', 'MFD-scherm: rechterknop buiten = Range; MENU op de kaart → Orientation.', (S, A) => A.map.range >= A.nav.dis * 0.9 && A.map.orient === 'TRKUP'),
      ] };
  });
  add('dto_nrst', 'Navigatie (GPS)', 'Nearest → Direct-To (uitwijkhaven)', () => {
    const start = R.airborne(R.apt({ max: 30 }), { dist: U.rnd(3, 7) });
    return { title: 'Uitwijken naar het dichtstbijzijnde veld', start, intro: '<p>Het weer verslechtert snel. Vlieg naar het dichtstbijzijnde vliegveld.</p>',
      steps: [
        mk('Open <b>Nearest → Airports</b> en activeer een <b>Direct-To naar het dichtstbijzijnde</b> vliegveld.', 'NRST-toets → tik op de eerste rij → Direct-To.', (S, A) => { const n = NAV.nearest(S.ac, 'APT', 1)[0].item; return A.fpl.directTo && A.fpl.directTo.to.id === n.id; }),
        mk('Zet de hoofdfrequentie van dat veld actief op de GNC 255 en de hoogte van het circuit (veldhoogte + 1000 ft, afgerond op 100) als geselecteerde hoogte.', 'Waypoint Info → frequentie aflezen → GNC 255; hoogtevak → waarde.', (S, A) => { const n = A.fpl.directTo && NAV.find(A.fpl.directTo.to.id); if (!n) return false; return near(A.com1.active, mainFreq(n), 0.0005) && near(A.altSel, Math.round((n.elev + 1000) / 100) * 100, 60); }),
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
        mk('Onderschep de koers: XTK < 0,2 nm gedurende 15 s.', 'Vlieg met 30–45° onderschepping naar de magenta lijn.', hold((S, A) => A.nav && A.nav.valid && Math.abs(A.nav.xtk) < 0.2, 15)),
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
        mk(`Zet de koers op <b>${U.fmtHdg(crs)}°</b>.`, 'Buitenring van de rechterknop op het PFD-scherm (Course) of het CRS-veld naast de HSI.', (S, A) => A.fpl.obs && hdgNear(A.crs1, crs, 2)),
        mk('Centreer de CDI (XTK < 0,3 nm) gedurende 10 s.', 'Vlieg naar de lijn toe.', hold((S, A) => A.fpl.obs && A.nav && Math.abs(A.nav.xtk) < 0.3, 10)),
        mk('Schakel OBS weer uit (normaal sequencen).', 'OBS-vak op de HSI of CRS-veld → OBS Off.', (S, A) => !A.fpl.obs),
      ] };
  });
  add('map_opts', 'Navigatie (GPS)', 'Kaart: bereik, oriëntatie, declutter en luchtruim', () => {
    const start = R.airborne(HOME); const range = U.pick([8, 10, 15, 20]); const orient = U.pick(['NORTH', 'HDGUP']); const asp = NAV.AIRSPACES.find(s => s.id === 'EBBL-CTR');
    return { title: 'Kaartinstellingen', start, intro: '<p>Stel de kaart in zoals gevraagd en lees het luchtruim af.</p>',
      steps: [
        mk(`Zet het kaartbereik op <b>${range} NM</b>.`, 'MFD-scherm: buitenring rechterknop (Range) of binnenknop linkerknop (Zoom Map), of −/+ rechtsonder op de kaart (+ = inzoomen).', (S, A) => A.map.range === range && A.mfdPage === 'MAP'),
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
        mk('Activeer de cursor op de kaart (tik op een lege plek of druk de rechterknop van het MFD-scherm in).', 'Linksonder verschijnt peiling en afstand vanaf het vliegtuig.', (S, A) => A.map.panning && A.mfdPage === 'MAP'),
        liveQ(`Wat is ongeveer de <b>afstand</b> van je positie tot <b>${esc(city[0])}</b>? (Zet de cursor op de stad.)`, S => U.distNm(S.ac, { lat: city[1], lon: city[2] }), 3, v => Math.max(0, v) + ' NM', 'Met de cursor op de stad staat de afstand linksonder op de kaart.'),
        mk('Maak een <b>gebruikerswaypoint</b> op de cursorpositie.', 'Cursormenu → Create User Waypoint (of de MFD-rechterknop indrukken → menu).', ev('userwpt')),
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
        mk(`Zet de hoofdfrequentie van ${apt.id} in standby op de GNC 255.`, 'Lees de frequentie af in het infovenster en stel ze op de GNC 255 in.', (S, A) => near(A.com1.standby, mainFreq(apt), 0.0005)),
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
        mk(`Zet de geselecteerde hoogte op <b>${target} ft</b> en open de pagina <b>VNAV</b> (Main Menu): lees de afstand tot het top-of-descent (TOD) af.`, 'Hoogtevak → ' + target + '. Main Menu (MENU 2×) → VNAV.', (S, A) => A.altSel === target && A.mfdPage === 'VNAV'),
        mk('Begin de daling bij het TOD en houd de magenta <b>V</b>-indicator naast de hoogtetape gecentreerd (afwijking < 150 ft) gedurende 20 s.', 'Ongeveer 500 fpm bij 100 kt GS; chevron boven het midden = je zit te laag.', hold((S, A) => A.nav && A.nav.vnav && A.nav.vnav.todDis <= 0 && Math.abs(A.nav.vnav.vdev) < 150 && S.ac.vs < -200, 20)),
        mk(`Bereik ${vrp.id} binnen 2 nm op ${target} ±150 ft.`, 'Vlak tijdig uit; de hoogtealert waarschuwt 200 ft vóór de geselecteerde hoogte.', (S, A) => U.distNm(S.ac, vrp) < 2 && near(AV.indAlt(), target, 150)),
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

  add('apr_rnp', 'Navigatie (GPS)', 'RNP-nadering handmatig vliegen (CDI en glijpad)', () => {
    const apts = Object.keys(NAV.APPROACHES).filter(id => NAV.APPROACHES[id].some(p => p.type === 'RNP')); const aptId = U.pick(apts); const apt = NAV.find(aptId);
    const idx = NAV.APPROACHES[aptId].findIndex(p => p.type === 'RNP'); const ap = NAV.APPROACHES[aptId][idx]; const iaf = ap.legs[0]; const faf = ap.legs.find(l => l.faf);
    const start = { airborne: true, ...U.dest(iaf, U.norm360(U.bearing(ap.legs[1], iaf) + U.rnd(-30, 30)), 8), alt: iaf.alt + 500, hdg: Math.round(U.bearing(U.dest(iaf, U.bearing(ap.legs[1], iaf), 8), iaf)), ias: 90, env: R.env(), fuelL: 35, fuelR: 35, fuelSel: 'R' };
    const av = () => { AV.fplClear(); AV.fplAdd(HOME); AV.fplAdd(apt); };
    return { title: `RNP ${ap.rwy} ${aptId} handmatig`, start, av, intro: chatter(`${apt.name}`, `OO-XYZ, cleared ${ap.name} approach via ${iaf.id}. Report established.`),
      steps: [
        mk(`Laad de <b>${ap.name}</b> op ${aptId} met transitie <b>${iaf.id}</b> en activeer ze.`, 'FPL → PROC (of Main Menu → Procedures) → vliegveld, nadering, transitie → Load & Activate.', (S, A) => A.fpl.approach && A.fpl.approach.apt === aptId && A.fpl.approach.name === ap.name && A.fpl.approach.transition === iaf.id && A.fpl.approach.active),
        mk(`Selecteer de FAF-hoogte (<b>${faf.alt} ft</b>) en daal ernaartoe (±150 ft) met de CDI gecentreerd (XTK < 0,3 nm), 15 s.`, 'Hoogtevak; CDI-schaal wordt TERM en daarna APR.', hold((S, A) => A.altSel === faf.alt && near(AV.indAlt(), faf.alt, 150) && A.nav && Math.abs(A.nav.xtk) < 0.3, 15)),
        mk('Na de FAF: volg het glijpad (magenta diamant naast de hoogtetape) met afwijking < 100 ft gedurende 15 s. Snelheid 70–85 kt, flaps T/O.', 'Vermogen 3800–4200 rpm voor 3° bij 75 kt; diamant boven het midden = je zit te laag.', hold((S, A) => A.nav && A.nav.gpValid && Math.abs(A.nav.vdev || 0) < 100, 15), { fail: S => S.ac.ias > 95 ? 'Te snel op de eindnadering (> 95 kt).' : null }),
        mk(`Op het MAP (${ap.legs.find(l => l.map).id}) verschijnt <b>SUSP</b>: ga door (vol gas, klimmen) en druk op SUSP voor de missed approach.`, 'SUSP onderaan of op de HSI.', (S, A) => A.fpl.wpts[A.fpl.active] && A.fpl.wpts[A.fpl.active].missed && S.ac.throttle > 0.8),
        mk(`Klim naar de missed-approach-hoogte (${ap.missed[0].alt} ft ±150) met die hoogte geselecteerd.`, 'Hoogtevak; Vy 69 kt.', (S, A) => near(AV.indAlt(), ap.missed[0].alt, 150) && A.altSel === ap.missed[0].alt),
      ] };
  });
  add('go_around', 'Volledige vluchten', 'Go-around vanaf korte final', () => {
    const apt = U.pick([HOME, NAV.find('EBST'), NAV.find('EBZW')]); const rwId = U.pick(apt.rwys[0].id.split('/')); const re = NAV.runwayEnds(apt, rwId);
    const start = { airborne: true, ...U.dest(re.thr, U.norm360(re.hdg + 180), 1.8), alt: apt.elev + 550, hdg: re.hdg, ias: 65, env: R.env(), fuelL: 30, fuelR: 30, fuelSel: 'L', flaps: 2, throttle: 0.35 };
    return { title: `Go-around ${apt.id} ${rwId}`, start, intro: chatter(`${apt.name} Radio`, `OO-XYZ, go around, I say again go around, traffic on the runway.`),
      steps: [
        mk('Vol gas, neus omhoog naar ca. 7°: positieve klim (VS > 200 fpm).', 'PageUp of schuifregelaar; ↓ voor neus omhoog.', S => S.ac.throttle > 0.9 && S.ac.vs > 200),
        mk('Flaps naar <b>T/O</b>, dan <b>UP</b> boven 60 kt en 300 ft AGL.', 'Toets F/V of de flapschakelaar (lampjes 0 / T / L).', (S, A) => S.ac.vs > 200 && S.ac.flaps === 0 && S.ac.agl > 250, { fail: S => S.ac.ias > 80 && S.ac.flaps === 2 ? 'VFE overschreden met volle flaps!' : null }),
        mk(`Klim naar circuit-hoogte (${apt.elev + 1000} ft ±100) en selecteer die hoogte; heading bug op de baanrichting ${U.fmtHdg(re.hdg)}°.`, 'Hoogtevak; PFD-linkerknop buitenring (Heading).', (S, A) => near(AV.indAlt(), apt.elev + 1000, 100) && near(A.altSel, apt.elev + 1000, 60) && hdgNear(A.hdgBug, re.hdg, 5)),
        q('Wat doe je met de transponder tijdens een go-around en nieuw circuit?', ['Niets: hij blijft op ALT', 'Op STBY zetten', 'IDENT drukken', 'Code 7700 instellen'], 0, 'De transponder blijft gewoon in ALT staan zolang je vliegt.'),
      ] };
  });

  // === Apparatuur van OO-KWO ===
  add('gma_audio', 'Radio & transponder', 'GMA 245: zendradio, meeluisteren en VOR-ident', () => {
    const vor = R.vor({ min: 8, max: 35 }); const start = R.airborne(HOME);
    return { title: 'Audiopaneel GMA 245', start, intro: '<p>Op de GMA 245 kies je welke radio zendt (COM1 MIC / COM2 MIC) en wat je meeluistert (COM1, COM2, NAV1, NAV2). De groene lampjes tonen de stand.</p>',
      steps: [
        mk('Druk op <b>COM2 MIC</b> en daarna weer op <b>COM1 MIC</b>: de GNC 255 is COM1 en moet de zendradio zijn.', 'GMA 245: knoppen COM1 MIC / COM2 MIC; het lampje boven de knop toont de keuze.', (S, A, ctx) => ctx.has('mic', v => v === 2) && ctx.has('mic', v => v === 1) && G3X.cockpit.gma.mic === 1),
        mk(`Stem NAV1 af op <b>${vor.id} ${U.fmtNav(vor.freq)}</b> (GNC 255: C/N → NAV → TUNE → ⇄).`, 'C/N schakelt het display tussen COM en NAV; de TUNE-knop zet de standby; ⇄ wisselt.', (S, A) => near(A.nav1.active, vor.freq, 0.001)),
        mk('Druk op <b>NAV1</b> op de GMA 245 om de morse-ident mee te luisteren.', 'Lampje NAV1 gaat branden; de G3X toont de gedecodeerde ident onder NAV1.', (S, A, ctx) => ctx.has('navaudio') && G3X.cockpit.gma.nav1),
        q(`Welke morse-ident hoor je nu voor ${vor.id}?`, U.shuffle([U.morse(vor.id), U.morse(vor.id.split('').reverse().join('')), U.morse(vor.id.slice(1) + vor.id[0]), U.morse('XYZ')]), null, `Ident ${vor.id} = ${U.morse(vor.id)}. Zet NAV1 daarna weer uit, anders blijft de morse door je koptelefoon piepen.`),
        mk('Zet <b>NAV1</b> weer uit op de GMA 245.', 'Nogmaals op NAV1 drukken.', (S, A, ctx) => ctx.has('navaudio') && !G3X.cockpit.gma.nav1),
      ] };
  });
  GEN.find(g => g.id === 'gma_audio').post = sc => { const id = sc.steps[1].text.match(/<b>([A-Z]+) /)[1]; const st = sc.steps[3]; st.question.correct = st.question.options.indexOf(U.morse(id)); };
  add('gnc_nav', 'Radio & transponder', 'GNC 255: VOR op het NAV-deel, OBS en T/F', () => {
    const vor = R.vor({ min: 8, max: 30 }); const start = R.airborne(vor, { dist: U.rnd(10, 16), alt: 3000 });
    return { title: `GNC 255 NAV naar ${vor.id}`, start, intro: `<p>Gebruik het NAV-deel van de GNC 255 voor <b>${esc(vor.name)}</b> (${vor.id}) en laat de HSI de VOR tonen.</p>`,
      steps: [
        mk('Schakel de GNC 255 met <b>C/N</b> naar NAV.', 'Het display toont dan de NAV-frequenties.', (S, A, ctx) => ctx.has('gncmode', m => m === 'NAV')),
        mk(`Zet <b>${U.fmtNav(vor.freq)}</b> in standby met de TUNE-knop en wissel met <b>⇄</b>.`, 'Buitenknop = MHz, binnenknop = 50 kHz-stappen.', (S, A) => near(A.nav1.active, vor.freq, 0.001)),
        mk('Tik op de <b>HSI</b> en kies CDI Source <b>VOR1</b>.', 'HSI Options → CDI Source.', (S, A) => A.navSource === 'NAV1' && A.nav1.data.valid),
        (() => ({ text: `Druk op <b>OBS</b> op de GNC 255 en zet met de TUNE-knop de koers op de peiling naar het station (TO). Welke koers is dat ongeveer (afgerond op 10°)?`, makeQuestion: S => { const b = Math.round(U.bearing(S.ac, vor) / 10) * 10 % 360; const o = numOpts(b, 20, v => U.fmtHdg(v) + '°'); return { options: o.options, correct: o.correct, explain: `Peiling naar ${vor.id}: ${U.fmtHdg(U.bearing(S.ac, vor))}°. T/F toont dan TO.` }; } }))(),
        mk('Zet de OBS-koers met de TUNE-knop op de GNC 255 (binnen 5° van de peiling) zodat de naald centreert met TO.', 'OBS → TUNE draait de koers (buiten 10°, binnen 1°).', (S, A, ctx) => ctx.has('gncobs') && A.nav1.data.valid && A.nav1.data.toFrom === 'TO' && Math.abs(A.nav1.data.dev) < 0.5),
        mk('Vlieg naar het station: DME < 3 nm.', 'Naald gecentreerd houden.', (S, A) => A.nav1.data.valid && A.nav1.data.dme != null && A.nav1.data.dme < 3),
      ] };
  });
  add('gtx_flow', 'Radio & transponder', 'GTX 335: van OFF tot ALT, code en IDNT', () => {
    const start = R.onRunway(HOME); start.engineRunning = true; const code = R.squawk();
    const av = A => { A.xpdr.mode = 'OFF'; A.xpdr.code = '7000'; };
    return { title: 'Transponder GTX 335', start, av, intro: chatter('Hasselt Radio', `OO-KWO, squawk ${code}.`),
      steps: [
        mk('Zet de transponder aan: druk op <b>SBY</b>.', 'Linkse knoppencluster van de GTX 335. Op de grond blijft hij in standby.', (S, A) => A.xpdr.mode === 'STBY'),
        mk(`Toets de code <b>${code}</b> in (vier cijfers 0–7).`, 'De cijfers verschijnen één voor één; na het vierde cijfer is de code actief. CLR wist de invoer.', (S, A) => A.xpdr.code === code),
        mk('Zet de transponder vóór het opstijgen op <b>ALT</b>.', 'Knop ALT. Op de grond toont het display GND (automatisch), in de lucht ALT met een R bij elke reply.', (S, A) => A.xpdr.mode === 'ALT'),
        mk('Hasselt Radio vraagt <i>“squawk ident”</i>: druk op <b>IDNT</b>.', 'Knop IDNT in het midden van de cluster.', ev('ident')),
        q('Wat betekent “FLIGHT ID OOKWO” op het display?', ['De Mode S-vluchtidentificatie: voor privévluchten de registratie zonder streepje', 'De transpondercode in letters', 'De naam van het dichtstbijzijnde vliegveld', 'De code van de ATC-eenheid'], 0, 'Mode S zendt naast de squawk ook de Flight ID uit; zonder vluchtplannummer gebruik je de registratie.'),
        mk('Na de vlucht: <b>VFR</b> (7000) en daarna <b>SBY</b>.', 'Knoppen VFR en SBY.', (S, A, ctx) => A.xpdr.code === '7000' && A.xpdr.mode === 'STBY' && ctx.has('squawk', c => c === '7000')),
      ] };
  });
  add('mfd_pages', 'Basis & PFD', 'Twee schermen: pagina’s kiezen met de MFD-knoppen', () => {
    const start = R.airborne(HOME);
    return { title: 'MFD-knoppen en pagina’s', start, intro: '<p>Op het MFD-scherm kies je met de <b>linkerknop</b> de pagina (buitenring: Select Page) en zoom je met de binnenknop (Zoom Map). Indrukken opent het Main Menu.</p>',
      steps: [
        mk('Draai met de buitenring van de MFD-linkerknop naar de pagina <b>Active Flight Plan</b>.', 'Select Page: Map → Active Flight Plan → Waypoint Info → Nearest → …', (S, A) => A.mfdPage === 'FPL'),
        mk('Draai verder naar <b>Nearest</b> en scrol met de MFD-rechterknop door de lijst.', 'Rechterknop buiten = Scroll, binnen = List; indrukken = selecteren.', (S, A, ctx) => A.mfdPage === 'NRST'),
        mk('Terug naar de <b>Map</b> en zoom in tot <b>5 NM</b> of minder met de binnenknop van de linkerknop.', 'Zoom Map = binnenknop links; Range = buitenring rechts.', (S, A) => A.mfdPage === 'MAP' && A.map.range <= 5),
        mk('Druk de MFD-linkerknop in: het <b>Main Menu</b> opent. Kies daar <b>Engine</b>.', 'Push: Main Menu (of MENU twee keer).', (S, A) => A.mfdPage === 'ENG'),
        q('Welke motorinformatie toont de G3X in dit toestel op de MFD?', ['Oliedruk, brandstofdruk, volts en ampères', 'Toerental, CT, olietemperatuur en brandstofhoeveelheid', 'Alle motorgegevens inclusief EGT en brandstofverbruik', 'Niets, alles is analoog'], 0, 'Alleen oil PSI, fuel PSI, volts en amps hangen aan de G3X; de rest zijn analoge meters in het paneel.'),
        mk('Druk op <b>BACK</b> tot de kaart weer zichtbaar is.', 'BACK op het MFD-scherm.', (S, A) => A.mfdPage === 'MAP'),
      ] };
  });
  add('gauges_read', 'Motor & systemen (EIS)', 'Analoge meters aflezen', () => {
    const start = R.airborne(HOME, { fuelL: U.rndInt(15, 55), fuelR: U.rndInt(15, 55) }); start.throttle = U.pick([0.6, 0.72, 0.85]);
    const mkQ = (label, getter, step, fmt) => liveQ(label, getter, step, fmt);
    return { title: 'Analoge meters', start, intro: '<p>Lees de analoge meters onder de schermen af; de G3X toont deze waarden niet.</p>',
      steps: [
        mkQ('Wat is het <b>toerental</b> (afgerond op 100)?', S => S.eng.rpm, 100, v => v + ' rpm'),
        mkQ('Hoeveel brandstof zit er ongeveer in de <b>linkertank</b>?', S => S.ac.fuelL, 5, v => v + ' L'),
        mkQ('En in de <b>rechtertank</b>?', S => S.ac.fuelR, 5, v => v + ' L'),
        mkQ('Wat is de <b>CT</b> (koelvloeistoftemperatuur)?', S => S.eng.cht, 10, v => v + ' °C'),
        mk('Zet de brandstofkraan op de <b>volste tank</b>.', 'Rode kraan LEFT/RIGHT.', S => (S.ac.fuelL >= S.ac.fuelR ? S.ac.fuelSel === 'L' : S.ac.fuelSel === 'R')),
        q('Welke waarde vind je wél op de G3X (EIS-strook op de MFD)?', ['Oliedruk', 'Toerental', 'Olietemperatuur', 'Brandstofhoeveelheid'], 0, 'EIS op de MFD: OIL PSI, FUEL PSI, VOLTS, AMPS.'),
      ] };
  });

  // === Motor & systemen ===
  add('eis_cht', 'Motor & systemen (EIS)', 'Hoge CT (koelvloeistof) in de klim', () => {
    const start = R.airborne(HOME, { alt: 1200, ias: 65 }); start.throttle = 1; start.env.oatSea = U.rndInt(24, 32);
    return { title: 'CT te hoog', start, fail: { chtHigh: true }, intro: `<p>Warme dag (${start.env.oatSea} °C), steile klim met vol vermogen. Let op de analoge motorinstrumenten onder het scherm.</p>`,
      steps: [
        mk('Let op de analoge <b>CT</b>-meter in het paneel: de G3X waarschuwt hier niet voor. Wacht tot de naald boven 120 °C (geel) komt.', 'CT = koelvloeistoftemperatuur, tweede meter van links.', S => S.eng.cht > 120),
        mk('Verminder het vermogen (<b>&lt; 4600 rpm</b>) en verhoog de snelheid (<b>&gt; 85 kt</b>) voor betere koeling; 15 s.', 'Gas terug (PageDown), neus omlaag.', hold(S => S.eng.rpm < 4600 && S.ac.ias > 85, 15)),
        mk('Open de checklist <b>EMERG: High CHT / Oil Temp</b> en werk ze af.', 'Main Menu (MENU 2×) → Checklist → kies de EMERG-checklist → tik elk item aan.', (S, A, ctx) => ctx.has('chkdone', g => /High CHT/.test(g))),
        mk('Wacht tot de CT weer onder <b>120 °C</b> is.', 'Het duurt even; houd de snelheid hoog.', S => S.eng.cht < 120),
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
        mk('Squawk <b>7700</b> (GTX 335) en zet <b>121.500</b> actief op de GNC 255 (of de frequentie van het veld).', 'GTX 335: 7 7 0 0. GNC 255: ⇄ 1,5 s ingedrukt houden = 121.500.', (S, A) => A.xpdr.code === '7700' && (near(A.com1.active, 121.5, 0.001) || (A.fpl.directTo && near(A.com1.active, mainFreq(NAV.find(A.fpl.directTo.to.id)), 0.001)))),
        mk('Kom binnen 3 nm van het veld, nog met draaiende motor (of in glijvlucht).', 'Hoogte bewaren: glijd zo nodig met 65 kt.', (S, A) => A.fpl.directTo && U.distNm(S.ac, A.fpl.directTo.to) < 3),
      ] };
  });
  add('eis_fuel', 'Motor & systemen (EIS)', 'Brandstofbeheer: tank wisselen en vliegtijd schatten', () => {
    const start = R.airborne(HOME, { fuelL: U.rndInt(6, 12), fuelR: U.rndInt(38, 55), fuelSel: 'L' });
    return { title: 'Brandstofbeheer', start, intro: '<p>Je vliegt al een tijdje op de linkertank. Kijk naar de analoge brandstofmeters in het paneel.</p>',
      steps: [
        mk('De tanks zijn uit balans. Wissel naar de <b>rechtertank</b>.', 'Rode brandstofkraan → RIGHT.', S => S.ac.fuelSel === 'R'),
        liveQ('Hoeveel vliegtijd heb je nog ongeveer, bij 17 L/h en 4 L onbruikbaar? (Lees de analoge meters af.)', S => (S.ac.fuelL + S.ac.fuelR - 4) / 17 * 60, 30, v => U.fmtEte(Math.max(0, v)), 'Bruikbaar (totaal − 4 L) ÷ 17 L/h. Zonder fuel-flow-sensor reken je zelf.'),
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
        mk('Brandstofkraan op de <b>volste tank</b>.', 'Rode brandstofkraan LEFT/RIGHT.', S => (S.ac.fuelL >= S.ac.fuelR ? S.ac.fuelSel === 'L' : S.ac.fuelSel === 'R')),
        mk('Werk de checklist <b>Before Engine Start</b> af.', 'Main Menu (MENU 2×) → Checklist.', (S, A, ctx) => ctx.has('chkdone', g => /Before Engine Start/.test(g))),
        mk('Start de motor (gas op idle).', 'Paneel → Start. Oliedruk (EIS op de MFD) moet binnen 10 s stijgen.', S => S.eng.running, { fail: S => S.ac.throttle > 0.3 && !S.eng.running ? 'Starten met te veel gas.' : null }),
        mk('Warmdraaien op <b>2000–2500 rpm</b>, 10 s.', 'Gas iets open.', hold(S => S.eng.rpm >= 1950 && S.eng.rpm <= 2550, 10)),
        mk(`Baro op <b>${qnh}</b>, hoogtevak op circuit-hoogte <b>${HOME.elev + 1000 - (HOME.elev + 1000) % 100 + 100} ft</b>, heading bug op de baanrichting (${U.fmtHdg(start.hdg)}°).`, 'Baro-veld, hoogtevak, HSI.', (S, A) => A.baro === qnh && !A.baroStd && A.altSel === HOME.elev + 1000 - (HOME.elev + 1000) % 100 + 100 && hdgNear(A.hdgBug, start.hdg, 3)),
        mk(`Transponder code <b>${code}</b>, modus <b>ALT</b>.`, 'Transponder onder het scherm.', (S, A) => A.xpdr.code === code && A.xpdr.mode === 'ALT'),
        mk(`Zet Hasselt Radio <b>${R.fmtF(mainFreq(HOME))}</b> actief op COM1 en start de vluchttimer (algemene timer omhoog).`, 'GNC 255: standby instellen en ⇄; Main Menu (MENU 2×) → Timer → Start.', (S, A) => near(A.com1.active, mainFreq(HOME), 0.001) && A.timer.running && A.timer.dir === 'UP'),
      ] };
  });
  add('eis_runup', 'Motor & systemen (EIS)', 'Run-up en before-takeoff checks', () => {
    const start = R.onRunway(HOME); start.engineRunning = true;
    return { title: 'Run-up', start, intro: '<p>Motor loopt warm. Voer de run-up uit en zet de G3X klaar voor vertrek.</p>',
      steps: [
        mk('Wacht tot de olietemperatuur ≥ <b>50 °C</b> (verhoog eventueel het toerental naar 2500).', 'Analoge OIL T-meter in het paneel.', S => S.eng.oilT >= 50),
        mk('Run-up: <b>4000 rpm ±150</b> gedurende 8 s, rem vast (parkeerrem).', 'Gas open; parkeerrem staat aan.', hold(S => near(S.eng.rpm, 4000, 150) && S.ac.parkBrake, 8)),
        q('Wat is de maximale toerentaldaling per ontstekingscircuit bij de magneetcheck van de Rotax 912 (bij benadering)?', ['300 rpm, max 120 rpm verschil tussen beide', '50 rpm', '1000 rpm', 'Er mag geen daling zijn'], 0, 'Rotax 912: max. 300 rpm daling, max. 120 rpm verschil (controleer de POH).'),
        mk('Gas terug naar idle; <b>flaps T/O</b>, <b>transponder ALT</b>, heading bug op de baanrichting.', 'Flapschakelaar (lampje T); GTX 335 → ALT; HSI.', (S, A) => S.eng.rpm < 2200 && S.ac.flaps === 1 && A.xpdr.mode === 'ALT' && hdgNear(A.hdgBug, start.hdg, 5)),
        mk('Werk de checklist <b>Before Takeoff</b> af.', 'Main Menu (MENU 2×) → Checklist.', (S, A, ctx) => ctx.has('chkdone', g => /Before Takeoff/.test(g))),
        mk('Parkeerrem los, vol gas, roteer bij 50 kt en klim naar 500 ft AGL met flaps UP boven 60 kt.', 'Paneel → parkeerrem; PageUp; ↓ voor rotatie; F voor flaps.', S => S.ac.agl > 500 && S.ac.flaps === 0 && !S.ac.onGround),
      ] };
  });

  // === Noodgevallen & storingen ===
  add('fail_ahrs', 'Noodgevallen & storingen', 'AHRS-storing: rode X over de horizon', () => {
    const start = R.airborne(HOME, { alt: 3000 });
    return { title: 'AHRS FAIL', start, fail: {}, intro: '<p>Na 10 seconden valt de AHRS uit. De attitude verdwijnt. Vlieg op track en VS.</p>',
      onTick: (S, A, ctx) => { if (ctx.t > 10 && !S.fail.ahrs && !ctx.recovered) S.fail.ahrs = true; if (ctx.stepIndex >= 3 && !ctx.recovered) { S.fail.ahrs = false; ctx.recovered = true; } },
      steps: [
        mk('Herken de storing (rode X, ATTITUDE FAIL) en bevestig de melding.', 'De HSI toont nu de GPS-track in plaats van de heading.', (S, A) => S.fail.ahrs && A.cas.some(c => c.id === 'AHRS') && A.acked.AHRS && A.acked.AHRS.seen),
        mk('Houd het toestel 30 s recht: track-verandering < 15° en VS binnen ±300 fpm.', 'Gebruik de track op de HSI en de VSI: kleine inputs.', hold((S, A, ctx) => { if (ctx.ref == null) ctx.ref = S.ac.trk; return Math.abs(U.norm180(S.ac.trk - ctx.ref)) < 15 && Math.abs(S.ac.vs) < 300; }, 30)),
        mk('Werk de checklist <b>EMERG: AHRS / ADC Failure</b> af.', 'Main Menu (MENU 2×) → Checklist.', (S, A, ctx) => ctx.has('chkdone', g => /AHRS/.test(g))),
        mk('De AHRS herstelt. Controleer de attitude tegen de VSI en houd 15 s bank < 5° en VS binnen ±200 fpm.', 'Kruiscontrole: horizon, VSI, snelheid.', hold(S => !S.fail.ahrs && Math.abs(S.ac.bank) < 5 && Math.abs(S.ac.vs) < 200, 15)),
      ] };
  });
  add('fail_adc', 'Noodgevallen & storingen', 'ADC-storing: geen snelheid en hoogte', () => {
    const start = R.airborne(HOME, { alt: 2500 });
    return { title: 'ADC FAIL', start, intro: '<p>De air data computer valt uit: snelheid, hoogte en VSI tonen een rode X. Gebruik GPS-gegevens.</p>',
      onTick: (S, A, ctx) => { if (ctx.t > 5 && !S.fail.adc && !ctx.rec) S.fail.adc = true; },
      steps: [
        mk('Bevestig <b>ADC FAIL</b>.', 'CAS-venster.', (S, A) => S.fail.adc && A.acked.ADC && A.acked.ADC.seen),
        liveQ('Wat is je <b>GPS-hoogte</b> (Trip Computer) afgerond op 100 ft?', S => S.ac.alt, 100, x => x + ' ft', 'Main Menu (MENU 2×) → Info/Trip Computer → GPS altitude. GPS-hoogte ≠ barometrische hoogte, maar bruikbaar als back-up.'),
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
        mk(`Stem NAV1 af op <b>${vor.id} ${U.fmtNav(vor.freq)}</b>, zet de CDI-bron op NAV1 en de CRS op de peiling naar het station (TO).`, 'NAV1-vak linksonder op de PFD; HSI aantikken → CDI Source VOR1; CRS zo draaien dat de naald centreert met TO.', (S, A) => near(A.nav1.active, vor.freq, 0.001) && A.navSource === 'NAV1' && A.nav1.data.valid && A.nav1.data.toFrom === 'TO' && Math.abs(A.nav1.data.dev) < 0.6),
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
        mk('Herstartpoging: wissel naar de <b>andere tank</b> (brandstofpomp aan) en start.', 'Brandstofkraan RIGHT → Start.', S => S.ac.fuelSel === 'R' && S.eng.running),
        mk('Squawk <b>7700</b> op de GTX 335, <b>121.500</b> actief op de GNC 255.', 'GTX 335: 7 7 0 0. GNC 255: ⇄ ingedrukt houden = 121.500.', (S, A) => A.xpdr.code === '7700' && near(A.com1.active, 121.5, 0.001)),
        mk('Werk de checklist <b>EMERG: Engine Failure in Flight</b> af.', 'Main Menu (MENU 2×) → Checklist.', (S, A, ctx) => ctx.has('chkdone', g => /Engine Failure/.test(g))),
        q('Wat was de meest waarschijnlijke oorzaak van de motorstoring?', ['Brandstofgebrek: de geselecteerde (linker)tank was leeg', 'Oververhitting', 'Een elektrische storing', 'IJsvorming in de carburateur'], 0, 'De linkertank stond op ~1,5 L. Tankbeheer is deel van elke kruisvluchtcheck.'),
      ] };
  });
  add('fail_radio', 'Noodgevallen & storingen', 'Radio uitgevallen: 7600', () => {
    const apt = R.apt({ max: 25 }); const f = mainFreq(apt); const start = R.airborne(apt, { dist: U.rnd(6, 10) });
    return { title: 'Radiostoring', start, fail: { com1: true }, intro: `<p>Je roept ${esc(apt.name)} op ${R.fmtF(f)} maar de GNC 255 is dood (display leeg). Er is maar één COM aan boord.</p>`,
      steps: [
        mk('Werk de checklist <b>EMERG: Radio Failure</b> af.', 'Main Menu (MENU 2×) → Checklist.', (S, A, ctx) => ctx.has('chkdone', g => /Radio Failure/.test(g))),
        mk('Squawk <b>7600</b>.', 'GTX 335: 7 6 0 0.', (S, A) => A.xpdr.code === '7600'),
        q('Wat doe je VFR bij volledige radio-uitval nabij een ongecontroleerd veld?', ['Blijf VFR, voeg in het circuit in met extra uitkijk, let op lichtsignalen', 'Land onmiddellijk rechtuit', 'Klim naar FL 100', 'Stijg uit het luchtruim en wacht'], 0, 'Transponder 7600, standaard circuit, lichtsignalen bij gecontroleerde velden.'),
      ] };
  });
  add('fail_display', 'Noodgevallen & storingen', 'Schermstoring en reversionary mode', () => {
    const start = R.airborne(HOME);
    return { title: 'Display fail', start, intro: '<p>Na enkele seconden valt het PFD-scherm uit. Met twee schermen neem je over op het MFD-scherm (reversionary). Hier: knop <b>Reversionary</b> in het paneel Vliegtuig.</p>',
      onTick: (S, A, ctx) => { if (ctx.t > 4 && !ctx.set) { S.fail.display = true; ctx.set = true; } },
      steps: [
        mk('Het PFD-scherm is uitgevallen: activeer <b>reversionary</b> (paneel Vliegtuig), zodat het MFD-scherm de PFD met EIS toont.', 'Op het echte toestel gebeurt dit automatisch of via de knop op het resterende scherm.', (S, A) => A.reversion),
        mk('Vlieg 15 s recht (bank < 5°) op het reversionary-scherm.', 'Rechterscherm: PFD met EIS-strook.', hold((S, A) => A.reversion && Math.abs(S.ac.bank) < 5, 15)),
        q('Wat toont een G3X Touch in reversionary mode?', ['PFD met EIS-strook op één scherm', 'Alleen de kaart', 'Alleen de motorinstrumenten', 'Een zwart scherm met de klok'], 0, 'Reversionary combineert de essentiële vlieg- en motorinformatie op het resterende scherm.'),
      ] };
  });
  add('airspace_avoid', 'Noodgevallen & storingen', 'Luchtruim vermijden zonder klaring', () => {
    const ctr = U.pick(NAV.AIRSPACES.filter(s => s.type === 'CTR' && U.distNm(HOME, s.shape.circle || { lat: s.shape.poly[0][0], lon: s.shape.poly[0][1] }) < 40));
    const c = ctr.shape.circle || { lat: ctr.shape.poly.reduce((t, p) => t + p[0], 0) / ctr.shape.poly.length, lon: ctr.shape.poly.reduce((t, p) => t + p[1], 0) / ctr.shape.poly.length };
    const brg = U.rnd(0, 360); const p = U.dest(c, brg, (ctr.shape.r || 10) + 6); const start = { airborne: true, lat: p.lat, lon: p.lon, alt: ctr.ceil - 500, hdg: Math.round(U.norm360(brg + 180)), ias: 95, env: R.env(), fuelL: 35, fuelR: 35, fuelSel: 'L' };
    return { title: `${ctr.name} vermijden`, start, intro: `<p>Je vliegt richting de <b>${esc(ctr.name)}</b> (${ctr.floor === 0 ? 'GND' : ctr.floor}–${ctr.ceil} ft) zonder klaring. De radio is druk; je krijgt geen antwoord.</p>`,
      steps: [
        mk('Wacht op de melding <b>CTR AHEAD</b> (binnen 2 minuten) en lees het luchtruim op de kaart.', 'De knop Messages onderaan de schermen knippert; het kaartlabel toont vloer/plafond.', (S, A) => A.msgs.some(m => m.key && m.key.startsWith('aspc-' + ctr.id))),
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
        mk(`Vertrekvoorbereiding: baro ${qnh}, heading bug ${U.fmtHdg(start.hdg)}°, hoogte 2000, squawk ${code} ALT, COM1 ${R.fmtF(mainFreq(HOME))}, flaps T/O.`, 'PFD-velden; GTX 335 en GNC 255 onder het scherm; flapschakelaar.', (S, A) => A.baro === qnh && hdgNear(A.hdgBug, start.hdg, 3) && A.altSel === 2000 && A.xpdr.code === code && A.xpdr.mode === 'ALT' && near(A.com1.active, mainFreq(HOME), 0.001) && S.ac.flaps === 1),
        mk('Stijg op en klim naar 2000 ft (±100), flaps UP.', 'Parkeerrem los, vol gas, roteren bij 50 kt.', (S, A) => !S.ac.onGround && near(AV.indAlt(), 2000, 100) && S.ac.flaps === 0),
        mk(`Direct-To <b>${vrp.id}</b> en vlieg ernaartoe (binnen 1 nm).`, 'D→ → ID → Activate. Houd de CDI gecentreerd.', (S, A) => U.distNm(S.ac, vrp) < 1),
        mk(`Direct-To <b>${HOME.id}</b>; stel COM1 op Hasselt Radio (al goed) en selecteer circuithoogte ${circ} ft.`, 'D→ → EBZH → Activate; hoogtevak.', (S, A) => A.fpl.directTo && A.fpl.directTo.to.id === HOME.id && A.altSel === circ),
        mk(`Kom aan boven het veld (< 1,5 nm) op ${circ} ±150 ft.`, 'Daal tijdig; 3° ≈ 300 ft/nm.', (S, A) => U.distNm(S.ac, HOME) < 1.5 && near(AV.indAlt(), circ, 150)),
        mk('Squawk 7000 en zet de transponder op GND of STBY ná de landing (of blijf ALT in het circuit): hier volstaat code 7000.', 'GTX 335 → VFR.', (S, A) => A.xpdr.code === '7000'),
      ] };
  });
  add('flight_cross', 'Volledige vluchten', 'Overlandvlucht met vluchtplan', () => {
    const dest = R.apt({ min: 20, max: 45, kinds: ['civil', 'intl'] }); const via = R.vrp({ from: HOME, min: 5, max: 15 }); const cruise = U.pick([2500, 3000, 3500]);
    const start = R.airborne(HOME, { dist: 2, alt: 1500, hdg: Math.round(U.bearing(HOME, via)) });
    return { title: `${HOME.id} → ${via.id} → ${dest.id}`, start, intro: `<p>Net opgestegen van ${HOME.id}. Vlieg via <b>${via.id}</b> naar <b>${dest.id}</b> (${esc(dest.name)}) op ${cruise} ft.</p>`,
      steps: [
        mk(`Maak het vluchtplan <b>${HOME.id} → ${via.id} → ${dest.id}</b> en activeer de leg naar ${via.id}.`, 'FPL → + Waypoint ×3 → rij ' + via.id + ' → Activate Leg.', (S, A) => A.fpl.wpts.map(w => w.id).join(',') === [HOME.id, via.id, dest.id].join(',') && A.fpl.active === 1),
        mk(`Selecteer ${cruise} ft, klim ernaartoe (±150 ft) en volg de actieve leg (XTK < 0,3 nm) gedurende 15 s.`, 'Hoogtevak; Vy 69 kt in de klim; CDI gecentreerd houden.', hold((S, A) => A.altSel === cruise && near(AV.indAlt(), cruise, 150) && A.nav && Math.abs(A.nav.xtk) < 0.3, 15)),
        mk(`Passeer ${via.id} (automatische sequencing naar ${dest.id}) op kruishoogte ±150 ft.`, 'De leg naar ' + dest.id + ' wordt magenta.', (S, A) => A.fpl.active === 2 && near(AV.indAlt(), cruise, 150)),
        mk(`Zet de frequentie van ${dest.id} (${R.fmtF(mainFreq(dest))}) in standby op de radio.`, 'Waypoint Info → frequentie aflezen → GNC 255.', (S, A) => near(A.com1.standby, mainFreq(dest), 0.0005) || near(A.com1.active, mainFreq(dest), 0.0005)),
        (() => ({ text: `Welke baan verwacht je op ${dest.id} (meeste tegenwind)?`, makeQuestion: () => { const w = SIM.windAt(); const ends = dest.rwys.flatMap(r => r.id.split('/').map((id, i) => ({ id, hdg: i ? U.norm360(r.hdg + 180) : r.hdg }))); const best = ends.map(e => ({ e, hw: w.spd * Math.cos((w.dir - e.hdg) * U.DEG) })).sort((a, b) => b.hw - a.hw)[0].e.id; let opts = U.shuffle(ends.map(e => e.id)).slice(0, 4); if (!opts.includes(best)) opts[0] = best; while (opts.length < 4) opts.push(['09', '18', '27', '36'].find(x => !opts.includes(x))); return { options: opts, correct: opts.indexOf(best), explain: `Wind ${U.fmtHdg(w.dir)}°/${Math.round(w.spd)} kt.` }; } }))(),
        mk(`Daal zodat je binnen 5 nm van ${dest.id} op circuithoogte (${dest.elev + 1000} ±200 ft) bent; TOD ≈ 3 nm per 1000 ft.`, 'Hoogtevak → circuithoogte, VS −500.', (S, A) => U.distNm(S.ac, dest) < 5 && near(AV.indAlt(), dest.elev + 1000, 200)),
        mk('Maak de veldfrequentie actief op de GNC 255 en zet flaps T/O (lampje T) voor de visuele nadering.', 'GNC 255 ⇄; flapschakelaar.', (S, A) => near(A.com1.active, mainFreq(dest), 0.0005) && S.ac.flaps >= 1),
      ] };
  });
  add('flight_ifr', 'Volledige vluchten', 'Complete RNP-nadering met hold op de missed', () => {
    const aptId = U.pick(['EBLG', 'EBAW', 'EHBK', 'EBKT', 'EBOS', 'EBCI']); const apt = NAV.find(aptId); const idx = NAV.APPROACHES[aptId].findIndex(p => p.type === 'RNP') >= 0 ? NAV.APPROACHES[aptId].findIndex(p => p.type === 'RNP') : 0; const ap = NAV.APPROACHES[aptId][idx]; const iaf = ap.legs[0];
    const start = { airborne: true, ...U.dest(iaf, U.norm360(U.bearing(ap.legs[1], iaf) + U.rnd(-40, 40)), 14), alt: iaf.alt + 1000, hdg: 0, ias: 100, env: R.env(), fuelL: 40, fuelR: 40, fuelSel: 'L' }; start.hdg = Math.round(U.bearing(start, iaf));
    const av = () => { AV.fplClear(); AV.fplAdd(HOME); AV.fplAdd(apt); };
    return { title: `${ap.name} ${aptId} compleet`, start, av, intro: chatter(`${apt.name} Approach`, `OO-XYZ, cleared ${ap.name} via ${iaf.id}, descend ${iaf.alt} ft, QNH ${start.env.qnh}. After the missed approach, hold at ${ap.missed[ap.missed.length - 1].id}.`),
      steps: [
        mk(`Baro ${start.env.qnh}; laad en activeer <b>${ap.name}</b> via <b>${iaf.id}</b>; daal naar ${iaf.alt} ft (geselecteerd).`, 'PROC-pagina; hoogtevak.', (S, A) => A.baro === start.env.qnh && A.fpl.approach && A.fpl.approach.active && A.fpl.approach.transition === iaf.id && A.altSel === iaf.alt),
        mk(`Vóór de FAF: hoogte FAF (${ap.legs.find(l => l.faf).alt} ft) geselecteerd en minimums ${apt.elev + 400} ft ingesteld; CDI gecentreerd (XTK < 0,3).`, 'Hoogtevak; MENU op het PFD-scherm → Minimums.', (S, A) => A.altSel === ap.legs.find(l => l.faf).alt && A.minimumsOn && A.minimums === apt.elev + 400 && A.nav && Math.abs(A.nav.xtk) < 0.3),
        mk('Eindnadering: volg het glijpad (magenta diamant, afwijking < 100 ft) gedurende 20 s; snelheid 70–85 kt, flaps T/O.', 'Vermogen 3800–4200 rpm; diamant boven het midden = jij zit te laag.', hold((S, A) => A.nav && A.nav.gpValid && Math.abs(A.nav.vdev || 0) < 100 && S.ac.ias >= 68 && S.ac.ias <= 88, 20)),
        mk('Bij MINIMUMS zonder zicht: go-around — vol gas, klimmen, flaps UP boven 60 kt; op het MAP verschijnt SUSP: druk erop om de missed approach te activeren.', 'SUSP-knop onderaan of op de HSI; F.', (S, A) => S.ac.throttle > 0.9 && S.ac.vs > 200 && (A.fpl.wpts[A.fpl.active] && A.fpl.wpts[A.fpl.active].missed)),
        mk(`Klim naar ${ap.missed[0].alt} ft en volg de missed approach tot het holdingfix ${ap.missed[ap.missed.length - 1].id} (< 1 nm).`, 'CDI gecentreerd houden; hoogtevak.', (S, A) => U.distNm(S.ac, ap.missed[ap.missed.length - 1]) < 1 && AV.indAlt() > ap.missed[0].alt - 200),
        mk('In de hold (SUSP): zet een 1-minuten-timer en vlieg een outbound leg (heading bug op de reciproke van de inbound koers).', 'Timer → Set… 01:00 (Count Down); heading bug via de PFD-linkerknop.', (S, A) => A.fpl.susp && A.timer.running && A.timer.dir === 'DOWN'),
      ] };
  });
  add('free', 'Vrij vliegen', 'Stilstaand op EBZH, motor draait', () => {
    const start = R.onRunway(HOME); start.engineRunning = true; start.parked = true;
    return { title: 'Verkennen — stilstaand op EBZH', start, intro: '<p>Het toestel staat stil op Kiewit met draaiende motor. Verken alle functies van de G3X: pagina’s, menu’s, radio’s, transponder, vluchtplan, naderingen, instellingen. Met <b>Reset</b> begin je opnieuw.</p>', steps: [] };
  });
  add('free_cold', 'Vrij vliegen', 'Stilstaand op EBZH, koud en donker', () => {
    const start = R.onRunway(HOME); start.engineRunning = false; start.parked = true;
    return { title: 'Verkennen — koud en donker op EBZH', start, intro: '<p>Master uit, motor uit. Zet in het paneel Vliegtuig de master aan en start de motor om de motorinstrumenten te zien; het toestel blijft stilstaan.</p>', steps: [] };
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
    const q = st.question;
    if (q.get && q.values) {
      // afleesvraag: vergelijk het gekozen antwoord met de waarde die de meter nu toont
      const cur = q.get(); const tol = q.step * 0.75;
      const dists = q.values.map(v => Math.abs(v - cur)); const nearest = dists.indexOf(Math.min(...dists));
      q.correct = dists[i] <= tol ? i : nearest;
      q.explain = `Nu afgelezen: ${q.fmt(Math.round(cur / q.step) * q.step)}.` + (q.explain ? ' ' + q.explain : '');
    }
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

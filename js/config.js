// Configuratie van licenties, vakken, examenparameters en bronnen.
// Pas hier het aantal vragen / de examentijd aan als de BCAA/DGLV iets wijzigt.

// Bezoekersteller: GoatCounter (gratis, zonder cookies of persoonsgegevens). Vul de naam van het
// GoatCounter-account in (bv. 'ppl-ulm' voor ppl-ulm.goatcounter.com); leeg = geen teller.
window.ANALYTICS = { goatcounter: 'svekke1986' };

window.SUBJECTS = {
  air_law:                { code: '10', name: 'Luchtvaartwetgeving', en: 'Air Law', icon: '⚖️' },
  human_performance:      { code: '20', name: 'Menselijke prestaties', en: 'Human Performance', icon: '🧠' },
  meteorology:            { code: '30', name: 'Meteorologie', en: 'Meteorology', icon: '🌦️' },
  communications:         { code: '40', name: 'Communicatie', en: 'Communications', icon: '📻' },
  principles_of_flight:   { code: '50', name: 'Beginselen van het vliegen', en: 'Principles of Flight', icon: '✈️' },
  operational_procedures: { code: '60', name: 'Operationele procedures', en: 'Operational Procedures', icon: '📋' },
  flight_performance:     { code: '70', name: 'Vluchtprestaties en -planning', en: 'Flight Performance & Planning', icon: '📈' },
  aircraft_general:       { code: '80', name: 'Algemene kennis van het luchtvaartuig', en: 'Aircraft General Knowledge', icon: '🔧' },
  navigation:             { code: '90', name: 'Navigatie', en: 'Navigation', icon: '🧭' }
};

window.LICENCES = {
  PPL: {
    name: 'PPL(A)',
    full: 'Private Pilot Licence – vliegtuig (EASA Part-FCL)',
    authority: 'BCAA / DGLV',
    passRule: 'subject',          // per vak geslaagd
    passMark: 75,                 // Part-FCL FCL.025: 75% per vak
    passSource: 'fcl',
    passRef: 'Part-FCL, FCL.025 – Theoretical knowledge examinations',
    // Aantal vragen en tijd per vak volgens BCAA/AltMoC/FCL/2022-01 (geldig vanaf 01/02/2022), 132 vragen in totaal.
    examVerified: true,
    examRef: 'BCAA/AltMoC/FCL/2022-01 – AltMoC for AMC1 FCL.215; FCL.235',
    exams: {
      air_law:                { questions: 20, minutes: 40 },
      human_performance:      { questions: 12, minutes: 24 },
      meteorology:            { questions: 20, minutes: 40 },
      communications:         { questions: 12, minutes: 24 },
      principles_of_flight:   { questions: 12, minutes: 24 },
      operational_procedures: { questions: 12, minutes: 24 },
      flight_performance:     { questions: 12, minutes: 24 },
      aircraft_general:       { questions: 12, minutes: 24 },
      navigation:             { questions: 20, minutes: 60 }
    },
    examSource: 'bcaa_ppl'
  },
  ULM: {
    name: 'ULM',
    full: 'Ultralicht motorluchtvaartuig – Belgische nationale vergunning',
    authority: 'DGLV',
    passRule: 'total',            // 70% van het totaal over de 4 vakken
    passMark: 70,
    passSource: 'bcaa_ulm',
    passRef: 'DGLV – ULM-theorie-examen: minimaal 70% van de punten over de vier vakken samen',
    examVerified: true,
    exams: {
      air_law:           { questions: 20, minutes: 40 },
      human_performance: { questions: 10, minutes: 20 },
      meteorology:       { questions: 20, minutes: 40 },
      communications:    { questions: 10, minutes: 20 }
    },
    // Vakken: KB van 20 december 2024 betreffende de ULM's, art. 48, 2° (theorie-examen bij het DGLV).
    // Beginselen van het vliegen, operationele procedures, vluchtprestaties en -planning, algemene kennis van het
    // luchtvaartuig en navigatie worden volgens art. 48, 4° door de examinator getoetst tijdens de praktische proef.
    // Aantal vragen, tijd en slaagdrempel: DGLV (niet in het KB zelf).
    examRef: 'KB 20/12/2024 betreffende de ULM\'s, art. 48, 2° (vakken); DGLV – ULM-theorie-examen (aantal vragen en tijd)',
    examSource: 'bcaa_ulm'
  }
};

// Officiële bronnen. 'aip:XXX-n.n' verwijst automatisch naar het juiste hoofdstuk van de Belgische eAIP.
window.SOURCES = {
  br:      { org: 'EASA / EU', title: 'Basisverordening (EU) 2018/1139', url: 'https://eur-lex.europa.eu/eli/reg/2018/1139/oj' },
  part21:  { org: 'EASA / EU', title: 'Verordening (EU) 748/2012 – Part 21 (initiële luchtwaardigheid)', url: 'https://eur-lex.europa.eu/eli/reg/2012/748/oj' },
  ml:      { org: 'EASA', title: 'Easy Access Rules – Continuing Airworthiness (Part-ML)', url: 'https://www.easa.europa.eu/en/document-library/easy-access-rules/online-publications/easy-access-rules-continuing-airworthiness' },
  nco:     { org: 'EASA / EU', title: 'Verordening (EU) 965/2012 – Air Operations (Part-NCO)', url: 'https://eur-lex.europa.eu/eli/reg/2012/965/oj' },
  fcl:     { org: 'EASA', title: 'Easy Access Rules – Aircrew (Part-FCL)', url: 'https://www.easa.europa.eu/en/document-library/easy-access-rules/easy-access-rules-aircrew-regulation-eu-no-11782011' },
  med:     { org: 'EASA', title: 'Easy Access Rules – Aircrew (Part-MED)', url: 'https://www.easa.europa.eu/en/document-library/easy-access-rules/easy-access-rules-aircrew-regulation-eu-no-11782011' },
  sera:    { org: 'EASA', title: 'Easy Access Rules – SERA (Uitvoeringsverordening (EU) 923/2012)', url: 'https://www.easa.europa.eu/en/document-library/easy-access-rules/easy-access-rules-standardised-european-rules-air-sera' },
  sera14:  { org: 'EASA', title: 'Easy Access Rules – SERA, Sectie 14 (spreekprocedures)', url: 'https://www.easa.europa.eu/en/document-library/easy-access-rules/easy-access-rules-standardised-european-rules-air-sera' },
  adr:     { org: 'EASA / EU', title: 'Verordening (EU) 139/2014 – Aerodromes (incl. CS-ADR-DSN)', url: 'https://eur-lex.europa.eu/eli/reg/2014/139/oj' },
  occ:     { org: 'EU', title: 'Verordening (EU) 376/2014 – Melden, analyseren en opvolgen van voorvallen', url: 'https://eur-lex.europa.eu/eli/reg/2014/376/oj' },
  acc:     { org: 'EU', title: 'Verordening (EU) 996/2010 – Onderzoek van ongevallen en incidenten', url: 'https://eur-lex.europa.eu/eli/reg/2010/996/oj' },
  cs23:    { org: 'EASA', title: 'Certification Specifications CS-23', url: 'https://www.easa.europa.eu/en/document-library/easy-access-rules' },
  syl:     { org: 'EASA', title: 'Part-FCL – PPL-syllabus (AMC1 FCL.210) / ECQB-leerdoelen', url: 'https://www.easa.europa.eu/en/domains/aircrew-and-medical/european-central-question-bank-ecqb' },
  bcaa:    { org: 'BCAA / DGLV', title: 'FOD Mobiliteit – Luchtvaart', url: 'https://mobilit.belgium.be/nl/luchtvaart' },
  bcaa_ppl:{ org: 'BCAA / DGLV', title: 'Theorie-examen vliegtuigen en helikopters', url: 'https://mobilit.belgium.be/nl/luchtvaart/vliegen-met/vliegtuigen-helikopters/piloot/examens' },
  bcaa_ulm:{ org: 'DGLV', title: 'ULM – examens', url: 'https://mobilit.belgium.be/nl/luchtvaart/vliegen-met/ultralichte-motorluchtvaartuigen-ulm/piloot/examens' },
  aip:     { org: 'skeyes / BCAA', title: 'AIP België & Luxemburg', url: 'https://ops.skeyes.be/services-aip' },
  kbulm:   { org: 'FOD Mobiliteit en Vervoer', title: 'KB van 20 december 2024 betreffende de ultralichte motorluchtvaartuigen (BS 18/02/2025)', url: 'https://www.ejustice.just.fgov.be/cgi/article_body.pl?language=nl&caller=summary&pub_date=25-02-18&numac=2025000168' },
  met:     { org: 'EU / ICAO', title: 'Uitvoeringsverordening (EU) 2017/373 – Part-MET (METAR/TAF), gebaseerd op ICAO Annex 3', url: 'https://eur-lex.europa.eu/eli/reg_impl/2017/373/oj' }
};

window.resolveSource = function (key) {
  if (key && key.startsWith('aip:')) {
    const chapter = key.slice(4); // bv. 'ENR-5.1'
    return {
      org: 'skeyes / BCAA',
      title: 'AIP België & Luxemburg – ' + chapter.replace('-', ' '),
      url: 'https://ops.skeyes.be/html/belgocontrol_static/eaip/eAIP_Main/html/eAIP/EB-' + chapter + '-en-GB.html'
    };
  }
  return window.SOURCES[key] || window.SOURCES.syl;
};

// Hoofdstukken per vak, op basis van de ECQB-leerdoelcodes (bv. '30.9' = vlieggevaren).
// Een vraag hoort bij het hoofdstuk met het langste overeenkomende prefix.
window.CHAPTERS = {
  air_law: [
    { id: 'eu', name: 'Internationale regelgeving & luchtwaardigheid', prefixes: ['10.1', '10.2', '10.3'] },
    { id: 'lic', name: 'Vergunningen & medische keuring', prefixes: ['10.4', '10.5.4.3'] },
    { id: 'sera', name: 'Luchtverkeersregels (SERA) & VFR-minima', prefixes: ['10.5'] },
    { id: 'alt', name: 'Hoogtemeterprocedures & transponder', prefixes: ['10.6'] },
    { id: 'ats', name: 'Luchtverkeersdiensten & luchtruim', prefixes: ['10.7'] },
    { id: 'ais', name: 'Luchtvaartinformatie (AIP, NOTAM)', prefixes: ['10.8'] },
    { id: 'ad', name: 'Vliegvelden, markeringen & seinen', prefixes: ['10.9'] },
    { id: 'sar', name: 'Opsporing & redding, ongevallenonderzoek', prefixes: ['10.10', '10.11', '10.12'] }
  ],
  human_performance: [
    { id: 'atm', name: 'Atmosfeer, zuurstof & hypoxie', prefixes: ['20.1', '20.2.1'] },
    { id: 'senses', name: 'Zenuwstelsel, zicht, gehoor & evenwicht', prefixes: ['20.2.2'] },
    { id: 'health', name: 'Gezondheid & hygiëne', prefixes: ['20.2.3'] },
    { id: 'error', name: 'Informatieverwerking & menselijke fouten', prefixes: ['20.3.1', '20.3.2'] },
    { id: 'decision', name: 'Besluitvorming & situationeel bewustzijn', prefixes: ['20.3.3', '20.3.4'] },
    { id: 'attitude', name: 'Persoonlijkheid & gevaarlijke attitudes', prefixes: ['20.3.5'] },
    { id: 'stress', name: 'Stress & belasting', prefixes: ['20.3.6'] }
  ],
  meteorology: [
    { id: 'atm', name: 'Atmosfeer, temperatuur & druk (ISA, hoogtemeter)', prefixes: ['30.1'] },
    { id: 'wind', name: 'Wind', prefixes: ['30.2'] },
    { id: 'clouds', name: 'Vocht, wolken, mist & neerslag', prefixes: ['30.3', '30.4', '30.5'] },
    { id: 'fronts', name: "Luchtmassa's, fronten & drukgebieden", prefixes: ['30.6', '30.7', '30.8'] },
    { id: 'hazards', name: 'Vlieggevaren (ijs, turbulentie, onweer)', prefixes: ['30.9'] },
    { id: 'info', name: 'Meteo-informatie (satelliet, radar, kaarten, METAR)', prefixes: ['30.10'] }
  ],
  communications: [
    { id: 'abbr', name: 'Afkortingen & Q-codes', prefixes: ['40.1.1'] },
    { id: 'rt', name: 'Spreekprocedures & fraseologie', prefixes: ['40.1.2'] },
    { id: 'met', name: 'Weerinformatie (ATIS, VOLMET)', prefixes: ['40.1.3'] },
    { id: 'fail', name: 'Radiostoring', prefixes: ['40.1.4'] },
    { id: 'emerg', name: 'Nood- & urgentieprocedures', prefixes: ['40.1.5'] },
    { id: 'waves', name: 'Radiogolven', prefixes: ['40.1.6'] }
  ],
  principles_of_flight: [
    { id: 'aero', name: 'Aerodynamica: druk, profiel & lift', prefixes: ['51.1.1', '51.1.2', '51.1.3'] },
    { id: 'drag', name: 'Weerstand & grondeffect', prefixes: ['51.1.4', '51.1.5', '51.1.6'] },
    { id: 'stall', name: 'Overtrek, kleppen & grenslaag', prefixes: ['51.1.7', '51.1.8', '51.1.9'] },
    { id: 'stab', name: 'Stabiliteit', prefixes: ['51.2'] },
    { id: 'ctrl', name: 'Besturing & trim', prefixes: ['51.3'] },
    { id: 'misc', name: 'Belastingen, propeller & vliegmechanica', prefixes: ['51.4', '51.5', '51.6'] }
  ],
  operational_procedures: [
    { id: 'gen', name: 'Algemene vereisten, documenten & uitrusting', prefixes: ['61.1'] },
    { id: 'ops', name: 'Grond- & vluchtoperaties', prefixes: ['61.2.1', '61.2.2', '61.2.4', '61.2.8', '61.2.11'] },
    { id: 'noise', name: 'Geluidsbeperking', prefixes: ['61.2.3'] },
    { id: 'fire', name: 'Brand & rook', prefixes: ['61.2.5'] },
    { id: 'shear', name: 'Windschering', prefixes: ['61.2.6'] },
    { id: 'wake', name: 'Zogturbulentie', prefixes: ['61.2.7'] },
    { id: 'emerg', name: 'Noodlandingen & vluchten boven water', prefixes: ['61.2.9'] },
    { id: 'rwy', name: 'Besmette banen', prefixes: ['61.2.10'] }
  ],
  flight_performance: [
    { id: 'mb', name: 'Massa & balans', prefixes: ['71'] },
    { id: 'perf', name: 'Prestaties', prefixes: ['72'] },
    { id: 'charts', name: 'Kaartlezen & routevoorbereiding', prefixes: ['74.1'] },
    { id: 'fuel', name: 'Brandstof, NOTAM & vluchtvoorbereiding', prefixes: ['74.2', '74.3', '74.5'] },
    { id: 'fpl', name: 'ATS-vluchtplan', prefixes: ['74.4'] }
  ],
  aircraft_general: [
    { id: 'struct', name: 'Structuur & belastingen', prefixes: ['81.1', '81.2', '81.3'] },
    { id: 'gear', name: 'Landingsgestel & besturing', prefixes: ['81.4', '81.5', '81.6'] },
    { id: 'systems', name: 'Brandstof- & elektrisch systeem', prefixes: ['81.7', '81.8'] },
    { id: 'engine', name: 'Motor', prefixes: ['81.9', '81.10'] },
    { id: 'pitot', name: 'Pitot-statische instrumenten', prefixes: ['82.1', '82.2'] },
    { id: 'compass', name: 'Magnetisch kompas', prefixes: ['82.3'] },
    { id: 'gyro', name: 'Gyro-instrumenten & waarschuwingen', prefixes: ['82.4', '82.5', '82.6'] }
  ],
  navigation: [
    { id: 'earth', name: 'Aarde, tijd & richtingen', prefixes: ['91.1'] },
    { id: 'maps', name: 'Kaarten & peilingen', prefixes: ['91.2'] },
    { id: 'calc', name: 'Navigatieberekeningen & wind', prefixes: ['91.3'] },
    { id: 'visual', name: 'Zichtnavigatie', prefixes: ['91.4'] },
    { id: 'waves', name: 'Radiogolven', prefixes: ['92.1'] },
    { id: 'radio', name: 'Radionavigatie (VDF, ADF, VOR, DME, radar)', prefixes: ['92.2', '92.3', '92.4'] }
  ]
};

// Door AI opgestelde (en nagekeken) aanvullende vragen krijgen in elk vak een eigen categorie.
Object.keys(window.SUBJECTS).forEach(subject => {
  (window.CHAPTERS[subject] = window.CHAPTERS[subject] || []).push({ id: 'ai', name: '🤖 AI-gegenereerde vragen', prefixes: ['AI'] });
});

window.chapterOf = function (subject, lo) {
  let best = null, len = -1;
  for (const ch of (window.CHAPTERS[subject] || [])) {
    for (const p of ch.prefixes) {
      if ((lo === p || lo.startsWith(p + '.')) && p.length > len) { best = ch; len = p.length; }
    }
  }
  return best;
};

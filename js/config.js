// Configuratie van licenties, vakken, examenparameters en bronnen.
// Pas hier het aantal vragen / de examentijd aan als de BCAA/DGLV iets wijzigt.

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
    examRef: 'DGLV – ULM-theorie-examen',
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
  acc:     { org: 'EU', title: 'Verordening (EU) 996/2010 – Onderzoek van ongevallen en incidenten', url: 'https://eur-lex.europa.eu/eli/reg/2010/996/oj' },
  cs23:    { org: 'EASA', title: 'Certification Specifications CS-23', url: 'https://www.easa.europa.eu/en/document-library/easy-access-rules' },
  syl:     { org: 'EASA', title: 'Part-FCL – PPL-syllabus (AMC1 FCL.210) / ECQB-leerdoelen', url: 'https://www.easa.europa.eu/en/domains/aircrew-and-medical/european-central-question-bank-ecqb' },
  bcaa:    { org: 'BCAA / DGLV', title: 'FOD Mobiliteit – Luchtvaart', url: 'https://mobilit.belgium.be/nl/luchtvaart' },
  bcaa_ppl:{ org: 'BCAA / DGLV', title: 'Theorie-examen vliegtuigen en helikopters', url: 'https://mobilit.belgium.be/nl/luchtvaart/vliegen-met/vliegtuigen-helikopters/piloot/examens' },
  bcaa_ulm:{ org: 'DGLV', title: 'ULM – examens', url: 'https://mobilit.belgium.be/nl/luchtvaart/vliegen-met/ultralichte-motorluchtvaartuigen-ulm/piloot/examens' },
  aip:     { org: 'skeyes / BCAA', title: 'AIP België & Luxemburg', url: 'https://ops.skeyes.be/services-aip' }
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

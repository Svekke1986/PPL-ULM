/* Navigatiedatabase voor de trainer: vereenvoudigd, bij benadering en NIET voor echte navigatie.
   Gebied: Limburg (EBZH Hasselt-Kiewit) en de ruime omgeving (België, Zuid-Nederland, grensstreek Duitsland). */
window.G3X = window.G3X || {};
(function () {
  const U = G3X.util;
  const A = (id, name, lat, lon, elev, rwys, freqs, kind = 'civil') => ({ id, name, lat, lon, elev, rwys, freqs, kind, type: 'APT' });
  const RW = (id, hdg, len, surf = 'ASPH', extra = {}) => Object.assign({ id, hdg, len, surf }, extra);
  const F = (type, freq) => ({ type, freq });

  // Luchthavens / vliegvelden. rwy-id = beide banen ("06/24"), hdg = magnetische richting van de eerste.
  const AIRPORTS = [
    A('EBZH', 'Hasselt-Kiewit', 50.9700, 5.3750, 141, [RW('06/24', 60, 800, 'ASPH'), RW('06G/24G', 60, 600, 'GRAS')], [F('RADIO', 118.955), F('ATIS', 0)], 'civil'),
    A('EBZW', 'Genk-Zwartberg', 51.0153, 5.5264, 285, [RW('04/22', 40, 800, 'ASPH')], [F('RADIO', 122.705)]),
    A('EBST', 'Sint-Truiden Brustem', 50.7917, 5.2017, 246, [RW('06/24', 60, 1200, 'ASPH')], [F('RADIO', 118.555)]),
    A('EBDT', 'Diest-Schaffen', 51.0000, 5.0656, 115, [RW('07/25', 70, 700, 'GRAS')], [F('RADIO', 119.605)]),
    A('EBKH', 'Balen-Keiheuvel', 51.1808, 5.2217, 125, [RW('04/22', 40, 700, 'GRAS')], [F('RADIO', 123.355)]),
    A('EBLE', 'Leopoldsburg-Beverlo', 51.1203, 5.3072, 207, [RW('05/23', 50, 650, 'GRAS')], [F('RADIO', 123.505)]),
    A('EBTN', 'Goetsenhoven', 50.7817, 4.9583, 246, [RW('05/23', 50, 800, 'GRAS')], [F('RADIO', 122.955)]),
    A('EBAV', 'Avernas', 50.7333, 5.0833, 400, [RW('08/26', 80, 500, 'GRAS')], [F('RADIO', 123.405)]),
    A('EBBL', 'Kleine-Brogel (MIL)', 51.1683, 5.4700, 210, [RW('05/23', 50, 3000, 'ASPH')], [F('TWR', 122.105), F('APP', 124.675)], 'mil'),
    A('EBBE', 'Beauvechain (MIL)', 50.7586, 4.7683, 370, [RW('04L/22R', 40, 3000), RW('04R/22L', 40, 2500)], [F('TWR', 122.105), F('APP', 129.825)], 'mil'),
    A('EBLG', 'Liège', 50.6374, 5.4432, 659, [RW('04R/22L', 40, 3690, 'ASPH', { ils: { '22L': 110.30, '04R': 109.75 } }), RW('04L/22R', 40, 2340)], [F('ATIS', 128.955), F('TWR', 118.955), F('APP', 129.305)], 'intl'),
    A('EBBR', 'Brussels', 50.9014, 4.4844, 184, [RW('07L/25R', 70, 3638, 'ASPH', { ils: { '25R': 110.30, '07L': 111.50 } }), RW('07R/25L', 70, 3211, 'ASPH', { ils: { '25L': 110.95 } }), RW('01/19', 10, 2984)], [F('ATIS', 132.475), F('TWR', 118.605), F('APP', 118.255)], 'intl'),
    A('EBAW', 'Antwerpen-Deurne', 51.1894, 4.4603, 39, [RW('11/29', 110, 1510, 'ASPH', { ils: { '29': 109.90 } })], [F('ATIS', 124.705), F('TWR', 121.855), F('APP', 118.255)], 'intl'),
    A('EBCI', 'Charleroi', 50.4592, 4.4538, 614, [RW('06/24', 60, 3200, 'ASPH', { ils: { '24': 110.10, '06': 109.30 } })], [F('ATIS', 126.805), F('TWR', 120.605), F('APP', 133.655)], 'intl'),
    A('EBKT', 'Kortrijk-Wevelgem', 50.8172, 3.2047, 64, [RW('06/24', 60, 1900, 'ASPH', { ils: { '06': 108.70 } })], [F('TWR', 120.755), F('ATIS', 125.605)], 'intl'),
    A('EBOS', 'Oostende-Brugge', 51.1989, 2.8622, 13, [RW('08/26', 80, 3200, 'ASPH', { ils: { '26': 109.50, '08': 110.70 } })], [F('ATIS', 127.805), F('TWR', 118.155), F('APP', 120.605)], 'intl'),
    A('EBGB', 'Grimbergen', 50.9000, 4.3914, 60, [RW('01/19', 10, 600, 'GRAS'), RW('07/25', 70, 700, 'GRAS')], [F('RADIO', 120.605)]),
    A('EBNM', 'Namur-Suarlée', 50.4878, 4.7689, 594, [RW('06/24', 60, 700, 'GRAS')], [F('RADIO', 122.505)]),
    A('EBSP', 'Spa-La Sauvenière', 50.4825, 5.9103, 1565, [RW('05/23', 50, 1000, 'ASPH')], [F('RADIO', 118.705)]),
    A('EBTX', 'Verviers-Theux', 50.5531, 5.8550, 1099, [RW('06/24', 60, 650, 'GRAS')], [F('RADIO', 122.605)]),
    A('EBSH', 'Saint-Hubert', 50.0361, 5.4042, 1930, [RW('05/23', 50, 1200, 'ASPH')], [F('RADIO', 123.205)]),
    A('EBNR', 'Noordwijk? (fictief)', 51.2600, 4.8800, 80, [RW('08/26', 80, 500, 'GRAS')], [F('RADIO', 123.005)], 'ulm'),
    A('EBMB', 'Maubray', 50.5150, 3.4983, 128, [RW('07/25', 70, 650, 'GRAS')], [F('RADIO', 123.655)]),
    A('EBWE', 'Weelde (MIL)', 51.3947, 4.9603, 105, [RW('07/25', 70, 2000)], [F('RADIO', 122.855)], 'mil'),
    A('EBHN', 'Hoevenen', 51.3072, 4.3878, 7, [RW('02/20', 20, 450, 'GRAS')], [F('RADIO', 123.255)]),
    A('EBUL', 'Ursel', 51.1442, 3.4756, 95, [RW('07/25', 70, 2400)], [F('RADIO', 120.205)]),
    A('EBMO', 'Moorsele', 50.8542, 3.1461, 66, [RW('06/24', 60, 600, 'GRAS')], [F('RADIO', 122.855)]),
    A('EBCF', 'Cerfontaine', 50.1522, 4.3872, 950, [RW('07/25', 70, 1000)], [F('RADIO', 123.155)]),
    A('EBAM', 'Amougies', 50.7403, 3.4847, 50, [RW('04/22', 40, 700, 'GRAS')], [F('RADIO', 123.555)]),
    A('EBSG', 'Saint-Ghislain', 50.4592, 3.8203, 131, [RW('07/25', 70, 600, 'GRAS')], [F('RADIO', 123.655)]),
    A('EHBK', 'Maastricht-Aachen', 50.9117, 5.7700, 375, [RW('03/21', 30, 2750, 'ASPH', { ils: { '21': 109.55, '03': 110.75 } })], [F('ATIS', 124.580), F('TWR', 119.475), F('APP', 123.855)], 'intl'),
    A('EHBD', 'Budel-Kempen', 51.2553, 5.6014, 114, [RW('03/21', 30, 1199, 'ASPH')], [F('RADIO', 122.605)]),
    A('EHEH', 'Eindhoven', 51.4500, 5.3744, 74, [RW('03/21', 30, 3000, 'ASPH', { ils: { '21': 109.75, '03': 110.90 } })], [F('ATIS', 131.955), F('TWR', 131.005), F('APP', 123.105)], 'mil'),
    A('EHSE', 'Seppe', 51.5547, 4.5525, 30, [RW('07/25', 70, 830)], [F('RADIO', 121.830)]),
    A('EHWO', 'Woensdrecht (MIL)', 51.4492, 4.3420, 63, [RW('07/25', 70, 2440)], [F('TWR', 128.355)], 'mil'),
    A('EHVK', 'Volkel (MIL)', 51.6564, 5.7086, 72, [RW('06/24', 60, 3000)], [F('TWR', 123.055)], 'mil'),
    A('EDLN', 'Mönchengladbach', 51.2303, 6.5044, 125, [RW('13/31', 130, 1200, 'ASPH', { ils: { '31': 109.35 } })], [F('TWR', 120.655), F('ATIS', 127.080)], 'intl'),
    A('EDKA', 'Aachen-Merzbrück', 50.8231, 6.1864, 623, [RW('07/25', 70, 520)], [F('INFO', 122.880)]),
    A('EDKZ', 'Meinerzhagen', 51.0997, 7.6000, 1549, [RW('07/25', 70, 1000)], [F('INFO', 122.105)]),
    A('EDLE', 'Essen-Mülheim', 51.4023, 6.9373, 424, [RW('07/25', 70, 1553)], [F('INFO', 119.830)]),
    A('EDLW', 'Dortmund', 51.5183, 7.6122, 425, [RW('06/24', 60, 2000, 'ASPH', { ils: { '24': 110.50 } })], [F('TWR', 118.405)], 'intl'),
    A('EDDK', 'Köln-Bonn', 50.8659, 7.1427, 302, [RW('14L/32R', 140, 3815, 'ASPH', { ils: { '14L': 110.90 } }), RW('06/24', 60, 2459)], [F('TWR', 124.980), F('ATIS', 125.030)], 'intl'),
    A('ELLX', 'Luxembourg', 49.6233, 6.2044, 1234, [RW('06/24', 60, 4000, 'ASPH', { ils: { '24': 110.10, '06': 110.70 } })], [F('TWR', 118.105), F('ATIS', 135.580)], 'intl'),
    A('EHRD', 'Rotterdam', 51.9569, 4.4372, -14, [RW('06/24', 60, 2200, 'ASPH', { ils: { '24': 110.90 } })], [F('TWR', 118.205), F('ATIS', 110.400)], 'intl'),
    A('EHGR', 'Gilze-Rijen (MIL)', 51.5675, 4.9319, 49, [RW('10/28', 100, 3000)], [F('TWR', 130.080)], 'mil'),
    A('EBFN', 'Koksijde (MIL)', 51.0903, 2.6528, 20, [RW('10/28', 100, 2400)], [F('TWR', 122.105)], 'mil'),
    A('EBCV', 'Chièvres (MIL)', 50.5758, 3.8311, 194, [RW('08/26', 80, 2900)], [F('TWR', 122.105)], 'mil'),
    A('EBFS', 'Florennes (MIL)', 50.2433, 4.6458, 935, [RW('08L/26R', 80, 3000)], [F('TWR', 122.105)], 'mil'),
    A('EBZR', 'Oostmalle-Zoersel', 51.2647, 4.7533, 35, [RW('07/25', 70, 1000, 'ASPH')], [F('RADIO', 118.105)]),
    A('EBSU', 'Saint-Hubert (ULM, fictief)', 50.08, 5.52, 1850, [RW('09/27', 90, 400, 'GRAS')], [F('RADIO', 123.405)], 'ulm'),
    A('EBHW', 'Hasselt-Wimmertingen (ULM, fictief)', 50.9020, 5.3100, 130, [RW('09/27', 90, 350, 'GRAS')], [F('RADIO', 123.405)], 'ulm'),
    A('EBOO', 'Opglabbeek (ULM, fictief)', 51.0450, 5.5900, 250, [RW('12/30', 120, 400, 'GRAS')], [F('RADIO', 123.405)], 'ulm'),
    A('EBBT', 'Brasschaat (MIL/heli)', 51.3403, 4.5056, 76, [RW('07/25', 70, 900, 'GRAS')], [F('RADIO', 122.555)], 'mil'),
  ].filter(a => a.id !== 'EBNR');

  // VOR/DME en NDB (frequenties bij benadering)
  const NAVAIDS = [
    { id: 'BUB', name: 'Brussels', type: 'VOR', freq: 114.60, lat: 50.9028, lon: 4.5383, dme: true },
    { id: 'AFI', name: 'Affligem', type: 'VOR', freq: 114.90, lat: 50.9064, lon: 4.1172, dme: true },
    { id: 'HUL', name: 'Huldenberg', type: 'VOR', freq: 117.55, lat: 50.7506, lon: 4.6425, dme: true },
    { id: 'NIK', name: 'Nicky', type: 'VOR', freq: 117.40, lat: 51.1650, lon: 4.1886, dme: true },
    { id: 'CIV', name: 'Chièvres', type: 'VOR', freq: 113.20, lat: 50.5681, lon: 3.8183, dme: true },
    { id: 'SPI', name: 'Sprimont', type: 'VOR', freq: 113.10, lat: 50.5147, lon: 5.6236, dme: true },
    { id: 'FLO', name: 'Florennes', type: 'VOR', freq: 115.70, lat: 50.2381, lon: 4.6594, dme: true },
    { id: 'KOK', name: 'Koksy', type: 'VOR', freq: 114.50, lat: 51.0944, lon: 2.6525, dme: true },
    { id: 'COA', name: 'Costa', type: 'VOR', freq: 110.05, lat: 51.3536, lon: 3.3511, dme: true },
    { id: 'GSY', name: 'Gosly', type: 'VOR', freq: 109.80, lat: 50.0392, lon: 4.7714, dme: true },
    { id: 'LNO', name: 'Lenno', type: 'VOR', freq: 116.30, lat: 50.5872, lon: 5.0633, dme: true },
    { id: 'OLNO', name: 'Olno', type: 'VOR', freq: 112.10, lat: 50.5939, lon: 5.6500, dme: true },
    { id: 'MAK', name: 'Maastricht', type: 'VOR', freq: 116.95, lat: 50.9050, lon: 5.7850, dme: true },
    { id: 'NVO', name: 'Nörvenich', type: 'VOR', freq: 115.20, lat: 50.8319, lon: 6.6642, dme: true },
    { id: 'EHV', name: 'Eindhoven', type: 'VOR', freq: 112.20, lat: 51.4528, lon: 5.3744, dme: true },
    { id: 'WDT', name: 'Woensdrecht', type: 'VOR', freq: 113.65, lat: 51.4486, lon: 4.3419, dme: true },
    { id: 'DIK', name: 'Diekirch', type: 'VOR', freq: 114.40, lat: 49.8625, lon: 6.1283, dme: true },
    { id: 'LUX', name: 'Luxembourg', type: 'VOR', freq: 112.25, lat: 49.6353, lon: 6.1714, dme: true },
    { id: 'RKN', name: 'Rekken', type: 'VOR', freq: 116.80, lat: 52.1331, lon: 6.7631, dme: true },
    { id: 'ONW', name: 'Oostende NDB (fictief)', type: 'NDB', freq: 399.5, lat: 51.2178, lon: 2.7800 },
    { id: 'HSL', name: 'Hasselt NDB (fictief)', type: 'NDB', freq: 352.0, lat: 50.9600, lon: 5.4200 },
    { id: 'LGE', name: 'Liège NDB', type: 'NDB', freq: 353.5, lat: 50.6600, lon: 5.4000 },
    { id: 'ANT', name: 'Antwerpen NDB', type: 'NDB', freq: 374.5, lat: 51.2000, lon: 4.3600 },
    { id: 'BRU', name: 'Brussels NDB', type: 'NDB', freq: 338.5, lat: 50.9300, lon: 4.6100 },
    { id: 'GLO', name: 'Gilze NDB', type: 'NDB', freq: 397.0, lat: 51.5700, lon: 5.0400 },
    { id: 'EHM', name: 'Maastricht NDB', type: 'NDB', freq: 331.0, lat: 50.8800, lon: 5.7300 },
  ];

  // VFR-meldpunten en intersecties (voornamelijk rond EBZH; fictief maar realistisch opgebouwd)
  const WAYPOINTS = [
    { id: 'HASSE', name: 'Hasselt centrum', type: 'VRP', lat: 50.9307, lon: 5.3378 },
    { id: 'GENKC', name: 'Genk centrum', type: 'VRP', lat: 50.9650, lon: 5.5000 },
    { id: 'TONGE', name: 'Tongeren', type: 'VRP', lat: 50.7806, lon: 5.4642 },
    { id: 'DIEPE', name: 'Diepenbeek', type: 'VRP', lat: 50.9089, lon: 5.4194 },
    { id: 'ALKAN', name: 'Albertkanaal brug Kuringen', type: 'VRP', lat: 50.9500, lon: 5.2950 },
    { id: 'HERKS', name: 'Herk-de-Stad', type: 'VRP', lat: 50.9400, lon: 5.1650 },
    { id: 'BERIN', name: 'Beringen', type: 'VRP', lat: 51.0450, lon: 5.2250 },
    { id: 'MAASE', name: 'Maaseik', type: 'VRP', lat: 51.0950, lon: 5.7900 },
    { id: 'LANAK', name: 'Lanaken', type: 'VRP', lat: 50.8900, lon: 5.6500 },
    { id: 'BILZE', name: 'Bilzen', type: 'VRP', lat: 50.8730, lon: 5.5180 },
    { id: 'LEUVN', name: 'Leuven', type: 'VRP', lat: 50.8790, lon: 4.7010 },
    { id: 'TIENE', name: 'Tienen', type: 'VRP', lat: 50.8070, lon: 4.9370 },
    { id: 'TURNH', name: 'Turnhout', type: 'VRP', lat: 51.3220, lon: 4.9450 },
    { id: 'MOLKE', name: 'Mol', type: 'VRP', lat: 51.1900, lon: 5.1150 },
    { id: 'LOMME', name: 'Lommel', type: 'VRP', lat: 51.2300, lon: 5.3130 },
    { id: 'PEERW', name: 'Peer', type: 'VRP', lat: 51.1300, lon: 5.4600 },
    { id: 'BREEE', name: 'Bree', type: 'VRP', lat: 51.1400, lon: 5.6000 },
    { id: 'MECHE', name: 'Mechelen', type: 'VRP', lat: 51.0260, lon: 4.4780 },
    { id: 'AARSC', name: 'Aarschot', type: 'VRP', lat: 50.9840, lon: 4.8370 },
    { id: 'VISEE', name: 'Visé', type: 'VRP', lat: 50.7370, lon: 5.6990 },
    { id: 'HUYYY', name: 'Huy', type: 'VRP', lat: 50.5190, lon: 5.2400 },
    { id: 'WAREM', name: 'Waremme', type: 'VRP', lat: 50.6960, lon: 5.2560 },
    { id: 'NOV', name: 'November (EBBR VRP)', type: 'VRP', lat: 51.0200, lon: 4.5200 },
    { id: 'WHISK', name: 'Whiskey (EBLG VRP)', type: 'VRP', lat: 50.6500, lon: 5.2200 },
    { id: 'ECHO', name: 'Echo (EBLG VRP)', type: 'VRP', lat: 50.6450, lon: 5.6700 },
    { id: 'SIERA', name: 'Sierra (EBAW VRP)', type: 'VRP', lat: 51.0900, lon: 4.4500 },
    { id: 'KOKSI', name: 'Koksijde kust', type: 'VRP', lat: 51.1200, lon: 2.6700 },
    { id: 'MAKOP', name: 'intersectie', type: 'INT', lat: 50.8000, lon: 5.0000 },
    { id: 'DENUT', name: 'intersectie', type: 'INT', lat: 51.1200, lon: 4.8500 },
    { id: 'RIVER', name: 'Maas bij Maasmechelen', type: 'VRP', lat: 50.9650, lon: 5.7000 },
  ];

  // Luchtruimen (vereenvoudigd). type: CTR/TMA/R/P/D; shape circle {c, r(nm)} of poly [[lat,lon]...]
  const AIRSPACES = [
    { id: 'EBBL-CTR', name: 'KLEINE-BROGEL CTR', cls: 'D', type: 'CTR', floor: 0, ceil: 2500, shape: { circle: { lat: 51.1683, lon: 5.4700 }, r: 8 }, freq: 122.105 },
    { id: 'EBBL-TMA', name: 'KLEINE-BROGEL TMA', cls: 'D', type: 'TMA', floor: 2500, ceil: 4500, shape: { circle: { lat: 51.1683, lon: 5.4700 }, r: 15 } },
    { id: 'EBLG-CTR', name: 'LIÈGE CTR', cls: 'D', type: 'CTR', floor: 0, ceil: 2500, shape: { poly: [[50.78, 5.25], [50.78, 5.65], [50.50, 5.65], [50.50, 5.25]] }, freq: 118.955 },
    { id: 'EBLG-TMA1', name: 'LIÈGE TMA 1', cls: 'D', type: 'TMA', floor: 2500, ceil: 4500, shape: { poly: [[50.90, 5.05], [50.90, 5.85], [50.40, 5.85], [50.40, 5.05]] } },
    { id: 'EBBR-CTR', name: 'BRUSSELS CTR', cls: 'C', type: 'CTR', floor: 0, ceil: 1500, shape: { poly: [[51.02, 4.28], [51.02, 4.70], [50.78, 4.70], [50.78, 4.28]] }, freq: 118.605 },
    { id: 'EBBR-TMA1', name: 'BRUSSELS TMA 1', cls: 'C', type: 'TMA', floor: 1500, ceil: 4500, shape: { poly: [[51.15, 4.00], [51.15, 5.05], [50.60, 5.05], [50.60, 4.00]] } },
    { id: 'EBBR-TMA2', name: 'BRUSSELS TMA 2', cls: 'C', type: 'TMA', floor: 2500, ceil: 4500, shape: { poly: [[51.30, 3.80], [51.30, 5.30], [50.45, 5.30], [50.45, 3.80]] } },
    { id: 'EBBE-CTR', name: 'BEAUVECHAIN CTR', cls: 'D', type: 'CTR', floor: 0, ceil: 2500, shape: { circle: { lat: 50.7586, lon: 4.7683 }, r: 7 }, freq: 122.105 },
    { id: 'EBAW-CTR', name: 'ANTWERPEN CTR', cls: 'D', type: 'CTR', floor: 0, ceil: 1500, shape: { circle: { lat: 51.1894, lon: 4.4603 }, r: 7 }, freq: 121.855 },
    { id: 'EBCI-CTR', name: 'CHARLEROI CTR', cls: 'D', type: 'CTR', floor: 0, ceil: 2500, shape: { circle: { lat: 50.4592, lon: 4.4538 }, r: 8 }, freq: 120.605 },
    { id: 'EHBK-CTR', name: 'MAASTRICHT CTR', cls: 'D', type: 'CTR', floor: 0, ceil: 3000, shape: { circle: { lat: 50.9117, lon: 5.7700 }, r: 7 }, freq: 119.475 },
    { id: 'EHBK-TMA', name: 'MAASTRICHT TMA', cls: 'E', type: 'TMA', floor: 1500, ceil: 4500, shape: { circle: { lat: 50.9117, lon: 5.7700 }, r: 14 } },
    { id: 'EHEH-CTR', name: 'EINDHOVEN CTR', cls: 'D', type: 'CTR', floor: 0, ceil: 3000, shape: { circle: { lat: 51.4500, lon: 5.3744 }, r: 8 }, freq: 131.005 },
    { id: 'EHBD-ATZ', name: 'BUDEL ATZ', cls: 'G', type: 'ATZ', floor: 0, ceil: 1500, shape: { circle: { lat: 51.2553, lon: 5.6014 }, r: 2.5 } },
    { id: 'EBST-ATZ', name: 'SINT-TRUIDEN ATZ', cls: 'G', type: 'ATZ', floor: 0, ceil: 1500, shape: { circle: { lat: 50.7917, lon: 5.2017 }, r: 2.5 } },
    { id: 'EBZH-ATZ', name: 'HASSELT ATZ', cls: 'G', type: 'ATZ', floor: 0, ceil: 1500, shape: { circle: { lat: 50.9700, lon: 5.3750 }, r: 2 } },
    { id: 'EB-R24', name: 'EB R24 LEOPOLDSBURG (schietterrein)', cls: 'R', type: 'R', floor: 0, ceil: 3500, shape: { poly: [[51.16, 5.22], [51.16, 5.36], [51.09, 5.36], [51.09, 5.22]] } },
    { id: 'EB-R34', name: 'EB R34 ELSENBORN', cls: 'R', type: 'R', floor: 0, ceil: 6000, shape: { poly: [[50.50, 6.15], [50.50, 6.40], [50.38, 6.40], [50.38, 6.15]] } },
    { id: 'EB-P10', name: 'EB P10 DOEL (kerncentrale)', cls: 'P', type: 'P', floor: 0, ceil: 2000, shape: { circle: { lat: 51.3250, lon: 4.2600 }, r: 1.5 } },
    { id: 'EB-P12', name: 'EB P12 TIHANGE (kerncentrale)', cls: 'P', type: 'P', floor: 0, ceil: 2000, shape: { circle: { lat: 50.5342, lon: 5.2733 }, r: 1.5 } },
    { id: 'EB-D29', name: 'EB D29 HELCHTEREN (schietterrein)', cls: 'D', type: 'D', floor: 0, ceil: 4500, shape: { poly: [[51.11, 5.33], [51.11, 5.45], [51.03, 5.45], [51.03, 5.33]] } },
    { id: 'EBLG-NORTH', name: 'LIÈGE TMA 3 (noord)', cls: 'D', type: 'TMA', floor: 3500, ceil: 4500, shape: { poly: [[51.05, 5.05], [51.05, 5.85], [50.90, 5.85], [50.90, 5.05]] } },
  ];

  // Naderingen (RNP/ILS) — vereenvoudigde legs. alt = minimale/verwachte hoogte in ft.
  const wp = (id, lat, lon, alt, extra = {}) => Object.assign({ id, lat, lon, alt }, extra);
  const APPROACHES = {
    EBLG: [
      { name: 'ILS 22L', type: 'ILS', rwy: '22L', freq: 110.30, finalCrs: 224, transitions: ['LGE', 'ECHO', 'VECTORS'],
        legs: [wp('LGE', 50.6600, 5.4000, 3000, { iaf: true }), wp('LG22I', 50.7550, 5.6450, 3000, { iaf: true }), wp('LG22F', 50.7050, 5.5600, 2500, { faf: true }), wp('RW22L', 50.6480, 5.4650, 709, { map: true, thr: true })],
        missed: [wp('LGMA1', 50.5900, 5.3700, 1500), wp('SPI', 50.5147, 5.6236, 3000, { hold: true })] },
      { name: 'RNP 04R', type: 'RNP', rwy: '04R', finalCrs: 44, transitions: ['WHISK', 'VECTORS'],
        legs: [wp('WHISK', 50.6500, 5.2200, 3000, { iaf: true }), wp('LG04F', 50.5750, 5.3350, 2000, { faf: true }), wp('RW04R', 50.6260, 5.4220, 709, { map: true, thr: true })],
        missed: [wp('LGMA2', 50.7100, 5.5500, 2500), wp('LGE', 50.6600, 5.4000, 3000, { hold: true })] },
    ],
    EBAW: [
      { name: 'RNP 29', type: 'RNP', rwy: '29', finalCrs: 294, transitions: ['SIERA', 'DENUT', 'VECTORS'],
        legs: [wp('SIERA', 51.0900, 4.4500, 2000, { iaf: true }), wp('DENUT', 51.1200, 4.8500, 2500, { iaf: true }), wp('AW29F', 51.1550, 4.6050, 1600, { faf: true }), wp('RW29', 51.1860, 4.4780, 89, { map: true, thr: true })],
        missed: [wp('AWMA1', 51.2300, 4.3500, 1500), wp('NIK', 51.1650, 4.1886, 2000, { hold: true })] },
      { name: 'ILS 29', type: 'ILS', rwy: '29', freq: 109.90, finalCrs: 294, transitions: ['DENUT', 'VECTORS'],
        legs: [wp('DENUT', 51.1200, 4.8500, 2500, { iaf: true }), wp('AW29F', 51.1550, 4.6050, 1600, { faf: true }), wp('RW29', 51.1860, 4.4780, 89, { map: true, thr: true })],
        missed: [wp('AWMA1', 51.2300, 4.3500, 1500), wp('NIK', 51.1650, 4.1886, 2000, { hold: true })] },
    ],
    EBOS: [
      { name: 'RNP 26', type: 'RNP', rwy: '26', finalCrs: 264, transitions: ['COA', 'VECTORS'],
        legs: [wp('COA', 51.3536, 3.3511, 3000, { iaf: true }), wp('OS26F', 51.2080, 3.0300, 1800, { faf: true }), wp('RW26', 51.1990, 2.8900, 63, { map: true, thr: true })],
        missed: [wp('OSMA1', 51.1900, 2.7000, 1500), wp('KOK', 51.0944, 2.6525, 2500, { hold: true })] },
    ],
    EBKT: [
      { name: 'RNP 24', type: 'RNP', rwy: '24', finalCrs: 244, transitions: ['AMOUG', 'VECTORS'],
        legs: [wp('AMOUG', 50.9100, 3.4000, 2500, { iaf: true }), wp('KT24F', 50.8580, 3.3180, 1700, { faf: true }), wp('RW24', 50.8210, 3.2180, 114, { map: true, thr: true })],
        missed: [wp('KTMA1', 50.7800, 3.1000, 1500), wp('CIV', 50.5681, 3.8183, 3000, { hold: true })] },
    ],
    EBCI: [
      { name: 'ILS 24', type: 'ILS', rwy: '24', freq: 110.10, finalCrs: 244, transitions: ['HUL', 'VECTORS'],
        legs: [wp('HUL', 50.7506, 4.6425, 3000, { iaf: true }), wp('CI24F', 50.5100, 4.5900, 2600, { faf: true }), wp('RW24', 50.4650, 4.4750, 664, { map: true, thr: true })],
        missed: [wp('CIMA1', 50.4200, 4.3600, 2000), wp('FLO', 50.2381, 4.6594, 3000, { hold: true })] },
    ],
    EHBK: [
      { name: 'ILS 21', type: 'ILS', rwy: '21', freq: 109.55, finalCrs: 211, transitions: ['EHM', 'VECTORS'],
        legs: [wp('EHM', 50.8800, 5.7300, 3000, { iaf: true }), wp('BK21F', 51.0000, 5.8500, 2500, { faf: true }), wp('RW21', 50.9220, 5.7800, 425, { map: true, thr: true })],
        missed: [wp('BKMA1', 50.8600, 5.7300, 2000), wp('MAK', 50.9050, 5.7850, 3000, { hold: true })] },
      { name: 'RNP 03', type: 'RNP', rwy: '03', finalCrs: 31, transitions: ['LANAK', 'VECTORS'],
        legs: [wp('LANAK', 50.8900, 5.6500, 3000, { iaf: true }), wp('BK03F', 50.8300, 5.6950, 2300, { faf: true }), wp('RW03', 50.9010, 5.7620, 425, { map: true, thr: true })],
        missed: [wp('BKMA2', 50.9800, 5.8200, 2500), wp('MAK', 50.9050, 5.7850, 3000, { hold: true })] },
    ],
    EBST: [
      { name: 'RNP 24 (training)', type: 'RNP', rwy: '24', finalCrs: 244, transitions: ['WAREM', 'VECTORS'],
        legs: [wp('WAREM', 50.6960, 5.2560, 2500, { iaf: true }), wp('ST24F', 50.8250, 5.2850, 1700, { faf: true }), wp('RW24', 50.7950, 5.2120, 296, { map: true, thr: true })],
        missed: [wp('STMA1', 50.7600, 5.1200, 1500), wp('LNO', 50.5872, 5.0633, 2500, { hold: true })] },
    ],
    EBZH: [
      { name: 'RNP 24 (training)', type: 'RNP', rwy: '24', finalCrs: 244, transitions: ['LANAK', 'VECTORS'],
        legs: [wp('LANAK', 50.8900, 5.6500, 2500, { iaf: true }), wp('ZH24F', 50.9980, 5.4450, 1500, { faf: true }), wp('RW24', 50.9720, 5.3810, 191, { map: true, thr: true })],
        missed: [wp('ZHMA1', 50.9450, 5.3100, 1200), wp('HSL', 50.9600, 5.4200, 2000, { hold: true })] },
      { name: 'RNP 06 (training)', type: 'RNP', rwy: '06', finalCrs: 64, transitions: ['HERKS', 'VECTORS'],
        legs: [wp('HERKS', 50.9400, 5.1650, 2500, { iaf: true }), wp('ZH06F', 50.9420, 5.3060, 1500, { faf: true }), wp('RW06', 50.9680, 5.3690, 191, { map: true, thr: true })],
        missed: [wp('ZHMA2', 50.9950, 5.4400, 1200), wp('HSL', 50.9600, 5.4200, 2000, { hold: true })] },
    ],
  };

  // Steden, water en wegen voor de kaart (bij benadering)
  const CITIES = [
    ['Hasselt', 50.9307, 5.3378, 1], ['Genk', 50.9650, 5.5000, 1], ['Leuven', 50.8790, 4.7010, 1], ['Brussel', 50.8503, 4.3517, 2],
    ['Antwerpen', 51.2194, 4.4025, 2], ['Luik', 50.6326, 5.5797, 2], ['Maastricht', 50.8514, 5.6910, 1], ['Eindhoven', 51.4416, 5.4697, 2],
    ['Tongeren', 50.7806, 5.4642, 0], ['Sint-Truiden', 50.8170, 5.1860, 0], ['Mechelen', 51.0260, 4.4780, 1], ['Aken', 50.7753, 6.0839, 1],
    ['Namen', 50.4674, 4.8720, 1], ['Charleroi', 50.4108, 4.4446, 1], ['Gent', 51.0543, 3.7174, 2], ['Brugge', 51.2093, 3.2247, 1],
    ['Kortrijk', 50.8280, 3.2649, 1], ['Turnhout', 51.3220, 4.9450, 0], ['Mol', 51.1900, 5.1150, 0], ['Lommel', 51.2300, 5.3130, 0],
    ['Maaseik', 51.0950, 5.7900, 0], ['Beringen', 51.0450, 5.2250, 0], ['Diest', 50.9870, 5.0500, 0], ['Tienen', 50.8070, 4.9370, 0],
    ['Roermond', 51.1940, 5.9870, 0], ['Weert', 51.2510, 5.7060, 0], ['Venlo', 51.3704, 6.1724, 1], ['Mönchengladbach', 51.1805, 6.4428, 1],
    ['Düsseldorf', 51.2277, 6.7735, 2], ['Keulen', 50.9375, 6.9603, 2], ['Spa', 50.4925, 5.8640, 0], ['Verviers', 50.5890, 5.8640, 0],
    ['Huy', 50.5190, 5.2400, 0], ['Bastogne', 50.0040, 5.7190, 0], ['Luxemburg', 49.6116, 6.1319, 2], ['Oostende', 51.2154, 2.9286, 1],
    ['Tilburg', 51.5555, 5.0913, 1], ['Breda', 51.5719, 4.7683, 1], ['Rotterdam', 51.9244, 4.4777, 2], ['Herentals', 51.1770, 4.8330, 0],
  ];
  const WATER = [
    { name: 'Albertkanaal', pts: [[51.2500, 4.4300], [51.1200, 4.7500], [51.0800, 5.0500], [51.0200, 5.3000], [50.9800, 5.4000], [50.9200, 5.5500], [50.8500, 5.6800], [50.6800, 5.6300]] },
    { name: 'Maas', pts: [[50.3500, 4.8700], [50.4700, 4.8700], [50.5200, 5.2400], [50.6300, 5.5600], [50.7400, 5.7000], [50.8500, 5.6900], [50.9600, 5.7300], [51.1000, 5.8000], [51.2000, 5.9900], [51.3700, 6.1700], [51.6000, 6.0000], [51.8000, 5.9000]] },
    { name: 'Schelde', pts: [[50.9900, 3.9000], [51.0500, 4.0500], [51.1500, 4.2500], [51.2300, 4.4000], [51.3300, 4.2500], [51.4000, 4.0500]] },
    { name: 'Demer', pts: [[50.9300, 5.3900], [50.9400, 5.2500], [50.9800, 5.0500], [50.9700, 4.8500], [51.0000, 4.6500]] },
    { name: 'Zuid-Willemsvaart', pts: [[50.8500, 5.6900], [51.0300, 5.6200], [51.2100, 5.6700], [51.3500, 5.5500]] },
  ];
  const COAST = [[51.0900, 2.5400], [51.1500, 2.7300], [51.2300, 2.9500], [51.3300, 3.1500], [51.3700, 3.3800], [51.4500, 3.6000], [51.5500, 3.9000], [51.6000, 4.1000]];

  // Terrein (ft) bij benadering: Vlaanderen laag, Kempen licht, Ardennen hoog in het zuidoosten.
  function terrainFt(lat, lon) {
    const dx = lon - 4.5, dy = lat - 50.5;
    let h = 50 + Math.max(0, (4.9 - lat) * 900) + Math.max(0, (lon - 5.0) * 120 * Math.max(0, 51.2 - lat));
    // Ardennen-kern rond 50.3N 6.0E
    const d = Math.hypot((lon - 6.0) * 0.65, lat - 50.25);
    h += 2000 * Math.exp(-(d * d) / 0.13);
    // Haspengouw / Kempen golving
    h += 60 * Math.sin(lon * 11) * Math.cos(lat * 13) + 40 * Math.sin((lon + lat) * 7);
    // Eifel (Duitsland)
    const d2 = Math.hypot((lon - 6.6) * 0.65, lat - 50.4);
    h += 1200 * Math.exp(-(d2 * d2) / 0.2);
    // Condroz plateau
    h += 500 * Math.exp(-(Math.hypot((lon - 5.1) * 0.65, lat - 50.4) ** 2) / 0.08);
    if (lat > 51.0 && lon < 4.6) h -= 30; // polders
    void dx; void dy;
    return Math.max(0, h);
  }

  // obstakels (fictief maar typisch): masten/windturbines rond EBZH
  const OBSTACLES = [
    { id: 'OBS1', name: 'Zendmast Genk', lat: 50.9900, lon: 5.4950, agl: 420, msl: 700 },
    { id: 'OBS2', name: 'Windturbines Albertkanaal', lat: 50.9350, lon: 5.2800, agl: 500, msl: 650 },
    { id: 'OBS3', name: 'Schoorsteen Tessenderlo', lat: 51.0650, lon: 5.0900, agl: 480, msl: 600 },
    { id: 'OBS4', name: 'Mast Lanaken', lat: 50.8700, lon: 5.6600, agl: 350, msl: 550 },
    { id: 'OBS5', name: 'Koeltorens Tihange', lat: 50.5342, lon: 5.2733, agl: 500, msl: 900 },
  ];

  // ---------- opzoeken ----------
  const ALL = [];
  AIRPORTS.forEach(a => ALL.push(a));
  NAVAIDS.forEach(n => ALL.push(n));
  WAYPOINTS.forEach(w => ALL.push(w));
  Object.entries(APPROACHES).forEach(([apt, list]) => list.forEach(ap => {
    ap.apt = apt;
    [...ap.legs, ...ap.missed].forEach(l => { if (!ALL.find(x => x.id === l.id)) ALL.push(Object.assign({ type: 'INT', name: `${ap.apt} ${ap.name}`, proc: true }, l)); });
  }));
  const byId = Object.create(null);
  ALL.forEach(x => { if (!byId[x.id]) byId[x.id] = x; });

  const NAV = {
    AIRPORTS, NAVAIDS, WAYPOINTS, AIRSPACES, APPROACHES, CITIES, WATER, COAST, OBSTACLES, ALL,
    HOME: byId.EBZH,
    find: id => byId[(id || '').toUpperCase()] || null,
    search: (q, limit = 12) => {
      q = (q || '').toUpperCase();
      const r = ALL.filter(x => x.id.startsWith(q));
      return r.slice(0, limit);
    },
    nearest: (pos, type, n = 10, filter) => {
      let list = type === 'APT' ? AIRPORTS : type === 'VOR' ? NAVAIDS.filter(x => x.type === 'VOR') : type === 'NDB' ? NAVAIDS.filter(x => x.type === 'NDB') : type === 'WPT' ? WAYPOINTS : ALL;
      if (filter) list = list.filter(filter);
      return list.map(x => ({ item: x, dist: U.distNm(pos, x), brg: U.bearing(pos, x) })).sort((a, b) => a.dist - b.dist).slice(0, n);
    },
    airspacesAt: (pos, altFt) => AIRSPACES.filter(s => NAV.inside(s, pos) && (altFt == null || (altFt >= s.floor && altFt <= s.ceil))),
    inside: (s, pos) => {
      if (s.shape.circle) return U.distNm(s.shape.circle, pos) <= s.shape.r;
      const p = s.shape.poly; let inside = false;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        const yi = p[i][0], xi = p[i][1], yj = p[j][0], xj = p[j][1];
        if (((yi > pos.lat) !== (yj > pos.lat)) && (pos.lon < (xj - xi) * (pos.lat - yi) / (yj - yi) + xi)) inside = !inside;
      }
      return inside;
    },
    // afstand tot de rand (nm, ruw): minimum over randpunten
    distToAirspace: (s, pos) => {
      if (s.shape.circle) return Math.max(0, U.distNm(s.shape.circle, pos) - s.shape.r);
      let best = 1e9; const p = s.shape.poly;
      for (let i = 0; i < p.length; i++) {
        const a = { lat: p[i][0], lon: p[i][1] }, b = { lat: p[(i + 1) % p.length][0], lon: p[(i + 1) % p.length][1] };
        const { xtk, along } = U.xtk(a, b, pos); const len = U.distNm(a, b);
        const d = along < 0 ? U.distNm(a, pos) : along > len ? U.distNm(b, pos) : Math.abs(xtk);
        best = Math.min(best, d);
      }
      return best;
    },
    terrainFt,
    runwayEnds: (apt, rwy) => {
      // geeft drempelpositie en richting voor een baan-aanduiding ("24")
      const r = rwy.match(/\d+/)[0];
      const rw = apt.rwys.find(x => x.id.split('/').some(s => s.replace(/[LRCG]/g, '') === r.padStart(2, '0') || s === rwy));
      if (!rw) return null;
      const ids = rw.id.split('/');
      const first = ids[0].replace(/[LRCG]/g, '') === r.padStart(2, '0') || ids[0] === rwy;
      const hdg = first ? rw.hdg : U.norm360(rw.hdg + 180);
      const halfNm = rw.len / 2 / U.NM_M;
      const thr = U.dest(apt, U.norm360(hdg + 180), halfNm);
      const end = U.dest(apt, hdg, halfNm);
      return { thr, end, hdg, len: rw.len, rw, id: first ? ids[0] : ids[1] };
    },
    freqOf: (apt, type) => { const f = apt.freqs.find(x => x.type === type && x.freq); return f ? f.freq : null; },
    mainFreq: apt => { const f = apt.freqs.find(x => x.type === 'TWR' || x.type === 'RADIO' || x.type === 'INFO'); return f ? f.freq : (apt.freqs[0] && apt.freqs[0].freq); },
  };
  G3X.nav = NAV;
})();

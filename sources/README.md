# Bronteksten

Officiële regelteksten, bewaard als basis voor uitleg en voor een latere vragen-pijplijn: nieuwe vragen worden
dan op één artikel gebaseerd en citeren eruit. Deze teksten worden (nog) niet op de website getoond.

| Map | Tekst | Bestanden |
|---|---|---|
| `bcaa/altmoc-fcl-2022-01` | BCAA/AltMoC/FCL/2022-01 – aantal vragen, verdeling per vak en duur van de theorie-examens PPL/LAPL/BPL/SPL in België (geldig vanaf 01/02/2022); basis voor `LICENCES` in `js/config.js` | `.pdf`, `.md` (tekst per pagina) |
| `ulm/` | Koninklijk besluit van 20 december 2024 betreffende de ultralichte motorluchtvaartuigen (BS 18.02.2025, numac 2025000168; tekst gecontroleerd tegen etaamb.openjustice.be: identiek) | `.pdf` (origineel), `.md` (leesbaar), `.json` (per artikel) |
| `eu/sera-923-2012-oorspronkelijk` | SERA – Uitvoeringsverordening (EU) nr. 923/2012, **oorspronkelijke versie 2012** (11 artikelen, 67 SERA-punten, 5 aanhangsels) | `.pdf`, `.md`, `.json` (per bepaling, met pagina in het Publicatieblad) |
| `eu/ongevalsonderzoek-996-2010-oorspronkelijk` | Ongevalsonderzoek – Verordening (EU) nr. 996/2010, **oorspronkelijke versie 2010** (26 artikelen + bijlage met voorbeelden van ernstige incidenten) | `.pdf`, `.md`, `.json` |
| `eu/part21-748-2012-oorspronkelijk` | Part 21 – Verordening (EU) nr. 748/2012, **oorspronkelijke versie 2012** (12 artikelen, 213 punten 21.A/21.B, aanhangsels) | `.pdf`, `.md`, `.json` |
| `eu/aircrew-1178-2011-oorspronkelijk` | Aircrew – Verordening (EU) nr. 1178/2011, **oorspronkelijke versie 2011**: Part-FCL (FCL.xxx), Part-MED (MED.A–D), bijlagen II–IV (12 artikelen, 230 punten) | 2 × `.pdf` (deel 1 en 2), `.md`, `.json` |
| `eu/airops-965-2012-oorspronkelijk` | Air Operations – Verordening (EU) nr. 965/2012, **oorspronkelijke versie 2012**: Part-ARO, ORO, CAT, SPA (10 artikelen, 390 punten) | 2 × `.pdf`, `.md`, `.json` |
| `eu/cont-airworthiness-1321-2014-oorspronkelijk` | Permanente luchtwaardigheid – Verordening (EU) nr. 1321/2014, **oorspronkelijke versie 2014**: Part-M, 145, 66, 147 (9 artikelen, 187 punten) | 2 × `.pdf`, `.md`, `.json` |

> ⚠️ De EU-teksten zijn de versies zoals oorspronkelijk bekendgemaakt (2011–2014), **niet geconsolideerd**. Latere wijzigingen ontbreken,
> en dat zijn er voor de PPL/ULM-theorie belangrijke:
> - SERA: de spreekprocedures van Sectie 14 (toegevoegd door Verordening (EU) 2016/1185) en de herziene VMC-tabel.
> - Air Operations: **Part-NCO** (niet-commerciële vluchten met eenvoudige luchtvaartuigen, dus de PPL) ontbreekt; dat werd pas
>   toegevoegd door Verordening (EU) nr. 800/2013.
> - Permanente luchtwaardigheid: **Part-ML** (lichte luchtvaartuigen) ontbreekt; dat werd toegevoegd door Verordening (EU) 2019/1383.
> - Aircrew: o.a. de latere wijzigingen voor LAPL/PPL, SPL/BPL (nu in aparte verordeningen) en recentere Part-MED-aanpassingen.
> Vervang ze door de geconsolideerde versie (EUR-Lex "Geconsolideerde tekst" of EASA Easy Access Rules) voor je er vragen
> op baseert. Tabellen (VMC-minima, onderscheppingssignalen …) komen in platte tekst niet altijd goed over: bij elke
> bepaling staat de pagina van het Publicatieblad (bv. "L 281/37"), zodat je ze in de PDF kunt nakijken.

## ULM-examen: wat is officieel vastgelegd?
- **KB 20/12/2024, art. 48, 2°**: theorie-examen bij het DGLV over **luchtvaartwetgeving, meteorologie, menselijke prestaties en
  communicatie**, "overeenkomstig de voorwaarden die de minister heeft vastgelegd".
- **KB 20/12/2024, art. 48, 4°**: tijdens de praktische proef toetst de examinator de klassespecifieke kennis: **beginselen van het
  vliegen, operationele procedures, vluchtprestaties en -planning, algemene kennis van het luchtvaartuig en navigatie**.
- Een ministerieel besluit met het detailprogramma is (nog) niet gevonden; aantal vragen, tijd en slaagdrempel (70 % over de vier
  vakken) komen van de examenpagina van het DGLV.

## EASA Easy Access Rules (geconsolideerd, Engels) — `easa/`
De meest actuele versies, met de regel zelf (IR) én de AMC en GM. **Gebruik deze als hoofdbron**; de PDF's in `eu/` zijn
oorspronkelijke (verouderde) Nederlandstalige versies, handig voor de Nederlandse terminologie.

| Bestand | Inhoud | Versie |
|---|---|---|
| `easa/sera.json` / `.md` | SERA (923/2012) incl. Sectie 14 (spreekprocedures) — 352 bepalingen | Revision August 2025 |
| `easa/aircrew.json` / `.md` | Aircrew (1178/2011): Part-FCL, Part-MED, ARA/ORA/DTO, PPL/LAPL-syllabus (AMC1 FCL.210; FCL.215) — 988 bepalingen | Revision November 2025 |
| `easa/airops.json` / `.md` | Air Operations (965/2012): **Part-NCO**, ORO, CAT, SPO, NCC, SPA … — 3 650 bepalingen | Revision March 2026 |
| `easa/part21.json` / `.md` | Initial Airworthiness (748/2012): Part 21 en **Part 21 Light** — 1 183 bepalingen | Revision November 2025 |
| `easa/cont-airworthiness.json` / `.md` | Continuing Airworthiness (1321/2014): **Part-ML**, Part-M, CAMO, CAO, 145, 66, 147 — 1 166 bepalingen | Revision September 2025 |
| `easa/aerodromes.json` / `.md` | Aerodromes (139/2014): ADR-regels en CS ADR-DSN (markeringen, borden, lichten) — 1 200 bepalingen | Revision March 2026 |
| `easa/atm-ans.json` / `.md` | ATM/ANS (2017/373): o.a. **Part-MET** (METAR/TAF, MET.TR.200), Part-ATS, Part-AIS — 1 348 bepalingen | Revision March 2025 |
| `easa/basic-regulation.json` / `.md` | Basisverordening (2018/1139): 141 artikelen + bijlagen I–X (o.a. **bijlage I**: luchtvaartuigen buiten EASA, zoals ULM's tot 300/450 kg — met nationale opt-out tot 600 kg) | Revision January 2023 |
| `easa/occurrence-reporting.json` / `.md` | Voorvalmelding (376/2014) met GM — 107 bepalingen | Revision September 2023 |

Elke bepaling: `{"id": "SERA.14083", "soort": "IR|AMC|GM|CR|CS", "titel": "...", "kop1": "ANNEX ...", "kop2": "SECTION 14 ...", "tekst": "..."}`.
De eerste regel van de tekst noemt meestal de wijzigende verordening of ED Decision (bv. "Regulation (EU) 2024/404").
Opnieuw aanmaken uit de XML-download van EASA (de XML zelf staat niet in de repository, 15–65 MB):
```bash
python3 tools/extract_ear.py "<Easy Access Rules … .xml>" sera "Easy Access Rules for SERA" "Revision August 2025"
```

## ECQB-syllabus — `ecqb/`
| Bestand | Inhoud |
|---|---|
| `ecqb/tk-syllabus-comparison-doc-v6.xlsx` | EASA TK Syllabus Comparison Document, versie 6 (17/12/2025), voor ECQB 2026 (origineel) |
| `ecqb/tk-syllabus-v6.json` | Per leerdoel: `ref` (bv. `010.05.06.01.05`), `tekst`, `bk` (basiskennis, geen aparte examenvraag), `brevetten`, `bron` (bv. "SERA.11015 Interception, Tables S11-1 …"); plus de lijst met bronversies (`bronnen`). 15 vakken, 6 365 regels, 1 244 met bron |

> Dit is de syllabus voor **ATPL/CPL/IR**. De leerdoelen voor **LAPL/PPL** (nummering zoals "10.5.5.1.4", die in de
> vragenbank staat) zijn een apart EASA-document dat hier nog ontbreekt. Veel onderwerpen zijn gelijk, dus de kolom `bron`
> is ook voor PPL-vragen een goede aanwijzing welk artikel je moet citeren.
Opnieuw aanmaken: `python3 tools/extract_tk.py sources/ecqb/tk-syllabus-comparison-doc-v6.xlsx`

## ECQB 2026 — aandachtspunten (EASA "ECQB Update", januari 2026)
Het document zelf staat niet in de repository (EASA: "Proprietary document – All rights reserved"). Samenvatting:
- ECQB 2026 is afgestemd op de EU-regelgeving en ICAO-SARPs **zoals gewijzigd begin 2025**. Detailverwijzingen per leerdoel
  staan in het "TK Syllabus Comparison Document" (v6) op de ECQB-pagina van EASA.
- **Radiostoring**: afgestemd op SERA na Verordening (EU) 2024/404 — nieuwe code **7601** (IFR-vlucht die in VMC verder vliegt)
  en de IFR-regel van 7 minuten werd **20 minuten** (SERA.14083). Voor VFR blijft het: 7600, in VMC blijven, landen op het
  dichtstbijzijnde geschikte vliegveld en aankomst melden. Raakt 010 Air Law en 090 Communications.
- **Brandstof**: nieuwe fuel-schema's (2021–2022), "Discretionary fuel" en herziene "Extra fuel" (031, 033, 070).
- **All-weather operations** (Verordening (EU) 2021/2237): alleen niet-gewijzigde aspecten worden bevraagd.
- **Meteo**: WAFC T+24 significant-weather-kaarten in het nieuwe formaat van 2025 (050).
- **Baansterkte**: nog ACN/PCN in de EU (010, 032). Noord-Atlantisch luchtruim: ICAO Doc 007 (2025).

## Formaat van de JSON
```json
{
  "titel": "...", "kort": "KB ULM (20 december 2024)", "datum": "2024-12-20", "bron": "...", "url": "...",
  "artikelen": [
    { "artikel": 46, "hoofdstuk": "HOOFDSTUK VI. - BESTURING", "afdeling": "Afdeling 2 - ULM Vergunning", "tekst": "§ 1. ..." }
  ]
}
```
De EU-teksten gebruiken `"bepalingen": [{ "id": "SERA.5001", "titel": "VMC Minima ...", "pagina": "L 281/25", "tekst": "..." }]`.

## Opnieuw aanmaken of een tekst toevoegen
```bash
pip install pymupdf
python3 tools/extract_law.py   # Belgische teksten (Staatsblad)
python3 tools/extract_eu.py    # EU-verordeningen (Publicatieblad / EUR-Lex)
```
Pas `CONFIG` in `tools/extract_law.py` of `DOCS` in `tools/extract_eu.py` aan voor een andere tekst. Tabellen die in de PDF verminkt uitkomen
(bv. de tweetalige MTOM-tabel in art. 1 van het KB ULM) worden vervangen door een handmatig overgenomen versie (`TABLES`).

## Rechten en actualiteit
- Belgische wetten en besluiten zijn officiële akten van de overheid en niet auteursrechtelijk beschermd (art. XI.172, § 2 WER).
- EU-verordeningen (EUR-Lex) mogen hergebruikt worden met bronvermelding.
- De Belgische AIP (skeyes) staat hier bewust niet in: daarvoor moeten de gebruiksvoorwaarden eerst nagekeken worden.
- Teksten staan hier zoals bekendgemaakt. Latere wijzigingen zijn niet verwerkt: controleer de geconsolideerde versie op
  [ejustice.just.fgov.be](https://www.ejustice.just.fgov.be) voor je er vragen op baseert.

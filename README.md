# PPL & ULM Oefenplatform (België)

Onofficieel oefenplatform voor de theorie-examens **PPL(A)** (EASA Part-FCL, BCAA/DGLV) en **ULM** (nationale vergunning, DGLV).

> ⚠️ Dit is **geen officieel platform**. Het is niet verbonden aan EASA, de BCAA of het DGLV en geeft **geen garantie** op slagen voor het echte examen.

## Functies
- Keuze tussen **PPL** en **ULM**, daarna de vakken van die opleiding.
- **Oefenmodus**: vragen uit de databank in willekeurige volgorde. Ook de volgorde van de antwoorden wordt geschud, zoals op het echte examen.
  Na het antwoorden krijg je een **groen** (juist) of **rood** (fout) vak met uitleg en een link naar de officiële bron (EASA, BCAA/DGLV, Belgische AIP).
- **Per hoofdstuk oefenen**: in de oefenmodus kies je "Alle hoofdstukken" of één hoofdstuk van het vak (indeling via de ECQB-leerdoelcodes, zie `CHAPTERS` in `js/config.js`).
- **Proefexamen** per vak met het aantal vragen en de tijd van het echte examen, met timer, markeren, overzicht en uitleg achteraf.
- **Rekenvragen**: aparte categorie waar de site zelf telkens nieuwe rekenoefeningen maakt (navigatie, vluchtplanning, meteo, aerodynamica, instrumenten …), met stap-voor-stap uitleg. Zie `js/calc.js`.
- **VOR & radionavigatie**: aparte categorie met zelf getekende instrumenten (VOR/CDI, ADF/RBI, RMI) in de stijl van de examenbijlagen; telkens een nieuwe stand, met stap-voor-stap uitleg. Zie `js/radionav.js`.
- **METAR & TAF**: aparte categorie waar de site telkens een nieuw, realistisch weerbericht voor een Belgisch vliegveld maakt. Je krijgt vragen over één gemarkeerd deel (wind, zicht, weer, wolken, temperatuur, QNH, CAVOK, trend), over het toepassen (ceiling, VFR-minima in een CTR volgens SERA.5005(b), baan en zijwind, cumulusbasis) en over TAFs (geldigheid, TEMPO/BECMG/PROB). Na je antwoord zie je het hele bericht ontcijferd. Zie `js/metar.js`.
- **Afkortingen**: na elk antwoord staan de afkortingen uit de vraag (VOR, NDB, QNH …) met volledige benaming en korte uitleg, vóór de bronvermelding. Zie `js/glossary.js`.
- **Kompasrekenmachine** (alleen in de oefenmodus, niet in het proefexamen): graden optellen/aftrekken met terugrekenen naar 0–360°, tussenstappen en een kleine kompasroos. Noorden volgens de luchtvaartstandaard: koers 360°, radiaal/peiling 000°. Zie `js/compasscalc.js`.
- Je voortgang wordt lokaal in de browser bewaard. Bij **Instellingen** wis je de voortgang per vak/instrument (score, oefenvolgorde en proefexamens) of alles in één keer.
- **G3X Touch Trainer** (`g3x/`): een aparte simulatorpagina in de stijl van de Garmin G3X Touch (één GDU 460-scherm) met een eenvoudig model van een Tecnam P2008 JC MkII (Rotax 912 S) en een GFC 500-achtige autopilot, thuisbasis EBZH Hasselt-Kiewit. Zie hieronder.

## G3X Touch Trainer
Open `g3x/index.html` (of de knop **G3X** in de navigatie). Onofficieel, geen Garmin-product; navigatiedata en vliegtuigwaarden zijn vereenvoudigd en **niet voor echte navigatie**. Het scherm van het toestel is, zoals het echte, volledig Engelstalig; het trainerpaneel is Nederlands.

- **Twee modi**: *Verkennen* (vrij alles bekijken en veranderen, met een startsituatie naar keuze en een **Reset**-knop die de startsituatie terugzet) en *Scenario* (stappen volgen; **Reset scenario** begint hetzelfde scenario met dezelfde gegevens opnieuw, **Nieuwe gegevens** genereert nieuwe willekeurige waarden).

- **Scherm**: PFD (attitude met synthetic vision, snelheids- en hoogtetape, VSI, HSI met CDI/bearing pointers/windvector, AP-statusbalk, CAS-meldingen), EIS-strook en motorpagina met brandstofcomputer, bewegende kaart (topografie, luchtruimen, vliegvelden, navaids, VRP's, obstakels, verkeer), terreinpagina, Home-menu met alle pagina's (vluchtplan, waypoint-info, Nearest, naderingen, timers, checklists, instellingen, berichten, tripcomputer, gebruikerswaypoints, opgeslagen vluchtplannen).
- **Bediening zoals op het toestel**: aanraakvelden op het scherm (baro, hoogte, heading, CRS, frequenties, transponder, AP-balk …), knoppenbalk onderaan (Back, Direct-To, Nearest, Menu, MSG, Home, PFD/Split/MFD, SUSP/OBS), twee dubbele draaiknoppen op de bezel, toetsenbord, muis/aanraking en gamepad. Autopilot via een GMC 507-achtig paneel (HDG, TRK, NAV, APR, AP, FD, ALT, VS, IAS, VNV, LVL, TO/GA, NOSE UP/DN).
- **Navigatie**: GPS-vluchtplan met sequencing, Direct-To (ook met koers), OBS, CDI-schaal ENR/TERM/APR/LNAV+V, VNAV, RNP- en ILS-naderingen met transities, vectors-to-final, SUSP en missed approach, VOR/ILS-ontvanger met ident, DME en glideslope.
- **Scenario's** (`g3x/js/scenarios.js`): 50+ oefeningen in categorieën (Basis & PFD, Radio & transponder, Navigatie, Autopilot, Motor & systemen, Noodgevallen & storingen, Volledige vluchten, Vrij vliegen). Elk scenario krijgt bij het starten willekeurige gegevens (vliegvelden, frequenties, QNH, codes, wind, storingen). Stappen worden automatisch gecontroleerd op de toestand van het toestel en op wat je op het scherm doet; met hints, meerkeuzevragen, fouten en een score die lokaal wordt bewaard.
- **Vliegtuigpaneel**: gas, flaps, tankkraan L/R/OFF, master, starter, parkeerrem, pauze, simulatiesnelheid, storingen (AHRS, ADC, GPS, alternator, oliedruk, CHT, motor, COM/NAV, pitot, brandstoflek, scherm) en reversionary.

| Pad | Inhoud |
|---|---|
| `g3x/js/navdata.js` | Vereenvoudigde navigatiedatabase (vliegvelden, navaids, VRP's, luchtruimen, naderingen, terrein) |
| `g3x/js/sim.js` | Vluchtmodel P2008 JC en Rotax 912 S-motormodel, omgeving, storingen |
| `g3x/js/avionics.js` | Avionica-toestand: radio's, transponder, vluchtplan, navigatierekenaar, VOR/ILS, waarschuwingen, checklists |
| `g3x/js/autopilot.js` | GFC 500-achtige autopilot/flight director |
| `g3x/js/display.js`, `pfd.js`, `eis.js`, `mfd.js`, `bars.js` | Canvas-weergave van het scherm |
| `g3x/js/ui.js` | Aanraakinterface: pagina's, dialoogvensters, knoppen |
| `g3x/js/scenarios.js` | Scenario-motor en generatoren |
| `g3x/js/main.js` | Hoofdlus, invoer, panelen |

## Structuur
| Pad | Inhoud |
|---|---|
| `index.html`, `css/`, `js/app.js` | De website (statisch, geen server nodig) |
| `js/calc.js` | Generatoren voor de rekenvragen (per vak een lijst oefeningstypes) |
| `js/radionav.js` | VOR/ADF/RMI-oefeningen en het tekenen van de instrumenten (SVG) |
| `js/metar.js` | METAR- en TAF-oefeningen (weerberichten genereren en ontcijferen) |
| `js/glossary.js` | Woordenlijst met luchtvaartafkortingen (volledige benaming + uitleg) |
| `js/compasscalc.js` | Kompasrekenmachine bij vragen met richtingen (alleen oefenmodus) |
| `js/config.js` | Vakken, examenparameters (aantal vragen/tijd/slaagdrempel) en bronnen |
| `data/<vak>.json` | Vragen uit de PDF's (het juiste antwoord is het groene vakje in de PDF). Aanvullende vragen van een auteur hebben een veld `author` (bv. de aerodynamicatoetsen van Jeroen Huygen, id `JH1-..`/`JH2-..`); de site toont dan "Aanvullende vraag · auteur: …" |
| `img/<vak>/` | Afbeeldingen/bijlagen bij de vragen |
| `content/<vak>.json` | Uitleg + bron per vraag-ID: `[uitleg, bron, artikel]` |
| `content/_patches.json` | Correcties op tekst die in de bron-PDF afgebroken is, tekstvervangingen (`_replace`) en gedraaide afbeeldingen (`_rotate`) |
| `sources/` | Officiële bronteksten: KB ULM (20/12/2024), BCAA AltMoC (examenparameters), EASA TK-syllabus met bron per leerdoel (ECQB 2026), EASA Easy Access Rules (SERA, Aircrew, Air Operations, Part 21, Continuing Airworthiness, Aerodromes, ATM/ANS incl. Part-MET, Basisverordening, voorvalmelding) en ongevalsonderzoek (996/2010) en de oorspronkelijke EU-teksten in het Nederlands als `.md` en per artikel als `.json`, voor een latere vragen-pijplijn. Zie `sources/README.md` |
| `tools/extract_law.py`, `tools/extract_eu.py`, `tools/extract_ear.py`, `tools/extract_tk.py` | Zetten een wettekst uit het Staatsblad, het EU-Publicatieblad (PDF), de EASA Easy Access Rules (XML) of de EASA TK-syllabus (xlsx) om naar `sources/` |
| `js/bank.js` | **Gegenereerd** door `tools/build.py` |

## Nieuwe PDF's toevoegen
```bash
pip install pymupdf
python3 tools/extract_pdf.py meteorology pad/naar/30_Meteorology.pdf
# schrijf de uitleg in content/meteorology.json
python3 tools/build.py
```
Mogelijke vak-sleutels: `air_law`, `human_performance`, `meteorology`, `communications`, `principles_of_flight`,
`operational_procedures`, `flight_performance`, `aircraft_general`, `navigation`.

## Lokaal bekijken
Open `index.html` in de browser, of start `python3 -m http.server` en ga naar http://localhost:8000.
De site werkt ook op GitHub Pages.

## Examenparameters
- **PPL(A)**: 132 vragen volgens BCAA/AltMoC/FCL/2022-01 (geldig vanaf 01/02/2022), 75% per vak.
  Air Law 20/40 min, Human Performance 12/24, Meteorology 20/40, Communications 12/24, Navigation 20/60,
  Principles of Flight 12/24, Operational Procedures 12/24, Flight Performance & Planning 12/24, Aircraft General Knowledge 12/24.
- **ULM** (DGLV): Luchtvaartwetgeving 20/40, Menselijke prestaties 10/20, Meteorologie 20/40, Communicatie 10/20; minimaal 70% over de vier vakken samen.

Aan te passen in `js/config.js` (`LICENCES`).

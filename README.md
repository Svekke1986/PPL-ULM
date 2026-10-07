# PPL & ULM Oefenplatform (België)

Onofficieel oefenplatform voor de theorie-examens **PPL(A)** (EASA Part-FCL, BCAA/DGLV) en **ULM** (nationale vergunning, DGLV).

> ⚠️ Dit is **geen officieel platform**. Het is niet verbonden aan EASA, de BCAA of het DGLV en geeft **geen garantie** op slagen voor het echte examen.

## Functies
- Keuze tussen **PPL** en **ULM**, daarna de vakken van die opleiding.
- **Oefenmodus**: vragen uit de databank in willekeurige volgorde. Ook de volgorde van de antwoorden wordt geschud, zoals op het echte examen.
  Na het antwoorden krijg je een **groen** (juist) of **rood** (fout) vak met uitleg en een link naar de officiële bron (EASA, BCAA/DGLV, Belgische AIP).
- **Proefexamen** per vak met het aantal vragen en de tijd van het echte examen, met timer, markeren, overzicht en uitleg achteraf.
- Optioneel: **AI-gegenereerde vragen** via je eigen Google Gemini API-sleutel (⚙️ Instellingen). Die vragen worden duidelijk gemarkeerd als niet gecontroleerd.
- Je voortgang wordt lokaal in de browser bewaard.

## Structuur
| Pad | Inhoud |
|---|---|
| `index.html`, `css/`, `js/app.js` | De website (statisch, geen server nodig) |
| `js/config.js` | Vakken, examenparameters (aantal vragen/tijd/slaagdrempel) en bronnen |
| `js/ai.js` | Optionele Gemini-vraaggenerator |
| `data/<vak>.json` | Vragen uit de PDF's (het juiste antwoord is het groene vakje in de PDF) |
| `img/<vak>/` | Afbeeldingen/bijlagen bij de vragen |
| `content/<vak>.json` | Uitleg + bron per vraag-ID: `[uitleg, bron, artikel]` |
| `content/_patches.json` | Correcties op tekst die in de bron-PDF afgebroken is |
| `js/bank.js` | **Gegenereerd** door `tools/build.py` |

## Nieuwe PDF's toevoegen (bv. Meteorologie)
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

## Nog te controleren
- Het aantal vragen en de examentijd per PPL-vak in `js/config.js` (`LICENCES.PPL.exams`). Te bevestigen met BCAA/AltMoC/FCL/2022-01.
  De ULM-waarden (20/40, 10/20, 20/40, 10/20 min, 70% totaal) komen van de DGLV-pagina.

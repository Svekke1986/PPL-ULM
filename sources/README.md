# Bronteksten

Officiële regelteksten, bewaard als basis voor uitleg en voor een latere vragen-pijplijn: nieuwe vragen worden
dan op één artikel gebaseerd en citeren eruit. Deze teksten worden (nog) niet op de website getoond.

| Map | Tekst | Bestanden |
|---|---|---|
| `ulm/` | Koninklijk besluit van 20 december 2024 betreffende de ultralichte motorluchtvaartuigen (BS numac 2025000168) | `.pdf` (origineel), `.md` (leesbaar), `.json` (per artikel) |
| `eu/sera-923-2012-oorspronkelijk` | SERA – Uitvoeringsverordening (EU) nr. 923/2012, **oorspronkelijke versie 2012** (11 artikelen, 67 SERA-punten, 5 aanhangsels) | `.pdf`, `.md`, `.json` (per bepaling, met pdf-pagina) |
| `eu/part21-748-2012-oorspronkelijk` | Part 21 – Verordening (EU) nr. 748/2012, **oorspronkelijke versie 2012** (12 artikelen, 211 punten 21.A/21.B, aanhangsels) | `.pdf`, `.md`, `.json` |

> ⚠️ De EU-teksten zijn de versies zoals bekendgemaakt in 2012, **niet geconsolideerd**. Latere wijzigingen ontbreken,
> bv. in SERA de spreekprocedures van Sectie 14 (toegevoegd door Verordening (EU) 2016/1185) en de herziene VMC-tabel.
> Vervang ze door de geconsolideerde versie (EUR-Lex "Geconsolideerde tekst" of EASA Easy Access Rules) voor je er vragen
> op baseert. Tabellen (VMC-minima, onderscheppingssignalen …) komen in platte tekst niet altijd goed over: bij elke
> bepaling staat de pdf-pagina, zodat je ze in de PDF kunt nakijken.

## Formaat van de JSON
```json
{
  "titel": "...", "kort": "KB ULM (20 december 2024)", "datum": "2024-12-20", "bron": "...", "url": "...",
  "artikelen": [
    { "artikel": 46, "hoofdstuk": "HOOFDSTUK VI. - BESTURING", "afdeling": "Afdeling 2 - ULM Vergunning", "tekst": "§ 1. ..." }
  ]
}
```
De EU-teksten gebruiken `"bepalingen": [{ "id": "SERA.5001", "titel": "VMC Minima ...", "pagina": 25, "tekst": "..." }]`.

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

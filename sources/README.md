# Bronteksten

Officiële regelteksten, bewaard als basis voor uitleg en voor een latere vragen-pijplijn: nieuwe vragen worden
dan op één artikel gebaseerd en citeren eruit. Deze teksten worden (nog) niet op de website getoond.

| Map | Tekst | Bestanden |
|---|---|---|
| `ulm/` | Koninklijk besluit van 20 december 2024 betreffende de ultralichte motorluchtvaartuigen (BS numac 2025000168) | `.pdf` (origineel), `.md` (leesbaar), `.json` (per artikel) |
| `eu/sera-923-2012-oorspronkelijk` | SERA – Uitvoeringsverordening (EU) nr. 923/2012, **oorspronkelijke versie 2012** (11 artikelen, 67 SERA-punten, 5 aanhangsels) | `.pdf`, `.md`, `.json` (per bepaling, met pdf-pagina) |
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

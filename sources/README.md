# Bronteksten

Officiële regelteksten, bewaard als basis voor uitleg en voor een latere vragen-pijplijn: nieuwe vragen worden
dan op één artikel gebaseerd en citeren eruit. Deze teksten worden (nog) niet op de website getoond.

| Map | Tekst | Bestanden |
|---|---|---|
| `ulm/` | Koninklijk besluit van 20 december 2024 betreffende de ultralichte motorluchtvaartuigen (BS numac 2025000168) | `.pdf` (origineel), `.md` (leesbaar), `.json` (per artikel) |

## Formaat van de JSON
```json
{
  "titel": "...", "kort": "KB ULM (20 december 2024)", "datum": "2024-12-20", "bron": "...", "url": "...",
  "artikelen": [
    { "artikel": 46, "hoofdstuk": "HOOFDSTUK VI. - BESTURING", "afdeling": "Afdeling 2 - ULM Vergunning", "tekst": "§ 1. ..." }
  ]
}
```

## Opnieuw aanmaken of een tekst toevoegen
```bash
pip install pymupdf
python3 tools/extract_law.py
```
Pas `CONFIG` in `tools/extract_law.py` aan voor een andere tekst. Tabellen die in de PDF verminkt uitkomen
(bv. de tweetalige MTOM-tabel in art. 1 van het KB ULM) worden vervangen door een handmatig overgenomen versie (`TABLES`).

## Rechten en actualiteit
- Belgische wetten en besluiten zijn officiële akten van de overheid en niet auteursrechtelijk beschermd (art. XI.172, § 2 WER).
- EU-verordeningen (EUR-Lex) mogen hergebruikt worden met bronvermelding.
- De Belgische AIP (skeyes) staat hier bewust niet in: daarvoor moeten de gebruiksvoorwaarden eerst nagekeken worden.
- Teksten staan hier zoals bekendgemaakt. Latere wijzigingen zijn niet verwerkt: controleer de geconsolideerde versie op
  [ejustice.just.fgov.be](https://www.ejustice.just.fgov.be) voor je er vragen op baseert.

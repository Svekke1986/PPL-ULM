#!/usr/bin/env python3
"""Zet een wettekst uit het Belgisch Staatsblad (PDF) om naar leesbare tekst en een JSON per artikel.

Gebruikt voor de bronteksten in sources/ (bv. het KB ULM). De JSON per artikel is bedoeld voor een
latere vragen-pijplijn: elke vraag kan dan naar één artikel verwijzen en eruit citeren.

    python3 tools/extract_law.py

Pas CONFIG aan voor een nieuwe tekst. Tabellen die in de PDF tweetalig/verminkt zijn, worden
vervangen door een handmatig overgenomen tabel (TABLES).
"""
import json
import os
import re
import shutil

import pymupdf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CONFIG = {
    "pdf": os.environ.get("KB_PDF", os.path.join(ROOT, "sources/ulm/kb-2024-12-20-ulm.pdf")),
    "out": os.path.join(ROOT, "sources/ulm/kb-2024-12-20-ulm"),
    "meta": {
        "titel": "Koninklijk besluit van 20 december 2024 betreffende de ultralichte motorluchtvaartuigen",
        "kort": "KB ULM (20 december 2024)",
        "datum": "2024-12-20",
        "bron": "Belgisch Staatsblad van 18 februari 2025, numac 2025000168 – FOD Mobiliteit en Vervoer",
        "publicatie": "2025-02-18",
        "url": "https://www.ejustice.just.fgov.be/cgi/article_body.pl?language=nl&caller=summary&pub_date=25-02-18&numac=2025000168",
        "taal": "nl",
        "licentie": "Officiële akte van de overheid: niet auteursrechtelijk beschermd (art. XI.172, § 2 WER).",
        "opmerking": "Tekst zoals bekendgemaakt; latere wijzigingen zijn niet verwerkt. Controleer altijd de geconsolideerde versie.",
    },
}

# Pagina (0-based) → (y0, y1) van een tabel die we vervangen, en de vervangtekst (Markdown).
TABLES = {
    1: ((70, 550), """
| | ULA/ULH/DPM | Amfibie ULA/ULH/DPM | Met totaal reddingsparachutesysteem op het luchtframe | Autogiro |
|---|---|---|---|---|
| Eénpersoons | 300 kg MTOM | extra 30 kg MTOM | extra 15 kg MTOM | 600 kg MTOM |
| Tweepersoons | 450 kg MTOM | extra 45 kg MTOM | extra 25 kg MTOM | 600 kg MTOM |

En waarvan voor de ULA en DPM de overtreksnelheid of de minimale constante vliegsnelheid in landingsconfiguratie niet hoger is dan 35 knopen gekalibreerde luchtsnelheid (Calibrated Air Speed, CAS).

| | ULA/ULH/DPM | Amfibie ULA/ULH/DPM | Met totaal reddingsparachutesysteem op het luchtframe | Autogiro |
|---|---|---|---|---|
| Maximum tweepersoons | 600 kg MTOM | 650 kg MTOM | niets extra | – |

En waarvan voor de ULA en DPM de overtreksnelheid of de minimale constante vliegsnelheid in landingsconfiguratie niet hoger is dan 45 knopen gekalibreerde luchtsnelheid (Calibrated Air Speed, CAS).
"""),
}

# Een nieuwe regel begint (in plaats van verder te lopen) als hij zo begint:
BREAK = re.compile(r"^(HOOFDSTUK |Afdeling \d|Onderafdeling |Art\. \d|Artikel \d|§ \d|\d+°|\d+\. |[a-z]\) |- |\||Gegeven te |Van Koningswege|FILIP$|De Minister)")


def page_text(doc):
    parts = []
    for i, page in enumerate(doc):
        if i in TABLES:
            (y0, y1), table = TABLES[i]
            w = page.rect.width
            parts.append(page.get_text(clip=pymupdf.Rect(0, 0, w, y0)))
            parts.append("\n" + table.strip() + "\n")
            parts.append(page.get_text(clip=pymupdf.Rect(0, y1, w, page.rect.height)))
        else:
            parts.append(page.get_text())
    return "\n".join(parts)


def reflow(raw):
    lines = [l.replace("\xa0", " ").rstrip() for l in raw.splitlines()]
    out = []
    for l in lines:
        s = l.strip()
        if not s:
            continue
        if out and not BREAK.match(s) and not out[-1].startswith("|") and not out[-1].endswith(":"):
            out[-1] += " " + s
        else:
            out.append(s)
    # Tabellen: lege regel ervoor en erna
    text = "\n".join(out)
    text = re.sub(r"\n(\|[^\n]*\n(?:\|[^\n]*\n)*)", r"\n\n\1\n", text)
    return text


def structure(text):
    """Deel op in hoofdstukken, afdelingen en artikelen."""
    chapter = section = None
    articles, preamble, cur = [], [], None
    for line in text.split("\n"):
        if line.startswith("HOOFDSTUK "):
            chapter, section = line, None
            continue
        if re.match(r"Afdeling \d", line):
            section = line
            continue
        m = re.match(r"(?:Art\.|Artikel) (\d+)\.\s*(.*)", line)
        if m:
            cur = {"artikel": int(m.group(1)), "hoofdstuk": chapter, "afdeling": section, "tekst": m.group(2)}
            articles.append(cur)
            continue
        if line.startswith(("Gegeven te ", "Van Koningswege", "FILIP", "De Minister")):
            cur = None
        if cur is None:
            preamble.append(line)
        else:
            cur["tekst"] += "\n" + line
    for a in articles:
        a["tekst"] = re.sub(r"\n{3,}", "\n\n", a["tekst"]).strip()
    return preamble, articles


def to_markdown(meta, articles):
    md = [f"# {meta['titel']}", "",
          f"- Bron: {meta['bron']}",
          f"- Link: {meta['url']}",
          f"- {meta['licentie']}",
          f"- {meta['opmerking']}", ""]
    chapter = section = None
    for a in articles:
        if a["hoofdstuk"] != chapter:
            chapter, section = a["hoofdstuk"], None
            md += [f"## {chapter}", ""]
        if a["afdeling"] != section:
            section = a["afdeling"]
            if section:
                md += [f"### {section}", ""]
        body = a["tekst"].replace("\n", "\n\n")
        body = re.sub(r"\n\n(\|)", r"\n\1", body)  # tabelrijen niet uit elkaar trekken
        md += [f"**Art. {a['artikel']}.** {body}", ""]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(md)).rstrip() + "\n"


def main():
    doc = pymupdf.open(CONFIG["pdf"])
    text = reflow(page_text(doc))
    preamble, articles = structure(text)
    meta = CONFIG["meta"]
    nums = [a["artikel"] for a in articles]
    assert nums == list(range(1, len(nums) + 1)), "artikelnummers niet doorlopend"
    with open(CONFIG["out"] + ".json", "w", encoding="utf-8") as f:
        json.dump({**meta, "artikelen": articles}, f, ensure_ascii=False, indent=1)
    with open(CONFIG["out"] + ".md", "w", encoding="utf-8") as f:
        f.write(to_markdown(meta, articles))
    print(f"{len(articles)} artikelen, {len({a['hoofdstuk'] for a in articles})} hoofdstukken → {CONFIG['out']}.md/.json")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Zet een EU-verordening (PDF uit het Publicatieblad / EUR-Lex) om naar leesbare tekst en een JSON per bepaling.

Een "bepaling" is een artikel van de verordening ("Artikel 3") of een punt uit de bijlage
("SERA.5001", "21.A.15", ...). Per bepaling bewaren we ook de pagina in de PDF, zodat je de
originele tekst (en tabellen, die in platte tekst niet altijd goed overkomen) snel terugvindt.

    python3 tools/extract_eu.py            # alle teksten uit DOCS
    python3 tools/extract_eu.py sera       # één tekst
"""
import json
import os
import re
import sys

import pymupdf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "sources", "eu")

DOCS = {
    "sera": {
        "pdf": "sera-923-2012-oorspronkelijk.pdf",
        "id": r"SERA\.\d{4,5}",
        "meta": {
            "titel": "Uitvoeringsverordening (EU) nr. 923/2012 van de Commissie van 26 september 2012 – gemeenschappelijke luchtverkeersregels (SERA)",
            "kort": "SERA (923/2012), oorspronkelijke versie",
            "celex": "32012R0923",
            "publicatie": "PB L 281 van 13.10.2012, blz. 1",
            "url": "https://eur-lex.europa.eu/eli/reg_impl/2012/923/oj",
        },
    },
    "part21": {
        "pdf": "part21-748-2012-oorspronkelijk.pdf",
        "id": r"21\.[AB]\.\d+[A-Z]?",
        # In de tekstlaag van de PDF ontbreekt de regel "Artikel 10" boven de titel.
        "fixes": {"Maatregelen van het Agentschap": "Artikel 10 Maatregelen van het Agentschap"},
        "meta": {
            "titel": "Verordening (EU) nr. 748/2012 van de Commissie van 3 augustus 2012 – luchtwaardigheid en milieucertificering (Part 21)",
            "kort": "Part 21 (748/2012), oorspronkelijke versie",
            "celex": "32012R0748",
            "publicatie": "PB L 224 van 21.8.2012, blz. 1",
            "url": "https://eur-lex.europa.eu/eli/reg/2012/748/oj",
        },
    },
}
COMMON_META = {
    "taal": "nl",
    "versie": "Oorspronkelijke tekst zoals bekendgemaakt in 2012, NIET geconsolideerd: latere wijzigingen ontbreken.",
    "licentie": "EU-wetgeving: hergebruik toegestaan met bronvermelding (Besluit 2011/833/EU). © Europese Unie, https://eur-lex.europa.eu",
}

# Kop- en voetregels van het Publicatieblad
NOISE = re.compile(r"^(NL|L \d+/\d+|Publicatieblad van de Europese Unie|\d{1,2}\.\d{1,2}\.\d{4})$")
TOC = re.compile(r"(\. ){4,}|\.{6,}")  # inhoudstafel met puntjes
HEAD = r"Artikel \d+|Aanhangsel [IVX\d]+|AANHANGSEL [IVX\d]+"


def lines_with_pages(doc, fixes=None):
    fixes = dict(fixes or {})
    for pno, page in enumerate(doc, start=1):
        lines = [l.replace("\xa0", " ").strip() for l in page.get_text().splitlines()]
        if sum(bool(TOC.search(l)) for l in lines) >= 5:
            continue  # pagina van de inhoudstafel
        for s in lines:
            if not s or NOISE.match(s) or TOC.search(s) or s.isdigit():
                continue
            if s in fixes:
                s = fixes.pop(s)  # alleen de eerste keer
            yield pno, s


def reflow(items, idpat):
    """Voeg afgebroken regels samen. Een nieuwe alinea begint bij een kop, een bepaling of een opsomming.
    Na de kop van een bepaling (id + titel) begint de tekst altijd op een nieuwe alinea."""
    # Kop = id alleen op de regel, of id gevolgd door een titel met hoofdletter. Anders is het een verwijzing.
    idbrk = rf"{idpat}(?:$|\s+[A-ZÀ-Ý])"
    brk = re.compile(rf"^({HEAD}|{idbrk}|BIJLAGE|HOOFDSTUK|AFDELING|SUBDEEL|DEEL|Tabel|\(?[a-z]\)|\(?\d+\)|\d+\.\s|[ivx]+\)|—|•|-\s)")
    head = re.compile(rf"^({HEAD}|{idpat})$")
    out, state = [], 0  # state 1: kop zonder titel gezien (volgende regel = titel); 2: titel compleet
    for pno, s in items:
        if out and state == 1:
            out[-1][1] += " " + s
            state = 2
            continue
        if out and state != 2 and not brk.match(s):
            prev = out[-1][1]
            if prev.endswith("\xad"):
                out[-1][1] = prev.rstrip("\xad") + s          # afbreekstreepje: woord aan elkaar
            elif prev.endswith("-") and s[:1].islower():
                out[-1][1] = prev + s                        # afgebroken woord met gewoon streepje
            else:
                out[-1][1] = prev + " " + s
        else:
            out.append([pno, s])
            state = 0
        if head.match(s):
            state = 1
        elif re.match(rf"^({HEAD}|{idpat})\s+\S", s) and len(out[-1][1]) == len(s):
            state = 2
    for o in out:
        o[1] = re.sub(r"\s+", " ", o[1].replace("\xad", "")).strip()
    return out


def split(paras, idpat):
    """Artikelen staan vóór de BIJLAGE en lopen op (1, 2, 3 ...); bijlagepunten en aanhangsels erna.
    Zo worden verwijzingen in de tekst die toevallig met een nummer beginnen niet als kop gezien."""
    head = re.compile(rf"^({HEAD}|{idpat})(?:$|\s+(?=[A-ZÀ-Ý])(.*))")
    provisions, cur, intro = [], None, []
    seen, in_annex, last_art = set(), False, 0
    for pno, text in paras:
        if re.match(r"^(BIJLAGE\b|SECTIE A\b|SUBDEEL A\b)", text):
            in_annex = True
        m = head.match(text)
        ok = False
        if m and m.group(1) in seen:
            # Eerste keer was een regel uit de inhoudstafel (zonder tekst): vervang door de echte kop.
            old = next(p for p in provisions if p["id"] == m.group(1))
            if len(old["tekst"]) < 20 and not m.group(1).startswith("Artikel"):
                provisions.remove(old)
                seen.discard(m.group(1))
        if m and m.group(1) not in seen:
            if m.group(1).startswith("Artikel"):
                n = int(m.group(1).split()[1])
                ok = not in_annex and last_art < n <= last_art + 3  # oplopend (een artikel kan ontbreken)
                if ok:
                    last_art = n
            else:
                ok = in_annex
        if ok:
            seen.add(m.group(1))
            cur = {"id": m.group(1), "titel": (m.group(2) or "")[:200], "pagina": pno, "tekst": ""}
            provisions.append(cur)
            continue
        if cur is None:
            intro.append(text)
        else:
            cur["tekst"] += ("\n" if cur["tekst"] else "") + text
    return intro, provisions


def to_markdown(meta, provisions):
    md = [f"# {meta['titel']}", "",
          f"- Publicatie: {meta['publicatie']} (CELEX {meta['celex']})",
          f"- Link: {meta['url']}",
          f"- **{meta['versie']}**",
          f"- {meta['licentie']}",
          "- Tabellen zijn in platte tekst niet altijd goed leesbaar: controleer ze in de PDF (paginanummer staat bij elke bepaling).", ""]
    for p in provisions:
        md += [f"## {p['id']} {p['titel']}".rstrip() + f"  _(pdf blz. {p['pagina']})_", "", p["tekst"].replace("\n", "\n\n"), ""]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(md)).rstrip() + "\n"


def run(key):
    cfg = DOCS[key]
    meta = {**cfg["meta"], **COMMON_META}
    doc = pymupdf.open(os.path.join(SRC, cfg["pdf"]))
    paras = reflow(lines_with_pages(doc, cfg.get("fixes")), cfg["id"])
    intro, provisions = split(paras, cfg["id"])
    base = os.path.join(SRC, os.path.splitext(cfg["pdf"])[0])
    with open(base + ".json", "w", encoding="utf-8") as f:
        json.dump({**meta, "bepalingen": provisions}, f, ensure_ascii=False, indent=1)
    with open(base + ".md", "w", encoding="utf-8") as f:
        f.write(to_markdown(meta, provisions))
    arts = sum(p["id"].startswith("Artikel") for p in provisions)
    print(f"{key}: {arts} artikelen + {len(provisions) - arts} bijlagepunten → {base}.md/.json")


if __name__ == "__main__":
    for k in (sys.argv[1:] or DOCS):
        run(k)

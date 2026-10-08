#!/usr/bin/env python3
"""Zet een EU-verordening (PDF uit het Publicatieblad / EUR-Lex) om naar leesbare tekst en een JSON per bepaling.

Een "bepaling" is een artikel van de verordening ("Artikel 3") of een punt uit de bijlage
("SERA.5001", "21.A.15", "FCL.740", "MED.A.030" ...). Per bepaling bewaren we ook de pagina van het
Publicatieblad (bv. "L 281/37"), zodat je de originele tekst (en tabellen, die in platte tekst niet
altijd goed overkomen) snel terugvindt en correct kunt citeren.

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
    "aircrew": {
        "pdf": ["aircrew-1178-2011-oorspronkelijk-deel1.pdf", "aircrew-1178-2011-oorspronkelijk-deel2.pdf"],
        "out": "aircrew-1178-2011-oorspronkelijk",
        "id": r"FCL\.\d{3,4}(?:\.[A-Z]{1,4})?|MED\.[A-D]\.\d{3}",
        "meta": {
            "titel": "Verordening (EU) nr. 1178/2011 van de Commissie van 3 november 2011 – bemanning van burgerluchtvaartuigen (Aircrew: Part-FCL, Part-MED …)",
            "kort": "Aircrew (1178/2011), oorspronkelijke versie",
            "celex": "32011R1178",
            "publicatie": "PB L 311 van 25.11.2011, blz. 1",
            "url": "https://eur-lex.europa.eu/eli/reg/2011/1178/oj",
        },
    },
    "airops": {
        "pdf": ["airops-965-2012-oorspronkelijk-deel1.pdf", "airops-965-2012-oorspronkelijk-deel2.pdf"],
        "out": "airops-965-2012-oorspronkelijk",
        "id": r"(?:ARO|ORO|CAT|SPA)(?:\.[A-Z]{1,5}){1,3}\.\d{3}",
        "meta": {
            "titel": "Verordening (EU) nr. 965/2012 van de Commissie van 5 oktober 2012 – vluchtuitvoering (Air Operations: Part-ARO, ORO, CAT, SPA)",
            "kort": "Air Operations (965/2012), oorspronkelijke versie",
            "celex": "32012R0965",
            "publicatie": "PB L 296 van 25.10.2012, blz. 1",
            "url": "https://eur-lex.europa.eu/eli/reg/2012/965/oj",
        },
    },
    "contaw": {
        "pdf": ["cont-airworthiness-1321-2014-oorspronkelijk-deel1.pdf", "cont-airworthiness-1321-2014-oorspronkelijk-deel2.pdf"],
        "out": "cont-airworthiness-1321-2014-oorspronkelijk",
        "id": r"(?:M|145|66|147)\.[AB]\.\d{2,3}[A-Z]?",
        "meta": {
            "titel": "Verordening (EU) nr. 1321/2014 van de Commissie van 26 november 2014 – permanente luchtwaardigheid (Part-M, Part-145, Part-66, Part-147)",
            "kort": "Permanente luchtwaardigheid (1321/2014), oorspronkelijke versie",
            "celex": "32014R1321",
            "publicatie": "PB L 362 van 17.12.2014, blz. 1",
            "url": "https://eur-lex.europa.eu/eli/reg/2014/1321/oj",
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
    "versie": "Oorspronkelijke tekst zoals bekendgemaakt, NIET geconsolideerd: latere wijzigingen ontbreken.",
    "licentie": "EU-wetgeving: hergebruik toegestaan met bronvermelding (Besluit 2011/833/EU). © Europese Unie, https://eur-lex.europa.eu",
}

# Kop- en voetregels van het Publicatieblad
NOISE = re.compile(r"^(NL|L \d+/\d+|Publicatieblad van de Europese Unie|\d{1,2}\.\d{1,2}\.\d{4})$")
TOC = re.compile(r"(\. ){4,}|\.{6,}")  # inhoudstafel met puntjes
HEAD = r"Artikel \d+|Aanhangsel [IVX\d]+|AANHANGSEL [IVX\d]+|BIJLAGE [IVX]+"


def lines_with_pages(docs, fixes=None):
    """Regels zonder kop/voet, met de pagina van het Publicatieblad (bv. "L 281/37") of anders het pdf-paginanummer."""
    fixes = dict(fixes or {})
    pages = [page for doc in docs for page in doc]
    for n, page in enumerate(pages, start=1):
        text = page.get_text()
        oj = re.search(r"(?m)^\s*(L \d+/\d+)\s*$", text)
        pno = oj.group(1) if oj else str(n)
        lines = [l.replace("\xa0", " ").strip() for l in text.splitlines()]
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
    idbrk = rf"{idpat}(?:$|\s+[A-ZÀ-Ý\[])"
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
    """Artikelen staan vóór de bijlage en lopen op (1, 2, 3 ...); bijlagepunten en aanhangsels erna.
    Een bijlagepunt kan meer dan eens als kop voorkomen (inhoudstafel zonder puntjes, verwijzing vooraan
    een regel). Dan houden we de versie met de meeste tekst; de andere wordt bij de vorige bepaling gevoegd."""
    head = re.compile(rf"^({HEAD}|{idpat})(?:$|\s+(?=[A-ZÀ-Ý\[])(.*))")
    provisions, cur, intro = [], None, []
    in_annex, last_art = False, 0
    for pno, text in paras:
        if re.match(r"^(BIJLAGE\b|SECTIE A\b|SUBDEEL A\b)", text):
            in_annex = True
        m = head.match(text)
        ok = False
        if m:
            if m.group(1).startswith("Artikel"):
                n = int(m.group(1).split()[1])
                ok = not in_annex and last_art < n <= last_art + 3  # oplopend (een artikel kan ontbreken)
                if ok:
                    last_art = n
            else:
                ok = in_annex
        if ok:
            cur = {"id": m.group(1), "titel": (m.group(2) or "")[:200], "pagina": pno, "tekst": ""}
            provisions.append(cur)
            continue
        if cur is None:
            intro.append(text)
        else:
            cur["tekst"] += ("\n" if cur["tekst"] else "") + text
    # Dubbels oplossen
    best = {}
    for i, p in enumerate(provisions):
        if p["id"] not in best or len(p["tekst"]) > len(provisions[best[p["id"]]]["tekst"]):
            best[p["id"]] = i
    kept = []
    for i, p in enumerate(provisions):
        if best[p["id"]] == i:
            kept.append(p)
        elif kept:
            extra = f"{p['id']} {p['titel']}".strip() + ("\n" + p["tekst"] if p["tekst"] else "")
            kept[-1]["tekst"] += ("\n" if kept[-1]["tekst"] else "") + extra
    return intro, kept


def to_markdown(meta, provisions):
    md = [f"# {meta['titel']}", "",
          f"- Publicatie: {meta['publicatie']} (CELEX {meta['celex']})",
          f"- Link: {meta['url']}",
          f"- **{meta['versie']}**",
          f"- {meta['licentie']}",
          "- Tabellen zijn in platte tekst niet altijd goed leesbaar: controleer ze in de PDF (de pagina van het Publicatieblad staat bij elke bepaling).", ""]
    for p in provisions:
        md += [f"## {p['id']} {p['titel']}".rstrip() + f"  _(PB {p['pagina']})_", "", p["tekst"].replace("\n", "\n\n"), ""]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(md)).rstrip() + "\n"


def run(key):
    cfg = DOCS[key]
    meta = {**cfg["meta"], **COMMON_META}
    pdfs = cfg["pdf"] if isinstance(cfg["pdf"], list) else [cfg["pdf"]]
    docs = [pymupdf.open(os.path.join(SRC, f)) for f in pdfs]
    paras = reflow(lines_with_pages(docs, cfg.get("fixes")), cfg["id"])
    intro, provisions = split(paras, cfg["id"])
    base = os.path.join(SRC, cfg.get("out") or os.path.splitext(pdfs[0])[0])
    with open(base + ".json", "w", encoding="utf-8") as f:
        json.dump({**meta, "bepalingen": provisions}, f, ensure_ascii=False, indent=1)
    with open(base + ".md", "w", encoding="utf-8") as f:
        f.write(to_markdown(meta, provisions))
    arts = sum(p["id"].startswith("Artikel") for p in provisions)
    print(f"{key}: {arts} artikelen + {len(provisions) - arts} bijlagepunten → {base}.md/.json")


if __name__ == "__main__":
    for k in (sys.argv[1:] or DOCS):
        run(k)

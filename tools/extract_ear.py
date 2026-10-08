#!/usr/bin/env python3
"""Zet EASA Easy Access Rules (Word-XML, download van easa.europa.eu) om naar tekst en een JSON per bepaling.

De Easy Access Rules zijn geconsolideerde versies (Engels) met de regels (IR), de AMC en de GM door elkaar.
Elke kop met een van die stijlen wordt een aparte bepaling, bv.
    {"id": "SERA.14090", "soort": "IR", "titel": "Specific communication procedures", "sectie": "SECTION 14 ...", "tekst": "..."}
    {"id": "AMC1 FCL.210", "soort": "AMC", ...}

    python3 tools/extract_ear.py <bestand.xml> <sleutel> "<titel>" "<versie>"
    bv. python3 tools/extract_ear.py "EAR SERA.xml" sera "Easy Access Rules for SERA" "Revision August 2025"

De ruwe XML (15–65 MB) hoort niet in de repository; alleen het resultaat komt in sources/easa/.
"""
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "sources", "easa")
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
PKG = "{http://schemas.microsoft.com/office/2006/xmlPackage}"

# Kopstijlen van de Easy Access Rules → soort bepaling
PROVISION = re.compile(r"^Heading\d(CR|IR|AMC|GM|CS)$")
CONTEXT = re.compile(r"^Heading[1-3]$")  # PART / ANNEX / SUBPART / SECTION / CHAPTER
# Sommige documenten (bv. de Basic Regulation) gebruiken gewone kopstijlen: dan telt de tekst ("Article 9 – …").
PLAIN = re.compile(r"^Heading[4-6]$")
PLAIN_TEXT = re.compile(r"^(Article|ANNEX|Annex|Appendix)\s+[\dIVX]")
_REF = r"(?:(?:Article|Appendix|Annex)\s+[\w().-]+|[A-Z0-9][A-Z0-9-]*(?:\.[A-Z0-9][A-Za-z0-9]*)+(?:\([a-z0-9]+\))*)"
# Een kop kan naar meerdere punten verwijzen: "AMC1 FCL.115; FCL.120; FCL.210 Titel"
ID = re.compile(rf"^((?:AMC|GM|CS)\d*\s+)?({_REF}(?:\s*[;,&]\s*{_REF})*)\s*(.*)$")


def text_of(el):
    txt = re.sub(r"\s+", " ", "".join(t.text or "" for t in el.iter(W + "t"))).strip()
    return re.sub(r"^(\([a-zA-Z0-9]{1,4}\))(?=\S)", r"\1 ", txt)  # "(a)When" → "(a) When"


def style_of(p):
    s = p.find(W + "pPr/" + W + "pStyle")
    return s.get(W + "val") if s is not None else ""


def walk(el):
    """Paragrafen en tabellen in documentvolgorde (ook binnen content controls)."""
    for ch in el:
        if ch.tag == W + "p":
            yield "p", ch
        elif ch.tag == W + "tbl":
            yield "tbl", ch
        elif ch.tag in (W + "sdt", W + "sdtContent", W + "customXml", W + "smartTag"):
            yield from walk(ch)


def table_lines(tbl):
    for tr in tbl.iter(W + "tr"):
        cells = [" / ".join(t for t in (text_of(p) for p in tc.iter(W + "p")) if t) for tc in tr.findall(W + "tc")]
        if any(cells):
            yield " | ".join(cells)


def document_body(path):
    for ev, el in ET.iterparse(path, events=("end",)):
        if el.tag == PKG + "part":
            if el.get(PKG + "name") == "/word/document.xml":
                return el.find(".//" + W + "body")
            el.clear()  # andere onderdelen (afbeeldingen, stijlen …) niet bewaren
    raise SystemExit("geen /word/document.xml gevonden")


def convert(path):
    body = document_body(path)
    provisions, cur, context = [], None, {}
    started = False
    for kind, el in walk(body):
        if kind == "tbl":
            if cur is not None:
                cur["tekst"].extend(table_lines(el))
            continue
        st, txt = style_of(el), text_of(el)
        if not txt or st.startswith("TOC"):
            continue
        m = PROVISION.match(st)
        if not m and PLAIN.match(st) and PLAIN_TEXT.match(txt):
            m = re.match(r"(IR)", "IR")
        if m:
            started = True
            idm = ID.match(txt)
            pid = ((idm.group(1) or "") + idm.group(2)).strip() if idm else txt[:80]
            cur = {"id": re.sub(r"\s+", " ", pid), "soort": m.group(1), "titel": (idm.group(3) if idm else "").strip(" –—-"),
                   **{k: v for k, v in context.items()}, "tekst": []}
            provisions.append(cur)
            continue
        if CONTEXT.match(st) and (started or re.match(r"^ANNEX [IVX]+\b", txt)):
            started = True
            level = int(st[7])
            context = {k: v for k, v in context.items() if int(k[-1]) < level}
            context[f"kop{level}"] = txt
            if cur is not None and cur["id"].startswith("Annex ") and not cur["tekst"] and not re.match(r"^ANNEX ", txt):
                cur["titel"] = (cur["titel"] + " – " if cur["titel"] else "") + txt  # ondertitel van de bijlage
                continue
            cur = None
            am = re.match(r"^(ANNEX [IVX]+)\b\s*[–—-]?\s*(.*)$", txt)
            if am:  # tekst die direct onder een bijlage staat (bv. de essentiële eisen) niet verliezen
                cur = {"id": "Annex " + am.group(1).split()[1], "soort": "IR", "titel": am.group(2), **context, "tekst": []}
                provisions.append(cur)
            continue
        if cur is not None:
            cur["tekst"].append(txt)
    for p in provisions:
        p["tekst"] = "\n".join(p["tekst"])
    return [p for p in provisions if p["tekst"] or not p["id"].startswith("Annex ")]


def to_markdown(meta, provisions):
    md = [f"# {meta['titel']}", "", f"- Versie: {meta['versie']}", f"- Bron: {meta['bron']}", f"- {meta['licentie']}",
          "- IR = de regel zelf (verordening), AMC = aanvaardbare wijze van naleving, GM = toelichting.", ""]
    for p in provisions:
        md += [f"## {p['id']} {p['titel']}".rstrip() + f"  _({p['soort']})_", "", p["tekst"].replace("\n", "\n\n"), ""]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(md)).rstrip() + "\n"


def main():
    path, key, title, version = sys.argv[1:5]
    provisions = convert(path)
    meta = {
        "titel": title, "kort": key, "versie": version, "taal": "en",
        "bron": "EASA Easy Access Rules (geconsolideerde tekst), https://www.easa.europa.eu/en/document-library/easy-access-rules",
        "licentie": "© European Union / EASA. Hergebruik toegestaan met bronvermelding (zie copyright notice in de Easy Access Rules).",
    }
    os.makedirs(OUT, exist_ok=True)
    base = os.path.join(OUT, key)
    with open(base + ".json", "w", encoding="utf-8") as f:
        json.dump({**meta, "bepalingen": provisions}, f, ensure_ascii=False, indent=0)
    with open(base + ".md", "w", encoding="utf-8") as f:
        f.write(to_markdown(meta, provisions))
    counts = {}
    for p in provisions:
        counts[p["soort"]] = counts.get(p["soort"], 0) + 1
    print(f"{key}: {len(provisions)} bepalingen {counts} → {base}.md/.json")


if __name__ == "__main__":
    main()

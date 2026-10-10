#!/usr/bin/env python3
"""Vul bij de aanvullende vragen (js/extra.js) het veld "fragment" in (en meld AI-vragen zonder leerdoelcode): het stuk wettekst rond het citaat
(de inleidende zin met alle onderdelen), zodat de leerling bij het antwoord genoeg context ziet.

    python3 tools/fragments.py
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = {
    "kb": ("sources/ulm/kb-2024-12-20-ulm.json", "artikelen", lambda a: str(a["artikel"])),
    "sera": ("sources/easa/sera.json", "bepalingen", lambda a: a["id"]),
    "sera2012": ("sources/eu/sera-923-2012-oorspronkelijk.json", "bepalingen", lambda a: a["id"]),
    "aircrew": ("sources/easa/aircrew.json", "bepalingen", lambda a: a["id"]),
    "airops": ("sources/easa/airops.json", "bepalingen", lambda a: a["id"]),
    "ml": ("sources/easa/cont-airworthiness.json", "bepalingen", lambda a: a["id"]),
    "part21": ("sources/easa/part21.json", "bepalingen", lambda a: a["id"]),
    "occ": ("sources/easa/occurrence-reporting.json", "bepalingen", lambda a: a["id"]),
    "atmans": ("sources/easa/atm-ans.json", "bepalingen", lambda a: a["id"]),
    "acc996": ("sources/eu/ongevalsonderzoek-996-2010-oorspronkelijk.json", "bepalingen", lambda a: a["id"]),
}
SUB = re.compile(r"^\s*(\(\d+\)|\([ivx]+\)|\d+°|[a-z]\)|\(\w\)\s*\(\d+\)|-\s)")       # onderdeel van een opsomming
TOP = re.compile(r"^\s*(\([a-z]\)|[a-z]\)\S|§\s*\d+|\d+\.\s)")                      # (a), a), § 1, 1.
NOISE = re.compile(r"^(Commission |Implementing |Delegated )?Regulation \(EU\) \d{4}/\d+$")
MAX = 1400


def window(text, start, end, size=450):
    a, b = max(0, start - size), min(len(text), end + size)
    # afronden op zinsgrenzen
    pa = text.rfind(". ", 0, start)
    a = pa + 2 if pa >= a else a
    pb = text.find(". ", end)
    b = pb + 1 if 0 <= pb <= b else b
    return ("… " if a > 0 else "") + text[a:b].strip() + (" …" if b < len(text) else "")


def fragment(text, cit):
    lines = [l for l in text.split("\n") if not NOISE.match(l.strip())]
    text = "\n".join(lines)
    pos = text.find(cit)
    if pos < 0:
        return None
    if len(text) <= 700:
        return text.strip()
    if len(lines) < 3:
        return window(text, pos, pos + len(cit))
    # regels waarin het citaat staat
    offs, o = [], 0
    for l in lines:
        offs.append(o); o += len(l) + 1
    i = max(k for k in range(len(lines)) if offs[k] <= pos)
    j = max(k for k in range(len(lines)) if offs[k] < pos + len(cit))
    # tabel: de hele tabel (met kop en titel) tonen, ook als het citaat net onder een tabel staat
    row = lambda l: l.count("|") >= 2 or l.strip().startswith("|---")
    prev = next((k for k in range(i - 1, -1, -1) if lines[k].strip()), None)  # vorige niet-lege regel
    if row(lines[i]) or (prev is not None and row(lines[prev]) and not SUB.match(lines[i])):
        k = i if row(lines[i]) else prev
        while k > 0 and (row(lines[k - 1]) or not lines[k - 1].strip()):
            k -= 1
        if k > 0 and re.match(r"^(Table|Tabel)\b", lines[k - 1].strip()):
            k -= 1
        i = min(i, k)
        while j + 1 < len(lines) and row(lines[j + 1]):
            j += 1
        frag = "\n".join(lines[i:j + 1]).strip()
        return frag if len(frag) <= 2 * MAX else window(text, pos, pos + len(cit))
    # omhoog: tot en met de inleidende zin van de opsomming (en het hoofdpunt (a), § 1 …)
    while i > 0 and (SUB.match(lines[i]) or lines[i - 1].rstrip().endswith(":")) and not TOP.match(lines[i]):
        i -= 1
    # omlaag: de opsomming afmaken
    while j + 1 < len(lines) and (lines[j].rstrip().endswith((":", ";", ",", "; and", "; or", ", and", ", or", " and", " or", "en", "of")) or SUB.match(lines[j + 1])) and not TOP.match(lines[j + 1]):
        j += 1
    frag = "\n".join(lines[i:j + 1]).strip()
    if len(frag) > MAX:
        return window(text, pos, pos + len(cit))
    if frag == cit.strip() and len(lines) > 1:  # geen context gevonden: neem de regel ervoor erbij
        frag = "\n".join(lines[max(0, i - 1):j + 1]).strip()
    return frag


def main():
    p = os.path.join(ROOT, "js", "extra.js")
    s = open(p, encoding="utf-8").read()
    head, ex = s[:s.index("=") + 1], json.loads(s[s.index("=") + 1:s.rindex(";")])
    cache, n, missing = {}, 0, []
    for q in ex:
        if not q.get("citaat") or not q.get("art"):
            continue
        doc = q.get("doc") or "kb"
        path, key, idf = DOCS[doc]
        if doc not in cache:
            cache[doc] = json.load(open(os.path.join(ROOT, path), encoding="utf-8"))[key]
        hits = [a for a in cache[doc] if idf(a) == str(q["art"])]
        a = next((a for a in hits if q["citaat"] in a["tekst"]), None)
        f = fragment(a["tekst"], q["citaat"]) if a else None
        if f:
            q["fragment"] = f; n += 1
        else:
            missing.append(q["id"])
    open(p, "w", encoding="utf-8").write(head + " " + json.dumps(ex, ensure_ascii=False, indent=1) + ";\n")
    print(f"{n} fragmenten; zonder: {missing}")
    # Elke AI-vraag hoort een ECQB-leerdoelcode te hebben (veld "lo"), behalve vragen over het Belgische KB ULM.
    nolo = [q["id"] for q in ex if str(q.get("opgesteld", "")).startswith("AI") and not re.match(r"^\d+(\.\d+)+$", q.get("lo") or "") and q.get("doc") != "kb"]
    if nolo:
        print(f"LET OP: {len(nolo)} AI-vragen zonder leerdoelcode: {nolo[:20]}")


if __name__ == "__main__":
    main()

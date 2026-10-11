"""Zet een AIP-deel (PDF van AIM Belgium, bv. GEN of ENR) om naar JSON en Markdown, per subsectie (GEN 1.7, ENR 1.2 …).

Gebruik: python3 tools/extract_aip.py sources/aip/GEN.pdf sources/aip/gen
Schrijft <uit>.json ({"bron", "amdt", "subsecties": [{id, titel, paginas, tekst}]}) en <uit>.md.
Vereist pdftotext (poppler-utils).
"""
import json, re, subprocess, sys
from collections import Counter

pdf, uit = sys.argv[1], sys.argv[2]
raw = subprocess.run(["pdftotext", "-layout", pdf, "-"], capture_output=True, text=True, check=True).stdout
pages = raw.split("\f")
PAGE_ID = re.compile(r"\b((?:GEN|ENR|AD) \d\.\d+(?:\.\d+)?)-(\d+)\b")
JUNK = re.compile(r"^\s*(AIP Belgium and Luxembourg|©\s*AIM BELGIUM|(AIRAC )?AMDT \d+/\d{4}|\d{2}-[A-Z]{3}-\d{4})\b")

subs, order, amdts = {}, [], Counter()
for nr, pg in enumerate(pages, 1):
    lines = pg.split("\n")
    head = "\n".join(lines[:8] + lines[-8:])
    m = PAGE_ID.search(head)
    if not m:
        continue
    sid = m.group(1)
    amdts.update(re.findall(r"AMDT (\d+/\d{4})", head))
    keep = []
    for ln in lines:
        if JUNK.match(ln) or PAGE_ID.fullmatch(ln.strip()) or re.fullmatch(r"\s*" + re.escape(m.group(0)) + r"\s*", ln):
            continue
        s = re.sub(r"\s*\b(?:GEN|ENR|AD) \d\.\d+(?:\.\d+)?-\d+\s*$", "", ln)
        s = re.sub(r"^\s*(?:GEN|ENR|AD) \d\.\d+(?:\.\d+)?-\d+\s+AIP Belgium and Luxembourg\s*$", "", s)
        s = re.sub(r"\s+(AIP Belgium and Luxembourg|©\s*AIM BELGIUM|(AIRAC )?AMDT \d+/\d{4}|\d{2}-[A-Z]{3}-\d{4})\s*$", "", s)
        keep.append(s.rstrip())
    txt = re.sub(r"\n{3,}", "\n\n", "\n".join(keep)).strip("\n")
    if sid not in subs:
        subs[sid] = {"id": sid, "titel": "", "paginas": [], "tekst": []}
        order.append(sid)
    subs[sid]["paginas"].append(nr)
    subs[sid]["tekst"].append(txt)

out = []
for sid in order:
    s = subs[sid]
    tekst = "\n\n".join(s["tekst"])
    t = re.search(re.escape(sid) + r" +([^\n]+(?:\n {3,}[A-Z][^\n]*)?)", tekst)
    titel = re.sub(r"\s+", " ", t.group(1)).strip() if t else ""
    out.append({"id": sid, "titel": titel, "paginas": [s["paginas"][0], s["paginas"][-1]], "tekst": tekst})

def key(a):
    return [int(x) for x in re.findall(r"\d+", a.split("/")[1] + " " + a.split("/")[0])]
nieuwste = max(amdts, key=key) if amdts else ""
json.dump({"bron": "AIP Belgium and Luxembourg (AIM Belgium / skeyes) – " + pdf.rsplit("/", 1)[-1],
           "amdt": "AIRAC AMDT " + nieuwste, "subsecties": out},
          open(uit + ".json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
with open(uit + ".md", "w", encoding="utf-8") as f:
    f.write(f"# AIP Belgium and Luxembourg – {pdf.rsplit('/', 1)[-1]}\n\nNieuwste wijziging in dit deel: AIRAC AMDT {nieuwste}. "
            "Tekst automatisch uit de PDF gehaald (pdftotext -layout); tabellen en kaarten: zie de PDF.\n\n")
    for s in out:
        f.write(f"## {s['id']} – {s['titel']}\n\n_PDF-pagina's {s['paginas'][0]}–{s['paginas'][1]}_\n\n```\n{s['tekst']}\n```\n\n")
print(len(out), "subsecties; nieuwste", nieuwste)

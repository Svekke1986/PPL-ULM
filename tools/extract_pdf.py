"""Extract ECQB sample questions (LPLUS TestStudio "detailed view" PDFs) to JSON.

Usage: python3 tools/extract_pdf.py <subject_key> <pdf> [<pdf> ...]
Writes data/<subject_key>.json and images to img/<subject_key>/.
The correct answer is the option whose checkbox has a green fill.
"""
import json, os, re, sys
import pymupdf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def is_green(fill):
    r, g, b = fill
    return g > 0.8 and r < 0.7 and b < 0.7


def footer(page):
    t = page.get_text()
    qid = re.search(r"ID:\s*\n?\s*(\d+)", t)
    topic = re.search(r"Topic:\s*\n?\s*([^\n]+)", t)
    return (qid.group(1) if qid else None, topic.group(1).strip() if topic else "")


def extract(subject, pdfs):
    imgdir = os.path.join(ROOT, "img", subject)
    os.makedirs(imgdir, exist_ok=True)
    questions, by_id = [], {}
    for pdf in pdfs:
        doc = pymupdf.open(pdf)
        for page in doc:
            qid, topic = footer(page)
            blocks = page.get_text("dict")["blocks"]
            spans = [(s["bbox"], s["text"], s["color"], s["size"])
                     for b in blocks if b["type"] == 0
                     for l in b["lines"] for s in l["spans"]]
            # body = between the header rule and the footer ("ID:" line)
            foot = min([s[0][1] for s in spans if s[1].strip() == "ID:"] or [780])
            head = max([s[0][1] for s in spans if s[1].strip().startswith("Examination date")] or [80]) + 8
            body = [s for s in spans if head < s[0][1] < foot - 2]
            images = [b for b in blocks if b["type"] == 1 and head < b["bbox"][1] < foot]
            if any(t.startswith("Attachment") or ".jpg (" in t or ".png (" in t for _, t, _, _ in body):
                q = by_id.get(qid)
                for n, im in enumerate(images):
                    name = f"{qid}_{len(q['images']) if q else n}.{im['ext']}"
                    with open(os.path.join(imgdir, name), "wb") as fh:
                        fh.write(im["image"])
                    if q:
                        q["images"].append(f"img/{subject}/{name}")
                continue
            boxes = sorted([s for s in body if s[1].strip() == "[ ]"], key=lambda s: s[0][1])
            if len(boxes) != 4:
                print("skip page", page.number, pdf, file=sys.stderr)
                continue
            first = boxes[0][0][1]
            qtext = [s for s in body if s[2] != 0 and s[0][1] < first]
            opts = []
            for i, bx in enumerate(boxes):
                y0 = bx[0][1] - 2
                y1 = boxes[i + 1][0][1] - 2 if i < 3 else foot
                opts.append(" ".join(s[1].strip() for s in body
                                     if s[0][0] > 75 and y0 <= s[0][1] < y1 and s[1].strip()))
            greens = [d["rect"] for d in page.get_drawings() if d.get("fill") and is_green(d["fill"])]
            correct = [i for i, bx in enumerate(boxes)
                       if any(r.y0 - 3 <= (bx[0][1] + bx[0][3]) / 2 <= r.y1 + 3 for r in greens)]
            if len(correct) != 1:
                print("no unique correct answer on page", page.number, pdf, correct, file=sys.stderr)
                continue
            text = " ".join(s[1].strip() for s in qtext if s[1].strip())
            q = {"id": qid, "topic": topic, "question": re.sub(r"\s+", " ", text),
                 "options": [re.sub(r"\s+", " ", o) for o in opts], "correct": correct[0], "images": []}
            questions.append(q)
            by_id[qid] = q
    out = os.path.join(ROOT, "data", f"{subject}.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(questions, fh, ensure_ascii=False, indent=1)
    print(subject, len(questions), "questions")


if __name__ == "__main__":
    extract(sys.argv[1], sys.argv[2:])

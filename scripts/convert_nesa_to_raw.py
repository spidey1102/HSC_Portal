#!/usr/bin/env python3
"""Convert NESA `nesappscraper` JSON into the raw paper list expected by optimize_data.py.

This script fetches the published `data.json` from the archived `nesappscraper`
repo by default and writes a flattened list of paper objects to `public/papers.json`.
Run in CI or locally before `optimize_data.py` to produce the optimized DB the
frontend expects.
"""
import json
import os
import re
import sys
import urllib.request

DEFAULT_URL = "https://raw.githubusercontent.com/notsidney/nesappscraper/master/data.json"
OUTPUT_PATH = "public/papers.json"


def fetch_url(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8")


def load_json(source: str):
    if source.startswith("http://") or source.startswith("https://"):
        text = fetch_url(source)
        return json.loads(text)
    else:
        with open(source, "r", encoding="utf-8") as fh:
            return json.load(fh)


def extract_year(text: str) -> str:
    if not text:
        return "Other"
    m = re.search(r"\b(19\d{2}|20\d{2})\b", str(text))
    return m.group(1) if m else "Other"


def doc_has_solution(name: str) -> bool:
    ln = (name or "").lower()
    return any(k in ln for k in ("marking", "guideline", "answer", "sample", "solution", "markscheme"))


def main():
    source = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_URL
    print(f"Loading NESA data from: {source}")
    try:
        data = load_json(source)
    except Exception as e:
        print(f"Failed to load JSON from {source}: {e}")
        raise

    raw_papers = []

    # Expect data to be a list of course items with `course_name` and `packs`
    for course in data:
        subject_name = course.get("course_name") or course.get("name") or "Unknown"
        packs = course.get("packs") or []
        for pack in packs:
            pack_year = pack.get("year") or ""
            docs = pack.get("docs") or []
            for doc in docs:
                doc_name = doc.get("doc_name") or doc.get("name") or ""
                doc_link = doc.get("doc_link") or doc.get("link") or ""
                if not doc_link:
                    continue

                year = extract_year(pack_year)
                if year == "Other":
                    year = extract_year(doc_name)

                has_solution = doc_has_solution(doc_name)

                raw_papers.append({
                    "name": doc_name,
                    "viewno": doc_link,
                    "subject": subject_name,
                    "level": "Year 12",
                    "category": "HSC Papers",
                    "year": year,
                    "school": "NESA",
                    "has_solution": has_solution,
                    "viewUrl": doc_link,
                    "downloadUrl": doc_link,
                    "iframeUrl": ""
                })

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as out_f:
        json.dump(raw_papers, out_f, indent=2, ensure_ascii=False)

    print(f"Wrote {len(raw_papers)} raw papers to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()

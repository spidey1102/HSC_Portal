#!/usr/bin/env python3
"""
Extract question-like blocks from a PDF and write JSON to public/extracted/<paperId>.json

Usage:
  python scripts/extract_questions.py --paper-id 1078 --pdf /path/to/file.pdf
  python scripts/extract_questions.py --paper-id 1078 --url https://example.com/file.pdf

Output:
  public/extracted/<paperId>.json

Requires: PyMuPDF (pip install PyMuPDF requests)
"""
import argparse
import json
import os
import re
import sys
import tempfile
from pathlib import Path

try:
    import fitz
except Exception:
    print("Missing dependency: PyMuPDF (fitz). Install with: pip install PyMuPDF")
    sys.exit(1)

try:
    import requests
except Exception:
    print("Missing dependency: requests. Install with: pip install requests")
    sys.exit(1)


QUESTION_START_PATTERNS = [
    r"^Question\s+\d+[:\.\)]?",
    r"^Q\.?\s*\d+[:\.\)]?",
    r"^\d+\.[ ]",  # e.g. 1. text
    r"^\d+\)",
]


def download(url, dest_path):
    r = requests.get(url, stream=True, timeout=30)
    r.raise_for_status()
    with open(dest_path, "wb") as f:
        for chunk in r.iter_content(1024 * 8):
            if chunk:
                f.write(chunk)


def extract_text_from_pdf(pdf_path):
    doc = fitz.open(pdf_path)
    pages = []
    for i in range(len(doc)):
        page = doc.load_page(i)
        text = page.get_text("text")
        pages.append({"page": i + 1, "text": text})
    return pages


def split_into_questions(pages):
    # Naive heuristic: scan through pages and split by question-like headers
    all_text = []
    for p in pages:
        lines = p["text"].splitlines()
        for ln in lines:
            all_text.append({"page": p["page"], "line": ln})

    # Build a long text with markers
    full = "\n".join([f"@@PAGE{l['page']}@@{l['line']}" for l in all_text])

    # Find candidate positions
    pattern = re.compile("|".join(f"({p})" for p in QUESTION_START_PATTERNS), re.IGNORECASE | re.MULTILINE)
    matches = list(pattern.finditer(full))

    if not matches:
        # fallback: split by double newlines into chunks
        chunks = [c.strip() for c in full.split("\n\n") if c.strip()]
        return [{"id": i + 1, "qnum": i + 1, "text": chunk, "page": 1} for i, chunk in enumerate(chunks[:200])]

    questions = []
    for idx, m in enumerate(matches):
        start = m.start()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(full)
        chunk = full[start:end].strip()
        # Recover page number from first line marker
        page_match = re.search(r"@@PAGE(\d+)@@", chunk)
        page = int(page_match.group(1)) if page_match else 1
        # Clean markers
        clean = re.sub(r"@@PAGE\d+@@", "", chunk).strip()
        questions.append({"id": idx + 1, "qnum": idx + 1, "text": clean, "page": page})

    return questions


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--paper-id", required=True)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--pdf", help="Path to local PDF file")
    group.add_argument("--url", help="URL to download PDF from")
    args = parser.parse_args()

    tmp_file = None
    try:
        if args.url:
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
            tmp.close()
            print(f"Downloading {args.url} ...")
            download(args.url, tmp.name)
            pdf_path = tmp.name
            tmp_file = tmp.name
        else:
            pdf_path = args.pdf

        print(f"Extracting text from {pdf_path} ...")
        pages = extract_text_from_pdf(pdf_path)

        # normalize pages structure
        pages_norm = [{"page": p["page"], "text": p["text"]} for p in pages]
        questions = split_into_questions(pages_norm)

        out_dir = Path("public") / "extracted"
        out_dir.mkdir(parents=True, exist_ok=True)
        out_file = out_dir / f"{args.paper_id}.json"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump({"paperId": args.paper_id, "questions": questions}, f, ensure_ascii=False, indent=2)

        print(f"Wrote {out_file} with {len(questions)} questions")
    finally:
        if tmp_file and os.path.exists(tmp_file):
            try:
                os.unlink(tmp_file)
            except Exception:
                pass


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Create a resumable ten-paper inventory and source-page contact sheets.

The source PDFs remain read-only. Progress and generated previews are written
outside the repository under the user's Codex scratch directory.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CATALOG = REPO / "public" / "papers.json"
PDF_ROOT = Path(r"C:\Users\manup\Downloads\THSC Papers - GitHub")
OUTPUT_ROOT = Path(r"C:\Users\manup\.gemini\antigravity\scratch\paper-analysis")
OCR_RUNTIME = OUTPUT_ROOT / "ocr-active"
LEDGER = OUTPUT_ROOT / "ledger.json"
BATCH_SIZE = 10

if OCR_RUNTIME.exists():
    sys.path.insert(0, str(OCR_RUNTIME))
import fitz
from PIL import Image, ImageDraw, ImageFont


def paper_identity(paper: dict) -> str:
    fields = ("v", "s", "l", "c", "y", "h", "w", "n")
    return json.dumps([paper.get(key) for key in fields], ensure_ascii=False, separators=(",", ":"))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def ensure_ledger(catalog: list[dict]) -> dict:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    if LEDGER.exists():
        ledger = json.loads(LEDGER.read_text(encoding="utf-8"))
        if ledger.get("catalog_count") != len(catalog):
            raise RuntimeError("Website catalog size changed; reconcile the ledger before resuming.")
        if ledger.get("catalog_fingerprint") != hashlib.sha256(
            CATALOG.read_bytes()
        ).hexdigest():
            raise RuntimeError("Website catalog changed; reconcile the ledger before resuming.")
        return ledger

    papers = []
    for index, paper in enumerate(catalog):
        papers.append({
            "catalog_index": index,
            "batch": index // BATCH_SIZE + 1,
            "identity": paper_identity(paper),
            "paper_id": str(paper.get("v", "")),
            "title": str(paper.get("n", "")),
            "year": paper.get("y"),
            "level": paper.get("l"),
            "category": paper.get("c"),
            "subject_index": paper.get("s"),
            "school_index": paper.get("h"),
            "source_path": str(paper.get("cf", "")),
            "source_url": str(paper.get("pdfUrl", "")),
            "local_path": str(PDF_ROOT / str(paper.get("cf", ""))),
            "source_sha256": None,
            "page_count": None,
            "analysis_status": "pending",
            "crop_review_status": "pending",
            "retry_count": 0,
            "failure_reason": None,
            "questions": [],
        })
    ledger = {
        "format_version": 1,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "catalog_count": len(catalog),
        "catalog_fingerprint": hashlib.sha256(CATALOG.read_bytes()).hexdigest(),
        "batch_size": BATCH_SIZE,
        "papers": papers,
        "batch_history": [],
    }
    save_ledger(ledger)
    return ledger


def save_ledger(ledger: dict) -> None:
    temp = LEDGER.with_suffix(".tmp")
    temp.write_text(json.dumps(ledger, ensure_ascii=False, indent=2), encoding="utf-8")
    temp.replace(LEDGER)


def contact_sheet(pdf_path: Path, output: Path, document: fitz.Document) -> None:
    columns = 4
    thumb_width = 360
    margin = 18
    label_height = 28
    cell_height = math.ceil(thumb_width * 1.48) + label_height
    rows = math.ceil(len(document) / columns)
    canvas = Image.new(
        "RGB",
        (margin * 2 + columns * (thumb_width + margin), margin * 2 + rows * (cell_height + margin)),
        "#d5d5d5",
    )
    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype("arial.ttf", 16)
    except OSError:
        font = ImageFont.load_default()

    for page_index, page in enumerate(document):
        pixmap = page.get_pixmap(matrix=fitz.Matrix(thumb_width / page.rect.width, thumb_width / page.rect.width), alpha=False)
        image = Image.frombytes("RGB", [pixmap.width, pixmap.height], pixmap.samples)
        row, col = divmod(page_index, columns)
        x = margin + col * (thumb_width + margin)
        y = margin + row * (cell_height + margin)
        canvas.paste(image, (x, y + label_height))
        draw.text((x, y + 4), f"Source page {page_index + 1}", fill="#111111", font=font)

    canvas.save(output, optimize=True)


def process_batch(ledger: dict, batch_number: int, force: bool = False, only_indexes: set[int] | None = None) -> None:
    start = (batch_number - 1) * BATCH_SIZE
    papers = ledger["papers"][start:start + BATCH_SIZE] if only_indexes is None else [
        record for record in ledger["papers"] if int(record["catalog_index"]) in only_indexes
    ]
    batch_dir = OUTPUT_ROOT / f"batch-{batch_number:04d}"
    batch_dir.mkdir(parents=True, exist_ok=True)
    paper_catalog = json.loads(CATALOG.read_text(encoding="utf-8"))["papers"]
    ocr_engine = None
    if OCR_RUNTIME.exists():
        sys.path.insert(0, str(OCR_RUNTIME))
        try:
            from rapidocr import RapidOCR
            ocr_engine = RapidOCR()
        except (ImportError, PermissionError, OSError) as error:
            print(f"OCR runtime unavailable; preserving native-text extraction and marking image-only pages for retry: {error}", file=sys.stderr)

    for record in papers:
        local_path = Path(record["local_path"])
        if not local_path.is_file():
            record["analysis_status"] = "blocked"
            record["failure_reason"] = "Exact catalog source path is missing locally."
            save_ledger(ledger)
            continue
        prior_status = record.get("analysis_status", "pending")
        prior_failure = record.get("failure_reason")
        prior_hash = record.get("source_sha256")
        prior_page_text = None
        prior_text_file = Path(record.get("page_text_file") or "")
        if prior_text_file.is_file():
            try:
                prior_extraction = json.loads(prior_text_file.read_text(encoding="utf-8"))
                if (prior_extraction.get("identity") == record.get("identity")
                        and prior_extraction.get("sha256") == prior_hash):
                    prior_page_text = [str(page.get("text") or "") for page in prior_extraction.get("pages", [])]
            except (OSError, ValueError, TypeError):
                prior_page_text = None
        current_hash = sha256(local_path)
        # Reuse extraction only when the exact source fingerprint and all saved
        # extraction artifacts still match. This preserves mapping/provider
        # blockers for a later retry instead of resetting them during inventory.
        # Pass --force after repairing OCR or when deliberately rebuilding it.
        if not force and prior_hash:
            text_file = Path(record.get("page_text_file") or "")
            contact_file = Path(record.get("contact_sheet") or "")
            if current_hash == prior_hash and text_file.is_file() and contact_file.is_file():
                try:
                    saved_text = json.loads(text_file.read_text(encoding="utf-8"))
                    source_matches = (
                        saved_text.get("identity") == record.get("identity")
                        and saved_text.get("sha256") == current_hash
                        and len(saved_text.get("pages", [])) == int(record.get("page_count") or 0)
                    )
                except (OSError, ValueError, TypeError):
                    source_matches = False
                if source_matches:
                    continue

        catalog_paper = paper_catalog[record["catalog_index"]]
        try:
            digest = sha256(local_path)
            document = fitz.open(local_path)
            page_text = [page.get_text("text", sort=True) for page in document]
            text_chars = [len(text.strip()) for text in page_text]
            page_records = []
            for page_index, page in enumerate(document):
                native_words = page.get_text("words", sort=True)
                if page_text[page_index].strip():
                    boxes = [{
                        "text": str(word[4]),
                        "bbox": [round(float(value), 2) for value in word[:4]],
                        "confidence": 1.0,
                    } for word in native_words]
                    ocr_used = False
                elif ocr_engine is not None:
                    pixmap = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0), alpha=False)
                    image_path = batch_dir / f".ocr-{record['catalog_index'] + 1:05d}-{page_index + 1:03d}.png"
                    pixmap.save(image_path)
                    ocr_result = ocr_engine(str(image_path))
                    image_path.unlink(missing_ok=True)
                    scale_x = page.rect.width / pixmap.width
                    scale_y = page.rect.height / pixmap.height
                    boxes = []
                    if ocr_result is not None:
                        ocr_boxes = getattr(ocr_result, "boxes", None)
                        ocr_texts = getattr(ocr_result, "txts", None)
                        ocr_scores = getattr(ocr_result, "scores", None)
                        if ocr_boxes is None or ocr_texts is None or ocr_scores is None:
                            ocr_boxes, ocr_texts, ocr_scores = [], [], []
                        for polygon, text, confidence in zip(ocr_boxes, ocr_texts, ocr_scores):
                            xs = [float(point[0]) for point in polygon]
                            ys = [float(point[1]) for point in polygon]
                            boxes.append({
                                "text": str(text),
                                "bbox": [round(min(xs) * scale_x, 2), round(min(ys) * scale_y, 2),
                                         round(max(xs) * scale_x, 2), round(max(ys) * scale_y, 2)],
                                "confidence": round(float(confidence), 4),
                            })
                        page_text[page_index] = " ".join(box["text"] for box in boxes)
                    ocr_used = True
                else:
                    boxes = []
                    ocr_used = False
                page_records.append({
                    "page": page_index + 1,
                    "width": round(float(page.rect.width), 2),
                    "height": round(float(page.rect.height), 2),
                    "ocr_used": ocr_used,
                    "text": page_text[page_index],
                    "text_boxes": boxes,
                })
            new_page_text = [str(page.get("text") or "") for page in page_records]
            source_changed = bool(prior_hash and prior_hash != digest)
            text_changed = bool(prior_hash and (
                prior_page_text is None or prior_page_text != new_page_text
            ))
            stale_reason = "source fingerprint changed" if source_changed else "extracted text changed after OCR refresh"
            invalidates_map = source_changed or text_changed
            if invalidates_map:
                if (record.get("questions") or record.get("crop_candidates")
                        or prior_status in {"mapped", "reviewed", "mapped_pending_review"}):
                    record.setdefault("stale_question_maps", []).append({
                        "source_sha256": prior_hash,
                        "status": prior_status,
                        "reason": stale_reason,
                        "archived_at": datetime.now(timezone.utc).isoformat(),
                        "questions": record.get("questions", []),
                        "total_marks": record.get("total_marks"),
                        "question_count": record.get("question_count"),
                        "map_confidence": record.get("map_confidence"),
                        "map_notes": record.get("map_notes"),
                        "crop_candidates": record.get("crop_candidates", []),
                        "map_extraction": record.get("map_extraction"),
                        "mapped_at": record.get("mapped_at"),
                    })
                record["questions"] = []
                record["total_marks"] = None
                record["question_count"] = 0
                record["map_confidence"] = None
                record["map_notes"] = stale_reason
                record["crop_candidates"] = []
                record["mapped_at"] = None
            if source_changed and record.get("verified_crops"):
                record.setdefault("stale_verified_crops", []).append({
                    "source_sha256": prior_hash,
                    "archived_at": datetime.now(timezone.utc).isoformat(),
                    "crops": record["verified_crops"],
                })
                record["verified_crops"] = []
                record["crop_review_status"] = "pending"
            if source_changed and record.get("manual_source_review"):
                record["stale_manual_source_reviews"] = record.pop("manual_source_review")
            record.update({
                "source_sha256": digest,
                "page_count": len(document),
                "extraction": {
                    "per_page_text_chars": [len(text.strip()) for text in page_text],
                    "embedded_text_chars": sum(text_chars),
                    "ocr_pages": sum(1 for page in page_records if page["ocr_used"]),
                    "image_only_pages": [page["page"] for page, chars in zip(page_records, (len(text.strip()) for text in page_text)) if chars < 24],
                    "ocr_provider_available": ocr_engine is not None,
                },
            })
            if source_changed or text_changed or not prior_hash:
                record["analysis_status"] = "needs_question_analysis"
                record["failure_reason"] = None
                record["crop_review_status"] = "pending"
            else:
                record["analysis_status"] = prior_status
                record["failure_reason"] = prior_failure
            slug = re.sub(r"[^a-zA-Z0-9]+", "-", record["title"]).strip("-").lower()
            contact_path = batch_dir / f"{record['catalog_index'] + 1:05d}-{slug}-source-pages.png"
            contact_sheet(local_path, contact_path, document)
            text_path = batch_dir / f"{record['catalog_index'] + 1:05d}-{slug}-page-text.json"
            text_path.write_text(json.dumps({
                "identity": record["identity"],
                "sha256": digest,
                "pages": page_records,
            }, ensure_ascii=False, indent=2), encoding="utf-8")
            record["contact_sheet"] = str(contact_path)
            record["page_text_file"] = str(text_path)
            document.close()
        except Exception as error:  # Keep the batch resumable if an individual PDF fails.
            record["retry_count"] = int(record.get("retry_count", 0)) + 1
            record["analysis_status"] = "blocked"
            record["failure_reason"] = f"{type(error).__name__}: {error}"
        save_ledger(ledger)

    ledger["batch_history"].append({
        "batch": batch_number,
        "paper_count": len(papers),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "paper_indices": [paper["catalog_index"] for paper in papers],
    })
    save_ledger(ledger)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", type=int, default=1)
    parser.add_argument("--only-indexes", help="Comma-separated zero-based catalog indexes; bypasses the ten-row catalog slice.")
    parser.add_argument("--force", action="store_true", help="Re-fingerprint and regenerate previews for this batch.")
    args = parser.parse_args()
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))["papers"]
    ledger = ensure_ledger(catalog)
    if args.batch < 1 or (args.batch - 1) * BATCH_SIZE >= len(catalog):
        raise SystemExit(f"Batch must be between 1 and {math.ceil(len(catalog) / BATCH_SIZE)}.")
    only_indexes = None if not args.only_indexes else {int(value) for value in args.only_indexes.split(",")}
    process_batch(ledger, args.batch, args.force, only_indexes)
    records = ledger["papers"][(args.batch - 1) * BATCH_SIZE:args.batch * BATCH_SIZE] if only_indexes is None else [
        record for record in ledger["papers"] if int(record["catalog_index"]) in only_indexes
    ]
    counts = {}
    for record in records:
        counts[record["analysis_status"]] = counts.get(record["analysis_status"], 0) + 1
    print(json.dumps({
        "ledger": str(LEDGER),
        "batch": args.batch,
        "paper_count": len(records),
        "status_counts": counts,
        "papers": [{
            "catalog_index": record["catalog_index"],
            "title": record["title"],
            "page_count": record["page_count"],
            "analysis_status": record["analysis_status"],
            "source_sha256": record["source_sha256"],
            "contact_sheet": record.get("contact_sheet"),
        } for record in records],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

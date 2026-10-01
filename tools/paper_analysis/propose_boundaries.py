#!/usr/bin/env python3
"""Propose fingerprint-bound question page fragments from saved OCR boxes.

This creates unapproved candidates only. Page and part boundaries still need
source-level review before they can be used for PDF export.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(r"C:\Users\manup\.gemini\antigravity\scratch\paper-analysis")
LEDGER = ROOT / "ledger.json"
BATCH_SIZE = 10
QUESTION = re.compile(r"\bquestion\s+(\d{1,3})\s*\.?\s*\(?\s*(\d{1,3})\s*marks?\s*\)?", re.I)
QUESTION_LABEL = re.compile(r"\bquestion\s+(\d{1,3})\s*\.?", re.I)
MC_ITEM = re.compile(r"^\s*(?:question\s+(\d{1,2})\s*[.)]?\s+(.{12,})|(\d{1,2})\s*[.)]?\s+(.{12,}))$", re.I)
MC_HEADER_ONLY = re.compile(r"^\s*question\s+(\d{1,2})\s*\.?\s*$", re.I)
MARKING = re.compile(r"marking\s+guidelines?|mark\s+scheme|suggested\s+answers?|worked\s+solutions?", re.I)


def text_lines(page: dict) -> list[dict]:
    """Group OCR/native word boxes into approximate visual lines."""
    words = [b for b in page.get("text_boxes", []) if str(b.get("text", "")).strip() and len(b.get("bbox", [])) == 4]
    words.sort(key=lambda b: ((float(b["bbox"][1]) + float(b["bbox"][3])) / 2, float(b["bbox"][0])))
    lines: list[dict] = []
    for word in words:
        x0, y0, x1, y1 = map(float, word["bbox"])
        mid = (y0 + y1) / 2
        height = y1 - y0
        target = next((line for line in reversed(lines[-8:]) if abs(line["mid"] - mid) <= max(3.0, min(height, line["height"]) * 0.55)), None)
        if target is None:
            lines.append({"mid": mid, "height": height, "bbox": [x0, y0, x1, y1], "items": [word]})
        else:
            target["items"].append(word)
            target["bbox"] = [min(target["bbox"][0], x0), min(target["bbox"][1], y0), max(target["bbox"][2], x1), max(target["bbox"][3], y1)]
            target["mid"] = sum((float(w["bbox"][1]) + float(w["bbox"][3])) / 2 for w in target["items"]) / len(target["items"])
            target["height"] = max(target["height"], height)
    result = []
    for line in lines:
        line["items"].sort(key=lambda b: float(b["bbox"][0]))
        result.append({"text": " ".join(str(b["text"]) for b in line["items"]), "bbox": line["bbox"]})
    return sorted(result, key=lambda line: line["bbox"][1])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", type=int, default=1)
    parser.add_argument("--only-indexes", help="Comma-separated zero-based catalog indexes.")
    parser.add_argument("--output-dir", help="Destination folder for this candidate set.")
    args = parser.parse_args()
    ledger = json.loads(LEDGER.read_text(encoding="utf-8"))
    indexes = None if not args.only_indexes else {int(value) for value in args.only_indexes.split(",")}
    records = (
        ledger["papers"][(args.batch - 1) * BATCH_SIZE:args.batch * BATCH_SIZE]
        if indexes is None else [record for record in ledger["papers"] if int(record["catalog_index"]) in indexes]
    )
    if not records:
        raise SystemExit(f"No papers in batch {args.batch}.")
    output = {"batch": args.batch, "approval_status": "pending", "warning": "OCR-derived page-fragment proposals only; visually inspect against each source PDF. Not exportable.", "papers": []}

    for record in records:
        source = json.loads(Path(record["page_text_file"]).read_text(encoding="utf-8"))
        if source.get("sha256") != record.get("source_sha256"):
            raise SystemExit(f"Fingerprint mismatch for {record['title']}.")
        pages = source["pages"]
        found = []
        page_lines = [text_lines(page) for page in pages]
        solution_start = next((index for index, lines in enumerate(page_lines)
                               if MARKING.search(" ".join(line["text"] for line in lines[:28]))), len(pages))
        page_segments = []
        current_segment = "paper1"
        for lines in page_lines:
            header = " ".join(line["text"] for line in lines[:18])
            if re.search(r"paper\s*2", header, re.I) and not re.search(r"paper\s*1", header, re.I):
                current_segment = "paper2"
            page_segments.append(current_segment)
        segment_end = {}
        for page_number, segment in enumerate(page_segments, 1):
            segment_end[segment] = page_number
        mc_range = None
        for page_index, lines in enumerate(page_lines):
            text = pages[page_index].get("text", "") + " " + " ".join(line["text"] for line in lines)
            if page_index >= solution_start:
                continue
            if re.search(r"part\s*a", text, re.I) and re.search(r"(?:multiple\s+choice|questions?\s+1\s*[-–]\s*20)", text, re.I):
                first_item = any(MC_HEADER_ONLY.match(line["text"]) and line["text"].strip().lower().startswith("question 1") for line in lines) or any(re.match(r"^\s*(?:question\s+)?1\s*[.)]?\s+.{12,}$", line["text"], re.I) for line in lines)
                if first_item:
                    end_index = len(pages)
                    for later_index in range(page_index + 1, len(pages)):
                        later_text = pages[later_index].get("text", "") + " " + " ".join(line["text"] for line in page_lines[later_index])
                        if re.search(r"part\s*b|section\s*ii", later_text, re.I) and re.search(r"questions?\s+2[01]", later_text, re.I):
                            end_index = later_index
                            break
                    mc_range = (page_index, end_index)
                    break

        for page_index, page in enumerate(pages):
            if page_index >= solution_start:
                continue
            lines = text_lines(page)
            for line in lines:
                match = QUESTION.search(line["text"])
                if match:
                    found.append({"page": int(page["page"]), "id": match.group(1), "marks": int(match.group(2)), "anchor_y": round(float(line["bbox"][1]), 2), "anchor_bbox": [round(float(v), 2) for v in line["bbox"]], "document_segment": page_segments[page_index]})
                elif not (mc_range and mc_range[0] <= page_index < mc_range[1]):
                    label = QUESTION_LABEL.search(line["text"])
                    if label and len(line["text"]) < 120 and not re.search(r"continu(?:es|ed|ation)|see\s+page", line["text"], re.I):
                        found.append({"page": int(page["page"]), "id": label.group(1), "marks": None, "anchor_y": round(float(line["bbox"][1]), 2), "anchor_bbox": [round(float(v), 2) for v in line["bbox"]], "detector": "question_label_without_total_marks", "document_segment": page_segments[page_index]})
                elif mc_range and mc_range[0] <= page_index < mc_range[1]:
                    mc_match = MC_ITEM.match(line["text"])
                    if not mc_match:
                        header_only = MC_HEADER_ONLY.match(line["text"])
                        if header_only:
                            mc_match = header_only
                    number = ((mc_match.group(1) or mc_match.group(3)) if mc_match.re.groups >= 4 else mc_match.group(1)) if mc_match else None
                    if number and int(number) <= 20:
                        item_text = line["text"].lower()
                        if re.search(r"multiple\s+choice\s+questions|attempt\s+questions|allow\s+about|marks\b", item_text):
                            continue
                        rest = (mc_match.group(2) or mc_match.group(4) or "") if mc_match.re.groups >= 4 else ""
                        first_word = re.sub(r"[^a-z]+", "", rest.lower().split(" ", 1)[0])
                        question_starters = {"which", "what", "why", "how", "who", "when", "where", "use", "select", "calculate", "identify", "if", "in", "at", "the", "an", "a", "for", "from", "during", "students", "farmers", "net", "one", "it", "as", "read", "below", "given", "according", "there", "to", "consider", "describe", "explain", "management", "rate", "predatory", "on"}
                        score = (int(first_word in question_starters) + int(bool(mc_match.group(3))) + int(bool(mc_match.group(1)))) if mc_match.re.groups >= 4 else 1
                        found.append({"page": int(page["page"]), "id": number, "marks": 1, "anchor_y": round(float(line["bbox"][1]), 2), "anchor_bbox": [round(float(v), 2) for v in line["bbox"]], "anchor_text": line["text"], "candidate_score": score, "detector": "multiple_choice_numbered_item_candidate", "document_segment": page_segments[page_index]})

        found.sort(key=lambda q: (q["page"], q["anchor_y"]))
        # Keep one candidate per page/number/anchor for OCR duplicate detections.
        deduped = []
        seen = set()
        for question in found:
            if question.get("detector") == "multiple_choice_numbered_item_candidate":
                prior = next((x for x in deduped if x.get("detector") == "multiple_choice_numbered_item_candidate" and x["id"] == question["id"]), None)
                if prior is not None and int(prior.get("candidate_score", 0)) >= int(question.get("candidate_score", 0)):
                    continue
                if prior is not None:
                    deduped.remove(prior)
            key = (question["page"], question["id"], question["anchor_y"])
            if key not in seen:
                seen.add(key)
                deduped.append(question)
        found = deduped

        # Prefer anchors for the AI-mapped question IDs on their mapped pages.
        # Page-wide detector output can merge several short-answer questions or
        # mistake a scan/OCR heading; the map gives each unit its expected page.
        map_questions = record.get("questions", [])
        missing_question_anchors = []
        if map_questions:
            found = []
            for mapped in map_questions:
                match_id = re.match(r"\s*(\d+)", str(mapped.get("id", "")))
                if not match_id:
                    missing_question_anchors.append({"id": mapped.get("id"), "reason": "question ID has no leading number"})
                    continue
                number = match_id.group(1)
                expected_page = mapped.get("page")
                if isinstance(expected_page, int) and 1 <= expected_page <= len(pages):
                    page_indexes = [expected_page - 1]
                else:
                    page_indexes = list(range(min(solution_start, len(pages))))
                paper_two = bool(re.search(r"paper\s*2", str(mapped.get("id", "")), re.I))
                if paper_two:
                    page_indexes = [page_index for page_index in page_indexes if page_segments[page_index] == "paper2"]
                label_pattern = re.compile(rf"^\s*(?:question\s*)?0*{re.escape(number)}(?:\b|\s*[.)])", re.I)
                matches = [
                    (page_index, line) for page_index in page_indexes
                    if page_index < solution_start
                    for line in page_lines[page_index]
                    if label_pattern.search(line["text"])
                    and not re.search(r"continu(?:es|ed|ation)|see\s+page", line["text"], re.I)
                ]
                if not matches:
                    missing_question_anchors.append({"id": mapped.get("id"), "expected_page": expected_page, "reason": "mapped question heading not found on the mapped source page"})
                    continue
                page_index, line = matches[0]
                found.append({
                    "page": int(pages[page_index]["page"]),
                    "id": str(mapped.get("id")),
                    "marks": mapped.get("marks"),
                    "anchor_y": round(float(line["bbox"][1]), 2),
                    "anchor_bbox": [round(float(value), 2) for value in line["bbox"]],
                    "anchor_text": line["text"],
                    "document_segment": page_segments[page_index],
                    "detector": "question_map_page_anchor",
                })
            found.sort(key=lambda question: (question["page"], question["anchor_y"]))

        fragments = []
        for index, question in enumerate(found):
            start_page = question["page"]
            segment = question.get("document_segment", page_segments[start_page - 1])
            segment_last_page = segment_end.get(segment, len(pages))
            next_same_segment = next((q for q in found[index + 1:] if q.get("document_segment", page_segments[q["page"] - 1]) == segment), None)
            end_page = next_same_segment["page"] if next_same_segment else segment_last_page
            end_page = min(end_page, segment_last_page)
            for page_number in range(start_page, end_page + 1):
                page = pages[page_number - 1]
                lines = text_lines(page)
                if page_number - 1 >= solution_start:
                    continue
                if page_number == start_page:
                    y0 = max(0.0, question["anchor_y"] - 18.0)
                else:
                    y0 = 0.0
                if page_number == end_page and next_same_segment and next_same_segment["page"] == page_number:
                    y1 = max(y0 + 1, next_same_segment["anchor_y"] - 10.0)
                else:
                    y1 = max(y0 + 1, float(page["height"]) - 1.0)
                fragments.append({"question_id": question["id"], "question_marks": question["marks"], "page": page_number, "rect": [0.0, round(y0, 2), max(1.0, float(page["width"]) - 1.0), round(y1, 2)]})

        output["papers"].append({
            "catalog_index": record["catalog_index"], "paper_id": record["paper_id"], "title": record["title"],
            "local_path": record["local_path"], "source_sha256": record["source_sha256"], "page_count": record["page_count"],
            "candidate_questions": found, "question_fragments": fragments,
            "map_question_count": len(map_questions),
            "mapped_anchor_count": len(found),
            "missing_question_anchors": missing_question_anchors,
            "coordinate_status": "pending_visual_review", "source_images_reviewed": False,
            "part_level_crops": "not_proposed_yet",
        })

    output_dir = Path(args.output_dir) if args.output_dir else ROOT / f"batch-{args.batch:04d}"
    output_dir.mkdir(parents=True, exist_ok=True)
    destination = output_dir / "question-boundary-candidates.json"
    destination.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"batch": args.batch, "papers": len(output["papers"]), "question_headers_detected": sum(len(p["candidate_questions"]) for p in output["papers"]), "page_fragments": sum(len(p["question_fragments"]) for p in output["papers"]), "approved": 0, "file": str(destination)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

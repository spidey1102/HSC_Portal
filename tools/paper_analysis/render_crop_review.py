#!/usr/bin/env python3
"""Render pending question-fragment proposals beside their source pages."""

from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path

import fitz
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(r"C:\Users\manup\.gemini\antigravity\scratch\paper-analysis")


def label_font(size: int):
    try:
        return ImageFont.truetype("arial.ttf", size)
    except OSError:
        return ImageFont.load_default()


def fit_image(image: Image.Image, width: int, height: int) -> Image.Image:
    image.thumbnail((width, height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (width, height), "#f2f2f2")
    canvas.paste(image, ((width - image.width) // 2, (height - image.height) // 2))
    return canvas


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", type=int, default=1)
    parser.add_argument("--candidate-file", help="Candidate JSON file to render.")
    parser.add_argument("--output-dir", help="Destination folder for review sheets.")
    args = parser.parse_args()
    source_file = Path(args.candidate_file) if args.candidate_file else ROOT / f"batch-{args.batch:04d}" / "question-boundary-candidates.json"
    data = json.loads(source_file.read_text(encoding="utf-8"))
    out_dir = Path(args.output_dir) if args.output_dir else source_file.parent / "crop-review-sheets"
    out_dir.mkdir(parents=True, exist_ok=True)
    font = label_font(15)
    small = label_font(12)
    cols, rows, per_sheet = 2, 3, 6
    tile_w, tile_h, image_h = 860, 300, 250
    page_index = 0
    errors = []

    for paper in data["papers"]:
        pdf = fitz.open(paper["local_path"])
        proposals = paper["question_fragments"]
        safe_title = re.sub(r"[^a-zA-Z0-9]+", "-", paper["title"]).strip("-").lower()
        for offset in range(0, len(proposals), per_sheet):
            group = proposals[offset:offset + per_sheet]
            sheet = Image.new("RGB", (cols * tile_w, rows * tile_h), "#d8d8d8")
            draw = ImageDraw.Draw(sheet)
            for local_index, proposal in enumerate(group):
                page_number = int(proposal["page"])
                page = pdf[page_number - 1]
                rect = fitz.Rect(*proposal["rect"])
                if not page.rect.contains(rect) or rect.is_empty:
                    errors.append({"paper": paper["title"], "page": page_number, "rect": proposal["rect"], "error": "outside_page_bounds"})
                    continue
                source_pix = page.get_pixmap(matrix=fitz.Matrix(0.38, 0.38), alpha=False)
                source_img = Image.frombytes("RGB", (source_pix.width, source_pix.height), source_pix.samples)
                source_scale_x = source_img.width / page.rect.width
                source_scale_y = source_img.height / page.rect.height
                x0, y0, x1, y1 = proposal["rect"]
                overlay = ImageDraw.Draw(source_img)
                overlay.rectangle((x0 * source_scale_x, y0 * source_scale_y, x1 * source_scale_x, y1 * source_scale_y), outline="#d40000", width=4)
                clip = page.get_pixmap(matrix=fitz.Matrix(1.2, 1.2), clip=rect, alpha=False)
                crop_img = Image.frombytes("RGB", (clip.width, clip.height), clip.samples)
                source_thumb = fit_image(source_img, 230, image_h)
                crop_thumb = fit_image(crop_img, tile_w - 260, image_h)
                col, row = local_index % cols, local_index // cols
                x, y = col * tile_w, row * tile_h
                qid = proposal.get("question_id", "?")
                marks = proposal.get("question_marks")
                title = f"{paper['title']} · Q{qid}" + (f" · {marks} marks" if marks is not None else " · marks unverified")
                draw.text((x + 8, y + 5), title, fill="#101010", font=font)
                draw.text((x + 8, y + 27), f"Source PDF page {page_number} · proposed crop (red outline) · pending review", fill="#444444", font=small)
                sheet.paste(source_thumb, (x + 8, y + 45))
                draw.text((x + 15, y + 46), "SOURCE", fill="#b00000", font=small)
                sheet.paste(crop_thumb, (x + 252, y + 45))
                draw.text((x + 260, y + 46), "CROP CANDIDATE", fill="#b00000", font=small)
            out = out_dir / f"{page_index + 1:03d}-{safe_title}-proposals-{offset // per_sheet + 1:02d}.jpg"
            sheet.save(out, quality=82, optimize=True)
            page_index += 1
        pdf.close()

    report = {"batch": args.batch, "papers": len(data["papers"]), "proposal_count": sum(len(p["question_fragments"]) for p in data["papers"]), "sheet_count": page_index, "approved_count": 0, "sheets": str(out_dir), "errors": errors}
    (out_dir / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

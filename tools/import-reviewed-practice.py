"""Package explicitly approved crop maps and their exact source PDFs for the website.

Usage: python tools/import-reviewed-practice.py --ledger ../paper-analysis/ledger.json
This is an importer, never a crop approver. Missing approvals, changed sources,
missing images, invalid rectangles and catalog mismatches stop the import.
"""
import argparse
import hashlib
import json
import pathlib
import re
import shutil

import fitz

PAPER_IDS = [178, 213, 214, 216, 217, 242, 243, 244, 245, 249, 250,
             1188, 1189, 1190, 1191, 1192, 1193, 1295, 1441, 1442, 1793]
ROOT = pathlib.Path(__file__).resolve().parents[1]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def unit_label(value):
    return re.sub(r"[\s()\-]", "", str(value or "").lower()).removeprefix("q")


def clean_text(value):
    # Some older ledger labels were UTF-8 decoded as Windows-1252.
    for _ in range(2):
        if not any(marker in value for marker in ('\u00e2', '\u00c3', '\u00c2')):
            break
        try:
            value = value.encode('cp1252').decode('utf-8')
        except (UnicodeEncodeError, UnicodeDecodeError):
            break
    return value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--ledger', required=True)
    args = parser.parse_args()
    ledger = json.loads(pathlib.Path(args.ledger).read_text(encoding='cp1252'))
    catalog = json.loads((ROOT / 'public/papers.json').read_text(encoding='utf-8'))
    identity_keys = ['v', 's', 'l', 'c', 'y', 'h', 'w', 'n']
    papers = {tuple(p[k] for k in identity_keys): p for p in catalog['papers'] if p.get('cf')}
    records = {e['catalog_index']: e for e in ledger['papers']}
    candidates, published, copies = [], [], []
    for index in PAPER_IDS:
        entry = records[index]
        assert entry['crop_review_status'] == 'approved', (index, 'paper not approved')
        source = pathlib.Path(entry['local_path'])
        sha = digest(source)
        manifest = json.loads(pathlib.Path(entry.get('crop_manifest') or entry['crop_manifest_path']).read_text(encoding='utf-8-sig'))
        assert sha == entry['source_sha256'] == manifest['source_sha256'], (index, 'source changed')
        paper = papers[tuple(json.loads(entry['identity']))]
        assert paper['cf'] == entry['source_path'], (index, 'catalog source mismatch')
        identity_fields = [paper[k] for k in identity_keys]
        assert identity_fields == json.loads(entry['identity']), (index, 'catalog identity mismatch')
        identity = json.dumps(identity_fields, separators=(',', ':'), ensure_ascii=False)
        subject, school = catalog['subjects'][paper['s']], catalog['schools'][paper['h']]
        source_url = f'/reviewed-paper-sources/{sha}.pdf'
        questions = {str(q['id']): q for q in entry['questions']}
        doc = fitz.open(source)
        seen = set()
        for unit in manifest['units']:
            # The website selects the complete letter, including every roman part.
            # Older manifests also contain standalone roman crops; do not expose those.
            if re.fullmatch(r'\d+[a-z][ivx]+', unit_label(unit.get('unit_id'))):
                continue
            status = unit.get('review_status') or unit.get('status')
            assert status == 'approved', (index, unit.get('unit_id'), 'unit not approved')
            audit_sha = unit.get('reviewed_source_sha256') or unit.get('audit', {}).get('source_sha256')
            assert audit_sha == sha and unit.get('source_sha256') == sha, (index, 'approval fingerprint mismatch')
            match = re.fullmatch(r'(\d+)([a-z]?)', unit_label(unit.get('unit_id')))
            assert match, (index, unit.get('unit_id'), 'unrecognised unit')
            qid, part = match.groups()
            assert (qid, part) not in seen, (index, qid, part, 'duplicate')
            seen.add((qid, part))
            assert (not part) == (unit['unit_type'] == 'whole_question'), (index, 'unit type mismatch')
            question = questions[qid]
            parts = [p for p in question.get('subparts', []) if unit_label(p['id']) == part
                     or part and re.fullmatch(re.escape(part) + r'[ivx]+', unit_label(p['id']))]
            exact_part = next((p for p in parts if unit_label(p['id']) == part), None)
            labels = [exact_part] if exact_part else parts if part else [question]
            topics = list(dict.fromkeys(clean_text(t) for q in labels for t in q.get('topics', []) if t))
            # Do not mislabel a selected part with its parent's unrelated topics.
            skill = '; '.join(dict.fromkeys(clean_text(q.get('skill', '')) for q in labels if q.get('skill')))
            marks = unit.get('displayed_marks', unit.get('marks'))
            assert isinstance(marks, (int, float)) and marks > 0, (index, qid, part, 'missing approved marks')
            fragments = []
            previous_page = 0
            for fragment in unit['fragments']:
                image = pathlib.Path(fragment['image'])
                assert digest(image) == fragment['sha256'], (index, 'crop image changed')
                page_number = fragment['page']
                assert previous_page <= page_number <= len(doc) and page_number >= 1, (index, 'page bounds/order')
                previous_page = page_number
                page = doc[page_number - 1]
                bbox = fragment['bbox_pdf_points']
                x0, y0, x1, y1 = bbox
                assert 0 <= x0 < x1 <= page.rect.width and 0 <= y0 < y1 <= page.rect.height, (index, qid, bbox, 'bounds')
                assert x1 - x0 >= 1 and y1 - y0 >= 1, (index, qid, 'empty crop')
                fragments.append({'page': page_number, 'bbox': bbox, 'pageWidth': page.rect.width,
                                  'pageHeight': page.rect.height, 'reviewedImageSha256': fragment['sha256']})
            assert 0 < len(fragments) <= 32, (index, qid, 'fragment count')
            crop = {'sourcePath': paper['cf'], 'sourceSha256': sha, 'sourceUrl': source_url,
                    'questionId': qid, 'unitId': part or 'whole', 'marks': marks, 'fragments': fragments}
            parent = f'{identity}::{qid}'
            candidates.append({'key': parent + (f'({part})' if part else ''), 'parentKey': parent,
                'paperIdentity': identity, 'paperName': paper['n'], 'paperYear': paper['y'],
                'subject': subject, 'level': paper['l'], 'school': school, 'hasSolutions': paper['w'] == 1,
                'allTopics': topics, 'question': {'id': qid, 'page': fragments[0]['page'], 'marks': marks,
                    'topics': topics, 'skill': skill, 'commandVerb': (exact_part or question).get('commandVerb', ''),
                    'sourcePages': list(dict.fromkeys(f['page'] for f in fragments)), 'pdfCrop': crop,
                    'challenge': {'level': question.get('challenge', {}).get('level', 'routine'),
                                  'subpartId': part},
                    'topicReviewPending': not bool(topics)}})
        published.append({'catalogIndex': index, 'title': paper['n'], 'subject': subject,
                          'year': paper['y'], 'sourcePath': paper['cf'], 'sourceSha256': sha,
                          'sourceUrl': source_url, 'unitCount': len(seen)})
        copies.append((source, ROOT / 'public' / source_url.lstrip('/')))
        doc.close()
    # Write only after the full input set has passed validation.
    for source, target in copies:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    payload = {'papers': published, 'candidates': candidates}
    output = ROOT / 'server/reviewedPracticeData.js'
    output.write_text('// Generated by tools/import-reviewed-practice.py. Do not approve crops here.\n'
                      + 'export default ' + json.dumps(payload, ensure_ascii=True, separators=(',', ':')) + ';\n', encoding='utf-8')
    print(f'Published {len(published)} reviewed papers and {len(candidates)} crop units.')
    for subject in sorted({p['subject'] for p in published}):
        print(subject, sum(p['subject'] == subject for p in published), 'papers',
              sum(c['subject'] == subject for c in candidates), 'crop units')


if __name__ == '__main__':
    main()

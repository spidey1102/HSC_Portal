#!/usr/bin/env python3
import json
import os
import re
from pathlib import Path

def slugify(s):
    s = s.lower()
    s = re.sub(r"[^a-z0-9\s-]", '', s)
    s = re.sub(r"[\s_]+", '-', s)
    s = re.sub(r"-+", '-', s)
    return s.strip('-')

def load_papers(path='public/papers.json'):
    p = Path(path)
    if not p.exists():
        raise SystemExit('public/papers.json not found; run scraper first')
    data = json.loads(p.read_text(encoding='utf-8'))
    if isinstance(data, dict) and 'papers' in data:
        return data['papers']
    if isinstance(data, list):
        return data
    # try to find the largest list
    for v in data.values():
        if isinstance(v, list):
            return v
    raise SystemExit('Could not parse papers.json')

HTML_TEMPLATE = '''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>{title}</title>
  <meta name="description" content="{description}" />
  <meta property="og:title" content="{og_title}" />
  <meta property="og:description" content="{og_description}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="{og_url}" />
  <link rel="canonical" href="{canonical}" />
  <meta name="robots" content="index,follow" />
</head>
<body>
  <script>
    // Redirect to SPA root with subject query (client-side filtering)
    location.replace('/?subject={slug}');
  </script>
</body>
</html>
'''

def main():
    papers = load_papers()
    subj_counts = {}
    for p in papers:
        subj = p.get('subject') or p.get('subjectName') or p.get('s') or 'Unknown'
        subj = str(subj)
        subj_counts[subj] = subj_counts.get(subj, 0) + 1

    out = Path('public')
    out.mkdir(exist_ok=True)

    urls = set(['/'])

    for subj, count in sorted(subj_counts.items(), key=lambda x: (-x[1], x[0])):
        slug = slugify(subj) or 'unknown'
        page_dir = out / slug
        page_dir.mkdir(parents=True, exist_ok=True)
        title = f"{subj} — HSC Past Papers"
        desc = f"Browse {count} past HSC papers for {subj}. Download PDFs, view marking guidelines, and practice exam questions."
        og_url = f"/{slug}/"
        canonical = og_url
        html = HTML_TEMPLATE.format(title=title, description=desc, og_title=title, og_description=desc, og_url=og_url, canonical=canonical, slug=slug)
        (page_dir / 'index.html').write_text(html, encoding='utf-8')
        urls.add(og_url)

    # write sitemap.xml
    sitemap = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u in sorted(urls):
        sitemap.append('  <url>')
        sitemap.append(f'    <loc>{u}</loc>')
        sitemap.append('  </url>')
    sitemap.append('</urlset>')
    (out / 'sitemap.xml').write_text('\n'.join(sitemap), encoding='utf-8')

    print(f'Wrote {len(subj_counts)} subject pages and sitemap.xml')

if __name__ == '__main__':
    main()

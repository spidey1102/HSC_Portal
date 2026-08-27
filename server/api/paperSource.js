import fs from 'fs';
import { resolve } from 'path';

export function loadPaperRecord(paperId, paperName) {
  const raw = fs.readFileSync(resolve(process.cwd(), 'public', 'papers.json'), 'utf-8');
  const papers = JSON.parse(raw).papers || [];
  return papers.find((paper) => (
    String(paper.v) === String(paperId)
    && (!paperName || paper.n === paperName)
  )) || null;
}

export function getPaperSourceFingerprint(paper) {
  return JSON.stringify({
    paperId: String(paper?.v || ''),
    paperName: String(paper?.n || ''),
    sourcePath: String(paper?.cf || ''),
  });
}

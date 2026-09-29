import { jsPDF } from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const SOURCE_BASE_URL = 'https://hscportal.pages.dev/';
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_MARGIN = 36;

function paperIdentity(paper) {
  return JSON.stringify([paper.v, paper.s, paper.l, paper.c, paper.y, paper.h, paper.w, paper.n]);
}

function sourcePdfUrl(paper, crop) {
  if (crop?.sourceUrl === `/reviewed-paper-sources/${crop.sourceSha256}.pdf`) {
    return new URL(crop.sourceUrl, window.location.origin).href;
  }
  return `${SOURCE_BASE_URL}${encodeURI(paper.cf)}`;
}

function expectedUnit(question) {
  return String(question?.challenge?.subpartId || 'whole').toLowerCase();
}

function verifiedFragments(result, paper) {
  const crop = result.question?.pdfCrop;
  const fragments = crop?.fragments;
  if (!crop || crop.sourcePath !== paper.cf || crop.questionId !== String(result.question?.id || '')
    || crop.unitId !== expectedUnit(result.question)
    || !/^[a-f0-9]{64}$/.test(String(crop.sourceSha256 || ''))
    || Number(crop.marks) !== Number(result.question?.marks)
    || !Array.isArray(fragments) || !fragments.length || fragments.length > 32) {
    throw new Error(`Question ${result.question?.id || ''} has no verified PDF crop. Build a PDF-ready set.`);
  }
  let previousPage = 0;
  for (const fragment of fragments) {
    const [left, top, right, bottom] = Array.isArray(fragment?.bbox) ? fragment.bbox.map(Number) : [];
    const width = Number(fragment?.pageWidth);
    const height = Number(fragment?.pageHeight);
    const page = Number(fragment?.page);
    if (!Number.isInteger(page) || page < previousPage || page < 1
      || !Number.isFinite(width) || !Number.isFinite(height)
      || width < 100 || height < 100 || ![left, top, right, bottom].every(Number.isFinite)
      || left < 0 || top < 0 || right > width || bottom > height
      || right - left < 1 || bottom - top < 1) {
      throw new Error(`Question ${result.question?.id || ''} has an invalid PDF crop.`);
    }
    previousPage = page;
  }
  return fragments;
}

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return canvas;
}

function addCover(doc, build) {
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(78, 121, 103);
  doc.text('THE PAPER ROOM · PRACTICE SET', PAGE_MARGIN, 56);
  doc.setTextColor(32, 32, 32);
  doc.setFontSize(26);
  doc.text(`${build.subject || 'Practice'} · Year ${build.level || ''}`, PAGE_MARGIN, 94);
  doc.setFont('times', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(95, 95, 95);
  doc.text(`${build.summary?.questionCount || build.questions.length} questions  ·  ${build.summary?.totalMarks || 0} marks  ·  approximately ${build.summary?.estimatedMinutes || 0} minutes`, PAGE_MARGIN, 119);
  if (build.topics?.length) {
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(`Topics: ${build.topics.join(' · ')}`, A4_WIDTH - PAGE_MARGIN * 2), PAGE_MARGIN, 143);
  }
  doc.setDrawColor(195, 195, 195);
  doc.line(PAGE_MARGIN, 165, A4_WIDTH - PAGE_MARGIN, 165);
  doc.setFont('times', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(50, 50, 50);
  doc.text('Questions are reproduced from the credited school papers below.', PAGE_MARGIN, 190);
  doc.text('Use the source link to view the original paper.', PAGE_MARGIN, 209);
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function loadVerifiedSource(paper, expectedHash, crop) {
  const url = sourcePdfUrl(paper, crop);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`The source PDF for ${paper.n || 'a question'} could not be loaded.`);
  const bytes = await response.arrayBuffer();
  if (await sha256Hex(bytes) !== expectedHash) {
    throw new Error(`The source PDF for ${paper.n || 'a question'} has changed. Its question images need review again.`);
  }
  return { url, document: await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise };
}

/** Export only manually reviewed crops from the exact source PDFs they were approved against. */
export async function createMiniPaperPdf(build, papers = []) {
  if (!Array.isArray(build?.questions) || !build.questions.length) throw new Error('Build a practice set before exporting it.');
  const paperByIdentity = new Map(papers.map((paper) => [paperIdentity(paper), paper]));
  const items = build.questions.map((result) => {
    const paper = paperByIdentity.get(String(result.paperIdentity || ''));
    if (!paper?.cf) throw new Error(`Could not find the source PDF for question ${result.question?.id || ''}.`);
    return { result, paper, fragments: verifiedFragments(result, paper) };
  });
  const sources = new Map();
  for (const item of items) {
    const existing = sources.get(item.paper.cf);
    if (existing && existing.hash !== item.result.question.pdfCrop.sourceSha256) {
      throw new Error('The same source paper has conflicting approved checksums.');
    }
    if (!existing) sources.set(item.paper.cf, { paper: item.paper, hash: item.result.question.pdfCrop.sourceSha256, crop: item.result.question.pdfCrop });
  }
  try {
  for (const [path, source] of sources) {
    sources.set(path, { ...source, ...await loadVerifiedSource(source.paper, source.hash, source.crop) });
  }
  // Validate every page before creating any output. A bad map cannot yield a partial paper.
  for (const { paper, fragments } of items) {
    const source = sources.get(paper.cf);
    for (const fragment of fragments) {
      if (fragment.page > source.document.numPages) throw new Error(`${paper.n} has no page ${fragment.page}.`);
      const viewport = (await source.document.getPage(fragment.page)).getViewport({ scale: 1 });
      if (Math.abs(viewport.width - fragment.pageWidth) > 2 || Math.abs(viewport.height - fragment.pageHeight) > 2) {
        throw new Error(`${paper.n} has changed page dimensions. Its question images need review again.`);
      }
    }
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
  addCover(doc, build);
  let outputPage = 0;
  const pageFooters = [];
  for (let questionIndex = 0; questionIndex < items.length; questionIndex += 1) {
    const { result, paper, fragments } = items[questionIndex];
    const source = sources.get(paper.cf);
    const availableWidth = A4_WIDTH - PAGE_MARGIN * 2;
    const availableHeight = A4_HEIGHT - 145;
    // Keep short stems at the same scale as their part, on the same output page.
    // Only break at reviewed fragment boundaries, never in the middle of a diagram.
    const widest = Math.max(...fragments.map((f) => f.bbox[2] - f.bbox[0]));
    let cursorY = 48;
    let footer;
    const startQuestionPage = (continued = false) => {
      outputPage += 1;
      doc.addPage();
      doc.setFont('times', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(30, 30, 30);
      const part = result.question.challenge?.subpartId ? `(${result.question.challenge.subpartId})` : '';
      doc.text(`${questionIndex + 1}.  Question ${result.question.id}${part}  ·  ${result.question.marks} marks${continued ? ' (continued)' : ''}`, PAGE_MARGIN, 34);
      cursorY = 48;
      footer = { page: doc.getNumberOfPages(), number: outputPage, paper, url: source.url, sourcePages: [] };
      pageFooters.push(footer);
    };
    startQuestionPage();
    for (const fragment of fragments) {
      const sourcePage = await source.document.getPage(fragment.page);
      const viewport = sourcePage.getViewport({ scale: 2 });
      const fullCanvas = makeCanvas(viewport.width, viewport.height);
      const context = fullCanvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Your browser could not prepare the PDF page images.');
      await sourcePage.render({ canvasContext: context, viewport }).promise;
      const scaleX = viewport.width / fragment.pageWidth;
      const scaleY = viewport.height / fragment.pageHeight;
      const [left, top, right, bottom] = fragment.bbox;
      const cropCanvas = makeCanvas((right - left) * scaleX, (bottom - top) * scaleY);
      cropCanvas.getContext('2d', { alpha: false }).drawImage(
        fullCanvas, left * scaleX, top * scaleY, (right - left) * scaleX, (bottom - top) * scaleY,
        0, 0, cropCanvas.width, cropCanvas.height,
      );

      const ratio = Math.min(availableWidth / (widest * scaleX), availableHeight / cropCanvas.height);
      const imageWidth = cropCanvas.width * ratio;
      const imageHeight = cropCanvas.height * ratio;
      if (cursorY > 48 && cursorY + imageHeight > 48 + availableHeight) startQuestionPage(true);
      doc.addImage(cropCanvas.toDataURL('image/jpeg', 0.94), 'JPEG', PAGE_MARGIN, cursorY, imageWidth, imageHeight, undefined, 'FAST');
      cursorY += imageHeight + 8;
      if (!footer.sourcePages.includes(fragment.page)) footer.sourcePages.push(fragment.page);
      fullCanvas.width = 1;
      fullCanvas.height = 1;
      cropCanvas.width = 1;
      cropCanvas.height = 1;
    }
  }
  for (const footer of pageFooters) {
      doc.setPage(footer.page);
      const footerY = A4_HEIGHT - 58;
      doc.setDrawColor(195, 195, 195);
      doc.line(PAGE_MARGIN, footerY - 13, A4_WIDTH - PAGE_MARGIN, footerY - 13);
      doc.setFont('times', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(75, 75, 75);
      const label = `${footer.paper.n || 'School paper'} · original page ${footer.sourcePages.join(', ')}`;
      doc.text(doc.splitTextToSize(label, A4_WIDTH - PAGE_MARGIN * 2 - 110), PAGE_MARGIN, footerY);
      doc.setTextColor(78, 121, 103);
      doc.textWithLink('Open source paper', A4_WIDTH - PAGE_MARGIN - 92, footerY, { url: footer.url });
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`${footer.number} / ${outputPage}`, A4_WIDTH - PAGE_MARGIN, A4_HEIGHT - 24, { align: 'right' });
  }
  doc.save(`${String(build.subject || 'practice-set').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-year-${build.level || ''}-practice-paper.pdf`);
  } finally {
    await Promise.all([...sources.values()].map((source) => source.document?.destroy()));
  }
}

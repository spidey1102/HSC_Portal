import { jsPDF } from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const SOURCE_BASE_URL = 'https://hscportal.pages.dev/';
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_MARGIN = 36;

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function questionNumber(question) {
  return String(question?.id || '').match(/\d+/)?.[0] || '';
}

function labelPattern(id) {
  return new RegExp(`^(?:question\\s*)?${escapeRegExp(id)}(?:\\s*[.)]|\\s|$)`, 'i');
}

function nextQuestionPattern(id) {
  const nextId = Number(id) + 1;
  return new RegExp(`^(?:question\\s*)?${nextId}(?:\\s*[.)]|\\s|$)`, 'i');
}

function textRows(textContent, viewport) {
  const rows = new Map();
  for (const item of textContent.items || []) {
    if (!item.str?.trim() || !item.transform) continue;
    const transformed = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const top = transformed[5] - Math.max(1, item.height * viewport.scale);
    const key = Math.round(top / 4) * 4;
    const row = rows.get(key) || [];
    row.push({ x: transformed[4], text: item.str });
    rows.set(key, row);
  }
  return [...rows.entries()]
    .map(([top, items]) => ({ top, text: items.sort((left, right) => left.x - right.x).map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim() }))
    .sort((left, right) => left.top - right.top);
}

function findQuestionCrop(rows, id, pageHeight) {
  if (!id) return null;
  const startIndex = rows.findIndex((row) => labelPattern(id).test(row.text));
  if (startIndex < 0) return null;
  const start = Math.max(0, rows[startIndex].top - 14);
  const nextPattern = nextQuestionPattern(id);
  const next = rows.slice(startIndex + 1).find((row) => nextPattern.test(row.text));
  const end = next ? Math.min(pageHeight, next.top - 8) : pageHeight - 18;
  if (end - start < 90) return null;
  return { top: start, bottom: end };
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
    const topicLines = doc.splitTextToSize(`Topics: ${build.topics.join(' · ')}`, A4_WIDTH - PAGE_MARGIN * 2);
    doc.text(topicLines, PAGE_MARGIN, 143);
  }
  doc.setDrawColor(195, 195, 195);
  doc.line(PAGE_MARGIN, 165, A4_WIDTH - PAGE_MARGIN, 165);
  doc.setFont('times', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(50, 50, 50);
  doc.text('Questions are reproduced from the credited school trial paper pages below.', PAGE_MARGIN, 190);
  doc.text('Use the source link to view the original paper.', PAGE_MARGIN, 209);
}

function sourcePdfUrl(paper) {
  return paper?.cf ? `${SOURCE_BASE_URL}${encodeURI(paper.cf)}` : '';
}

function sourcePagesFor(result) {
  const geometryPages = result.question?.geometry?.confidence !== 'low' && Array.isArray(result.question?.geometry?.segments)
    ? result.question.geometry.segments.map((segment) => Number(segment?.page))
      .filter((page) => Number.isInteger(page) && page > 0)
    : [];
  if (geometryPages.length) return [...new Set(geometryPages)].sort((left, right) => left - right);
  const pages = Array.isArray(result.question?.sourcePages) ? result.question.sourcePages : [result.question?.page];
  return [...new Set(pages.map(Number).filter((page) => Number.isInteger(page) && page > 0))].sort((left, right) => left - right);
}

function cropForQuestionPage(question, pageNumber, rows, pageHeight) {
  const segment = question?.geometry?.confidence !== 'low'
    ? question?.geometry?.segments?.find((item) => Number(item?.page) === pageNumber)
    : null;
  const bbox = Array.isArray(segment?.bbox) ? segment.bbox.map(Number) : [];
  if (bbox.length === 4 && bbox.every(Number.isFinite) && bbox[2] > bbox[0] && bbox[3] > bbox[1]) {
    return { left: bbox[0], top: bbox[1], right: bbox[2], bottom: bbox[3] };
  }
  const textCrop = findQuestionCrop(rows, questionNumber(question), pageHeight);
  return textCrop ? { left: 0, right: Number.POSITIVE_INFINITY, ...textCrop } : null;
}

/** Assemble a downloadable paper from page-addressed questions in their source PDFs. */
export async function createMiniPaperPdf(build, papers = []) {
  if (!Array.isArray(build?.questions) || build.questions.length === 0) throw new Error('Build a practice set before exporting it.');
  const paperByIdentity = new Map(papers.map((paper) => [JSON.stringify([paper.v, paper.s, paper.l, paper.c, paper.y, paper.h, paper.w, paper.n]), paper]));
  const documents = new Map();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
  addCover(doc, build);
  const totalPages = build.questions.reduce((count, question) => count + sourcePagesFor(question).length, 0);
  let outputPage = 0;

  for (let questionIndex = 0; questionIndex < build.questions.length; questionIndex += 1) {
    const result = build.questions[questionIndex];
    const paper = paperByIdentity.get(String(result.paperIdentity || ''));
    const url = sourcePdfUrl(paper);
    if (!paper || !url) throw new Error(`Could not find the source PDF for question ${questionIndex + 1}.`);
    const pages = sourcePagesFor(result);
    if (!pages.length) throw new Error(`Question ${questionIndex + 1} has no page number in its Question Map.`);

    let pdfDocument = documents.get(url);
    if (!pdfDocument) {
      pdfDocument = await pdfjsLib.getDocument({ url }).promise;
      documents.set(url, pdfDocument);
    }

    for (let sourcePageNumberIndex = 0; sourcePageNumberIndex < pages.length; sourcePageNumberIndex += 1) {
      const sourcePageNumber = pages[sourcePageNumberIndex];
      if (sourcePageNumber > pdfDocument.numPages) throw new Error(`${paper.n || 'A source paper'} has no page ${sourcePageNumber}.`);
      const sourcePage = await pdfDocument.getPage(sourcePageNumber);
      const viewport = sourcePage.getViewport({ scale: 1 });
      const rows = textRows(await sourcePage.getTextContent(), viewport);
      const isFirstSourcePage = sourcePageNumberIndex === 0;
      const crop = cropForQuestionPage(result.question, sourcePageNumber, rows, viewport.height)
        || (isFirstSourcePage ? null : { left: 0, right: Number.POSITIVE_INFINITY, top: 12, bottom: viewport.height - 16 });
      const renderedViewport = sourcePage.getViewport({ scale: 2 });
      const fullCanvas = makeCanvas(renderedViewport.width, renderedViewport.height);
      const context = fullCanvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Your browser could not prepare the PDF page images.');
      await sourcePage.render({ canvasContext: context, viewport: renderedViewport }).promise;

      const cropScale = renderedViewport.scale / viewport.scale;
      const cropLeft = crop ? Math.max(0, crop.left * cropScale) : 0;
      const cropRight = crop ? Math.min(fullCanvas.width, Number.isFinite(crop.right) ? crop.right * cropScale : fullCanvas.width) : fullCanvas.width;
      const cropTop = crop ? Math.max(0, crop.top * cropScale) : 0;
      const cropBottom = crop ? Math.min(fullCanvas.height, crop.bottom * cropScale) : fullCanvas.height;
      const cropCanvas = makeCanvas(cropRight - cropLeft, cropBottom - cropTop);
      cropCanvas.getContext('2d', { alpha: false }).drawImage(
        fullCanvas,
        cropLeft, cropTop, cropRight - cropLeft, cropBottom - cropTop,
        0, 0, cropCanvas.width, cropCanvas.height,
      );

      outputPage += 1;
      doc.addPage();
      doc.setFont('times', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(30, 30, 30);
      const part = result.question?.challenge?.subpartId ? `(${result.question.challenge.subpartId})` : '';
      doc.text(`${questionIndex + 1}.  Question ${result.question?.id || ''}${part}  ·  ${result.question?.marks || '?'} marks`, PAGE_MARGIN, 34);

      const image = cropCanvas.toDataURL('image/jpeg', 0.9);
      const availableWidth = A4_WIDTH - PAGE_MARGIN * 2;
      const availableHeight = A4_HEIGHT - 145;
      const ratio = Math.min(availableWidth / cropCanvas.width, availableHeight / cropCanvas.height);
      const imageWidth = cropCanvas.width * ratio;
      const imageHeight = cropCanvas.height * ratio;
      doc.addImage(image, 'JPEG', (A4_WIDTH - imageWidth) / 2, 48, imageWidth, imageHeight, undefined, 'FAST');

      const footerY = A4_HEIGHT - 58;
      doc.setDrawColor(195, 195, 195);
      doc.line(PAGE_MARGIN, footerY - 13, A4_WIDTH - PAGE_MARGIN, footerY - 13);
      doc.setFont('times', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(75, 75, 75);
      const sourceLabel = `${paper.n || 'School trial paper'} ${paper.y || ''} · original page ${sourcePageNumber}`;
      doc.text(sourceLabel, PAGE_MARGIN, footerY);
      doc.setTextColor(78, 121, 103);
      doc.textWithLink('Open source paper', A4_WIDTH - PAGE_MARGIN - 92, footerY, { url });
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`${outputPage} / ${totalPages}`, A4_WIDTH - PAGE_MARGIN, A4_HEIGHT - 24, { align: 'right' });
      fullCanvas.width = 1;
      fullCanvas.height = 1;
      cropCanvas.width = 1;
      cropCanvas.height = 1;
    }
  }

  doc.save(`${String(build.subject || 'practice-set').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-year-${build.level || ''}-practice-paper.pdf`);
}

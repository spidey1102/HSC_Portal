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
  const escaped = escapeRegExp(id);
  return new RegExp(`^(?:question\\s*${escaped}\\b|${escaped}\\s*[.)]\\s*\\S|${escaped}\\s*\\(\\s*(?:[a-z]|\\d+\\s*marks?))`, 'i');
}

function nextQuestionPattern(id) {
  return labelPattern(Number(id) + 1);
}

function anyQuestionLabelPattern() {
  return /^(?:question\s*\d{1,3}\b|\d{1,3}\s*[.)]\s*\S|\d{1,3}\s*\(\s*(?:[a-z]|\d+\s*marks?))/i;
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
    .map(([top, items]) => ({ top, x: Math.min(...items.map((item) => item.x)), text: items.sort((left, right) => left.x - right.x).map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim() }))
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

function orderedGeometrySegments(question) {
  if (question?.geometry?.confidence === 'low' || !Array.isArray(question?.geometry?.segments)) return [];
  return [...question.geometry.segments]
    .filter((segment) => Number.isInteger(Number(segment?.page)) && Number(segment.page) > 0)
    .sort((left, right) => Number(left.page) - Number(right.page));
}

function cropForQuestionPage(question, pageNumber, rows, viewport) {
  const segment = orderedGeometrySegments(question).find((item) => Number(item?.page) === pageNumber);
  const bbox = Array.isArray(segment?.bbox) ? segment.bbox.map(Number) : [];
  if (bbox.length === 4 && bbox.every(Number.isFinite) && bbox[2] > bbox[0] && bbox[3] > bbox[1]) {
    const sourceWidth = Number(segment.pageWidth);
    const sourceHeight = Number(segment.pageHeight);
    const scaleX = Number.isFinite(sourceWidth) && sourceWidth > 0 ? viewport.width / sourceWidth : 1;
    const scaleY = Number.isFinite(sourceHeight) && sourceHeight > 0 ? viewport.height / sourceHeight : 1;
    return { left: bbox[0] * scaleX, top: bbox[1] * scaleY, right: bbox[2] * scaleX, bottom: bbox[3] * scaleY, fromGeometry: true };
  }
  const textCrop = findQuestionCrop(rows, questionNumber(question), viewport.height);
  return textCrop ? { left: 0, right: Number.POSITIVE_INFINITY, ...textCrop } : null;
}

function selectedLetter(question) {
  const id = String(question?.challenge?.subpartId || '').trim().toLowerCase();
  return id.match(/^\(?([a-h])\)?(?:\(?[ivx]+\)?)?$/)?.[1] || '';
}

function partMarker(row) {
  const match = row.text.match(/^\s*\(?([a-h])\)\s*(?:\S|$)/i);
  return match && row.x < 180 ? match[1].toLowerCase() : '';
}

function questionEnd(row, id) {
  return new RegExp(`^end of question\\s*${escapeRegExp(id)}\\b`, 'i').test(row.text)
    || nextQuestionPattern(id).test(row.text);
}

function planSubpartPages(question, pages) {
  const letter = selectedLetter(question);
  if (!letter) return null;
  const id = questionNumber(question);
  const markers = pages.flatMap((page, pageIndex) => page.rows
    .filter((row) => row.top >= (page.crop?.top ?? 0) - 12 && row.top < (page.crop?.bottom ?? page.viewport.height) + 8)
    .map((row) => ({ ...row, pageIndex, letter: partMarker(row) }))
    .filter((row) => row.letter || questionEnd(row, id)));
  const start = markers.find((row) => row.letter === letter);
  if (!start) return null;
  const end = markers.find((row) => row.pageIndex > start.pageIndex
    || (row.pageIndex === start.pageIndex && row.top > start.top + 2)
      ? (row.letter && row.letter !== letter) || questionEnd(row, id)
      : false);
  const firstPart = markers.find((row) => row.letter);
  const planned = [];
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const base = page.crop || { left: 0, right: page.viewport.width, top: 0, bottom: page.viewport.height };
    const fragments = [];
    // Keep the shared question stem, which can define diagrams and values used by every part.
    if (firstPart?.pageIndex === index && (start.pageIndex !== index || start.top > firstPart.top + 2)) {
      const stemBottom = Math.min(base.bottom, firstPart.top - 5);
      if (stemBottom > base.top + 12) fragments.push({ ...base, bottom: stemBottom });
    }
    if (index >= start.pageIndex && (!end || index <= end.pageIndex)) {
      const top = index === start.pageIndex
        ? (start === firstPart ? base.top : Math.max(base.top, start.top - 8))
        : base.top;
      const bottom = end?.pageIndex === index ? Math.min(base.bottom, end.top - 14) : base.bottom;
      if (bottom > top + 12) fragments.push({ ...base, top, bottom });
    }
    const substantiveRows = page.rows.filter((row) => fragments.some((fragment) => row.top >= fragment.top && row.top < fragment.bottom)
      && !/^question\s*\d+.*(?:continued|continues on page)/i.test(row.text)
      && !/^end of question\s*\d+/i.test(row.text));
    if (fragments.length && substantiveRows.length) planned.push({ ...page, fragments });
  }
  return planned.length ? planned : null;
}

/** Assemble a downloadable paper from page-addressed questions in their source PDFs. */
export async function createMiniPaperPdf(build, papers = []) {
  if (!Array.isArray(build?.questions) || build.questions.length === 0) throw new Error('Build a practice set before exporting it.');
  const paperByIdentity = new Map(papers.map((paper) => [JSON.stringify([paper.v, paper.s, paper.l, paper.c, paper.y, paper.h, paper.w, paper.n]), paper]));
  const documents = new Map();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
  addCover(doc, build);
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

    const pageDetails = [];
    for (const sourcePageNumber of pages) {
      if (sourcePageNumber > pdfDocument.numPages) throw new Error(`${paper.n || 'A source paper'} has no page ${sourcePageNumber}.`);
      const sourcePage = await pdfDocument.getPage(sourcePageNumber);
      const viewport = sourcePage.getViewport({ scale: 1 });
      const rows = textRows(await sourcePage.getTextContent(), viewport);
      pageDetails.push({ sourcePageNumber, sourcePage, viewport, rows,
        crop: cropForQuestionPage(result.question, sourcePageNumber, rows, viewport) });
    }
    const subpartPlan = planSubpartPages(result.question, pageDetails);
    const selectedPages = subpartPlan || pageDetails.map((page) => ({ ...page, fragments: [page.crop] }));

    for (let sourcePageNumberIndex = 0; sourcePageNumberIndex < selectedPages.length; sourcePageNumberIndex += 1) {
      const { sourcePageNumber, sourcePage, viewport, rows, fragments } = selectedPages[sourcePageNumberIndex];
      const isFirstSourcePage = sourcePageNumberIndex === 0;
      const expectedLabel = labelPattern(questionNumber(result.question));
      const questionLabelPresent = rows.some((row) => expectedLabel.test(row.text));
      const conflictingQuestionLabel = rows.some((row) => anyQuestionLabelPattern().test(row.text) && !expectedLabel.test(row.text));
      const sourceMismatch = isFirstSourcePage && !questionLabelPresent && conflictingQuestionLabel;
      const hasSubpart = Boolean(result.question?.challenge?.subpartId);
      const cropNeedsReview = (hasSubpart && !subpartPlan)
        || (isFirstSourcePage && !questionLabelPresent)
        || sourceMismatch;
      const renderedViewport = sourcePage.getViewport({ scale: 2 });
      const fullCanvas = makeCanvas(renderedViewport.width, renderedViewport.height);
      const context = fullCanvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Your browser could not prepare the PDF page images.');
      await sourcePage.render({ canvasContext: context, viewport: renderedViewport }).promise;

      const cropScale = renderedViewport.scale / viewport.scale;
      const sourceCrops = fragments.map((crop) => ({
        left: crop ? Math.max(0, crop.left * cropScale) : 0,
        right: crop ? Math.min(fullCanvas.width, Number.isFinite(crop.right) ? crop.right * cropScale : fullCanvas.width) : fullCanvas.width,
        top: crop ? Math.max(0, crop.top * cropScale) : 0,
        bottom: crop ? Math.min(fullCanvas.height, crop.bottom * cropScale) : fullCanvas.height,
      })).filter((crop) => crop.right > crop.left && crop.bottom > crop.top);
      const cropCanvas = makeCanvas(
        Math.max(...sourceCrops.map((crop) => crop.right - crop.left)),
        sourceCrops.reduce((height, crop) => height + crop.bottom - crop.top, 0),
      );
      const cropContext = cropCanvas.getContext('2d', { alpha: false });
      cropContext.fillStyle = '#fff';
      cropContext.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
      let targetTop = 0;
      for (const crop of sourceCrops) {
        const width = crop.right - crop.left;
        const height = crop.bottom - crop.top;
        cropContext.drawImage(fullCanvas, crop.left, crop.top, width, height, 0, targetTop, width, height);
        targetTop += height;
      }

      outputPage += 1;
      doc.addPage();
      doc.setFont('times', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(30, 30, 30);
      const part = result.question?.challenge?.subpartId ? `(${result.question.challenge.subpartId})` : '';
      doc.text(`${questionIndex + 1}.  Question ${result.question?.id || ''}${part}  ·  ${result.question?.marks || '?'} marks`, PAGE_MARGIN, 34);
      if (cropNeedsReview) {
        doc.setFont('times', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(154, 101, 0);
        const reviewMessage = sourceMismatch
          ? 'The source page shows a different question; image omitted for review.'
          : hasSubpart
            ? 'Full question shown; selected subpart crop needs review.'
            : 'Source image needs review.';
        doc.text(reviewMessage, PAGE_MARGIN, 49);
      }

      if (!sourceMismatch) {
        const image = cropCanvas.toDataURL('image/jpeg', 0.9);
        const availableWidth = A4_WIDTH - PAGE_MARGIN * 2;
        const availableHeight = A4_HEIGHT - (cropNeedsReview ? 160 : 145);
        const ratio = Math.min(availableWidth / cropCanvas.width, availableHeight / cropCanvas.height);
        const imageWidth = cropCanvas.width * ratio;
        const imageHeight = cropCanvas.height * ratio;
        doc.addImage(image, 'JPEG', (A4_WIDTH - imageWidth) / 2, cropNeedsReview ? 61 : 48, imageWidth, imageHeight, undefined, 'FAST');
      } else {
        doc.setFont('times', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(90, 90, 90);
        doc.text('Open the credited source paper below to find the selected question.', PAGE_MARGIN, 75);
      }

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
      doc.text(String(outputPage), A4_WIDTH - PAGE_MARGIN, A4_HEIGHT - 24, { align: 'right' });
      fullCanvas.width = 1;
      fullCanvas.height = 1;
      cropCanvas.width = 1;
      cropCanvas.height = 1;
    }
  }

  doc.save(`${String(build.subject || 'practice-set').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-year-${build.level || ''}-practice-paper.pdf`);
}

const GEMINI_API_ROOT = 'https://generativelanguage.googleapis.com';
const FILE_PROCESSING_POLL_MS = 3_000;
const MAX_DIRECT_PDF_BYTES = 32 * 1024 * 1024;

function providerError(status, message) {
  const error = new Error(message);
  error.name = 'GeminiPdfProviderError';
  error.status = Number(status) || 500;
  return error;
}

async function responseJson(response, fallbackMessage) {
  const raw = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    // The upstream payload is never sent to the browser unchanged.
  }

  if (!response.ok) {
    const message = String(payload?.error?.message || fallbackMessage).trim();
    throw providerError(response.status, message || fallbackMessage);
  }
  return payload || {};
}

function remainingMs(deadline) {
  return deadline - Date.now();
}

function requireTime(deadline, minimumMs, message) {
  if (remainingMs(deadline) < minimumMs) {
    throw new Error(message);
  }
}

async function deleteUploadedFile({ apiKey, name }) {
  if (!name) return;
  try {
    await fetch(`${GEMINI_API_ROOT}/v1beta/${name}?key=${encodeURIComponent(apiKey)}`, {
      method: 'DELETE',
    });
  } catch {
    // Gemini also expires uploaded files automatically. Deletion is best-effort
    // and must not turn an otherwise complete Question Map into a failure.
  }
}

async function uploadPdf({ apiKey, paperUrl, deadline, signal }) {
  requireTime(deadline, 10_000, 'The analysis job ran out of time before the scanned PDF could be downloaded. Please retry this paper.');
  const paperResponse = await fetch(paperUrl, { signal });
  if (!paperResponse.ok) {
    throw providerError(paperResponse.status, 'The scanned paper could not be downloaded for analysis.');
  }

  const declaredLength = Number(paperResponse.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_DIRECT_PDF_BYTES) {
    throw new Error('This scanned PDF is too large for direct analysis.');
  }

  const pdfBytes = await paperResponse.arrayBuffer();
  if (!pdfBytes.byteLength) throw new Error('The scanned PDF was empty.');
  if (pdfBytes.byteLength > MAX_DIRECT_PDF_BYTES) {
    throw new Error('This scanned PDF is too large for direct analysis.');
  }

  requireTime(deadline, 10_000, 'The analysis job ran out of time before the scanned PDF could be uploaded. Please retry this paper.');
  const startResponse = await fetch(`${GEMINI_API_ROOT}/upload/v1beta/files?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(pdfBytes.byteLength),
      'X-Goog-Upload-Header-Content-Type': 'application/pdf',
    },
    body: JSON.stringify({
      file: { display_name: 'hsc-hide-scanned-paper.pdf' },
    }),
    signal,
  });

  if (!startResponse.ok) {
    await responseJson(startResponse, 'Gemini could not start the scanned-PDF upload.');
  }
  const uploadUrl = String(startResponse.headers.get('x-goog-upload-url') || '').trim();
  if (!uploadUrl) throw new Error('Gemini did not provide an upload URL for the scanned PDF.');

  const finaliseResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(pdfBytes.byteLength),
      'Content-Type': 'application/pdf',
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: pdfBytes,
    signal,
  });
  const uploaded = await responseJson(finaliseResponse, 'Gemini could not upload the scanned PDF.');
  const file = uploaded?.file || uploaded;
  if (!file?.name || !file?.uri) {
    throw new Error('Gemini did not return a usable scanned-PDF upload.');
  }
  return file;
}

async function waitForActiveFile({ apiKey, file, deadline, signal }) {
  let current = file;
  while (String(current?.state || '').toUpperCase() === 'PROCESSING') {
    requireTime(deadline, FILE_PROCESSING_POLL_MS + 8_000, 'Gemini was still preparing the scanned PDF when the analysis time ran out. Please retry this paper.');
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, FILE_PROCESSING_POLL_MS);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    });

    const fileResponse = await fetch(`${GEMINI_API_ROOT}/v1beta/${current.name}?key=${encodeURIComponent(apiKey)}`, {
      signal,
    });
    current = await responseJson(fileResponse, 'Gemini could not check the scanned-PDF upload.');
  }

  if (String(current?.state || '').toUpperCase() === 'FAILED') {
    throw new Error('Gemini could not prepare this scanned PDF for analysis.');
  }
  if (String(current?.state || '').toUpperCase() !== 'ACTIVE') {
    throw new Error('Gemini did not make the scanned PDF ready for analysis.');
  }
  return current;
}

/**
 * Reads an image-only HSC PDF with Gemini's native PDF understanding. This helper
 * is server-only; its API key is never returned to the browser or saved in source.
 */
export async function analyseScannedPdfWithGemini({ apiKey, paperUrl, prompt, timeoutMs, maxOutputTokens }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const deadline = Date.now() + timeoutMs;
  let uploadedFile = null;

  try {
    uploadedFile = await uploadPdf({ apiKey, paperUrl, deadline, signal: controller.signal });
    const activeFile = await waitForActiveFile({
      apiKey,
      file: uploadedFile,
      deadline,
      signal: controller.signal,
    });

    requireTime(deadline, 8_000, 'The analysis job ran out of time before Gemini could read the scanned PDF. Please retry this paper.');
    const analysisResponse = await fetch(
      `${GEMINI_API_ROOT}/v1beta/models/gemini-flash-lite-latest:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              { text: prompt },
              {
                fileData: {
                  mimeType: 'application/pdf',
                  fileUri: activeFile.uri,
                },
              },
            ],
          }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      },
    );
    const payload = await responseJson(analysisResponse, 'Gemini could not analyse this scanned PDF.');
    const answer = (Array.isArray(payload?.candidates?.[0]?.content?.parts)
      ? payload.candidates[0].content.parts.map((part) => part?.text || '').join('')
      : '').trim();
    if (!answer) throw new Error('Gemini returned no Question Map for this scanned PDF.');
    return answer;
  } catch (error) {
    if (controller.signal.aborted || error?.name === 'AbortError') {
      throw new Error('Gemini took too long to analyse this scanned PDF. Please retry this paper.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    await deleteUploadedFile({ apiKey, name: uploadedFile?.name });
  }
}

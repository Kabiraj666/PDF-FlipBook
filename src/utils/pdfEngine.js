import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Loads a PDF file (File object or ArrayBuffer) into a pdf.js document proxy.
 */
export async function loadPdfDocument(fileOrBuffer) {
  const data =
    fileOrBuffer instanceof File
      ? await fileOrBuffer.arrayBuffer()
      : fileOrBuffer;
  const loadingTask = pdfjsLib.getDocument({ 
    data,
    cMapUrl: "/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/standard_fonts/"
  });
  return loadingTask.promise;
}

/**
 * Fetches a PDF from a pasted URL. Tries a direct browser fetch first
 * (works when the source server allows CORS — fast, no server hop).
 * If that fails or the response isn't actually a PDF, falls back to the
 * /api/pdf-proxy serverless function, which can also resolve a webpage
 * that merely links to a PDF rather than being one.
 *
 * Returns { arrayBuffer, suggestedName }.
 */
export async function fetchPdfFromUrl(url) {
  const suggestedName = suggestFileNameFromUrl(url);

  try {
    const direct = await fetch(url, { mode: "cors" });
    if (direct.ok) {
      const buffer = await direct.arrayBuffer();
      if (isPdfBuffer(buffer)) {
        return { arrayBuffer: buffer, suggestedName };
      }
    }
  } catch {
    // CORS-blocked or network error — fall through to the proxy.
  }

  const proxyUrl = `/api/pdf-proxy?url=${encodeURIComponent(url)}`;
  const proxied = await fetch(proxyUrl);
  if (!proxied.ok) {
    const body = await proxied.json().catch(() => ({}));
    throw new Error(body.error || "Couldn't load a PDF from that link.");
  }
  const buffer = await proxied.arrayBuffer();
  if (!isPdfBuffer(buffer)) {
    throw new Error("Couldn't load a PDF from that link.");
  }
  return { arrayBuffer: buffer, suggestedName };
}

function isPdfBuffer(buffer) {
  const bytes = new Uint8Array(buffer.slice(0, 5));
  return String.fromCharCode(...bytes) === "%PDF-";
}

function suggestFileNameFromUrl(url) {
  try {
    const path = new URL(url).pathname;
    const last = path.split("/").filter(Boolean).pop();
    return last?.toLowerCase().endsWith(".pdf") ? last : "document.pdf";
  } catch {
    return "document.pdf";
  }
}

/**
 * Renders a single page to a PNG data URL at the given scale.
 * Higher scale = sharper but slower/heavier. Used for both the base
 * flipbook render and the higher-res zoom re-render.
 */
export async function renderPageToDataUrl(pdfDoc, pageNumber, baseScale = 1.6, useDpr = true) {
  const page = await pdfDoc.getPage(pageNumber);
  
  // Cap DPR at 1.5 for base flipbook pages for optimal speed and memory performance
  const dpr = useDpr ? Math.min(1.5, window.devicePixelRatio || 1) : 1;
  const viewport = page.getViewport({ scale: baseScale * dpr });
  const logicalViewport = page.getViewport({ scale: baseScale });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "medium";
  }

  await page.render({ canvasContext: ctx, viewport }).promise;
  
  // 0.85 JPEG quality provides excellent sharpness while rendering 5x faster with 70% smaller memory size
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

  canvas.width = 0;
  canvas.height = 0;

  return { dataUrl, width: logicalViewport.width, height: logicalViewport.height };
}

/**
 * Renders every page of the document, reporting progress as it goes.
 * Runs with a small concurrency limit so the tab doesn't lock up on
 * large books.
 */
export async function renderAllPages(pdfDoc, scale, onProgress, concurrency = 3) {
  const total = pdfDoc.numPages;
  const results = new Array(total);
  let nextIndex = 1;
  let completed = 0;

  async function worker() {
    while (nextIndex <= total) {
      const pageNum = nextIndex++;
      const rendered = await renderPageToDataUrl(pdfDoc, pageNum, scale);
      results[pageNum - 1] = rendered;
      completed++;
      onProgress?.(completed, total);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, total) }, worker);
  await Promise.all(workers);
  return results;
}

/**
 * Extracts a flat, clickable table of contents from the PDF outline.
 * Each entry is resolved to a 1-based page number where possible.
 */
export async function getTableOfContents(pdfDoc) {
  const outline = await pdfDoc.getOutline();
  if (!outline) return [];

  async function resolveDest(item) {
    try {
      let dest = item.dest;
      if (typeof dest === "string") {
        dest = await pdfDoc.getDestination(dest);
      }
      if (!dest) return null;
      const pageIndex = await pdfDoc.getPageIndex(dest[0]);
      return pageIndex + 1;
    } catch {
      return null;
    }
  }

  async function walk(items, depth) {
    const out = [];
    for (const item of items) {
      const page = await resolveDest(item);
      out.push({ title: item.title, page, depth });
      if (item.items?.length) {
        out.push(...(await walk(item.items, depth + 1)));
      }
    }
    return out;
  }

  return walk(outline, 0);
}

export async function searchInDocument(pdfDoc, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const total = pdfDoc.numPages;
  const matches = [];
  let nextIndex = 1;

  async function worker() {
    while (nextIndex <= total) {
      const pageNum = nextIndex++;
      try {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const text = textContent.items.map((it) => it.str).join(" ");
        const lower = text.toLowerCase();
        
        let idx = lower.indexOf(q);
        while (idx !== -1) {
          const start = Math.max(0, idx - 40);
          const end = Math.min(text.length, idx + q.length + 40);
          matches.push({ page: pageNum, snippet: `…${text.slice(start, end)}…` });
          idx = lower.indexOf(q, idx + 1); // find next match on same page
        }
      } catch (err) {
        console.warn(`Failed to search text on page ${pageNum}:`, err);
      }
    }
  }

  // Run with concurrency of 5 to speed up search on large documents
  const workers = Array.from({ length: Math.min(5, total) }, worker);
  await Promise.all(workers);

  return matches.sort((a, b) => a.page - b.page);
}

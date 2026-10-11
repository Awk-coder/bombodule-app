import type { TextItem } from "./parser";

export type ProgressCallback = (message: string, percent?: number) => void;

/** Determines whether a file is an image (PNG/JPG) based on MIME type or name. */
export function isImageFile(file: Blob): boolean {
  if (file.type && file.type.startsWith("image/")) return true;
  const name = (file as { name?: string }).name?.toLowerCase() ?? "";
  return name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg");
}

/** Determines whether extracted PDF text items contain enough valid text or should fall back to OCR. */
export function isTextPdf(items: TextItem[]): boolean {
  const text = items.map((it) => it.str).join(" ");
  if (text.trim().length < 20) return false;
  // Must match at least one 3-4 letter course code with 4 digits (e.g. BICS 1301, UNGS 1301)
  return /[A-Z]{3,4}\s*\d{4}/i.test(text);
}

async function loadNodeCanvas(): Promise<any> {
  if (typeof document !== "undefined" || typeof OffscreenCanvas !== "undefined") return null;
  try {
    const mod = "@napi-rs/canvas";
    return await import(/* @vite-ignore */ mod);
  } catch {
    return null;
  }
}

async function createOffscreenCanvas(
  width: number,
  height: number,
): Promise<{ canvas: any; ctx: any }> {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    return { canvas, ctx: canvas.getContext("2d") };
  }
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return { canvas, ctx: canvas.getContext("2d") };
  }
  // Node.js fallback for tests
  const nodeCanvas = await loadNodeCanvas();
  if (nodeCanvas) {
    const canvas = nodeCanvas.createCanvas(width, height);
    return { canvas, ctx: canvas.getContext("2d") };
  }
  throw new Error("No canvas implementation available in this environment.");
}

/** Preprocess canvas: converts to grayscale and boosts contrast for crisp OCR. */
export function preprocessCanvas(ctx: any, width: number, height: number): void {
  const imgData = ctx.getImageData(0, 0, width, height);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const val = gray > 190 ? 255 : gray < 70 ? 0 : (gray - 70) * (255 / 120);
    d[i] = val;
    d[i + 1] = val;
    d[i + 2] = val;
  }
  ctx.putImageData(imgData, 0, 0);
}

/** Renders a single PDF page to a canvas, scaled for crisp OCR and capped to 2400px to prevent memory crashes. */
export async function renderPdfPageToCanvas(page: any, preferredScale = 3): Promise<any> {
  const baseViewport = page.getViewport({ scale: 1 });
  const maxDim = Math.max(baseViewport.width, baseViewport.height);
  const maxAllowedScale = 2400 / Math.max(1, maxDim);
  const scale = Math.max(1.5, Math.min(preferredScale, maxAllowedScale));
  const viewport = page.getViewport({ scale });
  const { canvas, ctx } = await createOffscreenCanvas(viewport.width, viewport.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  preprocessCanvas(ctx, viewport.width, viewport.height);
  return canvas;
}

/** Convert a PNG/JPG blob into a preprocessed canvas. */
export async function imageFileToCanvas(file: Blob): Promise<any> {
  if (typeof createImageBitmap !== "undefined") {
    const imgBitmap = await createImageBitmap(file);
    const { canvas, ctx } = await createOffscreenCanvas(imgBitmap.width, imgBitmap.height);
    ctx.drawImage(imgBitmap, 0, 0);
    preprocessCanvas(ctx, imgBitmap.width, imgBitmap.height);
    return canvas;
  }
  // Node.js fallback
  const nodeCanvas = await loadNodeCanvas();
  if (nodeCanvas) {
    const buf = Buffer.from(await file.arrayBuffer());
    const img = await nodeCanvas.loadImage(buf);
    const canvas = nodeCanvas.createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    preprocessCanvas(ctx, img.width, img.height);
    return canvas;
  }
  throw new Error("No canvas/image implementation available in this environment.");
}

/**
 * Runs OCR using lazy-loaded tesseract.js in a web worker with PSM 6 (single uniform block).
 */
export async function recognizeCanvas(
  canvas: any,
  onProgress?: ProgressCallback,
): Promise<string> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (!onProgress) return;
      if (m.status === "loading tesseract core" || m.status === "initializing tesseract") {
        onProgress("Loading OCR engine…");
      } else if (m.status === "loading language traineddata") {
        onProgress("Loading OCR language data…");
      } else if (m.status === "recognizing text") {
        const pct = Math.round((m.progress ?? 0) * 100);
        onProgress(`Scanning document… ${pct}%`, pct);
      }
    },
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK, // PSM 6: Assume a single uniform block of text.
    });
    // In Node.js / canvas, pass canvas or buffer
    const input = canvas.toBuffer ? canvas.toBuffer("image/png") : canvas;
    const res = await worker.recognize(input);
    return res.data.text;
  } finally {
    await worker.terminate();
  }
}

/** Render all pages of an image PDF and perform OCR using a single shared worker. */
export async function ocrPdf(
  doc: any,
  onProgress?: ProgressCallback,
): Promise<string> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (!onProgress) return;
      if (m.status === "loading tesseract core" || m.status === "initializing tesseract") {
        onProgress("Loading OCR engine…");
      } else if (m.status === "loading language traineddata") {
        onProgress("Loading OCR language data…");
      } else if (m.status === "recognizing text") {
        const pct = Math.round((m.progress ?? 0) * 100);
        onProgress(`Scanning document… ${pct}%`, pct);
      }
    },
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    });
    const parts: string[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      onProgress?.(doc.numPages > 1 ? `Rendering page ${p} of ${doc.numPages}…` : "Rendering document…");
      const page = await doc.getPage(p);
      const canvas = await renderPdfPageToCanvas(page);
      const input = canvas.toBuffer ? canvas.toBuffer("image/png") : canvas;
      const res = await worker.recognize(input);
      parts.push(res.data.text);
    }
    return parts.join("\n");
  } finally {
    await worker.terminate();
  }
}

/** Converts raw text (from OCR or text dumps) into standard rows of cells. */
export function textToRows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/));
}

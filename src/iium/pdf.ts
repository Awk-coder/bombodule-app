import type { TextItem } from "./parser";

export interface PdfDoc {
  numPages: number;
  getPage(n: number): Promise<any>;
  destroy?(): Promise<void>;
}

/** Positioned text from every page; later pages sit below earlier ones. */
export async function textItems(doc: PdfDoc): Promise<TextItem[]> {
  const out: TextItem[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const { items } = await (await doc.getPage(n)).getTextContent();
    for (const it of items as { str?: string; transform?: number[] }[]) {
      if (typeof it.str !== "string" || !it.transform) continue;
      out.push({ str: it.str, x: it.transform[4], y: it.transform[5] - (n - 1) * 10_000 });
    }
  }
  return out;
}

export async function loadPdfDoc(data: ArrayBuffer): Promise<PdfDoc> {
  const isNode = typeof window === "undefined" && typeof process !== "undefined" && !!process.versions?.node;
  const pdfjs: any = isNode
    ? await import("pdfjs-dist/legacy/build/pdf.mjs")
    : await import("pdfjs-dist");

  if (!isNode) {
    pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  }

  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  return await task.promise;
}

export async function readPdf(data: ArrayBuffer): Promise<TextItem[]> {
  const doc = await loadPdfDoc(data);
  try {
    return await textItems(doc);
  } finally {
    if (doc.destroy) void doc.destroy();
  }
}

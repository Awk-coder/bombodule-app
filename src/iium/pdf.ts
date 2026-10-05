import type { TextItem } from "./parser";

interface PdfDoc {
  numPages: number;
  getPage(n: number): Promise<{ getTextContent(): Promise<{ items: unknown[] }> }>;
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

export async function readPdf(data: ArrayBuffer): Promise<TextItem[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  try {
    return await textItems(doc);
  } finally {
    void doc.destroy();
  }
}

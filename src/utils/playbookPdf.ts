// Reading Hudl playbook files in the browser.
//  - A printed Hudl playbook / install page (Ctrl+P of the web page): the play list is real text.
//  - A Hudl "Export" install PDF: one play per page, but Hudl draws the letters as shapes, so the
//    play name and the position table are read with text recognition (tesseract, loaded on demand).
//  - Screenshots / photos of a Hudl play list: text recognition, then read like a pasted list.
// The parsing itself is in playbookImport.ts.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import ocrWorkerUrl from 'tesseract.js/dist/worker.min.js?url';
import {
  DraftInput,
  PdfTextItem,
  isSectionName,
  parseAssignmentLines,
  parseHudlListPages,
  fixOcrCall,
  parseLooseList,
  tidyPlayName,
} from './playbookImport';
import { diagramFromPage } from './playDiagrams';

export interface PlaybookReadProgress {
  done: number;
  total: number;
  message: string;
}

export interface PlaybookReadResult {
  kind: 'list' | 'install' | 'image' | 'empty';
  install?: string;
  inputs: DraftInput[];
  /** Section cards whose plays are drawn sideways and could not be read. */
  sectionCards: string[];
  warnings: string[];
}

type OcrWorker = { recognize: (image: HTMLCanvasElement | File) => Promise<{ data: { text: string } }>; terminate: () => Promise<unknown> };

async function loadPdf(file: File) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}

async function makeOcrWorker(): Promise<OcrWorker> {
  const { createWorker } = await import('tesseract.js');
  return (await createWorker('eng', 1, { workerPath: ocrWorkerUrl })) as unknown as OcrWorker;
}

function crop(src: HTMLCanvasElement, top: number, bottom: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = Math.max(1, Math.round(src.height * (bottom - top)));
  c.getContext('2d')!.drawImage(src, 0, Math.round(src.height * top), src.width, c.height, 0, 0, c.width, c.height);
  return c;
}

/** First line that reads like a title (letters in it), from the text recognition of the heading band. */
export function headingFromOcr(text: string): string {
  const line = String(text || '')
    .split(/\r?\n/)
    .map((l) => fixOcrCall(l))
    .find((l) => (l.match(/[A-Za-z]/g) || []).length >= 3);
  return line || '';
}

/** "4-4 BASE STACK RIP vs 22 TWINS R" -> name "4-4 BASE STACK RIP", versus "22 TWINS R". */
export function splitVersus(title: string): { name: string; versus?: string } {
  const m = title.match(/^(.*?)\s+vs\.?\s+(.+)$/i);
  return m ? { name: tidyPlayName(m[1]), versus: tidyPlayName(m[2]) } : { name: tidyPlayName(title) };
}

export async function readPlaybookPdf(file: File, onProgress?: (p: PlaybookReadProgress) => void): Promise<PlaybookReadResult> {
  const doc = await loadPdf(file);
  const pages: PdfTextItem[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    onProgress?.({ done: i - 1, total: doc.numPages, message: `Reading page ${i} of ${doc.numPages}` });
    const tc = await (await doc.getPage(i)).getTextContent();
    pages.push(
      (tc.items as any[])
        .filter((it) => typeof it.str === 'string')
        .map((it) => ({ str: it.str as string, x: it.transform[4] as number, y: it.transform[5] as number }))
    );
  }

  // 1) A printed play list: real text, numbered rows.
  const list = parseHudlListPages(pages);
  if (list.entries.length >= 3) {
    return {
      kind: 'list',
      install: list.install,
      inputs: list.entries.map((e) => ({ name: e.name, where: e.where })),
      sectionCards: [],
      warnings:
        list.entries.length && list.entries[list.entries.length - 1].index !== list.entries.length
          ? ['Some numbers are missing from the list (the print may have cut off the end). Add any missing plays by pasting them.']
          : [],
    };
  }

  // 2) A Hudl install export: read each page's title and position table.
  const footer = pages
    .flat()
    .map((it) => it.str.trim())
    .find((s) => /^Install:\s*/i.test(s));
  const install = footer ? footer.replace(/^Install:\s*/i, '').trim() : undefined;
  const inputs: DraftInput[] = [];
  const sectionCards: string[] = [];
  const warnings: string[] = [];
  let worker: OcrWorker;
  try {
    onProgress?.({ done: 0, total: doc.numPages, message: 'Loading the text reader…' });
    worker = await makeOcrWorker();
  } catch {
    return {
      kind: 'empty',
      install,
      inputs: [],
      sectionCards: [],
      warnings: [
        'This Hudl PDF draws its play names as pictures, and the text reader could not load (it needs an internet connection the first time). Paste the play list instead, or print the Hudl playbook page to PDF.',
      ],
    };
  }
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      onProgress?.({ done: i - 1, total: doc.numPages, message: `Reading play ${i} of ${doc.numPages}` });
      const page = await doc.getPage(i);
      const vp = page.getViewport({ scale: 3 });
      const canvas = document.createElement('canvas');
      canvas.width = vp.width;
      canvas.height = vp.height;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp, canvas } as any).promise;
      const heading = headingFromOcr((await worker.recognize(crop(canvas, 0, 0.075))).data.text);
      if (!heading || /^printed/i.test(heading)) continue; // cover page
      const { name, versus } = splitVersus(heading);
      if (isSectionName(name)) {
        sectionCards.push(name);
        inputs.push({ name, where: `page ${i}` });
        continue;
      }
      const table = (await worker.recognize(crop(canvas, 0.43, 0.9))).data.text;
      const assignments = parseAssignmentLines(table).map((a) => ({ ...a, text: a.text.length > 140 ? `${a.text.slice(0, 139)}…` : a.text }));
      inputs.push({ name, where: `page ${i}`, assignments, diagram: await diagramFromPage(canvas).catch(() => undefined), notes: versus ? `Drawn vs ${versus}` : undefined });
    }
  } finally {
    await worker.terminate().catch(() => undefined);
  }
  onProgress?.({ done: doc.numPages, total: doc.numPages, message: 'Done' });
  if (sectionCards.length) {
    warnings.push(
      `Section card${sectionCards.length > 1 ? 's' : ''} ${sectionCards.map((s) => `"${s}"`).join(', ')} show several plays drawn sideways, which can't be read. If any of those plays are missing, paste the play list from Hudl.`
    );
  }
  return { kind: inputs.length ? 'install' : 'empty', install, inputs, sectionCards, warnings };
}

/** A screenshot or photo of a Hudl play list (or a single play card). */
export async function readPlaybookImage(file: File, onProgress?: (p: PlaybookReadProgress) => void): Promise<PlaybookReadResult> {
  onProgress?.({ done: 0, total: 1, message: 'Loading the text reader…' });
  let worker: OcrWorker;
  try {
    worker = await makeOcrWorker();
  } catch {
    return { kind: 'empty', inputs: [], sectionCards: [], warnings: ['The text reader could not load (it needs an internet connection the first time).'] };
  }
  try {
    onProgress?.({ done: 0, total: 1, message: `Reading ${file.name}` });
    const text = (await worker.recognize(file)).data.text;
    const entries = parseLooseList(text).filter((e) => /\d/.test(e.name) || isSectionName(e.name));
    return {
      kind: entries.length ? 'image' : 'empty',
      inputs: entries.map((e) => ({ name: e.name, where: `${file.name}, ${e.where}` })),
      sectionCards: [],
      warnings: entries.length ? ['Read from a picture: check the names before adding them.'] : ['No play names found in that picture.'],
    };
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}

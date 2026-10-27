import { PDFDocument } from "pdf-lib"
import { rotatePage } from "./geometry"
import { loadPdf, savePdf, type PdfBytes } from "./load"

export interface PageSpec {
  /** 0-based index of the page in the source document. */
  index: number
  /** Extra clockwise rotation in degrees (multiple of 90). */
  rotate?: number
}

/**
 * Builds a new PDF from the given pages, in the given order. This one operation
 * covers reorder, rotate, delete and extract.
 */
export async function buildFromPages(bytes: PdfBytes, specs: PageSpec[]): Promise<Uint8Array> {
  const source = await loadPdf(bytes)
  const out = await PDFDocument.create()
  const copied = await out.copyPages(
    source,
    specs.map((s) => s.index)
  )
  copied.forEach((page, i) => {
    if (specs[i].rotate) rotatePage(page, specs[i].rotate!)
    out.addPage(page)
  })
  copyInfo(source, out)
  return savePdf(out)
}

export async function mergePdfs(files: PdfBytes[]): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  for (const bytes of files) {
    const source = await loadPdf(bytes)
    const pages = await out.copyPages(source, source.getPageIndices())
    pages.forEach((page) => out.addPage(page))
  }
  return savePdf(out)
}

/** One output PDF per group of 0-based page indices. */
export async function splitPdf(bytes: PdfBytes, groups: number[][]): Promise<Uint8Array[]> {
  const source = await loadPdf(bytes)
  const outputs: Uint8Array[] = []
  for (const group of groups) {
    const out = await PDFDocument.create()
    const pages = await out.copyPages(source, group)
    pages.forEach((page) => out.addPage(page))
    copyInfo(source, out)
    outputs.push(await savePdf(out))
  }
  return outputs
}

export async function getPageCount(bytes: PdfBytes): Promise<number> {
  return (await loadPdf(bytes)).getPageCount()
}

function copyInfo(from: PDFDocument, to: PDFDocument) {
  const title = from.getTitle()
  const author = from.getAuthor()
  if (title) to.setTitle(title)
  if (author) to.setAuthor(author)
}

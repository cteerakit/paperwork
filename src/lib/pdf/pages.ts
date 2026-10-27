import { PDFDocument, type PDFRef } from "pdf-lib"
import { rotatePage } from "./geometry"
import { loadPdf, savePdf, type PdfBytes } from "./load"
import { readOutline, writeOutline, type OutlineNode } from "./outline"

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

export interface MergeSource {
  bytes: PdfBytes
  /** Used as the bookmark that holds this file's own bookmarks. */
  name: string
  /** 0-based pages to include, in order. Defaults to every page. */
  pages?: number[]
}

/**
 * Joins PDFs in order. Each file's bookmarks are kept under a top-level
 * bookmark named after the file, and the first file's title and author carry over.
 */
export async function mergePdfs(files: MergeSource[]): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  const bookmarks: OutlineNode[] = []
  for (const [n, file] of files.entries()) {
    const source = await loadPdf(file.bytes)
    const indices = file.pages ?? source.getPageIndices()
    const pages = await out.copyPages(source, indices)
    const mapped = new Map<string, PDFRef>()
    pages.forEach((page, i) => {
      mapped.set(source.getPage(indices[i]).ref.tag, page.ref)
      out.addPage(page)
    })
    if (n === 0) copyInfo(source, out)
    if (!pages.length) continue
    bookmarks.push({
      title: file.name.replace(/\.pdf$/i, "") || "document",
      dest: out.context.obj([pages[0].ref, "Fit"]),
      children: readOutline(source, out, mapped),
    })
  }
  writeOutline(out, bookmarks)
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

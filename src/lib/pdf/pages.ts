import { PDFDocument, type PDFPage, type PDFRef } from "pdf-lib"
import { rotatePage } from "./geometry"
import { loadPdf, savePdf, type PdfBytes } from "./load"
import { readOutline, writeOutline, type OutlineNode } from "./outline"

export type PageSpec =
  | {
      /** 0-based index of the page in its source document. */
      index: number
      /** Which document the page comes from: 0 is the main file, 1+ are the extra files. */
      source?: number
      /** Extra clockwise rotation in degrees (multiple of 90). */
      rotate?: number
    }
  | { blank: { width: number; height: number } }

/**
 * Builds a new PDF from the given pages, in the given order. This one operation
 * covers reorder, rotate, delete, extract, duplicate and inserting blank pages
 * or pages from other files (`extra`).
 */
export async function buildFromPages(bytes: PdfBytes, specs: PageSpec[], extra: PdfBytes[] = []): Promise<Uint8Array> {
  const sources = [await loadPdf(bytes)]
  for (const file of extra) sources.push(await loadPdf(file))

  // Pages are copied together per source so shared fonts and images are stored once. A page used
  // twice needs a separate copy of its own, so repeats go into later rounds.
  const rounds = new Map<string, number[]>()
  const uses = new Map<string, number>()
  specs.forEach((spec, position) => {
    if ("blank" in spec) return
    const use = `${spec.source ?? 0}:${spec.index}`
    const repeat = uses.get(use) ?? 0
    uses.set(use, repeat + 1)
    const round = `${repeat}:${spec.source ?? 0}`
    rounds.set(round, [...(rounds.get(round) ?? []), position])
  })

  const out = await PDFDocument.create()
  const copies = new Map<number, PDFPage>()
  for (const [round, positions] of rounds) {
    const source = sources[Number(round.split(":")[1])]
    const pages = await out.copyPages(
      source,
      positions.map((position) => (specs[position] as { index: number }).index)
    )
    positions.forEach((position, i) => copies.set(position, pages[i]))
  }

  specs.forEach((spec, position) => {
    if ("blank" in spec) {
      out.addPage([spec.blank.width, spec.blank.height])
      return
    }
    const page = copies.get(position)!
    if (spec.rotate) rotatePage(page, spec.rotate)
    out.addPage(page)
  })
  copyInfo(sources[0], out)
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

import { layoutText, prepareLayout } from "../text/layout"
import { sanitize } from "../text/segment"
import { PageWriter } from "./content"
import { loadPdf, savePdf, type PdfBytes } from "./load"
import { drawTextXObject, textXObject } from "./text"

export type Position = "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right"

export interface PageNumberOptions {
  position: Position
  /** "{n}" is replaced by the page number, "{total}" by the last number. */
  template: string
  startAt: number
  /** 0-based pages to number. Numbering follows this order. */
  pages: number[]
  fontSize: number
  color: string
  /** Distance from the page edge, in points. */
  margin?: number
  lang?: string
}

export function formatPageNumber(template: string, n: number, total: number) {
  return template.replaceAll("{n}", String(n)).replaceAll("{total}", String(total))
}

/** Top-left of a page-number label of size w×h on a W×H page. */
export function pageNumberPlacement(position: Position, W: number, H: number, w: number, h: number, margin = 28) {
  const [vertical, horizontal] = position.split("-")
  const x = horizontal === "left" ? margin : horizontal === "right" ? W - margin - w : (W - w) / 2
  const y = vertical === "top" ? margin : H - margin - h
  return { x, y }
}

export async function addPageNumbers(bytes: PdfBytes, options: PageNumberOptions) {
  const { position, template, startAt, pages, fontSize, color, margin = 28, lang } = options
  const doc = await loadPdf(bytes)
  const total = startAt + pages.length - 1

  // Load fonts once using the widest label; every label uses the same characters.
  const textOptions = { fontSize, lang }
  const { missing } = await prepareLayout(formatPageNumber(template, total, total), textOptions)

  pages.forEach((pageIndex, i) => {
    const page = doc.getPage(pageIndex)
    const writer = new PageWriter(doc, page)
    const label = sanitize(formatPageNumber(template, startAt + i, total), textOptions).text
    const layout = layoutText(label, textOptions)
    const { width: W, height: H } = writer.frame
    const placement = pageNumberPlacement(position, W, H, layout.width, layout.height, margin)
    drawTextXObject(writer, textXObject(doc, layout, color), layout, { placement })
    writer.commit()
  })

  return { bytes: await savePdf(doc), missing }
}

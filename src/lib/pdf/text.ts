import type { PDFDocument, PDFRef } from "pdf-lib"
import { layoutToPdfPath } from "../text/draw"
import type { TextLayout } from "../text/layout"
import { formXObject, matrix, rgb, type PageWriter } from "./content"
import { hexToRgb, placementMatrix, type Placement } from "./geometry"
import type { InvisibleTextLayer } from "./textLayer"

/**
 * Registers text outlines as a reusable Form XObject. Draw it many times
 * (e.g. a watermark on every page) while storing the outlines once.
 */
export function textXObject(doc: PDFDocument, layout: TextLayout, color: string): PDFRef {
  const pad = layout.fontSize
  const content = `${rgb(hexToRgb(color))} rg\n${layoutToPdfPath(layout)}\nf`
  return formXObject(doc, content, [-pad, -layout.height - pad, layout.width + pad, pad])
}

export interface DrawTextOptions {
  placement: Placement
  opacity?: number
  /** Adds an invisible text layer so the text can be searched and copied. */
  searchable?: InvisibleTextLayer
}

/** Draws a text XObject with its top-left at the placement point. */
export function drawTextXObject(
  writer: PageWriter,
  ref: PDFRef,
  layout: TextLayout,
  { placement, opacity = 1, searchable }: DrawTextOptions
) {
  writer.push("q")
  if (opacity < 1) writer.push(`${writer.graphicsState(opacity)} gs`)
  writer.push(matrix(placementMatrix(placement, writer.frame.height)), `${writer.xObject(ref)} Do`)
  if (searchable) {
    for (const line of layout.lines) searchable.writeLine(writer, line, layout.fontSize)
  }
  writer.push("Q")
}

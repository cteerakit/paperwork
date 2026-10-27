/**
 * Flattens annotation objects into page content. Sticky notes are the exception:
 * they become real PDF comments that viewers show in their comments panel.
 */
import { PDFHexString, PDFString, type PDFDocument, type PDFPage, type PDFRef } from "pdf-lib"
import { arrowHead, NOTE_SIZE, TEXT_LINE_HEIGHT, type Annotation, type NoteObject } from "../annotate/model"
import { prepareLayout } from "../text/layout"
import { PageWriter } from "./content"
import { drawArrowHead, drawEllipse, drawImage, drawPolyline, drawRect, embedImage } from "./draw"
import { apply, hexToRgb, type PageFrame } from "./geometry"
import { loadPdf, savePdf, type PdfBytes } from "./load"
import { drawTextXObject, textXObject } from "./text"
import { InvisibleTextLayer } from "./textLayer"

export async function applyAnnotations(bytes: PdfBytes, annotations: Annotation[], options: { lang?: string } = {}) {
  const doc = await loadPdf(bytes)
  const searchable = new InvisibleTextLayer(doc)
  const images = new Map<string, Promise<PDFRef>>()
  const missing = new Set<string>()

  const byPage = new Map<number, Annotation[]>()
  for (const a of annotations) byPage.set(a.page, [...(byPage.get(a.page) ?? []), a])

  for (const [pageIndex, items] of byPage) {
    const page = doc.getPage(pageIndex)
    const writer = new PageWriter(doc, page)

    for (const a of items) {
      switch (a.type) {
        case "rect":
          drawRect(writer, a, a)
          break
        case "ellipse":
          drawEllipse(writer, a, a)
          break
        case "highlight":
          drawRect(writer, a, { fill: a.color, opacity: a.opacity, blend: "Multiply" })
          break
        case "line":
        case "pen":
          drawPolyline(writer, a.points, a)
          break
        case "arrow": {
          const head = arrowHead(a.strokeWidth)
          const [x1, y1, x2, y2] = a.points
          // Stop the line at the base of the arrowhead so its square end doesn't poke through.
          const len = Math.hypot(x2 - x1, y2 - y1) || 1
          const t = Math.max(0, (len - head.length * 0.8) / len)
          drawPolyline(writer, [x1, y1, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t], a)
          drawArrowHead(writer, a.points, head, a.stroke, a.opacity)
          break
        }
        case "image": {
          let ref = images.get(a.src)
          if (!ref) {
            ref = embedImage(doc, a.src)
            images.set(a.src, ref)
          }
          drawImage(writer, await ref, a, a.opacity)
          break
        }
        case "text": {
          if (a.text.trim() === "") break
          const result = await prepareLayout(a.text, {
            fontSize: a.fontSize,
            maxWidth: a.width,
            align: a.align,
            lineHeight: TEXT_LINE_HEIGHT,
            weight: a.bold ? "bold" : "regular",
            family: a.family,
            lang: options.lang,
          })
          result.missing.forEach((m) => missing.add(m))
          drawTextXObject(writer, textXObject(doc, result.layout, a.color), result.layout, {
            placement: a,
            opacity: a.opacity,
            searchable,
          })
          break
        }
        case "note":
          addNote(doc, page, a, writer.frame)
          break
      }
    }
    writer.commit()
  }

  searchable.finish()
  return { bytes: await savePdf(doc), missing: [...missing] }
}

function addNote(doc: PDFDocument, page: PDFPage, note: NoteObject, frame: PageFrame) {
  // Note icon box in visual coordinates (y up), mapped to user space.
  const corners = [
    apply(frame.matrix, note.x, frame.height - note.y - NOTE_SIZE),
    apply(frame.matrix, note.x + NOTE_SIZE, frame.height - note.y),
  ]
  const rect = [
    Math.min(corners[0][0], corners[1][0]),
    Math.min(corners[0][1], corners[1][1]),
    Math.max(corners[0][0], corners[1][0]),
    Math.max(corners[0][1], corners[1][1]),
  ]
  const annot = doc.context.obj({
    Type: "Annot",
    Subtype: "Text",
    Rect: rect,
    // UTF-16 text string, so Thai and other scripts show correctly in comment panels.
    Contents: PDFHexString.fromText(note.text),
    Name: "Comment",
    C: hexToRgb(note.color),
    CA: note.opacity,
    M: PDFString.fromDate(new Date()),
    NM: PDFString.of(note.id),
    Open: false,
    // Print + NoZoom + NoRotate: the icon stays upright and the same size.
    F: 4 | 8 | 16,
  })
  page.node.addAnnot(doc.context.register(annot))
}

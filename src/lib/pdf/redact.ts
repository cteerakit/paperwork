import {
  PDFArray,
  PDFDict,
  PDFName,
  PDFNumber,
  rgb,
  type PDFPage,
} from "pdf-lib"
import type { WrappedPdfiumModule } from "@embedpdf/pdfium"
import { apply, pageFrame, type Matrix } from "./geometry"
import { loadPdf, type PdfBytes } from "./load"
import { RedactionError } from "./redactionError"
import { removeHiddenInformation, removeUnreferencedObjects } from "./sanitize"

export interface Redaction {
  page: number
  x: number
  y: number
  width: number
  height: number
}

function heap(pdfium: WrappedPdfiumModule) {
  if (
    !("HEAPU8" in pdfium.pdfium) ||
    !(pdfium.pdfium.HEAPU8 instanceof Uint8Array)
  ) {
    throw new Error("PDF engine memory is unavailable.")
  }
  return pdfium.pdfium.HEAPU8
}

function pdfRect(page: PDFPage, area: Redaction) {
  const frame = pageFrame(page)
  const unit =
    page.node.lookupMaybe(PDFName.of("UserUnit"), PDFNumber)?.asNumber() ?? 1
  const [x1, y1] = apply(
    frame.matrix,
    area.x / unit,
    frame.height - area.y / unit
  )
  const [x2, y2] = apply(
    frame.matrix,
    (area.x + area.width) / unit,
    frame.height - (area.y + area.height) / unit
  )
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  }
}

/** Text redaction preserves vector backgrounds; image pixels need a separate redaction engine. */
function rejectImageOverlaps(
  pdfium: WrappedPdfiumModule,
  page: number,
  regions: ReturnType<typeof pdfRect>[]
) {
  const memory = pdfium.pdfium.wasmExports
  const buffer = memory.malloc(24)
  if (!buffer) throw new Error("Could not inspect page content.")
  const intersects = (
    left: number,
    bottom: number,
    right: number,
    top: number
  ) =>
    regions.some(
      (region) =>
        left < region.x + region.width &&
        right > region.x &&
        bottom < region.y + region.height &&
        top > region.y
    )
  const number = (index: number) =>
    pdfium.pdfium.getValue(buffer + index * 4, "float")
  const visit = (container: number, parent: Matrix, isForm: boolean) => {
    const count = isForm
      ? pdfium.FPDFFormObj_CountObjects(container)
      : pdfium.FPDFPage_CountObjects(container)
    for (let index = 0; index < count; index++) {
      const object = isForm
        ? pdfium.FPDFFormObj_GetObject(container, index)
        : pdfium.FPDFPage_GetObject(container, index)
      const type = pdfium.FPDFPageObj_GetType(object)
      if (type === 1 || type === 2 || type === 4) continue
      if (type === 5) {
        if (!pdfium.FPDFPageObj_GetMatrix(object, buffer))
          throw new Error("Could not inspect PDF form.")
        const [a, b, c, d, e, f] = [
          number(0),
          number(1),
          number(2),
          number(3),
          number(4),
          number(5),
        ]
        const [p, q, r, s, x, y] = parent
        visit(
          object,
          [
            p * a + r * b,
            q * a + s * b,
            p * c + r * d,
            q * c + s * d,
            p * e + r * f + x,
            q * e + s * f + y,
          ],
          true
        )
      } else {
        if (
          !pdfium.FPDFPageObj_GetBounds(
            object,
            buffer,
            buffer + 4,
            buffer + 8,
            buffer + 12
          )
        ) {
          throw new Error("Could not inspect PDF object.")
        }
        const [left, bottom, right, top] = [
          number(0),
          number(1),
          number(2),
          number(3),
        ]
        const corners = [
          apply(parent, left, bottom),
          apply(parent, right, top),
          apply(parent, left, top),
          apply(parent, right, bottom),
        ]
        if (
          intersects(
            Math.min(...corners.map(([x]) => x)),
            Math.min(...corners.map(([, y]) => y)),
            Math.max(...corners.map(([x]) => x)),
            Math.max(...corners.map(([, y]) => y))
          )
        )
          throw new RedactionError()
      }
    }
  }
  try {
    visit(page, [1, 0, 0, 1, 0, 0], false)
  } finally {
    memory.free(buffer)
  }
}

/** Rewrites intersecting content with PDFium; all unaffected PDF objects remain native. */
export async function redactPdf(
  bytes: PdfBytes,
  areas: Redaction[],
  pdfium: WrappedPdfiumModule,
  onProgress?: (done: number) => void,
  { removeHiddenInfo = true }: { removeHiddenInfo?: boolean } = {}
) {
  if (!areas.length) throw new Error("Select an area to redact.")
  const source = await loadPdf(bytes)
  const pages = source.getPages()
  for (const area of areas) {
    const page = pages[area.page]
    if (
      !Number.isInteger(area.page) ||
      !page ||
      ![area.x, area.y, area.width, area.height].every(Number.isFinite) ||
      area.x < 0 ||
      area.y < 0 ||
      area.width <= 0 ||
      area.height <= 0
    ) {
      throw new Error("Invalid redaction area.")
    }
    const frame = pageFrame(page)
    const unit =
      page.node.lookupMaybe(PDFName.of("UserUnit"), PDFNumber)?.asNumber() ?? 1
    if (
      !Number.isFinite(unit) ||
      unit <= 0 ||
      area.x + area.width > frame.width * unit + 0.01 ||
      area.y + area.height > frame.height * unit + 0.01
    ) {
      throw new Error("Redaction area is outside the page.")
    }
  }
  for (const [index, page] of pages.entries()) {
    const regions = areas
      .filter((area) => area.page === index)
      .map((area) => pdfRect(page, area))
    if (!regions.length) continue
    const annots = page.node.Annots()
    if (!annots) continue
    for (
      let annotationIndex = annots.size() - 1;
      annotationIndex >= 0;
      annotationIndex--
    ) {
      const annotation = source.context.lookup(
        annots.get(annotationIndex),
        PDFDict
      )
      const rect = annotation.lookupMaybe(PDFName.of("Rect"), PDFArray)
      if (!rect || rect.size() !== 4) throw new RedactionError()
      const [x1, y1, x2, y2] = rect
        .asArray()
        .map((value) => source.context.lookup(value, PDFNumber).asNumber())
      if (
        regions.some(
          (region) =>
            Math.min(x1, x2) < region.x + region.width &&
            Math.max(x1, x2) > region.x &&
            Math.min(y1, y2) < region.y + region.height &&
            Math.max(y1, y2) > region.y
        )
      ) {
        if (annotation.get(PDFName.of("Subtype")) === PDFName.of("Link")) {
          // Link targets can contain the selected text, even though the link itself is invisible.
          annots.remove(annotationIndex)
        } else {
          throw new RedactionError()
        }
      }
    }
  }
  const changedPages = new Map<
    number,
    { firstAnnotation: number; count: number }
  >()
  for (const area of areas) {
    const page = pages[area.page]
    const rect = pdfRect(page, area)
    const annots = page.node.Annots() ?? source.context.obj([])
    const pending = changedPages.get(area.page) ?? {
      firstAnnotation: annots.size(),
      count: 0,
    }
    const annotation = source.context.obj({
      Type: "Annot",
      Subtype: "Redact",
      Rect: [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height],
      IC: [0, 0, 0],
      F: 4,
    })
    annots.push(source.context.register(annotation))
    page.node.set(PDFName.of("Annots"), annots)
    // Embedded previews and application edit data may contain a pre-redaction copy.
    page.node.delete(PDFName.of("Thumb"))
    page.node.delete(PDFName.of("PieceInfo"))
    changedPages.set(area.page, { ...pending, count: pending.count + 1 })
  }

  const prepared = await source.save({ updateFieldAppearances: false })
  const memory = pdfium.pdfium.wasmExports
  const inputPtr = memory.malloc(prepared.length)
  if (!inputPtr) throw new Error("Could not allocate PDF memory.")
  let document = 0
  try {
    heap(pdfium).set(prepared, inputPtr)
    document = pdfium.FPDF_LoadMemDocument(inputPtr, prepared.length, "")
    if (!document) throw new Error("Could not open PDF for redaction.")
    for (let index = 0; index < pages.length; index++) {
      const pending = changedPages.get(index)
      if (pending) {
        const page = pdfium.FPDF_LoadPage(document, index)
        if (!page) throw new Error("Could not open page for redaction.")
        try {
          rejectImageOverlaps(
            pdfium,
            page,
            areas
              .filter((area) => area.page === index)
              .map((area) => pdfRect(pages[index], area))
          )
          // Applying only our marks leaves pre-existing pending redactions untouched.
          for (let offset = pending.count - 1; offset >= 0; offset--) {
            const annotation = pdfium.FPDFPage_GetAnnot(
              page,
              pending.firstAnnotation + offset
            )
            if (!annotation) throw new Error("Could not find redaction mark.")
            try {
              if (!pdfium.EPDFAnnot_ApplyRedaction(page, annotation))
                throw new Error("Could not apply redaction.")
            } finally {
              pdfium.FPDFPage_CloseAnnot(annotation)
            }
          }
          if (!pdfium.FPDFPage_GenerateContent(page))
            throw new Error("Could not save redacted content.")
        } finally {
          pdfium.FPDF_ClosePage(page)
        }
      }
      onProgress?.(index + 1)
    }
    const writer = pdfium.PDFiumExt_OpenFileWriter()
    if (!writer) throw new Error("Could not create PDF writer.")
    let outputPtr = 0
    try {
      if (!pdfium.PDFiumExt_SaveAsCopy(document, writer))
        throw new Error("Could not save redacted PDF.")
      const length = pdfium.PDFiumExt_GetFileWriterSize(writer)
      if (length <= 0) throw new Error("Redacted PDF is empty.")
      outputPtr = memory.malloc(length)
      if (!outputPtr) throw new Error("Could not allocate PDF output memory.")
      pdfium.PDFiumExt_GetFileWriterData(writer, outputPtr, length)
      const result = await loadPdf(
        heap(pdfium).slice(outputPtr, outputPtr + length)
      )
      for (const area of areas) {
        const page = result.getPage(area.page)
        page.drawRectangle({ ...pdfRect(page, area), color: rgb(0, 0, 0) })
      }
      // Redacted words can also live in properties, bookmarks, tags and attachments.
      if (removeHiddenInfo) removeHiddenInformation(result)
      removeUnreferencedObjects(result)
      return await result.save({ updateFieldAppearances: false })
    } finally {
      if (outputPtr) memory.free(outputPtr)
      pdfium.PDFiumExt_CloseFileWriter(writer)
    }
  } finally {
    if (document) pdfium.FPDF_CloseDocument(document)
    memory.free(inputPtr)
  }
}

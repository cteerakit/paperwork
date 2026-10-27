import { PDFArray, PDFDocument, PDFName, PDFNumber, PDFRawStream, type PDFDict } from "pdf-lib"
import { dataUrlToBytes } from "./draw"
import { loadPdf, savePdf, type PdfBytes } from "./load"

/** "custom" is "medium" with your own image size and quality. */
export type CompressionLevel = "light" | "medium" | "strong" | "custom"

/** Re-encodes a JPEG, scaled to fit `maxSize` px. Returns null when it can't. */
export type JpegRecoder = (
  jpeg: Uint8Array,
  maxSize: number,
  quality: number
) => Promise<{ bytes: Uint8Array; width: number; height: number } | null>

/** Renders one page to a JPEG data URL plus the page's visual size in points. */
export type PageRasterizer = (pageIndex: number) => Promise<{ jpeg: string; width: number; height: number }>

export interface CompressDeps {
  recodeJpeg?: JpegRecoder
  rasterize?: PageRasterizer
  onProgress?: (done: number, total: number) => void
  /** Longest image side in px, for "medium" and "custom". */
  maxImageSize?: number
  /** JPEG quality from 0 to 1, for "medium" and "custom". */
  jpegQuality?: number
}

export const MEDIUM_MAX_IMAGE_SIZE = 1600
export const MEDIUM_JPEG_QUALITY = 0.7

export async function compressPdf(bytes: PdfBytes, level: CompressionLevel, deps: CompressDeps = {}) {
  if (level === "strong") return rasterizeAll(bytes, deps)

  const source = await loadPdf(bytes)
  // Copying pages into a fresh document leaves behind objects nothing refers to.
  const doc = await PDFDocument.create()
  const pages = await doc.copyPages(source, source.getPageIndices())
  for (const page of pages) {
    for (const key of ["Thumb", "PieceInfo", "Metadata"]) page.node.delete(PDFName.of(key))
    doc.addPage(page)
  }

  compressRawStreams(doc)
  if ((level === "medium" || level === "custom") && deps.recodeJpeg) await recodeImages(doc, deps)
  return savePdf(doc)
}

/** Flate-compresses streams that were stored without any compression. */
function compressRawStreams(doc: PDFDocument) {
  const { context } = doc
  for (const [ref, obj] of context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream) || obj.dict.has(PDFName.of("Filter")) || obj.contents.length < 64) continue
    const compressed = context.flateStream(obj.contents)
    for (const [key, value] of obj.dict.entries()) {
      if (key !== PDFName.Length) compressed.dict.set(key, value)
    }
    context.assign(ref, compressed)
  }
}

function isDctImage(dict: PDFDict) {
  if (dict.get(PDFName.of("Subtype")) !== PDFName.of("Image")) return false
  const filter = dict.lookup(PDFName.of("Filter"))
  const isDct =
    filter === PDFName.of("DCTDecode") ||
    (filter instanceof PDFArray && filter.size() === 1 && filter.get(0) === PDFName.of("DCTDecode"))
  const colorSpace = dict.get(PDFName.of("ColorSpace"))
  const simpleColor = colorSpace === PDFName.of("DeviceRGB") || colorSpace === PDFName.of("DeviceGray")
  return isDct && simpleColor && !dict.has(PDFName.of("Decode")) && !dict.has(PDFName.of("ImageMask"))
}

async function recodeImages(doc: PDFDocument, deps: CompressDeps) {
  const { context } = doc
  const images = context
    .enumerateIndirectObjects()
    .filter(([, obj]) => obj instanceof PDFRawStream && isDctImage(obj.dict)) as [
    Parameters<typeof context.assign>[0],
    PDFRawStream,
  ][]

  let done = 0
  for (const [ref, stream] of images) {
    const result = await deps.recodeJpeg!(
      stream.contents,
      deps.maxImageSize ?? MEDIUM_MAX_IMAGE_SIZE,
      deps.jpegQuality ?? MEDIUM_JPEG_QUALITY
    )
    deps.onProgress?.(++done, images.length)
    // Only swap when it's a real saving; re-encoding an already-small JPEG can make it bigger.
    if (!result || result.bytes.length > stream.contents.length * 0.9) continue

    const replacement = context.stream(result.bytes)
    for (const [key, value] of stream.dict.entries()) {
      if (key !== PDFName.Length && key !== PDFName.of("DecodeParms")) replacement.dict.set(key, value)
    }
    replacement.dict.set(PDFName.of("Width"), PDFNumber.of(result.width))
    replacement.dict.set(PDFName.of("Height"), PDFNumber.of(result.height))
    replacement.dict.set(PDFName.of("ColorSpace"), PDFName.of("DeviceRGB"))
    replacement.dict.set(PDFName.of("BitsPerComponent"), PDFNumber.of(8))
    replacement.dict.set(PDFName.of("Filter"), PDFName.of("DCTDecode"))
    context.assign(ref, replacement)
  }
}

/** Replaces every page with a JPEG picture of it. Biggest saving; text is no longer selectable. */
async function rasterizeAll(bytes: PdfBytes, deps: CompressDeps) {
  if (!deps.rasterize) throw new Error("Strong compression needs a page rasterizer.")
  const source = await loadPdf(bytes)
  const total = source.getPageCount()
  const doc = await PDFDocument.create()
  for (let i = 0; i < total; i++) {
    const { jpeg, width, height } = await deps.rasterize(i)
    const image = await doc.embedJpg(dataUrlToBytes(jpeg))
    doc.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height })
    deps.onProgress?.(i + 1, total)
  }
  return savePdf(doc)
}

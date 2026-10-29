import { PDFDocument, PageSizes } from "pdf-lib"
import { savePdf } from "./load"

export interface ImageSource {
  /** PNG or JPEG bytes, already upright. */
  bytes: Uint8Array
  /** Size in pixels. */
  width: number
  height: number
}

export type ImagePageSize = "fit" | "a4" | "letter"

export interface ImagesToPdfOptions {
  pageSize: ImagePageSize
  /** Space around each image, in points. */
  margin: number
}

const PAPER = { a4: PageSizes.A4, letter: PageSizes.Letter }
/** "Fit" pages treat the image as 96 dpi, the size browsers and most apps show it at. */
const POINTS_PER_PIXEL = 72 / 96

/**
 * One page per image, in order. Paper pages turn to match each image's orientation and the image
 * is scaled to fill the space inside the margins, centered.
 */
export async function imagesToPdf(images: ImageSource[], { pageSize, margin }: ImagesToPdfOptions) {
  const doc = await PDFDocument.create()
  for (const image of images) {
    const isPng = image.bytes[0] === 0x89 && image.bytes[1] === 0x50
    const embedded = isPng ? await doc.embedPng(image.bytes) : await doc.embedJpg(image.bytes)
    let width: number
    let height: number
    if (pageSize === "fit") {
      width = image.width * POINTS_PER_PIXEL + 2 * margin
      height = image.height * POINTS_PER_PIXEL + 2 * margin
    } else {
      const [short, long] = PAPER[pageSize]
      ;[width, height] = image.width > image.height ? [long, short] : [short, long]
    }
    const scale = Math.min((width - 2 * margin) / image.width, (height - 2 * margin) / image.height)
    const w = image.width * scale
    const h = image.height * scale
    doc.addPage([width, height]).drawImage(embedded, { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h })
  }
  return savePdf(doc)
}

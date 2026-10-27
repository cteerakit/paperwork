import type { Box } from "../annotate/model"
import { prepareLayout } from "../text/layout"
import { PageWriter } from "./content"
import { drawImage, embedImage } from "./draw"
import { loadPdf, savePdf, type PdfBytes } from "./load"
import { drawTextXObject, textXObject } from "./text"

export interface TextWatermarkOptions {
  text: string
  fontSize: number
  color: string
  opacity: number
  /** Counter-clockwise angle in degrees; 45 runs bottom-left to top-right. */
  angle: number
  layout: "center" | "tile"
  bold?: boolean
  pages: number[]
  lang?: string
}

/** Top-left placement that puts the centre of a w×h box, rotated clockwise by `rotation`, at (cx, cy). */
export function centeredPlacement(cx: number, cy: number, w: number, h: number, rotation: number) {
  const r = (rotation * Math.PI) / 180
  const dx = (w / 2) * Math.cos(r) - (h / 2) * Math.sin(r)
  const dy = (w / 2) * Math.sin(r) + (h / 2) * Math.cos(r)
  return { x: cx - dx, y: cy - dy, rotation }
}

/** Centres of tiled watermarks covering a W×H page, on a grid rotated with the text. */
export function tileCenters(W: number, H: number, w: number, h: number, rotation: number, fontSize: number) {
  const r = (rotation * Math.PI) / 180
  const [cos, sin] = [Math.cos(r), Math.sin(r)]
  const stepX = w + fontSize * 3
  const stepY = h + fontSize * 3
  const reach = Math.hypot(W, H)
  const centers: [number, number][] = []
  for (let j = -Math.ceil(reach / stepY); j <= Math.ceil(reach / stepY); j++) {
    for (let i = -Math.ceil(reach / stepX); i <= Math.ceil(reach / stepX); i++) {
      const u = i * stepX + (j % 2 ? stepX / 2 : 0)
      const v = j * stepY
      const cx = W / 2 + u * cos - v * sin
      const cy = H / 2 + u * sin + v * cos
      // Keep tiles whose centre is within reach of the page; the rest would be invisible.
      if (cx > -w / 2 && cx < W + w / 2 && cy > -w / 2 && cy < H + w / 2) centers.push([cx, cy])
    }
  }
  return centers
}

export async function addTextWatermark(bytes: PdfBytes, options: TextWatermarkOptions) {
  const doc = await loadPdf(bytes)
  const { layout, missing } = await prepareLayout(options.text, {
    fontSize: options.fontSize,
    weight: options.bold ? "bold" : "regular",
    lang: options.lang,
    align: "center",
  })
  // One XObject for the whole document: the outlines are stored once, however many pages.
  const ref = textXObject(doc, layout, options.color)
  const rotation = -options.angle

  for (const index of options.pages) {
    const writer = new PageWriter(doc, doc.getPage(index))
    const { width: W, height: H } = writer.frame
    const centers =
      options.layout === "tile"
        ? tileCenters(W, H, layout.width, layout.height, rotation, options.fontSize)
        : [[W / 2, H / 2] as [number, number]]
    for (const [cx, cy] of centers) {
      drawTextXObject(writer, ref, layout, {
        placement: centeredPlacement(cx, cy, layout.width, layout.height, rotation),
        opacity: options.opacity,
      })
    }
    writer.commit()
  }

  return { bytes: await savePdf(doc), missing }
}

export interface ImageStampOptions {
  /** PNG/JPEG bytes or a data: URL. */
  image: Uint8Array | string
  /** Position on the reference page, in visual points. */
  box: Box
  /** Size of the page the box was placed on; other page sizes scale proportionally. */
  reference: { width: number; height: number }
  opacity: number
  pages: number[]
}

export async function addImageStamp(bytes: PdfBytes, options: ImageStampOptions) {
  const doc = await loadPdf(bytes)
  const ref = await embedImage(doc, options.image)
  const { box, reference } = options

  for (const index of options.pages) {
    const writer = new PageWriter(doc, doc.getPage(index))
    const sx = writer.frame.width / reference.width
    const sy = writer.frame.height / reference.height
    const s = Math.min(sx, sy)
    drawImage(
      writer,
      ref,
      { x: box.x * sx, y: box.y * sy, width: box.width * s, height: box.height * s, rotation: box.rotation },
      options.opacity
    )
    writer.commit()
  }
  return savePdf(doc)
}

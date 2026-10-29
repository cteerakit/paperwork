import { createCanvas } from "@napi-rs/canvas"
import { PDFDocument } from "pdf-lib"
import { describe, expect, it } from "vitest"
import { jpegOrientation } from "@/lib/images"
import { imagesToPdf } from "@/lib/pdf/images"

function image(width: number, height: number, type: "png" | "jpg") {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext("2d")
  ctx.fillStyle = "#3080c0"
  ctx.fillRect(0, 0, width, height)
  const bytes = type === "png" ? canvas.toBuffer("image/png") : canvas.toBuffer("image/jpeg", 90)
  return { bytes: new Uint8Array(bytes), width, height }
}

const pageSizes = async (bytes: Uint8Array) =>
  (await PDFDocument.load(bytes)).getPages().map((page) => {
    const { width, height } = page.getSize()
    return [Math.round(width), Math.round(height)]
  })

/** A JPEG start plus an APP1 EXIF segment holding only an orientation tag. */
function exifJpeg(orientation: number, little: boolean) {
  const tiff = new DataView(new ArrayBuffer(26))
  tiff.setUint16(0, little ? 0x4949 : 0x4d4d)
  tiff.setUint16(2, 42, little)
  tiff.setUint32(4, 8, little)
  tiff.setUint16(8, 1, little)
  tiff.setUint16(10, 0x0112, little)
  tiff.setUint16(12, 3, little)
  tiff.setUint32(14, 1, little)
  tiff.setUint16(18, orientation, little)
  const app1 = [0xff, 0xe1, 0, 2 + 6 + 26, 0x45, 0x78, 0x69, 0x66, 0, 0]
  return new Uint8Array([0xff, 0xd8, ...app1, ...new Uint8Array(tiff.buffer), 0xff, 0xda, 0, 2])
}

describe("images to PDF", () => {
  it("makes one page per image, in order, turning paper to match each image", async () => {
    const out = await imagesToPdf([image(400, 300, "jpg"), image(300, 400, "png")], { pageSize: "a4", margin: 18 })
    expect(await pageSizes(out)).toEqual([
      [842, 595],
      [595, 842],
    ])
    const letter = await imagesToPdf([image(300, 400, "jpg")], { pageSize: "letter", margin: 0 })
    expect(await pageSizes(letter)).toEqual([[612, 792]])
  })

  it("sizes pages to the image at 96 dpi, plus the margin", async () => {
    const out = await imagesToPdf([image(960, 480, "png")], { pageSize: "fit", margin: 10 })
    expect(await pageSizes(out)).toEqual([[740, 380]])
  })

  it("keeps JPEG bytes as they are", async () => {
    const jpg = image(200, 100, "jpg")
    const out = await imagesToPdf([jpg], { pageSize: "fit", margin: 0 })
    expect(Buffer.from(out).includes(Buffer.from(jpg.bytes))).toBe(true)
  })
})

describe("JPEG orientation", () => {
  it("reads the EXIF orientation in either byte order", () => {
    expect(jpegOrientation(exifJpeg(6, false))).toBe(6)
    expect(jpegOrientation(exifJpeg(8, true))).toBe(8)
  })

  it("defaults to upright without EXIF data or for other files", () => {
    expect(jpegOrientation(image(10, 10, "jpg").bytes)).toBe(1)
    expect(jpegOrientation(image(10, 10, "png").bytes)).toBe(1)
    expect(jpegOrientation(new Uint8Array())).toBe(1)
  })
})

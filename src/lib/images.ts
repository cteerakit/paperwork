/** Reads an image file as a PNG or JPEG data URL (the formats PDFs can embed) plus its size. */
export async function readImageFile(file: File): Promise<{ src: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = bitmap
  let src: string
  if (file.type === "image/png" || file.type === "image/jpeg") {
    src = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
  } else {
    // WebP, GIF, BMP, … are converted to PNG, keeping transparency.
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0)
    src = canvas.toDataURL("image/png")
  }
  bitmap.close()
  return { src, width, height }
}

/** Fits a w×h image inside maxW×maxH, keeping its aspect ratio. */
export function fitSize(w: number, h: number, maxW: number, maxH: number) {
  const s = Math.min(maxW / w, maxH / h, 1)
  return { width: w * s, height: h * s }
}

/** Whether a file looks like an image the browser may be able to read. */
export const isImageFile = (file: File) =>
  file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|avif|heic|heif)$/i.test(file.name)

/**
 * Turns an image file into upright PNG or JPEG bytes a PDF can embed, plus its size in pixels.
 * PNGs and JPEGs are kept as they are, unless a JPEG is stored sideways; other formats are
 * converted, to JPEG when fully opaque and to PNG when they have transparency.
 */
export async function readImageForPdf(file: File): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  // Browsers apply the EXIF orientation when decoding, so this is the upright size.
  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: file.type }))
  const { width, height } = bitmap
  try {
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8
    if (isPng || (isJpeg && jpegOrientation(bytes) === 1)) return { bytes, width, height }
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext("2d")!
    ctx.drawImage(bitmap, 0, 0)
    const opaque = isJpeg || isOpaque(ctx.getImageData(0, 0, width, height).data)
    const blob = await canvas.convertToBlob(opaque ? { type: "image/jpeg", quality: 0.92 } : { type: "image/png" })
    return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height }
  } finally {
    bitmap.close()
  }
}

function isOpaque(pixels: Uint8ClampedArray) {
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] < 255) return false
  return true
}

/**
 * The EXIF orientation (1–8) stored in a JPEG, or 1 if there is none. PDFs ignore it, so a photo
 * taken sideways needs turning before it is embedded.
 */
export function jpegOrientation(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return 1
  let offset = 2
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset)
    const length = view.getUint16(offset + 2)
    // Image data starts at SOS; EXIF always comes before it.
    if (marker === 0xffda || (marker & 0xff00) !== 0xff00) return 1
    // APP1 holding "Exif\0\0" and then a TIFF header.
    if (marker === 0xffe1 && offset + 10 <= view.byteLength && view.getUint32(offset + 4) === 0x45786966) {
      const tiff = offset + 10
      if (tiff + 8 > view.byteLength) return 1
      const little = view.getUint16(tiff) === 0x4949
      const ifd = tiff + view.getUint32(tiff + 4, little)
      if (ifd + 2 > view.byteLength) return 1
      const count = view.getUint16(ifd, little)
      for (let i = 0; i < count; i++) {
        const entry = ifd + 2 + i * 12
        if (entry + 12 > view.byteLength) return 1
        if (view.getUint16(entry, little) === 0x0112) {
          const value = view.getUint16(entry + 8, little)
          return value >= 1 && value <= 8 ? value : 1
        }
      }
      return 1
    }
    offset += 2 + length
  }
  return 1
}

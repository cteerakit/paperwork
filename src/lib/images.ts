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

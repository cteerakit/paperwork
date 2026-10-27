/** Browser JPEG re-encoding for compression. Works on the main thread and in workers. */

/** Re-encodes a JPEG in the browser, scaled down to fit `maxSize` pixels. */
export async function recodeJpeg(jpeg: Uint8Array, maxSize: number, quality: number) {
  try {
    const bitmap = await createImageBitmap(new Blob([jpeg as BlobPart], { type: "image/jpeg" }))
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = new OffscreenCanvas(width, height)
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality })
    return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height }
  } catch {
    return null
  }
}

import { zipSync } from "fflate"

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Give the browser a moment to start the download before freeing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), filename)
}

export function downloadZip(files: { name: string; bytes: Uint8Array }[], filename: string) {
  // PDFs are already compressed, so store them in the zip as-is (level 0) for speed.
  const zipped = zipSync(Object.fromEntries(files.map((f) => [f.name, [f.bytes, { level: 0 }]])))
  downloadBlob(new Blob([zipped as BlobPart], { type: "application/zip" }), filename)
}

/** "report.pdf" + "rotated" → "report-rotated.pdf" */
export function outputName(original: string, suffix: string, ext = "pdf") {
  const base = original.replace(/\.pdf$/i, "") || "document"
  return `${base}-${suffix}.${ext}`
}

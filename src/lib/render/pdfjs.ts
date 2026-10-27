/** pdf.js setup and page rendering for thumbnails, previews and the editor. */
import type { PDFDocumentProxy } from "pdfjs-dist"
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"
import { PdfError } from "../pdf/load"

const assets = `${import.meta.env.BASE_URL}pdfjs/`

export type PdfDoc = PDFDocumentProxy

export interface PageSize {
  /** Visual size in points, after the page's rotation. */
  width: number
  height: number
}

export interface LoadedPdf {
  id: string
  name: string
  bytes: Uint8Array
  doc: PdfDoc
  pageCount: number
  pageSizes: PageSize[]
}

/** Opens a PDF for display. Throws {@link PdfError} for password-protected or broken files. */
export async function openPdf(file: File): Promise<LoadedPdf> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let doc: PdfDoc
  try {
    const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist")
    GlobalWorkerOptions.workerSrc = workerUrl
    doc = await getDocument({
      // pdf.js takes ownership of (detaches) the buffer it's given, so pass a copy.
      data: bytes.slice(),
      cMapUrl: `${assets}cmaps/`,
      standardFontDataUrl: `${assets}standard_fonts/`,
      iccUrl: `${assets}iccs/`,
      wasmUrl: `${assets}wasm/`,
    }).promise
  } catch (error) {
    if (error instanceof Error && error.name === "PasswordException") throw new PdfError("encrypted", error)
    throw new PdfError("invalid", error)
  }

  const pageSizes: PageSize[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const viewport = (await doc.getPage(i)).getViewport({ scale: 1 })
    pageSizes.push({ width: viewport.width, height: viewport.height })
  }
  return { id: crypto.randomUUID(), name: file.name, bytes, doc, pageCount: doc.numPages, pageSizes }
}

/** Releases a document's worker resources. */
export function closePdf(pdf: LoadedPdf | undefined) {
  void pdf?.doc.loadingTask.destroy()
}

/**
 * Renders a page (0-based) onto a new canvas. `scale` is canvas pixels per
 * point; device pixel ratio should already be included by the caller.
 */
export async function renderPage(doc: PdfDoc, pageIndex: number, scale: number, signal?: AbortSignal) {
  const page = await doc.getPage(pageIndex + 1)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))
  const task = page.render({ canvas, viewport, background: "#ffffff" })
  signal?.addEventListener("abort", () => task.cancel())
  await task.promise
  return canvas
}

/** Most pixels one exported image may have; bigger pages are scaled down to fit a browser canvas. */
const MAX_EXPORT_PIXELS = 64_000_000

/** The pixel size an exported page will have at `dpi`, after any scaling down. */
export function exportSize(size: PageSize, dpi: number) {
  const scale = Math.min(dpi / 72, Math.sqrt(MAX_EXPORT_PIXELS / (size.width * size.height)))
  return { scale, width: Math.max(1, Math.floor(size.width * scale)), height: Math.max(1, Math.floor(size.height * scale)) }
}

/** Renders a page (0-based) to a PNG or JPEG file at the given resolution. */
export async function renderPageToBlob(
  doc: PdfDoc,
  pageIndex: number,
  dpi: number,
  type: "image/png" | "image/jpeg",
  quality: number
) {
  const size = (await doc.getPage(pageIndex + 1)).getViewport({ scale: 1 })
  const canvas = await renderPage(doc, pageIndex, exportSize(size, dpi).scale)
  try {
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not create the image."))), type, quality)
    )
  } finally {
    canvas.width = canvas.height = 0
  }
}

/** Renders a page to a JPEG data URL, for strong compression. */
export async function renderPageToJpeg(doc: PdfDoc, pageIndex: number, dpi: number, quality: number) {
  const canvas = await renderPage(doc, pageIndex, dpi / 72)
  const size = (await doc.getPage(pageIndex + 1)).getViewport({ scale: 1 })
  const jpeg = canvas.toDataURL("image/jpeg", quality)
  canvas.width = canvas.height = 0
  return { jpeg, width: size.width, height: size.height }
}

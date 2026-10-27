import type { CompressionLevel, PageRasterizer } from "./compress"
import type { CompressRequest, CompressResponse } from "./compress.worker"
import { PdfError } from "./load"

export interface CompressOptions {
  /** Longest image side in px, for the "medium" and "custom" levels. */
  maxImageSize?: number
  /** JPEG quality from 0 to 1, for the "medium" and "custom" levels. */
  jpegQuality?: number
}

/**
 * Compresses in a worker so large files don't freeze the page. A fresh worker per run releases its
 * memory afterwards. Strong compression draws pages with pdf.js, which needs the page's own
 * thread, so the worker asks `rasterize` for each page and assembles the result.
 */
export async function compressInWorker(
  bytes: Uint8Array,
  level: CompressionLevel,
  options: CompressOptions,
  hooks: { rasterize: PageRasterizer; onProgress: (done: number, total: number) => void }
) {
  const worker = new Worker(new URL("./compress.worker.ts", import.meta.url), { type: "module" })
  const send = (request: CompressRequest) => worker.postMessage(request)
  try {
    return await new Promise<Uint8Array>((resolve, reject) => {
      worker.onmessage = ({ data }: MessageEvent<CompressResponse>) => {
        switch (data.kind) {
          case "progress":
            hooks.onProgress(data.done, data.total)
            break
          case "raster":
            hooks.rasterize(data.index).then(
              (page) => send({ kind: "page", index: data.index, ...page }),
              (error) =>
                send({ kind: "pageError", index: data.index, message: error instanceof Error ? error.message : "" })
            )
            break
          case "complete":
            resolve(data.bytes)
            break
          case "error":
            reject(data.code ? new PdfError(data.code) : new Error(data.message))
            break
        }
      }
      worker.onerror = () => reject(new Error("Could not run the compression engine."))
      worker.onmessageerror = () => reject(new Error("Could not read the compressed PDF."))
      // Send a copy: the caller keeps using these bytes for the before/after comparison.
      send({ kind: "start", bytes: bytes.slice(), level, ...options })
    })
  } finally {
    worker.terminate()
  }
}

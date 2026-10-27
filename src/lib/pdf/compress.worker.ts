import { compressPdf, type CompressionLevel } from "./compress"
import { recodeJpeg } from "./jpeg"
import { PdfError, type PdfErrorCode } from "./load"

export type CompressRequest =
  | {
      kind: "start"
      bytes: Uint8Array
      level: CompressionLevel
      maxImageSize?: number
      jpegQuality?: number
    }
  /** The reply to a "raster" request: one page as a JPEG data URL, plus its size in points. */
  | { kind: "page"; index: number; jpeg: string; width: number; height: number }
  | { kind: "pageError"; index: number; message: string }

export type CompressResponse =
  | { kind: "progress"; done: number; total: number }
  /** Strong compression needs pdf.js, which draws on the main thread, so it renders pages on request. */
  | { kind: "raster"; index: number }
  | { kind: "complete"; bytes: Uint8Array }
  | { kind: "error"; message: string; code?: PdfErrorCode }

const post = (message: CompressResponse) => self.postMessage(message)

type PageReply = Extract<CompressRequest, { kind: "page" | "pageError" }>
const waiting = new Map<number, { resolve: (page: Extract<PageReply, { kind: "page" }>) => void; reject: (error: Error) => void }>()

const rasterize = (index: number) =>
  new Promise<Extract<PageReply, { kind: "page" }>>((resolve, reject) => {
    waiting.set(index, { resolve, reject })
    post({ kind: "raster", index })
  })

self.onmessage = async ({ data }: MessageEvent<CompressRequest>) => {
  if (data.kind === "page" || data.kind === "pageError") {
    const request = waiting.get(data.index)
    waiting.delete(data.index)
    if (data.kind === "page") request?.resolve(data)
    else request?.reject(new Error(data.message))
    return
  }
  try {
    const bytes = await compressPdf(data.bytes, data.level, {
      recodeJpeg,
      rasterize,
      maxImageSize: data.maxImageSize,
      jpegQuality: data.jpegQuality,
      onProgress: (done, total) => post({ kind: "progress", done, total }),
    })
    post({ kind: "complete", bytes })
  } catch (error) {
    post({
      kind: "error",
      message: error instanceof Error ? error.message : "Compression failed.",
      code: error instanceof PdfError ? error.code : undefined,
    })
  }
}

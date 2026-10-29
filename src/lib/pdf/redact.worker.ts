import { init } from "@embedpdf/pdfium"
import wasmUrl from "@embedpdf/pdfium/pdfium.wasm?url"
import { redactPdf, type Redaction } from "./redact"
import { RedactionError } from "./redactionError"

export type RedactRequest = {
  bytes: Uint8Array
  areas: Redaction[]
  removeHiddenInfo: boolean
}
export type RedactResponse =
  | { kind: "progress"; done: number }
  | { kind: "complete"; bytes: Uint8Array }
  | { kind: "error"; message: string; textOnly: boolean }

self.onmessage = async ({ data }: MessageEvent<RedactRequest>) => {
  try {
    const response = await fetch(wasmUrl)
    if (!response.ok) throw new Error("Could not load PDF redaction engine.")
    const pdfium = await init({ wasmBinary: await response.arrayBuffer() })
    pdfium.PDFiumExt_Init()
    try {
      const bytes = await redactPdf(
        data.bytes,
        data.areas,
        pdfium,
        (done) => {
          self.postMessage({ kind: "progress", done } satisfies RedactResponse)
        },
        { removeHiddenInfo: data.removeHiddenInfo }
      )
      self.postMessage({ kind: "complete", bytes } satisfies RedactResponse)
    } finally {
      pdfium.FPDF_DestroyLibrary()
    }
  } catch (error) {
    self.postMessage({
      kind: "error",
      textOnly: error instanceof RedactionError,
      message: error instanceof Error ? error.message : "Redaction failed.",
    } satisfies RedactResponse)
  }
}

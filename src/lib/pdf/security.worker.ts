import { init } from "@embedpdf/pdfium"
import wasmUrl from "@embedpdf/pdfium/pdfium.wasm?url"
import {
  cleanPdf,
  securePdf,
  inspectPdfProtection,
  SecurityError,
  type SecurityErrorCode,
  type SecurityOptions,
} from "./security"

export type SecurityRequest =
  | { kind: "inspect"; bytes: Uint8Array }
  | { kind: "export"; bytes: Uint8Array; options: SecurityOptions }
  | { kind: "clean"; bytes: Uint8Array; currentPassword: string }
export type SecurityResponse =
  | { kind: "inspected"; protection: "protected" | "unprotected" }
  | { kind: "complete"; bytes: Uint8Array }
  | { kind: "error"; code: SecurityErrorCode }

self.onmessage = async ({ data }: MessageEvent<SecurityRequest>) => {
  try {
    const response = await fetch(wasmUrl)
    if (!response.ok) throw new SecurityError("failed")
    const engine = await init({ wasmBinary: await response.arrayBuffer() })
    engine.PDFiumExt_Init()
    try {
      if (data.kind === "inspect") {
        const protection = inspectPdfProtection(data.bytes, engine)
        self.postMessage({
          kind: "inspected",
          protection,
        } satisfies SecurityResponse)
      } else {
        const bytes =
          data.kind === "clean"
            ? await cleanPdf(data.bytes, data.currentPassword, engine)
            : securePdf(data.bytes, data.options, engine)
        self.postMessage({ kind: "complete", bytes } satisfies SecurityResponse)
      }
    } finally {
      engine.FPDF_DestroyLibrary()
    }
  } catch (error) {
    self.postMessage({
      kind: "error",
      code: error instanceof SecurityError ? error.code : "failed",
    } satisfies SecurityResponse)
  }
}

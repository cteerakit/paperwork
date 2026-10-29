import type { Redaction } from "./redact"
import type { RedactRequest, RedactResponse } from "./redact.worker"
import { RedactionError } from "./redactionError"

/** A fresh worker per export keeps PDF processing off the UI and releases WASM memory afterward. */
export async function exportRedactedPdf(
  bytes: Uint8Array,
  areas: Redaction[],
  onProgress: (done: number) => void,
  removeHiddenInfo = true
) {
  const worker = new Worker(new URL("./redact.worker.ts", import.meta.url), {
    type: "module",
  })
  try {
    return await new Promise<Uint8Array>((resolve, reject) => {
      worker.onmessage = ({ data }: MessageEvent<RedactResponse>) => {
        switch (data.kind) {
          case "progress":
            onProgress(data.done)
            break
          case "complete":
            resolve(data.bytes)
            break
          case "error":
            reject(
              data.textOnly ? new RedactionError() : new Error(data.message)
            )
            break
        }
      }
      worker.onerror = () =>
        reject(new Error("Could not run PDF redaction engine."))
      worker.onmessageerror = () =>
        reject(new Error("Could not read redacted PDF."))
      worker.postMessage({
        bytes,
        areas,
        removeHiddenInfo,
      } satisfies RedactRequest)
    })
  } finally {
    worker.terminate()
  }
}

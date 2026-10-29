import { SecurityError, type SecurityOptions } from "./security"
import type { SecurityRequest, SecurityResponse } from "./security.worker"

async function requestSecurity(request: SecurityRequest) {
  const worker = new Worker(new URL("./security.worker.ts", import.meta.url), {
    type: "module",
  })
  try {
    return await new Promise<Exclude<SecurityResponse, { kind: "error" }>>(
      (resolve, reject) => {
        worker.onmessage = ({ data }: MessageEvent<SecurityResponse>) => {
          if (data.kind === "error") reject(new SecurityError(data.code))
          else resolve(data)
        }
        worker.onerror = () => reject(new SecurityError("failed"))
        worker.onmessageerror = () => reject(new SecurityError("failed"))
        worker.postMessage(request)
      }
    )
  } finally {
    worker.terminate()
  }
}

export async function detectPdfProtection(bytes: Uint8Array) {
  const response = await requestSecurity({ kind: "inspect", bytes })
  if (response.kind !== "inspected") throw new SecurityError("failed")
  return response.protection
}

export async function exportSecurePdf(
  bytes: Uint8Array,
  options: SecurityOptions
) {
  const response = await requestSecurity({ kind: "export", bytes, options })
  if (response.kind !== "complete") throw new SecurityError("failed")
  return response.bytes
}

export async function exportCleanPdf(
  bytes: Uint8Array,
  currentPassword: string
) {
  const response = await requestSecurity({
    kind: "clean",
    bytes,
    currentPassword,
  })
  if (response.kind !== "complete") throw new SecurityError("failed")
  return response.bytes
}

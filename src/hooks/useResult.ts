import { useCallback, useState } from "react"
import { downloadPdf } from "@/lib/download"

export interface ToolResult {
  name: string
  bytes: Uint8Array
}

/**
 * Holds the latest output of a tool so it can be offered to other tools.
 * `deliver` also starts the download, matching how saving always behaved.
 */
export function useResult() {
  const [result, setResult] = useState<ToolResult>()
  const deliver = useCallback((bytes: Uint8Array, name: string, download = true) => {
    if (download) downloadPdf(bytes, name)
    setResult({ bytes, name })
  }, [])
  const clear = useCallback(() => setResult(undefined), [])
  return { result, deliver, clear }
}

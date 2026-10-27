import { useEffect } from "react"
import { useNavigate } from "react-router"
import { setHandoff, type HandoffFile } from "@/lib/handoff"

/** The File Handling API: PDFs the operating system opened with the installed app. */
interface LaunchParams {
  files: { getFile(): Promise<File> }[]
}
declare global {
  interface Window {
    launchQueue?: { setConsumer(consumer: (params: LaunchParams) => void): void }
  }
}

/**
 * Listens for PDFs opened with the installed app ("Open with Paperwork") and sends them to the page
 * that asks what to do with them. It lives at the top of the app because a window that is already
 * open receives them without being navigated.
 */
export function LaunchHandler() {
  const navigate = useNavigate()
  useEffect(() => {
    window.launchQueue?.setConsumer(async ({ files }) => {
      const received: HandoffFile[] = []
      for (const handle of files) {
        try {
          const file = await handle.getFile()
          received.push({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })
        } catch {
          // A file that can't be read is skipped.
        }
      }
      if (!received.length) return
      setHandoff(received)
      void navigate("/open")
    })
  }, [navigate])
  return null
}

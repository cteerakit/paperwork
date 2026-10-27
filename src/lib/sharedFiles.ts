/**
 * PDFs shared to the installed app arrive in a POST request that the service worker answers
 * (public/share-target-sw.js). It parks the files in a cache just long enough for the page to read
 * them; this module reads them back and deletes them straight away.
 */
import type { HandoffFile } from "./handoff"

/** Must match SHARED_CACHE in public/share-target-sw.js. */
export const SHARED_CACHE = "paperwork-shared-files"

export async function discardSharedFiles() {
  try {
    await caches.delete(SHARED_CACHE)
  } catch {
    // No Cache API (or no permission): nothing was parked.
  }
}

/** Reads and deletes the files the service worker received. */
export async function takeSharedFiles(): Promise<HandoffFile[]> {
  try {
    const cache = await caches.open(SHARED_CACHE)
    const files: HandoffFile[] = []
    for (const request of await cache.keys()) {
      const response = await cache.match(request)
      if (!response) continue
      files.push({
        name: decodeURIComponent(response.headers.get("x-file-name") ?? "") || "document.pdf",
        bytes: new Uint8Array(await response.arrayBuffer()),
      })
    }
    return files
  } catch {
    return []
  } finally {
    await discardSharedFiles()
  }
}

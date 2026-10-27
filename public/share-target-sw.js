// Receives PDFs shared to the installed app (Web Share Target). Loaded into the generated service
// worker with importScripts, so it runs before any caching routes.
//
// The browser sends shared files as a multipart POST to /open. A page can't read that, so this
// parks the PDFs in a cache and redirects to /open?shared=1, where the page reads and deletes them
// (see src/lib/sharedFiles.ts). They are never kept: the page also clears this cache on startup.

const SHARED_CACHE = "paperwork-shared-files"

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "POST" || new URL(request.url).pathname !== "/open") return
  event.respondWith(receiveSharedFiles(request))
})

async function receiveSharedFiles(request) {
  try {
    const form = await request.formData()
    await caches.delete(SHARED_CACHE)
    const cache = await caches.open(SHARED_CACHE)
    let count = 0
    for (const value of form.getAll("pdf")) {
      if (typeof value === "string") continue
      await cache.put(
        `/shared-files/${count++}`,
        new Response(value, {
          headers: {
            "content-type": "application/pdf",
            "x-file-name": encodeURIComponent(value.name),
          },
        })
      )
    }
  } catch {
    // Fall through: the page shows its normal "no file received" state.
  }
  return Response.redirect(new URL("/open?shared=1", request.url).href, 303)
}

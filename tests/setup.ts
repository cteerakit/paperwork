import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { setFontLoader } from "@/lib/text/fonts"

// Read fonts from public/fonts instead of fetching them over HTTP.
setFontLoader(async (file) => {
  const bytes = await readFile(resolve(import.meta.dirname, "../public/fonts", file))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
})

// Copies the data files pdf.js loads at runtime (CMaps for CJK PDFs, standard
// fonts, colour profiles and WASM image decoders) into public/pdfjs/, so they
// are served from this app and never fetched from a CDN.

import { cp } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const source = join(root, "node_modules", "pdfjs-dist")
const target = join(root, "public", "pdfjs")

for (const dir of ["cmaps", "standard_fonts", "iccs", "wasm"]) {
  await cp(join(source, dir), join(target, dir), { recursive: true })
}
console.log("Copied pdf.js assets to public/pdfjs.")

// Downloads the fonts used to draw text into PDFs into public/fonts/.
// URLs are pinned to specific commits so builds are reproducible.
// All fonts are licensed under the SIL Open Font License (see public/fonts/OFL.txt).
//
// Usage: node scripts/fetch-fonts.mjs [--force]

import { mkdir, stat, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const NOTO = "https://raw.githubusercontent.com/notofonts/notofonts.github.io/781896b8653bf9e09129c103643a3cc5e31a2cb7/fonts"
const NOTO_CJK = "https://raw.githubusercontent.com/notofonts/noto-cjk/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/SubsetOTF"
const GOOGLE = "https://raw.githubusercontent.com/google/fonts/a4c0b21f839d7ac65a7d8b49eb81bddd110774a3/ofl"

const NOTO_FAMILIES = [
  "NotoSans",
  "NotoSansThai",
  "NotoSansLao",
  "NotoSansKhmer",
  "NotoSansArabic",
  "NotoSansHebrew",
  "NotoSansDevanagari",
  "NotoSansBengali",
  "NotoSansTamil",
  // Alternative styles offered for watermark text.
  "NotoSerif",
  "NotoSerifThai",
  "NotoSansMono",
]
const CJK_REGIONS = ["SC", "TC", "JP", "KR"]
const WEIGHTS = ["Regular", "Bold"]

const files = [
  ...NOTO_FAMILIES.flatMap((family) =>
    WEIGHTS.map((w) => ({
      name: `${family}-${w}.ttf`,
      url: `${NOTO}/${family}/hinted/ttf/${family}-${w}.ttf`,
    }))
  ),
  ...CJK_REGIONS.flatMap((region) =>
    WEIGHTS.map((w) => ({
      name: `NotoSans${region}-${w}.otf`,
      url: `${NOTO_CJK}/${region}/NotoSans${region}-${w}.otf`,
    }))
  ),
  // Handwriting-style font with Thai and Latin, used for typed signatures.
  ...WEIGHTS.map((w) => ({ name: `Charm-${w}.ttf`, url: `${GOOGLE}/charm/Charm-${w}.ttf` })),
  { name: "OFL.txt", url: `${GOOGLE}/notosans/OFL.txt` },
  { name: "OFL-Charm.txt", url: `${GOOGLE}/charm/OFL.txt` },
]

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "fonts")
const force = process.argv.includes("--force")

async function exists(path) {
  try {
    return (await stat(path)).size > 0
  } catch {
    return false
  }
}

await mkdir(outDir, { recursive: true })

let downloaded = 0
for (const { name, url } of files) {
  const target = join(outDir, name)
  if (!force && (await exists(target))) continue

  const response = await fetch(url)
  if (!response.ok) {
    console.error(`Failed to download ${name}: HTTP ${response.status} (${url})`)
    process.exitCode = 1
    continue
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  await writeFile(target, bytes)
  downloaded++
  console.log(`${name}  ${(bytes.length / 1024).toFixed(0)} KB`)
}

console.log(downloaded ? `Downloaded ${downloaded} file(s) to public/fonts.` : "All fonts already present.")

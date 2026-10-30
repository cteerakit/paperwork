/**
 * Font registry for text drawn into PDFs.
 *
 * Fonts are self-hosted in public/fonts (see scripts/fetch-fonts.mjs) and
 * loaded lazily: a font is only fetched the first time text needs it.
 */
import type * as HB from "harfbuzzjs"

export type FontId =
  | "latin"
  | "thai"
  | "lao"
  | "khmer"
  | "arabic"
  | "hebrew"
  | "devanagari"
  | "bengali"
  | "tamil"
  | "sc"
  | "tc"
  | "jp"
  | "kr"
  | "charm"
  | "serif"
  | "serifThai"
  | "mono"

export type Weight = "regular" | "bold"

/**
 * "sans" is the default Noto stack. The others put a styled font first for the
 * scripts it covers and fall back to the sans stack for everything else.
 * "signature" is a handwriting font.
 */
export type FontFamily = "sans" | "serif" | "mono" | "signature"

interface FontDef {
  file: Record<Weight, string>
  /** CJK fonts are several MB, so the UI shows a download message for them. */
  large?: boolean
}

const noto = (name: string, ext = "ttf"): Record<Weight, string> => ({
  regular: `${name}-Regular.${ext}`,
  bold: `${name}-Bold.${ext}`,
})

export const FONT_DEFS: Record<FontId, FontDef> = {
  latin: { file: noto("NotoSans") },
  thai: { file: noto("NotoSansThai") },
  lao: { file: noto("NotoSansLao") },
  khmer: { file: noto("NotoSansKhmer") },
  arabic: { file: noto("NotoSansArabic") },
  hebrew: { file: noto("NotoSansHebrew") },
  devanagari: { file: noto("NotoSansDevanagari") },
  bengali: { file: noto("NotoSansBengali") },
  tamil: { file: noto("NotoSansTamil") },
  sc: { file: noto("NotoSansSC", "otf"), large: true },
  tc: { file: noto("NotoSansTC", "otf"), large: true },
  jp: { file: noto("NotoSansJP", "otf"), large: true },
  kr: { file: noto("NotoSansKR", "otf"), large: true },
  charm: { file: { regular: "Charm-Regular.ttf", bold: "Charm-Bold.ttf" } },
  serif: { file: noto("NotoSerif") },
  serifThai: { file: noto("NotoSerifThai") },
  mono: { file: noto("NotoSansMono") },
}

export interface LoadedFont {
  id: FontId
  weight: Weight
  hb: HB.Font
  upem: number
  ascender: number
  descender: number
  hasGlyph(codePoint: number): boolean
}

type FontLoader = (file: string) => Promise<ArrayBuffer>

let loader: FontLoader = async (file) => {
  const response = await fetch(`${import.meta.env.BASE_URL}fonts/${file}`)
  if (!response.ok) throw new Error(`Could not load font ${file} (HTTP ${response.status})`)
  return response.arrayBuffer()
}

/** Replaces how font files are read (tests and Node scripts read from disk). */
export function setFontLoader(next: FontLoader) {
  loader = next
}

type LoadListener = (event: { id: FontId; state: "start" | "end" }) => void
const listeners = new Set<LoadListener>()

/** Notifies when a large (CJK) font starts or finishes downloading. */
export function onLargeFontLoad(listener: LoadListener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

let hbModule: Promise<typeof HB> | undefined
export function harfbuzz() {
  // harfbuzzjs initialises its WASM with a top-level await, so import it lazily.
  hbModule ??= import("harfbuzzjs")
  return hbModule
}

const cache = new Map<string, Promise<LoadedFont>>()

export function loadFont(id: FontId, weight: Weight = "regular"): Promise<LoadedFont> {
  const key = `${id}:${weight}`
  let pending = cache.get(key)
  if (!pending) {
    pending = createFont(id, weight)
    pending.catch(() => cache.delete(key))
    cache.set(key, pending)
  }
  return pending
}

async function createFont(id: FontId, weight: Weight): Promise<LoadedFont> {
  const def = FONT_DEFS[id]
  if (def.large) listeners.forEach((l) => l({ id, state: "start" }))
  try {
    const [hb, bytes] = await Promise.all([harfbuzz(), loader(def.file[weight])])
    const face = new hb.Face(new hb.Blob(bytes))
    const font = new hb.Font(face)
    const extents = font.hExtents()
    const glyphCache = new Map<number, boolean>()
    return {
      id,
      weight,
      hb: font,
      upem: face.upem,
      ascender: extents.ascender,
      descender: extents.descender,
      hasGlyph(codePoint) {
        let has = glyphCache.get(codePoint)
        if (has === undefined) {
          has = font.nominalGlyph(codePoint) !== undefined
          glyphCache.set(codePoint, has)
        }
        return has
      },
    }
  } finally {
    if (def.large) listeners.forEach((l) => l({ id, state: "end" }))
  }
}

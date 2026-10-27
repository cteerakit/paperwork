/**
 * Splits text into runs that share a font, choosing the font from each
 * character's Unicode script.
 */
import { loadFont, type FontFamily, type FontId, type LoadedFont, type Weight } from "./fonts"

const SCRIPT_FONTS: [RegExp, FontId | "cjk"][] = [
  [/\p{Script=Thai}/u, "thai"],
  [/\p{Script=Lao}/u, "lao"],
  [/\p{Script=Khmer}/u, "khmer"],
  [/\p{Script=Arabic}/u, "arabic"],
  [/\p{Script=Hebrew}/u, "hebrew"],
  [/\p{Script=Devanagari}/u, "devanagari"],
  [/\p{Script=Bengali}/u, "bengali"],
  [/\p{Script=Tamil}/u, "tamil"],
  [/\p{Script=Hangul}/u, "kr"],
  [/[\p{Script=Hiragana}\p{Script=Katakana}]/u, "jp"],
  [/\p{Script=Bopomofo}/u, "tc"],
  [/\p{Script=Han}/u, "cjk"],
]
const NEUTRAL = /[\p{Script=Common}\p{Script=Inherited}]/u
/** CJK punctuation, symbols and full-width forms are "Common" but only CJK fonts draw them. */
const CJK_COMMON = /[⺀-㏿︰-﹏＀-￯]/u

export interface TextOptions {
  family?: FontFamily
  weight?: Weight
  /** BCP 47 language hint, used to pick the right CJK font and for word breaking. */
  lang?: string
}

export interface FontRun {
  start: number
  end: number
  font: LoadedFont
}

/** Fonts that finished loading, so layout can stay synchronous. */
const ready = new Map<string, LoadedFont>()

function cjkFont(text: string, lang = ""): FontId {
  const l = lang.toLowerCase()
  if (l.startsWith("ja") || /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) return "jp"
  if (l.startsWith("ko") || /\p{Script=Hangul}/u.test(text)) return "kr"
  if (/^zh-(tw|hk|mo|hant)/.test(l)) return "tc"
  return "sc"
}

/** The font a character asks for by script, or null when it should follow its neighbours. */
function scriptFont(ch: string, cjk: FontId): FontId | null {
  for (const [re, id] of SCRIPT_FONTS) {
    if (re.test(ch)) return id === "cjk" ? cjk : id
  }
  if (CJK_COMMON.test(ch)) return cjk
  if (NEUTRAL.test(ch)) return null
  return "latin"
}

function preferred(id: FontId, family: FontFamily): FontId[] {
  // Charm covers Latin and Thai, so signatures use it for both and fall back to Noto.
  if (family === "signature" && (id === "latin" || id === "thai")) return ["charm", id]
  return [id]
}

/** Font IDs the text needs, without loading anything. */
export function requiredFonts(text: string, options: TextOptions = {}): FontId[] {
  const family = options.family ?? "sans"
  const cjk = cjkFont(text, options.lang)
  const ids = new Set<FontId>(preferred("latin", family))
  for (const ch of text) {
    const id = scriptFont(ch, cjk)
    if (id) preferred(id, family).forEach((p) => ids.add(p))
  }
  return [...ids]
}

/** Loads every font the text needs. Call before {@link itemize}. */
export async function ensureFonts(text: string, options: TextOptions = {}) {
  const weight = options.weight ?? "regular"
  const fonts = await Promise.all(requiredFonts(text, options).map((id) => loadFont(id, weight)))
  for (const font of fonts) ready.set(`${font.id}:${weight}`, font)
}

function readyFont(id: FontId, weight: Weight): LoadedFont | undefined {
  return ready.get(`${id}:${weight}`)
}

/** Finds a loaded font that can draw `cp`, trying the preferred fonts first. */
function coveringFont(cp: number, ids: FontId[], weight: Weight): LoadedFont | undefined {
  for (const id of ids) {
    const font = readyFont(id, weight)
    if (font?.hasGlyph(cp)) return font
  }
  for (const font of ready.values()) {
    if (font.weight === weight && font.hasGlyph(cp)) return font
  }
  return undefined
}

const IGNORABLE = /[\p{Cc}\p{Cf}\p{Mn}\p{Me}︀-️]/u

/**
 * Replaces characters no loaded font can draw with "?" and reports them.
 * Combining marks and format characters (ZWJ, variation selectors) are never reported,
 * because they are drawn as part of the character before them.
 */
export function sanitize(text: string, options: TextOptions = {}) {
  const weight = options.weight ?? "regular"
  const family = options.family ?? "sans"
  const cjk = cjkFont(text, options.lang)
  const missing = new Set<string>()
  let out = ""
  for (const ch of text.replace(/\r\n?/g, "\n").replace(/\t/g, " ")) {
    if (ch === "\n") {
      out += ch
      continue
    }
    const cp = ch.codePointAt(0)!
    const id = scriptFont(ch, cjk)
    if (coveringFont(cp, id ? preferred(id, family) : ["latin"], weight) || IGNORABLE.test(ch)) {
      out += ch
    } else {
      missing.add(ch)
      out += "?"
    }
  }
  return { text: out, missing: [...missing] }
}

/** Splits text into same-font runs. Fonts must be loaded with {@link ensureFonts} first. */
export function itemize(text: string, options: TextOptions = {}): FontRun[] {
  const weight = options.weight ?? "regular"
  const family = options.family ?? "sans"
  const cjk = cjkFont(text, options.lang)
  const fallback = readyFont(preferred("latin", family)[0], weight) ?? readyFont("latin", weight)
  if (!fallback) throw new Error("Fonts are not loaded. Call ensureFonts() first.")

  // First pass: font per character; neutral characters (spaces, digits, marks) are resolved later.
  const chars: { index: number; ch: string; font: LoadedFont | null }[] = []
  let index = 0
  for (const ch of text) {
    const id = scriptFont(ch, cjk)
    const font = id ? coveringFont(ch.codePointAt(0)!, preferred(id, family), weight) ?? fallback : null
    chars.push({ index, ch, font })
    index += ch.length
  }

  // Neutral characters join the run before them (or after, at the start of the text),
  // as long as that font can draw them.
  let previous: LoadedFont | null = null
  for (const c of chars) {
    if (c.font) previous = c.font
    else if (previous && (previous.hasGlyph(c.ch.codePointAt(0)!) || IGNORABLE.test(c.ch))) c.font = previous
  }
  let next: LoadedFont | null = null
  for (let i = chars.length - 1; i >= 0; i--) {
    const c = chars[i]
    if (c.font) next = c.font
    else if (next && (next.hasGlyph(c.ch.codePointAt(0)!) || IGNORABLE.test(c.ch))) c.font = next
  }
  for (const c of chars) {
    c.font ??= coveringFont(c.ch.codePointAt(0)!, ["latin"], weight) ?? fallback
  }

  const runs: FontRun[] = []
  for (const c of chars) {
    const last = runs.at(-1)
    if (last && last.font === c.font) last.end = c.index + c.ch.length
    else runs.push({ start: c.index, end: c.index + c.ch.length, font: c.font! })
  }
  return runs
}

/**
 * Finds text across a document and turns each match into redaction areas.
 *
 * Areas are in visual page points (origin top-left), like manual selections. pdf.js gives each text
 * item a baseline origin and a total width, not per-character positions, so a match inside an item is
 * placed by splitting the item's width by estimated character widths. The estimate is rough, so each
 * area gets a small horizontal margin: covering a neighbouring character is safer than missing part
 * of the match.
 */
import type { PdfDoc } from "../render/pdfjs"
import type { Redaction } from "./redact"

export type SearchPreset = "email" | "phone" | "thaiId" | "card"

export const SEARCH_PRESETS: SearchPreset[] = ["email", "phone", "thaiId", "card"]

export type SearchQuery =
  | { kind: "text"; text: string }
  | { kind: "regex"; pattern: string }
  | { kind: "preset"; preset: SearchPreset }

export type SearchErrorCode = "empty" | "invalid"

/** Carries a code so the UI can show a translated message. */
export class SearchPatternError extends Error {
  readonly code: SearchErrorCode

  constructor(code: SearchErrorCode) {
    super(code === "empty" ? "Nothing to search for." : "This pattern isn't valid.")
    this.code = code
  }
}

export interface Matcher {
  regex: RegExp
  /** Filters out look-alikes the regex alone can't tell apart, such as numbers that aren't cards. */
  accept?: (text: string) => boolean
}

const digitsOf = (text: string) => text.replace(/\D/g, "")

function passesLuhn(digits: string) {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum % 10 === 0
}

const PRESETS: Record<SearchPreset, Matcher> = {
  email: { regex: /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/giu },
  phone: {
    regex: /(?<![\d+])\+?\d[\d ().-]{6,}\d(?!\d)/g,
    accept: (text) => digitsOf(text).length >= 8 && digitsOf(text).length <= 15,
  },
  thaiId: { regex: /(?<!\d)\d[ -]?\d{4}[ -]?\d{5}[ -]?\d{2}[ -]?\d(?!\d)/g },
  card: {
    regex: /(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)/g,
    accept: (text) => passesLuhn(digitsOf(text)),
  },
}

/** Builds a matcher from what the user typed or picked. Throws {@link SearchPatternError}. */
export function compileQuery(query: SearchQuery): Matcher {
  if (query.kind === "preset") {
    const { regex, accept } = PRESETS[query.preset]
    return { regex: new RegExp(regex.source, regex.flags), accept }
  }
  const input = query.kind === "text" ? query.text.trim() : query.pattern
  if (!input.trim()) throw new SearchPatternError("empty")
  // A typed phrase matches whatever whitespace the PDF happens to use between words.
  const source =
    query.kind === "text"
      ? input
          .split(/\s+/u)
          .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("\\s+")
      : input
  let regex: RegExp
  try {
    regex = new RegExp(source, "giu")
  } catch {
    throw new SearchPatternError("invalid")
  }
  // A pattern that matches nothing at all would "find" every position.
  if (new RegExp(source, "u").test("")) throw new SearchPatternError("empty")
  return { regex }
}

/** The parts of a pdf.js text item that searching needs. */
export interface SearchItem {
  str: string
  transform: number[]
  width: number
  fontName: string
  hasEOL?: boolean
}

export type SearchStyles = Record<string, { ascent?: number; descent?: number }>

export interface TextMatch {
  page: number
  text: string
  areas: Redaction[]
}

const MARGIN = 0.12 // of the font size, added on both ends of each area
const MAX_MATCHES = 5_000

/** Relative width of a character, to place a match inside a text item. */
function weight(char: string) {
  if (/[il.,:;'|!jI]/.test(char)) return 0.45
  if (/[ftr\s()[\]-]/.test(char)) return 0.6
  if (/[mwMW@]/.test(char)) return 1.6
  if (/\p{Lu}/u.test(char)) return 1.15
  if (/\d/.test(char)) return 1.1
  return 1
}

function multiply(a: number[], b: number[]) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ]
}

interface Segment {
  /** Where the item's text begins in the page's joined text. */
  start: number
  item: SearchItem
}

/**
 * Finds matches on one page. `viewport` is pdf.js's viewport transform at scale 1 and `size` the
 * page's visual size in points.
 */
export function findInItems(
  items: SearchItem[],
  styles: SearchStyles,
  viewport: number[],
  size: { width: number; height: number },
  page: number,
  matcher: Matcher
): TextMatch[] {
  let text = ""
  const segments: Segment[] = []
  for (const item of items) {
    if (item.str) {
      segments.push({ start: text.length, item })
      text += item.str
    }
    if (item.hasEOL) text += "\n"
  }

  const matches: TextMatch[] = []
  for (const found of text.matchAll(matcher.regex)) {
    if (matches.length >= MAX_MATCHES) break
    if (!found[0].trim() || (matcher.accept && !matcher.accept(found[0]))) continue
    const start = found.index
    const end = start + found[0].length
    const areas: Redaction[] = []
    for (const segment of segments) {
      const length = segment.item.str.length
      const from = Math.max(start, segment.start) - segment.start
      const to = Math.min(end, segment.start + length) - segment.start
      if (to <= from) continue
      const area = areaOf(segment.item, from, to, styles, viewport, size, page)
      if (area) areas.push(area)
    }
    if (areas.length) matches.push({ page, text: found[0], areas })
  }
  return matches
}

/** The box around characters [from, to) of an item, or undefined if it has no visible size. */
function areaOf(
  item: SearchItem,
  from: number,
  to: number,
  styles: SearchStyles,
  viewport: number[],
  size: { width: number; height: number },
  page: number
): Redaction | undefined {
  const chars = Array.from(item.str)
  // Offsets are in UTF-16 units; convert them to characters so surrogate pairs aren't split.
  const charFrom = Array.from(item.str.slice(0, from)).length
  const charTo = Array.from(item.str.slice(0, to)).length
  const weights = chars.map(weight)
  const total = weights.reduce((sum, w) => sum + w, 0)
  const before = weights.slice(0, charFrom).reduce((sum, w) => sum + w, 0)
  const within = weights.slice(charFrom, charTo).reduce((sum, w) => sum + w, 0)
  if (!total || !within) return undefined

  const m = multiply(viewport, item.transform)
  const fontSize = Math.hypot(m[2], m[3])
  const advance = Math.hypot(m[0], m[1])
  if (!fontSize || !advance) return undefined
  const scale = Math.hypot(viewport[0], viewport[1])
  const length = item.width * scale
  // Unit vectors along the text and towards the top of its glyphs, in page space (y down).
  const along = [m[0] / advance, m[1] / advance]
  const up = [m[2] / fontSize, m[3] / fontSize]
  const style = styles[item.fontName]
  const ascent = (style?.ascent ?? 0.8) * fontSize
  const descent = (style?.descent ?? -0.2) * fontSize

  const margin = MARGIN * fontSize
  const near = (before / total) * length - margin
  const far = ((before + within) / total) * length + margin
  const corners = [near, far].flatMap((distance) =>
    [ascent, descent].map((rise) => [
      m[4] + along[0] * distance + up[0] * rise,
      m[5] + along[1] * distance + up[1] * rise,
    ])
  )
  const x = Math.max(0, Math.min(...corners.map(([cx]) => cx)))
  const y = Math.max(0, Math.min(...corners.map(([, cy]) => cy)))
  const right = Math.min(size.width, Math.max(...corners.map(([cx]) => cx)))
  const bottom = Math.min(size.height, Math.max(...corners.map(([, cy]) => cy)))
  if (right <= x || bottom <= y) return undefined
  return { page, x, y, width: right - x, height: bottom - y }
}

/** Searches every page. Reports progress after each page and stops early when `signal` aborts. */
export async function searchDocument(
  doc: PdfDoc,
  matcher: Matcher,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal
): Promise<TextMatch[]> {
  const matches: TextMatch[] = []
  for (let index = 0; index < doc.numPages; index++) {
    if (signal?.aborted || matches.length >= MAX_MATCHES) break
    const page = await doc.getPage(index + 1)
    const [content, viewport] = [await page.getTextContent(), page.getViewport({ scale: 1 })]
    const items = content.items.filter((item): item is typeof item & SearchItem => "str" in item)
    matches.push(
      ...findInItems(
        items,
        content.styles,
        viewport.transform,
        { width: viewport.width, height: viewport.height },
        index,
        matcher
      )
    )
    onProgress?.(index + 1, doc.numPages)
  }
  return matches
}

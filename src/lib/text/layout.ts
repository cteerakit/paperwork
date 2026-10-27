/**
 * Lays out multi-line text: wraps at word boundaries (Intl.Segmenter, which
 * knows where Thai, Lao, Khmer and CJK words break even without spaces),
 * aligns each line, and positions glyphs in a top-left-origin box.
 */
import { ensureFonts, sanitize, type TextOptions } from "./segment"
import { initShaper, shapeLine, type PositionedGlyph } from "./shape"

export type TextAlign = "left" | "center" | "right"

export interface LayoutOptions extends TextOptions {
  fontSize: number
  /** Wrap width in points. Omit for no wrapping. */
  maxWidth?: number
  align?: TextAlign
  /** Line height as a multiple of font size. */
  lineHeight?: number
}

export interface LayoutLine {
  /** The line's text in logical order (used for the searchable text layer). */
  text: string
  glyphs: PositionedGlyph[]
  /** Advance per UTF-16 index of `text` that starts a cluster. */
  advances: Float64Array
  /** Left edge of the line inside the box, after alignment. */
  x: number
  /** Baseline, measured down from the top of the box. */
  baseline: number
  width: number
}

export interface TextLayout {
  lines: LayoutLine[]
  /** Box size in points. Width is maxWidth when wrapping, otherwise the widest line. */
  width: number
  height: number
  fontSize: number
}

/** Typographic ascent/descent used for every line, as a fraction of font size (Noto Sans metrics). */
const ASCENT = 1.069
const DESCENT = 0.293

/**
 * Loads fonts, removes characters no font can draw, and lays out the text.
 * `missing` lists the characters that were replaced with "?".
 */
export async function prepareLayout(text: string, options: LayoutOptions) {
  await Promise.all([initShaper(), ensureFonts(text, options)])
  const clean = sanitize(text, options)
  return { layout: layoutText(clean.text, options), missing: clean.missing }
}

/** Synchronous layout. Fonts and the shaper must be ready (see {@link prepareLayout}). */
export function layoutText(text: string, options: LayoutOptions): TextLayout {
  const { fontSize, maxWidth, align = "left", lineHeight = 1.4 } = options
  const lineTexts = text.split("\n").flatMap((p) => wrapParagraph(p, options))
  const shaped = lineTexts.map((t) => ({ text: t, ...shapeLine(t, fontSize, options) }))

  const widest = Math.max(0, ...shaped.map((l) => l.width))
  const boxWidth = maxWidth ?? widest
  const lineAdvance = fontSize * lineHeight
  const halfLeading = (lineAdvance - (ASCENT + DESCENT) * fontSize) / 2

  const lines: LayoutLine[] = shaped.map((l, i) => {
    // RTL paragraphs start from the right unless explicitly aligned otherwise.
    const effective = align === "left" && l.rtl ? "right" : align
    const x =
      effective === "center" ? (boxWidth - l.width) / 2 : effective === "right" ? boxWidth - l.width : 0
    return {
      text: l.text,
      glyphs: l.glyphs,
      advances: l.advances,
      width: l.width,
      x,
      baseline: i * lineAdvance + halfLeading + ASCENT * fontSize,
    }
  })

  return { lines, width: boxWidth, height: Math.max(1, lines.length) * lineAdvance, fontSize }
}

const segmenters = new Map<string, Intl.Segmenter>()
function segmenter(lang: string | undefined, granularity: "word" | "grapheme") {
  const key = `${lang ?? ""}:${granularity}`
  let s = segmenters.get(key)
  if (!s) {
    s = new Intl.Segmenter(lang, { granularity })
    segmenters.set(key, s)
  }
  return s
}

/** Greedy line breaking at word boundaries; words wider than the box break between characters. */
function wrapParagraph(paragraph: string, options: LayoutOptions): string[] {
  const { maxWidth, fontSize } = options
  if (maxWidth === undefined || paragraph === "") return [paragraph]

  const width = (s: string) => shapeLine(s.trimEnd(), fontSize, options).width
  if (width(paragraph) <= maxWidth) return [paragraph]

  const lines: string[] = []
  let current = ""
  const pushPiece = (piece: string) => {
    if (current === "" && /^\s+$/.test(piece)) return // no leading spaces on wrapped lines
    const candidate = current + piece
    if (current === "" || width(candidate) <= maxWidth) {
      current = candidate
    } else {
      lines.push(current.trimEnd())
      current = piece.trimStart()
    }
  }

  for (const { segment } of segmenter(options.lang, "word").segment(paragraph)) {
    if (width(segment) <= maxWidth) {
      pushPiece(segment)
      continue
    }
    // A single word longer than the line: break it between grapheme clusters.
    for (const { segment: grapheme } of segmenter(options.lang, "grapheme").segment(segment)) {
      pushPiece(grapheme)
    }
  }
  if (current !== "") lines.push(current.trimEnd())
  return lines
}

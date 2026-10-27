/**
 * Shapes one line of text with HarfBuzz: applies bidi ordering, per-script fonts,
 * and the font's own substitution/positioning rules (Thai mark stacking,
 * Arabic joining, Indic reordering).
 */
import bidiFactory from "bidi-js"
import type { LoadedFont } from "./fonts"
import { harfbuzz } from "./fonts"
import { itemize, type TextOptions } from "./segment"

export interface PositionedGlyph {
  font: LoadedFont
  gid: number
  /** Pen position in points, relative to the line start (x) and baseline (y, up is positive). */
  x: number
  y: number
}

export interface ShapedLine {
  glyphs: PositionedGlyph[]
  width: number
  /** Advance in points for each UTF-16 index that starts a cluster (logical order). */
  advances: Float64Array
  rtl: boolean
}

let bidi: ReturnType<typeof bidiFactory> | undefined

interface Segment {
  start: number
  end: number
  font: LoadedFont
  level: number
}

let hb: Awaited<ReturnType<typeof harfbuzz>> | undefined
/** Call once before using {@link shapeLine} synchronously. */
export async function initShaper() {
  hb = await harfbuzz()
}

/** Shapes a single line (no newlines). Fonts must already be loaded. */
export function shapeLine(text: string, fontSize: number, options: TextOptions = {}): ShapedLine {
  if (!hb) throw new Error("Shaper not initialised. Call initShaper() first.")
  bidi ??= bidiFactory()

  const advances = new Float64Array(text.length)
  if (text === "") return { glyphs: [], width: 0, advances, rtl: false }

  const { levels, paragraphs } = bidi.getEmbeddingLevels(text)
  const segments: Segment[] = []
  for (const run of itemize(text, options)) {
    let start = run.start
    for (let i = run.start + 1; i <= run.end; i++) {
      if (i === run.end || levels[i] !== levels[start]) {
        segments.push({ start, end: i, font: run.font, level: levels[start] })
        start = i
      }
    }
  }

  // Unicode bidi rule L2: from the highest level down to the lowest odd level,
  // reverse every contiguous sequence of segments at that level or higher.
  const visual = [...segments]
  const maxLevel = Math.max(...visual.map((s) => s.level))
  const minOdd = Math.min(...visual.map((s) => s.level).filter((l) => l % 2 === 1), Infinity)
  for (let level = maxLevel; level >= minOdd && level > 0; level--) {
    for (let i = 0; i < visual.length; ) {
      if (visual[i].level < level) {
        i++
        continue
      }
      let j = i
      while (j < visual.length && visual[j].level >= level) j++
      visual.splice(i, j - i, ...visual.slice(i, j).reverse())
      i = j
    }
  }

  const glyphs: PositionedGlyph[] = []
  let pen = 0
  for (const seg of visual) {
    const scale = fontSize / seg.font.upem
    const buffer = new hb.Buffer()
    buffer.addText(text.slice(seg.start, seg.end))
    buffer.guessSegmentProperties()
    buffer.setDirection(seg.level % 2 ? hb.Direction.RTL : hb.Direction.LTR)
    if (options.lang) buffer.setLanguage(options.lang)
    hb.shape(seg.font.hb, buffer)

    for (const g of buffer.getGlyphInfosAndPositions()) {
      glyphs.push({
        font: seg.font,
        gid: g.codepoint,
        x: pen + (g.xOffset ?? 0) * scale,
        y: (g.yOffset ?? 0) * scale,
      })
      const advance = (g.xAdvance ?? 0) * scale
      advances[seg.start + g.cluster] += advance
      pen += advance
    }
  }

  return { glyphs, width: pen, advances, rtl: paragraphs[0]?.level % 2 === 1 }
}

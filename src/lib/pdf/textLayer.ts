/**
 * Invisible, searchable text for text we draw as outlines.
 *
 * Outlines look right in every viewer but can't be searched or copied. To fix
 * that we also write the text in rendering mode 3 (invisible), the way OCR'd
 * PDFs do. We don't need a real font for that: a Type 3 font with empty glyphs
 * works, as long as each code maps back to the right Unicode text (ToUnicode)
 * and has the right width (so selections line up with the visible outlines).
 *
 * Codes map to Unicode code points in visual order. PDF readers apply bidi
 * ordering during extraction to recover logical Arabic and Hebrew text.
 */
import bidiFactory from "bidi-js"
import { PDFHexString, type PDFDocument, type PDFRef } from "pdf-lib"
import { num } from "./content"
import type { PageWriter } from "./content"
import type { LayoutLine } from "../text/layout"

/** Width units per em (FontMatrix is 1/1000). */
const UNITS = 1000
const CODES = [
  ...Array.from({ length: 94 }, (_, i) => 0x21 + i),
  ...Array.from({ length: 95 }, (_, i) => 0xa1 + i),
]

interface Type3Font {
  ref: PDFRef
  entries: { text: string; width: number; code: number }[]
  index: Map<string, number>
}

const bidi = bidiFactory()

export class InvisibleTextLayer {
  private fonts: Type3Font[] = []
  private glyphProc: PDFRef | undefined

  private readonly doc: PDFDocument

  constructor(doc: PDFDocument) {
    this.doc = doc
  }

  /**
   * Writes one line of invisible text. Must be called inside the same local
   * transform as the visible outlines (origin at the text box's top-left, y up).
   */
  writeLine(writer: PageWriter, line: LayoutLine, fontSize: number) {
    if (line.text.trim() === "") return
    const ops: string[] = []
    let currentFont: Type3Font | undefined
    let pending: number[] = []
    const flush = () => {
      if (pending.length)
        ops.push(
          `<${pending.map((c) => c.toString(16).padStart(2, "0")).join("")}> Tj`
        )
      pending = []
    }

    const embedding = bidi.getEmbeddingLevels(line.text)
    const order = bidi.getReorderedIndices(line.text, embedding)
    const baseLevel = embedding.paragraphs[0]?.level ?? 0
    const runLevels = embedding.levels.map((level) =>
      baseLevel === 1 ? 1 : Math.min(level, 1)
    )
    const positions = new Map<number, number>()
    let x = line.x
    for (const index of order) {
      positions.set(index, x)
      x += line.advances[index]
    }
    // Emit directional runs in reading order, at their visual positions.
    // Marked content keeps readers from applying bidi to unrelated runs together.
    for (let start = 0; start < line.text.length;) {
      let end = start + 1
      while (end < line.text.length && runLevels[end] === runLevels[start])
        end++
      const indices = order.filter((index) => index >= start && index < end)
      const left = Math.min(
        ...indices.map((index) => positions.get(index) ?? line.x)
      )
      ops.push(
        "/Span BMC",
        "BT",
        "3 Tr",
        `1 0 0 1 ${num(left)} ${num(-line.baseline)} Tm`
      )
      currentFont = undefined
      for (const index of indices) {
        const unit = line.text.charCodeAt(index)
        if (unit >= 0xdc00 && unit <= 0xdfff && index > 0) {
          const previous = line.text.charCodeAt(index - 1)
          if (previous >= 0xd800 && previous <= 0xdbff) continue
        }
        const char = String.fromCodePoint(
          line.text.codePointAt(index) ?? 0xfffd
        )
        const width = Math.round((line.advances[index] / fontSize) * UNITS)
        const { font, code } = this.code(char, width)
        if (font !== currentFont) {
          flush()
          ops.push(`${writer.font(font.ref)} ${num(fontSize)} Tf`)
          currentFont = font
        }
        pending.push(code)
      }
      flush()
      ops.push("ET", "EMC")
      start = end
    }
    writer.push(...ops)
  }

  private code(text: string, width: number) {
    const key = `${text}\u0000${width}`
    for (const font of this.fonts) {
      const code = font.index.get(key)
      if (code !== undefined) return { font, code }
    }
    let font = this.fonts.at(-1)
    if (!font || font.entries.length >= CODES.length) {
      font = { ref: this.doc.context.nextRef(), entries: [], index: new Map() }
      this.fonts.push(font)
    }
    const code = CODES[font.entries.length]
    font.entries.push({ text, width, code })
    font.index.set(key, code)
    return { font, code }
  }

  /** Writes the font dictionaries. Call once after all text is written, before saving. */
  finish() {
    const { context } = this.doc
    this.glyphProc ??= context.register(context.stream("0 0 0 0 0 0 d1"))
    for (const font of this.fonts) {
      const first = font.entries[0].code
      const last = font.entries.at(-1)!.code
      const widths = Array<number>(last - first + 1).fill(0)
      for (const entry of font.entries) widths[entry.code - first] = entry.width
      const toUnicode = [
        "/CIDInit /ProcSet findresource begin",
        "12 dict begin",
        "begincmap",
        "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
        "/CMapName /Paperwork-Invisible def",
        "/CMapType 2 def",
        "1 begincodespacerange <00> <FF> endcodespacerange",
        ...chunk(font.entries, 100).flatMap((entries) => [
          `${entries.length} beginbfchar`,
          ...entries.map(
            (e) =>
              `<${e.code.toString(16).padStart(2, "0")}> <${utf16Hex(e.text)}>`
          ),
          "endbfchar",
        ]),
        "endcmap",
        "CMapName currentdict /CMap defineresource pop",
        "end",
        "end",
      ].join("\n")

      context.assign(
        font.ref,
        context.obj({
          Type: "Font",
          Subtype: "Type3",
          FontBBox: [0, 0, 0, 0],
          FontMatrix: [1 / UNITS, 0, 0, 1 / UNITS, 0, 0],
          CharProcs: { g: this.glyphProc },
          Encoding: {
            Type: "Encoding",
            Differences: [first, ...Array(widths.length).fill("g")],
          },
          FirstChar: first,
          LastChar: last,
          Widths: widths,
          Resources: {},
          ToUnicode: context.register(context.flateStream(toUnicode)),
        })
      )
    }
  }
}

function utf16Hex(text: string) {
  return PDFHexString.fromText(text).asString().replace(/^FEFF/i, "")
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size))
  return out
}

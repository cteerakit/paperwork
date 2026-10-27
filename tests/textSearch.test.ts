import { PDFDocument, StandardFonts } from "pdf-lib"
import { describe, expect, it } from "vitest"
import type { PdfDoc } from "@/lib/render/pdfjs"
import { compileQuery, searchDocument, SearchPatternError, type SearchQuery } from "@/lib/pdf/textSearch"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import { makePdf } from "./helpers"

const SIZE = 12
const LEFT = 50
const BASELINE = 700
const PAGE_HEIGHT = 842

/** One page of text lines drawn in Helvetica, plus a way to measure where each piece really sits. */
async function textPdf(lines: string[]) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.addPage([595, PAGE_HEIGHT])
  lines.forEach((line, i) => page.drawText(line, { x: LEFT, y: BASELINE - i * 30, size: SIZE, font }))
  return { bytes: await doc.save(), width: (text: string) => font.widthOfTextAtSize(text, SIZE) }
}

async function search(bytes: Uint8Array, query: SearchQuery) {
  const task = getDocument({ data: bytes.slice(), verbosity: 0 })
  try {
    return await searchDocument((await task.promise) as unknown as PdfDoc, compileQuery(query))
  } finally {
    await task.destroy()
  }
}

describe("text search", () => {
  it("covers a match in the middle of a line, with only a small margin", async () => {
    const { bytes, width } = await textPdf(["Contact: ana@example.com today"])
    const [match, ...rest] = await search(bytes, { kind: "preset", preset: "email" })
    expect(rest).toEqual([])
    expect(match.text).toBe("ana@example.com")

    const x0 = LEFT + width("Contact: ")
    const x1 = x0 + width("ana@example.com")
    const [area] = match.areas
    expect(area.page).toBe(0)
    // The whole address is inside the area...
    expect(area.x).toBeLessThanOrEqual(x0)
    expect(area.x + area.width).toBeGreaterThanOrEqual(x1)
    // ...which doesn't spill much further than a couple of characters.
    expect(x0 - area.x).toBeLessThan(2.5 * SIZE)
    expect(area.x + area.width - x1).toBeLessThan(2.5 * SIZE)
    // The line's glyphs, from capital height down to the descenders, are inside it vertically.
    const baseline = PAGE_HEIGHT - BASELINE
    expect(area.y).toBeLessThanOrEqual(baseline - 0.7 * SIZE)
    expect(area.y + area.height).toBeGreaterThanOrEqual(baseline + 0.2 * SIZE)
  })

  it("matches typed text ignoring case and the kind of whitespace", async () => {
    const { bytes } = await textPdf(["Account Number: 42", "account number again"])
    const matches = await search(bytes, { kind: "text", text: "ACCOUNT   number" })
    expect(matches.map((m) => m.text)).toEqual(["Account Number", "account number"])
  })

  it("treats typed text literally but a pattern as a pattern", async () => {
    const { bytes } = await textPdf(["Total (USD) 1.50 and 1x50"])
    expect(await search(bytes, { kind: "text", text: "1.50" })).toHaveLength(1)
    expect((await search(bytes, { kind: "regex", pattern: "1.50" })).map((m) => m.text)).toEqual(["1.50", "1x50"])
    expect(await search(bytes, { kind: "text", text: "(USD)" })).toHaveLength(1)
  })

  it("finds numbers by preset and skips look-alikes", async () => {
    const { bytes } = await textPdf([
      "Card 4111 1111 1111 1111 ok",
      "Card 1234 5678 9012 3456 no",
      "Call 081-234-5678 now",
      "Ref 12345 and ID 1-2345-67890-12-3",
    ])
    const found = async (preset: "card" | "phone" | "thaiId") =>
      (await search(bytes, { kind: "preset", preset })).map((m) => m.text)
    expect(await found("card")).toEqual(["4111 1111 1111 1111"])
    expect(await found("phone")).toContain("081-234-5678")
    expect(await found("phone")).not.toContain("12345")
    expect(await found("thaiId")).toEqual(["1-2345-67890-12-3"])
  })

  it("reports the page of each match", async () => {
    const matches = await search(await makePdf(3), { kind: "text", text: "page 2" })
    expect(matches.map((m) => m.page)).toEqual([1])
    expect(matches[0].areas[0].page).toBe(1)
  })

  it("places matches correctly on a rotated page", async () => {
    const bytes = await makePdf(1, { rotate: { 0: 90 } })
    const [match] = await search(bytes, { kind: "text", text: "Page 1" })
    const [area] = match.areas
    // Rotated a quarter turn clockwise, the line starting at (50, 750) now runs down from (750, 50).
    expect(area.x).toBeLessThanOrEqual(750 - 0.2 * 24 + 1)
    expect(area.x + area.width).toBeGreaterThanOrEqual(750 + 0.7 * 24)
    expect(area.y).toBeLessThanOrEqual(50)
    expect(area.y + area.height).toBeGreaterThan(50 + 24)
    expect(area.y + area.height).toBeLessThan(50 + 24 * 5)
  })

  it("rejects searches that are empty or malformed", () => {
    const code = (query: SearchQuery) => {
      try {
        compileQuery(query)
      } catch (error) {
        return error instanceof SearchPatternError ? error.code : "other"
      }
    }
    expect(code({ kind: "text", text: "   " })).toBe("empty")
    expect(code({ kind: "regex", pattern: "(" })).toBe("invalid")
    expect(code({ kind: "regex", pattern: ".*" })).toBe("empty")
    expect(code({ kind: "regex", pattern: "a|" })).toBe("empty")
    expect(code({ kind: "regex", pattern: "\\d+" })).toBeUndefined()
  })
})

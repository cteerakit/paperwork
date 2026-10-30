import { describe, expect, it } from "vitest"
import { prepareLayout } from "@/lib/text/layout"
import { layoutToPdfPath, layoutToSvgPath } from "@/lib/text/draw"

describe("text engine", () => {
  it("stacks Thai tone marks using the font's shaping rules", async () => {
    const shape = async (t: string) => (await prepareLayout(t, { fontSize: 100 })).layout.lines[0].glyphs
    const name = (g: { font: { hb: { glyphName(id: number): string } }; gid: number }) => g.font.hb.glyphName(g.gid)

    const plain = await shape("ท่")
    const stacked = await shape("ที่")
    expect(stacked.every((g) => g.font.id === "thai")).toBe(true)
    // Above a vowel, the tone mark is substituted with a smaller, raised form (GSUB).
    expect(name(plain[1])).toBe("uni0E48")
    expect(name(stacked[2])).toBe("uni0E48.small")
    // Next to a tall consonant it shifts left so it doesn't collide with the stem.
    expect(name((await shape("ป่"))[1])).toBe("uni0E48.narrow")
    // Double stacking (mai han-akat + mai tho) also gets a positioning offset (GPOS).
    expect((await shape("ปั้น")).some((g) => g.y !== 0)).toBe(true)
  })

  it("joins Arabic letters and orders them right to left", async () => {
    const word = "سلام"
    const { layout } = await prepareLayout(word, { fontSize: 100 })
    const joined = layout.lines[0].glyphs.map((g) => g.gid)
    const isolated = await Promise.all(
      [...word].map(async (ch) => (await prepareLayout(ch, { fontSize: 100 })).layout.lines[0].glyphs[0].gid)
    )
    expect(layout.lines[0].glyphs.every((g) => g.font.id === "arabic")).toBe(true)
    // Joined forms differ from the isolated letters.
    expect(joined).not.toEqual(isolated)
    expect(joined).not.toEqual([...isolated].reverse())
    // Glyphs are in visual order: x increases left to right.
    const xs = layout.lines[0].glyphs.map((g) => g.x)
    expect([...xs].sort((a, b) => a - b)).toEqual(xs)
  })

  it("puts mixed-direction runs in visual order", async () => {
    const { layout } = await prepareLayout("abc שלום def", { fontSize: 50 })
    const fonts = layout.lines[0].glyphs.map((g) => g.font.id)
    expect(fonts[0]).toBe("latin")
    expect(fonts.at(-1)).toBe("latin")
    expect(fonts).toContain("hebrew")
  })

  it("wraps Thai at word boundaries even without spaces", async () => {
    const text = "สวัสดีครับยินดีต้อนรับสู่ระบบจัดการเอกสาร"
    const { layout } = await prepareLayout(text, { fontSize: 20, maxWidth: 90, lang: "th" })
    expect(layout.lines.length).toBeGreaterThan(1)
    expect(layout.lines.map((l) => l.text).join("")).toBe(text)
    const boundaries = new Set(
      [...new Intl.Segmenter("th", { granularity: "word" }).segment(text)].map((s) => s.index)
    )
    let offset = 0
    for (const line of layout.lines.slice(0, -1)) {
      offset += line.text.length
      expect(boundaries.has(offset)).toBe(true)
    }
  })

  it("picks CJK fonts by script and language", async () => {
    const ja = await prepareLayout("こんにちは世界", { fontSize: 20 })
    expect(new Set(ja.layout.lines[0].glyphs.map((g) => g.font.id))).toEqual(new Set(["jp"]))
    const ko = await prepareLayout("안녕하세요", { fontSize: 20 })
    expect(ko.layout.lines[0].glyphs[0].font.id).toBe("kr")
  })

  it("uses a family's styled fonts where they cover the script and Noto Sans elsewhere", async () => {
    const fontsOf = async (text: string, family: "serif" | "mono") => {
      const { layout } = await prepareLayout(text, { fontSize: 20, family })
      return new Set(layout.lines[0].glyphs.map((g) => g.font.id))
    }
    expect(await fontsOf("Draft ร่าง", "serif")).toEqual(new Set(["serif", "serifThai"]))
    expect(await fontsOf("Draft ร่าง", "mono")).toEqual(new Set(["mono", "thai"]))
  })

  it("reports characters no font can draw", async () => {
    const { missing, layout } = await prepareLayout("ok 😀", { fontSize: 20 })
    expect(missing).toEqual(["😀"])
    expect(layout.lines[0].text).toBe("ok ?")
  })

  it("produces outline paths", async () => {
    const { layout } = await prepareLayout("Aก", { fontSize: 20 })
    expect(layoutToSvgPath(layout)).toMatch(/^M/)
    expect(layoutToPdfPath(layout)).toMatch(/ m\n/)
  })
})

import { describe, expect, it } from "vitest"
import { normalizeSaved } from "@/lib/signatures"

describe("saved signatures", () => {
  it("upgrades entries saved before categories existed", () => {
    // Exactly what the old localStorage version wrote.
    const legacy = [
      { id: "a", kind: "image", src: "data:image/png;base64,AAAA", width: 120, height: 40 },
      { id: "b", kind: "text", text: "Ana", color: "#1d4ed8" },
    ]
    expect(normalizeSaved(legacy)).toEqual([
      { id: "a", category: "signature", name: undefined, kind: "image", src: "data:image/png;base64,AAAA", width: 120, height: 40 },
      { id: "b", category: "signature", name: undefined, kind: "text", text: "Ana", color: "#1d4ed8" },
    ])
  })

  it("keeps categories and names", () => {
    const [item] = normalizeSaved([
      { id: "c", category: "stamp", name: "  Approved ", kind: "image", src: "data:,", width: 10, height: 10 },
    ])
    expect(item).toMatchObject({ category: "stamp", name: "Approved" })
  })

  it("falls back to signature for unknown categories", () => {
    const [item] = normalizeSaved([{ id: "d", category: "seal", kind: "text", text: "x", color: "#000" }])
    expect(item.category).toBe("signature")
  })

  it("drops malformed entries instead of failing", () => {
    expect(
      normalizeSaved([
        null,
        "text",
        { kind: "text", text: "no id", color: "#000" },
        { id: "e", kind: "image", src: "data:,", width: "wide", height: 1 },
        { id: "f", kind: "video" },
        { id: "g", kind: "text", text: "ok", color: "#000" },
      ]).map((item) => item.id)
    ).toEqual(["g"])
    expect(normalizeSaved({ not: "a list" })).toEqual([])
    expect(normalizeSaved(undefined)).toEqual([])
  })
})

import { describe, expect, it } from "vitest"
import { chunkPages, formatRanges, PageRangeError, parseRangeGroups, parseRanges } from "@/lib/pdf/ranges"

describe("page ranges", () => {
  it("parses pages, ranges and open-ended ranges", () => {
    expect(parseRanges("1-3, 5, 8-", 10)).toEqual([0, 1, 2, 4, 7, 8, 9])
    expect(parseRanges("", 3)).toEqual([0, 1, 2])
    expect(parseRanges("all", 2)).toEqual([0, 1])
    expect(parseRanges("3-1", 3)).toEqual([2, 1, 0])
    expect(parseRanges("2, 2, 1 - 2", 3)).toEqual([1, 0])
  })

  it("rejects bad input with a code the UI can translate", () => {
    expect(() => parseRanges("abc", 3)).toThrow(PageRangeError)
    expect(() => parseRanges("5", 3)).toThrow(
      expect.objectContaining({ code: "outOfRange", values: { page: 5, count: 3 } })
    )
  })

  it("splits groups and chunks", () => {
    expect(parseRangeGroups("1-2, 3; 4-5", 5)).toEqual([[0, 1], [2], [3, 4]])
    expect(chunkPages(5, 2)).toEqual([[0, 1], [2, 3], [4]])
    expect(formatRanges([0, 1, 2, 4, 6, 7])).toBe("1-3, 5, 7-8")
  })
})

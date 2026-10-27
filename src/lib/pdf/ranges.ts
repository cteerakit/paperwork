/**
 * Page range parsing shared by every tool that targets a subset of pages.
 * User input is 1-based ("1-3, 5, 8-"); results are 0-based page indices.
 */

export type RangeErrorCode = "invalid" | "outOfRange" | "empty" | "chunkSize"

/** Carries a code and values so the UI can show a translated message. */
export class PageRangeError extends Error {
  readonly code: RangeErrorCode
  readonly values: Record<string, string | number>

  constructor(code: RangeErrorCode, values: Record<string, string | number> = {}) {
    super(`${code}: ${JSON.stringify(values)}`)
    this.code = code
    this.values = values
  }
}

/** Parses "1-3, 5, 8-" into 0-based indices in input order, without duplicates. Empty or "all" means every page. */
export function parseRanges(input: string, pageCount: number): number[] {
  const trimmed = input.trim()
  if (trimmed === "" || trimmed.toLowerCase() === "all") {
    return Array.from({ length: pageCount }, (_, i) => i)
  }

  const seen = new Set<number>()
  const result: number[] = []
  for (const part of trimmed.split(/[,;]/)) {
    for (const index of parsePart(part.trim(), pageCount)) {
      if (!seen.has(index)) {
        seen.add(index)
        result.push(index)
      }
    }
  }
  return result
}

/** Each comma, semicolon or line is one output file, e.g. "1-3, 4-6, 7". */
export function parseRangeGroups(input: string, pageCount: number): number[][] {
  const groups = input
    .split(/[,;\n]/)
    .map((g) => g.trim())
    .filter(Boolean)
  if (groups.length === 0) throw new PageRangeError("empty")
  return groups.map((g) => parsePart(g, pageCount))
}

/** Groups pages into consecutive chunks of `size`. */
export function chunkPages(pageCount: number, size: number): number[][] {
  if (!Number.isInteger(size) || size < 1) throw new PageRangeError("chunkSize")
  const groups: number[][] = []
  for (let start = 0; start < pageCount; start += size) {
    groups.push(Array.from({ length: Math.min(size, pageCount - start) }, (_, i) => start + i))
  }
  return groups
}

/** Formats 0-based indices as a compact 1-based range string, e.g. [0,1,2,4] → "1-3, 5". */
export function formatRanges(indices: number[]): string {
  const parts: string[] = []
  for (let i = 0; i < indices.length; ) {
    let j = i
    while (j + 1 < indices.length && indices[j + 1] === indices[j] + 1) j++
    parts.push(i === j ? `${indices[i] + 1}` : `${indices[i] + 1}-${indices[j] + 1}`)
    i = j + 1
  }
  return parts.join(", ")
}

function parsePart(part: string, pageCount: number): number[] {
  if (part === "") return []
  const match = /^(\d+)?\s*(-)?\s*(\d+)?$/.exec(part)
  if (!match || (!match[1] && !match[3])) throw new PageRangeError("invalid", { part })

  const [, startText, dash, endText] = match
  const start = startText ? Number(startText) : 1
  const end = dash ? (endText ? Number(endText) : pageCount) : start

  for (const page of [start, end]) {
    if (page < 1 || page > pageCount) throw new PageRangeError("outOfRange", { page, count: pageCount })
  }

  const step = start <= end ? 1 : -1
  const pages: number[] = []
  for (let n = start; n !== end + step; n += step) pages.push(n - 1)
  return pages
}

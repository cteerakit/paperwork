import { describe, expect, it } from "vitest"
import { isLiveSession, SESSION_MAX_AGE } from "@/lib/storage"

describe("autosaved sessions", () => {
  const now = Date.UTC(2026, 9, 29)

  it("keeps sessions saved within the last week", () => {
    expect(isLiveSession({ savedAt: now, value: [] }, now)).toBe(true)
    expect(isLiveSession({ savedAt: now - SESSION_MAX_AGE + 1, value: [] }, now)).toBe(true)
  })

  it("expires sessions older than a week", () => {
    expect(isLiveSession({ savedAt: now - SESSION_MAX_AGE, value: [] }, now)).toBe(false)
  })

  it("expires saves from before timestamps existed, and timestamps from the future", () => {
    expect(isLiveSession([{ kind: "text" }], now)).toBe(false)
    expect(isLiveSession(undefined, now)).toBe(false)
    expect(isLiveSession({ savedAt: "yesterday", value: [] }, now)).toBe(false)
    expect(isLiveSession({ savedAt: now + 60_000, value: [] }, now)).toBe(false)
  })
})

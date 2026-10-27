import { afterEach, describe, expect, it, vi } from "vitest"
import feedback from "../src/server/feedback"

const env = {
  DISCORD_FEEDBACK_WEBHOOK: "https://discord.com/api/webhooks/test/token",
  FEEDBACK_RATE_LIMIT: { limit: async () => ({ success: true }) },
}
function request(message: unknown, origin = "https://paperwork.example") {
  return new Request("https://paperwork.example/api/feedback", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  })
}
afterEach(() => vi.unstubAllGlobals())

describe("feedback delivery", () => {
  it("delivers trimmed feedback with Discord mentions disabled", async () => {
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", send)
    expect(
      (await feedback.fetch(request("  Please add a tool @everyone  "), env))
        .status
    ).toBe(204)
    expect(send).toHaveBeenCalledWith(
      env.DISCORD_FEEDBACK_WEBHOOK,
      expect.objectContaining({
        body: JSON.stringify({
          content: "**Paperwork feedback**\nPlease add a tool @everyone",
          allowed_mentions: { parse: [] },
        }),
      })
    )
  })
  it.each([" ", "x".repeat(1501), null, 12])(
    "rejects invalid messages",
    async (message) => {
      const send = vi.fn()
      vi.stubGlobal("fetch", send)
      expect((await feedback.fetch(request(message), env)).status).toBe(400)
      expect(send).not.toHaveBeenCalled()
    }
  )
  it("rejects oversized request bodies", async () => {
    expect((await feedback.fetch(request("x".repeat(9000)), env)).status).toBe(
      413
    )
  })
  it("rejects cross-origin submissions", async () => {
    expect(
      (await feedback.fetch(request("Hello", "https://other.example"), env))
        .status
    ).toBe(403)
  })
  it("honors rate limiting without contacting Discord", async () => {
    const send = vi.fn()
    vi.stubGlobal("fetch", send)
    expect(
      (
        await feedback.fetch(request("Hello"), {
          ...env,
          FEEDBACK_RATE_LIMIT: { limit: async () => ({ success: false }) },
        })
      ).status
    ).toBe(429)
    expect(send).not.toHaveBeenCalled()
  })
  it.each([false, true])(
    "reports upstream failures instead of success (network failure: %s)",
    async (networkFailure) => {
      vi.stubGlobal(
        "fetch",
        networkFailure
          ? vi.fn().mockRejectedValue(new Error("offline"))
          : vi.fn().mockResolvedValue(new Response(null, { status: 429 }))
      )
      expect((await feedback.fetch(request("Hello"), env)).status).toBe(502)
    }
  )
})

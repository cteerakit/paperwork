import type { InferEnv } from "cf/config"
import type config from "../../cloudflare.config"

type FeedbackEnv = InferEnv<typeof config.worker>

const reply = (status: number) =>
  new Response(null, { status, headers: { "Cache-Control": "no-store" } })

export default {
  async fetch(request: Request, env: FeedbackEnv): Promise<Response> {
    if (new URL(request.url).pathname !== "/api/feedback") return reply(404)
    if (request.method !== "POST") return reply(405)
    if (request.headers.get("Origin") !== new URL(request.url).origin)
      return reply(403)
    if (!request.headers.get("Content-Type")?.startsWith("application/json"))
      return reply(415)
    const { success } = await env.FEEDBACK_RATE_LIMIT.limit({
      key: request.headers.get("CF-Connecting-IP") ?? "local",
    })
    if (!success) return reply(429)

    let body: unknown
    try {
      const reader = request.body?.getReader()
      if (!reader) return reply(400)
      const chunks: Uint8Array[] = []
      let size = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > 8192) {
          await reader.cancel()
          return reply(413)
        }
        chunks.push(value)
      }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.byteLength
      }
      body = JSON.parse(new TextDecoder().decode(bytes))
    } catch {
      return reply(400)
    }
    if (
      !body ||
      typeof body !== "object" ||
      !("message" in body) ||
      typeof body.message !== "string"
    )
      return reply(400)
    const message = body.message.trim()
    if (!message || message.length > 1500) return reply(400)
    if (!env.DISCORD_FEEDBACK_WEBHOOK) return reply(503)
    try {
      const response = await fetch(env.DISCORD_FEEDBACK_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `**Paperwork feedback**\n${message}`,
          allowed_mentions: { parse: [] },
        }),
        signal: AbortSignal.timeout(10000),
      })
      await response.body?.cancel()
      return reply(response.ok ? 204 : 502)
    } catch {
      return reply(502)
    }
  },
}

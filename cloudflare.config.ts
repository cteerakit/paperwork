import { bindings, defineConfig } from "cf/config"

export default defineConfig({
  accountId: "abacddc84809ae90bc41554d996120ca",
  worker: {
    name: "paperwork",
    entrypoint: "./src/server/feedback.ts",
    compatibilityDate: "2026-10-23",
    assets: {
      notFoundHandling: "404-page",
      htmlHandling: "drop-trailing-slash",
      runWorkerFirst: ["/api/*"],
    },
    env: {
      DISCORD_FEEDBACK_WEBHOOK: bindings.secret(),
      FEEDBACK_RATE_LIMIT: bindings.rateLimit({
        namespace: "1001",
        simple: { limit: 3, period: 60 },
      }),
    },
  },
})

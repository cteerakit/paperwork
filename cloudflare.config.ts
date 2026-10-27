import { defineConfig } from "cf/config"

export default defineConfig({
  accountId: "abacddc84809ae90bc41554d996120ca",
  worker: {
    name: "paperwork",
    compatibilityDate: "2026-10-23",
    assets: { notFoundHandling: "single-page-application" },
  },
})

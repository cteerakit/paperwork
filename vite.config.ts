import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"
import { cloudflare } from "@cloudflare/vite-plugin"
import { VitePWA } from "vite-plugin-pwa"
import { socialMetadata } from "./scripts/social-metadata.ts"
import { SOCIAL_PAGES } from "./src/lib/social.ts"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cloudflare(),
    socialMetadata(),
    VitePWA({
      outDir: ".cloudflare/output/v0/workers/default/assets",
      registerType: "prompt",
      injectRegister: "script-defer",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        id: "/",
        name: "Paperwork — PDF tools",
        short_name: "Paperwork",
        description: "Private PDF tools. Merge, split, sign, and edit on your device.",
        lang: "en",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#6366f1",
        background_color: "#f6f5ff",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,wasm,woff,woff2,ttf,bcmap,pfb,icc}"],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api(?:\/|$)/],
        navigateFallbackAllowlist: SOCIAL_PAGES.map(({ path }) =>
          new RegExp(`^${path === "/" ? "/" : `${path}/?`}(?:\\?.*)?$`)
        ),
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /^\/fonts\/NotoSans(?:SC|TC|JP|KR)-.*\.otf$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "paperwork-cjk-fonts",
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 8, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
  optimizeDeps: {
    // harfbuzzjs locates its .wasm via import.meta.url, which pre-bundling would break.
    exclude: ["harfbuzzjs"],
  },
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    testTimeout: 30000,
  },
})

import { resolve } from "node:path"
import { createServer, type Plugin } from "vite"
import {
  applicationJsonLd,
  NOT_FOUND_PAGE,
  SITE_URL,
  SOCIAL_PAGES,
  socialPage,
  socialTags,
} from "../src/lib/social.ts"

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")

function metadata(path: string) {
  const page = socialPage(path)
  return [
    `<title>${escapeHtml(page.title)}</title>`,
    ...(page === NOT_FOUND_PAGE
      ? []
      : [
          `<link rel="canonical" href="${SITE_URL}${page.path}" />`,
          `<script id="application-jsonld" type="application/ld+json">${applicationJsonLd()}</script>`,
        ]),
    ...socialTags(page).map(
      (tag) =>
        `<meta ${"property" in tag ? `property="${tag.property}"` : `name="${tag.name}"`} content="${escapeHtml(tag.content)}" />`
    ),
  ].join("\n    ")
}

export function socialMetadata(): Plugin {
  return {
    name: "paperwork-social-metadata",
    enforce: "post",
    transformIndexHtml: {
      order: "post",
      handler: (html) =>
        html.replace("<!-- social-metadata -->", metadata("/")),
    },
    generateBundle: {
      order: "post",
      async handler(_options, bundle) {
        const index = bundle["index.html"]
        if (
          !index ||
          index.type !== "asset" ||
          typeof index.source !== "string"
        )
          return
        const template = index.source
        if (!template.includes('<div id="root"></div>')) {
          this.error("The static page template is missing its empty app root.")
        }
        const server = await createServer({
          configFile: false,
          root: resolve(import.meta.dirname, ".."),
          resolve: { alias: { "@": resolve(import.meta.dirname, "../src") } },
          esbuild: { jsx: "automatic" },
          server: { middlewareMode: true, watch: null },
          appType: "custom",
        })
        try {
          const { renderPage } = await server.ssrLoadModule(
            "/src/entry-static.tsx"
          )
          if (typeof renderPage !== "function")
            this.error("Missing static page renderer.")
          for (const page of [...SOCIAL_PAGES, NOT_FOUND_PAGE]) {
            const content: unknown = await renderPage(page.path)
            if (typeof content !== "string")
              this.error("Static page rendering did not produce HTML.")
            const source = template
              .replace(metadata("/"), metadata(page.path))
              .replace(
                '<div id="root"></div>',
                () => `<div id="root">${content}</div>`
              )
            if (page.path === "/") index.source = source
            else
              this.emitFile({
                type: "asset",
                fileName:
                  page === NOT_FOUND_PAGE
                    ? "404.html"
                    : `${page.path.slice(1)}/index.html`,
                source,
              })
          }
        } finally {
          await server.close()
        }
        this.emitFile({
          type: "asset",
          fileName: "sitemap.xml",
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${SOCIAL_PAGES.map((page) => `  <url><loc>${SITE_URL}${page.path}</loc></url>`).join("\n")}\n</urlset>\n`,
        })
        this.emitFile({
          type: "asset",
          fileName: "robots.txt",
          source: `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
        })
      },
    },
  }
}

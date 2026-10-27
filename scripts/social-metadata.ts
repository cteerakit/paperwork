import type { Plugin } from "vite"
import {
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
    `<link rel="canonical" href="${SITE_URL}${page.path}" />`,
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
      handler(_options, bundle) {
        const index = bundle["index.html"]
        if (
          !index ||
          index.type !== "asset" ||
          typeof index.source !== "string"
        )
          return
        for (const page of SOCIAL_PAGES.filter((page) => page.path !== "/")) {
          this.emitFile({
            type: "asset",
            fileName: `${page.path.slice(1)}/index.html`,
            source: index.source.replace(metadata("/"), metadata(page.path)),
          })
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

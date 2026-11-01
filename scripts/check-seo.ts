import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { SITE_URL, SOCIAL_PAGES, STRUCTURED_DATA } from "../src/lib/social.ts"

const directory = resolve(
  import.meta.dirname,
  "../.cloudflare/output/v0/workers/default/assets"
)
const escapeHtml = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
const paths = new Set(SOCIAL_PAGES.map(({ path }) => path))

for (const page of SOCIAL_PAGES) {
  const html = await readFile(
    resolve(
      directory,
      page.path === "/" ? "index.html" : `${page.path.slice(1)}/index.html`
    ),
    "utf8"
  )
  assert.equal(
    html.match(/<h1\b/g)?.length,
    1,
    `${page.path}: one primary heading`
  )
  assert.equal(html.match(/<title>/g)?.length, 1, `${page.path}: one title`)
  assert.ok(
    html.includes(`<title>${escapeHtml(page.title)}</title>`),
    `${page.path}: correct title`
  )
  assert.ok(
    html.includes(
      `name="description" content="${escapeHtml(page.description)}"`
    ),
    `${page.path}: correct description`
  )
  assert.ok(
    html.includes(`<link rel="canonical" href="${SITE_URL}${page.path}" />`),
    `${page.path}: canonical URL`
  )
  assert.ok(
    html.includes('name="robots" content="index, follow"'),
    `${page.path}: indexable`
  )
  assert.ok(
    !html.includes('<div id="root"></div>'),
    `${page.path}: nonempty content`
  )
  assert.ok(!html.includes("seo.tools."), `${page.path}: translated content`)
  const jsonLd = html.match(
    /<script id="application-jsonld" type="application\/ld\+json">(.*?)<\/script>/s
  )?.[1]
  assert.ok(jsonLd, `${page.path}: structured data exists`)
  assert.deepEqual(
    JSON.parse(jsonLd),
    STRUCTURED_DATA,
    `${page.path}: valid structured data`
  )
  for (const [, href] of html.matchAll(/<a\b[^>]*href="([^"]+)"/g)) {
    if (href.startsWith("/"))
      assert.ok(paths.has(href), `${page.path}: valid internal link ${href}`)
  }
}

const missing = await readFile(resolve(directory, "404.html"), "utf8")
assert.ok(missing.includes('name="robots" content="noindex, follow"'))
assert.ok(!missing.includes('rel="canonical"'))
assert.ok(!missing.includes('id="application-jsonld"'))
assert.equal(missing.match(/<h1\b/g)?.length, 1)

const sitemap = await readFile(resolve(directory, "sitemap.xml"), "utf8")
assert.deepEqual(
  [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(([, url]) => url).sort(),
  SOCIAL_PAGES.map(({ path }) => `${SITE_URL}${path}`).sort()
)
const robots = await readFile(resolve(directory, "robots.txt"), "utf8")
assert.ok(robots.includes(`Sitemap: ${SITE_URL}/sitemap.xml`))
assert.ok(robots.includes("Allow: /"))
console.log(
  `Verified ${SOCIAL_PAGES.length} generated public pages, 404.html, sitemap.xml, and robots.txt.`
)

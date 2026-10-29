import { describe, expect, it } from "vitest"
import { renderPage } from "@/entry-static"
import en from "@/i18n/locales/en.json"
import th from "@/i18n/locales/th.json"
import {
  NOT_FOUND_PAGE,
  SOCIAL_PAGES,
  socialPage,
  socialTags,
} from "@/lib/social"
import { TOOLS } from "@/tools/registry"

describe("public page content", () => {
  it.each(SOCIAL_PAGES)(
    "renders crawlable content for $path without browser APIs",
    async (page) => {
      const html = await renderPage(page.path)
      expect(html.match(/<h1\b/g)).toHaveLength(1)
      expect(html).toContain('href="/"')
      expect(html).toContain('href="/about"')
      expect(html).toContain('href="/pricing"')
      expect(html).not.toContain("seo.tools.")
      if (page.path === "/") {
        for (const tool of TOOLS) expect(html).toContain(`href="${tool.path}"`)
      }
    }
  )

  it.each(TOOLS)(
    "includes English and Thai instructions for $id",
    async ({ id, path }) => {
      for (const [language, messages] of [
        ["en", en],
        ["th", th],
      ] as const) {
        const html = await renderPage(path, language)
        expect(html).toContain(messages.tools[id].title)
        for (const instruction of Object.values(messages.seo.tools[id])) {
          expect(html).toContain(
            instruction.replaceAll("&", "&amp;").replaceAll("'", "&#x27;")
          )
        }
        expect(html).toContain(messages.seo.privacyTitle)
        expect(html.match(/<li><a /g)?.length).toBe(3)
      }
    }
  )

  it("renders a missing page instead of the home page", async () => {
    const html = await renderPage("/does-not-exist")
    expect(html).toContain(en.seo.notFoundTitle)
    expect(html).not.toContain(en.home.title)
  })

  it("keeps the public URL registry aligned with the tool routes", () => {
    expect(SOCIAL_PAGES.map(({ path }) => path).sort()).toEqual(
      [
        "/",
        "/about",
        "/pricing",
        "/changelog",
        "/privacy",
        ...TOOLS.map(({ path }) => path),
      ].sort()
    )
    expect(new Set(SOCIAL_PAGES.map(({ title }) => title)).size).toBe(
      SOCIAL_PAGES.length
    )
    expect(
      new Set(SOCIAL_PAGES.map(({ description }) => description)).size
    ).toBe(SOCIAL_PAGES.length)
  })

  it("normalizes trailing slashes and marks unknown URLs noindex", () => {
    expect(socialPage("/merge/").path).toBe("/merge")
    expect(socialPage("/does-not-exist")).toBe(NOT_FOUND_PAGE)
    expect(socialTags(socialPage("/does-not-exist"))).toContainEqual({
      name: "robots",
      content: "noindex, follow",
    })
    expect(socialTags(socialPage("/merge"))).toContainEqual({
      name: "robots",
      content: "index, follow",
    })
  })
})

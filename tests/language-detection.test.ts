import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

async function openSite(languages: string[], savedLanguage?: string) {
  const stored = new Map<string, string>()
  if (savedLanguage) stored.set("paperwork.lang", savedLanguage)
  const localStorage = {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  }
  vi.stubGlobal("window", { localStorage })
  vi.stubGlobal("navigator", { languages, language: languages[0] })
  vi.stubGlobal("document", { documentElement: { lang: "" } })
  const { default: i18n } = await import("@/i18n")
  return { i18n, localStorage }
}

describe("initial language selection", () => {
  it.each([
    { languages: ["th-TH", "en-US"], expected: "th" },
    { languages: ["en-GB", "th-TH"], expected: "en" },
    { languages: ["fr-FR", "th-TH"], expected: "th" },
    { languages: ["fr-FR"], expected: "en" },
    { languages: [], expected: "en" },
  ])("selects $expected for browser preferences $languages", async ({ languages, expected }) => {
    const { i18n } = await openSite(languages)
    expect(i18n.resolvedLanguage).toBe(expected)
    expect(document.documentElement.lang).toBe(expected)
  })

  it("keeps a saved choice ahead of browser preferences", async () => {
    const { i18n } = await openSite(["th-TH"], "en")
    expect(i18n.resolvedLanguage).toBe("en")
  })

  it("remembers a manual language change for the next visit", async () => {
    const { i18n, localStorage } = await openSite(["en-US"])
    await i18n.changeLanguage("th")
    expect(localStorage.getItem("paperwork.lang")).toBe("th")
    expect(document.documentElement.lang).toBe("th")
  })
})

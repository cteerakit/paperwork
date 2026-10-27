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
  const { default: i18n, i18nReady, changeLanguage } = await import("@/i18n")
  await i18nReady
  return { i18n, localStorage, changeLanguage }
}

describe("initial language selection", () => {
  it.each([
    { languages: ["th-TH", "en-US"], expected: "th" },
    { languages: ["en-GB", "th-TH"], expected: "en" },
    { languages: ["fr-FR", "th-TH"], expected: "th" },
    { languages: ["ja-JP", "en-US"], expected: "ja" },
    { languages: ["zh-CN", "en-US"], expected: "zh" },
    { languages: ["zh-SG"], expected: "zh" },
    { languages: ["vi-VN"], expected: "vi" },
    { languages: ["es-MX", "en-US"], expected: "es" },
    { languages: ["es-419"], expected: "es" },
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

  it("starts in the saved language with its strings already loaded", async () => {
    const { i18n } = await openSite(["en-US"], "ja")
    expect(i18n.resolvedLanguage).toBe("ja")
    expect(i18n.t("common.allTools")).toBe("すべてのツール")
  })

  it("loads a language's strings when it is chosen", async () => {
    const { i18n, localStorage, changeLanguage } = await openSite(["en-US"])
    expect(i18n.hasResourceBundle("es", "translation")).toBe(false)
    await changeLanguage("es")
    expect(i18n.resolvedLanguage).toBe("es")
    expect(i18n.t("common.allTools")).toBe("Todas las herramientas")
    expect(i18n.t("common.pageCount", { count: 1 })).toBe("1 página")
    expect(i18n.t("common.pageCount", { count: 3 })).toBe("3 páginas")
    expect(localStorage.getItem("paperwork.lang")).toBe("es")
  })

  it("uses the plural forms of each language", async () => {
    const { i18n, changeLanguage } = await openSite(["en-US"])
    await changeLanguage("vi")
    expect(i18n.t("common.pageCount", { count: 1 })).toBe("1 trang")
    expect(i18n.t("common.pageCount", { count: 5 })).toBe("5 trang")
    await changeLanguage("zh")
    expect(i18n.t("common.pageCount", { count: 1 })).toBe("1 页")
  })

  it("remembers a manual language change for the next visit", async () => {
    const { i18n, localStorage } = await openSite(["en-US"])
    await i18n.changeLanguage("th")
    expect(localStorage.getItem("paperwork.lang")).toBe("th")
    expect(document.documentElement.lang).toBe("th")
  })
})

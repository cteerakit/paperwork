import type { i18n as I18n } from "i18next"
import type { LanguageCode } from "./languages"

/** English and Thai ship with the app; the rest load when first needed, to keep the first download small. */
const LAZY_LOCALES = {
  ja: () => import("./locales/ja.json"),
  zh: () => import("./locales/zh.json"),
  vi: () => import("./locales/vi.json"),
  es: () => import("./locales/es.json"),
}

/** Adds a language's strings to `i18n` if they aren't loaded yet. Has no side effects on import, so it is safe to prerender. */
export async function loadLocale(i18n: I18n, language: string | undefined) {
  // "zh-CN" and "ja-JP" use the strings of "zh" and "ja".
  const code = language?.split("-")[0]
  if (
    !code ||
    !(code in LAZY_LOCALES) ||
    i18n.hasResourceBundle(code, "translation")
  )
    return
  const { default: strings } =
    await LAZY_LOCALES[code as keyof typeof LAZY_LOCALES]()
  i18n.addResourceBundle(code, "translation", strings)
}

/** Switches language, loading its strings first. */
export async function changeLanguage(i18n: I18n, code: LanguageCode) {
  await loadLocale(i18n, code)
  await i18n.changeLanguage(code)
}

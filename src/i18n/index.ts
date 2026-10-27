import i18n from "i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import { initReactI18next } from "react-i18next"
import en from "./locales/en.json"
import th from "./locales/th.json"

import { LANGUAGES, type LanguageCode } from "./languages"

export { LANGUAGES, type LanguageCode }

/** English and Thai ship with the app; the rest load when first needed, to keep the first download small. */
const LAZY_LOCALES = {
  ja: () => import("./locales/ja.json"),
  zh: () => import("./locales/zh.json"),
  vi: () => import("./locales/vi.json"),
  es: () => import("./locales/es.json"),
}

async function loadLocale(language: string | undefined) {
  // "zh-CN" and "ja-JP" use the strings of "zh" and "ja".
  const code = language?.split("-")[0]
  if (!code || !(code in LAZY_LOCALES) || i18n.hasResourceBundle(code, "translation")) return
  const { default: strings } = await LAZY_LOCALES[code as keyof typeof LAZY_LOCALES]()
  i18n.addResourceBundle(code, "translation", strings)
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, th: { translation: th } },
    fallbackLng: "en",
    supportedLngs: LANGUAGES.map((l) => l.code),
    // "th-TH" from the browser should match "th".
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "paperwork.lang",
      caches: ["localStorage"],
    },
  })

/**
 * Resolves once the strings of the language chosen at startup are loaded, so the first screen isn't
 * drawn in English first. It never rejects: if a locale can't load, the app stays in English.
 */
export const i18nReady = loadLocale(i18n.language)
  .then(() => (i18n.resolvedLanguage === i18n.language.split("-")[0] ? undefined : i18n.changeLanguage(i18n.language)))
  .then(() => undefined, () => undefined)

/** Switches language, loading its strings first. */
export async function changeLanguage(code: LanguageCode) {
  await loadLocale(code)
  await i18n.changeLanguage(code)
}

const syncHtmlLang = (lng: string) => {
  document.documentElement.lang = lng
}
syncHtmlLang(i18n.resolvedLanguage ?? "en")
// Use the language that actually has strings: the event carries what was asked for, such as "ja-JP".
i18n.on("languageChanged", (lng) => syncHtmlLang(i18n.resolvedLanguage ?? lng))

export default i18n

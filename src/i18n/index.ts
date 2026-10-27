import i18n from "i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import { initReactI18next } from "react-i18next"
import en from "./locales/en.json"
import th from "./locales/th.json"

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "th", label: "ไทย" },
] as const

export type LanguageCode = (typeof LANGUAGES)[number]["code"]

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

const syncHtmlLang = (lng: string) => {
  document.documentElement.lang = lng
}
syncHtmlLang(i18n.resolvedLanguage ?? "en")
i18n.on("languageChanged", syncHtmlLang)

export default i18n

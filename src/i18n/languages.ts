/** The languages the interface is offered in. Kept apart from the i18n setup so it has no side effects. */
export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "th", label: "ไทย" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "简体中文" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "es", label: "Español" },
] as const

export type LanguageCode = (typeof LANGUAGES)[number]["code"]

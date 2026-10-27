import { useMemo } from "react"
import { useTranslation } from "react-i18next"

/** Locale-aware number and file-size formatting for the current UI language. */
export function useFormat() {
  const { i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? "en"
  return useMemo(() => {
    const number = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 })
    const percent = new Intl.NumberFormat(lang, { style: "percent", maximumFractionDigits: 0 })
    const units = ["B", "KB", "MB", "GB"]
    return {
      number: (n: number) => number.format(n),
      percent: (n: number) => percent.format(n),
      bytes: (n: number) => {
        let i = 0
        while (n >= 1024 && i < units.length - 1) {
          n /= 1024
          i++
        }
        return `${number.format(n)} ${units[i]}`
      },
    }
  }, [lang])
}

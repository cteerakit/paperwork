import type { TFunction } from "i18next"
import { PdfError } from "./pdf/load"
import { PageRangeError } from "./pdf/ranges"
import { RedactionError } from "./pdf/redactionError"

/** Turns any error into a friendly, translated message. */
export function errorMessage(t: TFunction, error: unknown): string {
  if (error instanceof RedactionError) return t("tools.redact.textOnly")
  if (error instanceof PdfError) return t(`errors.${error.code}`)
  if (error instanceof PageRangeError) return t(`errors.range.${error.code}`, error.values)
  if (error instanceof Error && error.name === "PasswordException") return t("errors.encrypted")
  if (error instanceof Error && /encrypt/i.test(error.message)) return t("errors.encrypted")
  console.error(error)
  return t("errors.generic")
}

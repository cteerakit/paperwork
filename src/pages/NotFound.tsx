import { useTranslation } from "react-i18next"
import { Link } from "react-router"

export function NotFound() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      <p className="text-sm text-muted-foreground">404</p>
      <h1 className="mt-3 text-3xl font-semibold">{t("seo.notFoundTitle")}</h1>
      <p className="mt-4 text-muted-foreground">
        {t("seo.notFoundDescription")}
      </p>
      <Link to="/" className="mt-6 inline-block underline underline-offset-4">
        {t("common.allTools")}
      </Link>
    </div>
  )
}

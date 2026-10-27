import { ArrowLeft, ArrowUpRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"

export function About() {
  const { t } = useTranslation()

  return (
    <article className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("common.allTools")}
      </Link>
      <header className="mt-8 mb-8">
        <p className="mb-3 text-sm font-medium text-muted-foreground">
          {t("footer.about")}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {t("about.title")}
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          {t("about.intro")}
        </p>
      </header>
      <div className="space-y-5 leading-8 text-muted-foreground">
        <p>{t("about.context")}</p>
        <p>{t("about.problem")}</p>
        <p>{t("about.girlfriend")}</p>
        <p className="font-medium text-foreground">{t("about.question")}</p>
        <p>{t("about.solution")}</p>
        <p>{t("about.invitation")}</p>
      </div>
      <div className="mt-10 border-t pt-6">
        <p className="font-medium">Teerakit Chantrakul</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("about.creator")}
        </p>
        <a
          href="https://x.com/tearakit/status/2115112893977117018"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1 rounded-sm text-sm underline underline-offset-4 hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          {t("about.originalPost")}
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </a>
      </div>
    </article>
  )
}

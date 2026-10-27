import { useTranslation } from "react-i18next"
import { CHANGELOG } from "@/lib/changelog"
import { cn } from "@/lib/utils"

export function Changelog() {
  const { t, i18n } = useTranslation()
  const formatDate = new Intl.DateTimeFormat(i18n.resolvedLanguage ?? "en", {
    dateStyle: "long",
    timeZone: "UTC",
  })

  return (
    <article className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <header className="text-center">
        <p className="text-sm font-medium text-muted-foreground">
          {t("footer.changelog")}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          {t("changelog.title")}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          {t("changelog.subtitle")}
        </p>
      </header>

      <ol className="mt-12 space-y-10">
        {CHANGELOG.map((entry) => (
          <li key={entry.id}>
            <section
              aria-labelledby={`release-${entry.id}`}
              className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8"
            >
              <time
                dateTime={entry.date}
                className="text-sm font-medium text-muted-foreground"
              >
                {formatDate.format(new Date(entry.date))}
              </time>
              <h2
                id={`release-${entry.id}`}
                className="mt-1 text-xl font-semibold tracking-tight"
              >
                {t(`changelog.entries.${entry.id}.title`)}
              </h2>
              <ul className="mt-5 space-y-3 text-sm leading-6">
                {entry.items.map(({ key, type }) => (
                  <li key={key} className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                        type === "new"
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {t(`changelog.types.${type}`)}
                    </span>
                    <span>
                      {t(`changelog.entries.${entry.id}.items.${key}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </li>
        ))}
      </ol>
    </article>
  )
}

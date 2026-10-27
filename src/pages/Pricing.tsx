import { ArrowRight, Check, Smile } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { buttonVariants } from "@/components/ui/button"

export function Pricing() {
  const { t } = useTranslation()

  return (
    <article className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <header className="text-center">
        <p className="text-sm font-medium text-muted-foreground">
          {t("footer.pricing")}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          {t("pricing.title")}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          {t("pricing.subtitle")}
        </p>
      </header>

      <section
        aria-labelledby="free-plan"
        className="mx-auto mt-10 max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-8"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id="free-plan" className="text-lg font-semibold">
            {t("pricing.plan")}
          </h2>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
            {t("pricing.badge")}
          </span>
        </div>
        <p className="mt-6 flex items-baseline gap-2">
          <span className="text-7xl font-semibold tracking-tight">$0</span>
          <span className="text-sm text-muted-foreground">
            {t("pricing.period")}
          </span>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("pricing.finePrint")}
        </p>
        <ul className="my-7 space-y-4 text-sm">
          {["tools", "signup", "privacy"].map((feature) => (
            <li key={feature} className="flex items-start gap-3">
              <Check
                className="size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              {t(`pricing.features.${feature}`)}
            </li>
          ))}
        </ul>
        <Link to="/" className={buttonVariants({ className: "h-11 w-full" })}>
          {t("pricing.cta")}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {t("pricing.checkout")}
        </p>
      </section>

      <div className="mx-auto mt-9 max-w-md text-center">
        <Smile
          className="mx-auto size-6 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="mt-3 leading-7 text-muted-foreground">
          {t("pricing.note")}
        </p>
        <Link
          to="/about"
          className="mt-3 inline-block rounded-sm text-sm underline underline-offset-4 hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          {t("pricing.story")}
        </Link>
      </div>
    </article>
  )
}

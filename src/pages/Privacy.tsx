import { useState } from "react"
import { ArrowLeft, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { clearLocalData } from "@/lib/storage"

const SECTIONS = ["files", "stored", "feedback", "hosting"] as const

export function Privacy() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<"idle" | "clearing" | "cleared">("idle")

  const clear = async () => {
    if (!window.confirm(t("privacy.clearConfirm"))) return
    setStatus("clearing")
    await clearLocalData()
    setStatus("cleared")
  }

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
          {t("footer.privacy")}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {t("privacy.title")}
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          {t("privacy.intro")}
        </p>
      </header>
      <div className="space-y-8">
        {SECTIONS.map((section) => (
          <section key={section}>
            <h2 className="text-lg font-semibold">
              {t(`privacy.${section}.title`)}
            </h2>
            <p className="mt-2 leading-7 text-muted-foreground">
              {t(`privacy.${section}.body`)}
            </p>
          </section>
        ))}
      </div>
      <section className="mt-10 grid gap-3 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">{t("privacy.clear.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("privacy.clear.body")}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="destructive"
            disabled={status === "clearing"}
            onClick={() => void clear()}
          >
            <Trash2 />
            {t("privacy.clear.action")}
          </Button>
          {status === "cleared" && (
            <p role="status" className="text-sm">
              {t("privacy.clear.done")}
            </p>
          )}
        </div>
      </section>
    </article>
  )
}

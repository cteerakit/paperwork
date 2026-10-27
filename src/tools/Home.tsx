import { ShieldCheck } from "lucide-react"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { TOOLS } from "./registry"
import { preloadTool } from "./loaders"

export function Home() {
  const { t } = useTranslation()
  useEffect(() => {
    const warmTools = () => TOOLS.forEach(({ id }) => preloadTool(id))
    if ("requestIdleCallback" in window) {
      const idle = window.requestIdleCallback(warmTools, { timeout: 2000 })
      return () => window.cancelIdleCallback(idle)
    }
    const timer = setTimeout(warmTools, 1000)
    return () => clearTimeout(timer)
  }, [])
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{t("home.title")}</h1>
        <p className="mt-3 text-muted-foreground text-pretty">{t("home.subtitle")}</p>
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-sm text-emerald-700 dark:text-emerald-400">
          <ShieldCheck className="size-4" />
          {t("common.privacy")}
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TOOLS.map(({ id, path, icon: Icon, accent }) => (
          <Link
            key={id}
            to={path}
            onPointerEnter={() => preloadTool(id)}
            onFocus={() => preloadTool(id)}
            onTouchStart={() => preloadTool(id)}
            className="group rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <div className={`grid size-10 place-items-center rounded-lg ${accent}`}>
              <Icon className="size-5" />
            </div>
            <h2 className="mt-4 font-medium">{t(`tools.${id}.title`)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t(`tools.${id}.description`)}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

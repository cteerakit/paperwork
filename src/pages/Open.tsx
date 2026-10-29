import { FileText } from "lucide-react"
import { useEffect, useSyncExternalStore } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useSearchParams } from "react-router"
import { useFormat } from "@/hooks/useFormat"
import { peekHandoff, setHandoff, subscribeHandoff } from "@/lib/handoff"
import { takeSharedFiles } from "@/lib/sharedFiles"
import { TOOLS } from "@/tools/registry"
import { preloadTool } from "@/tools/loaders"

/**
 * Where PDFs land when they are opened with, or shared to, the installed app. The files wait in the
 * handoff slot until a tool is chosen, and that tool picks them up.
 */
export function Open() {
  const { t } = useTranslation()
  const { bytes: formatBytes } = useFormat()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const files = useSyncExternalStore(subscribeHandoff, peekHandoff)
  const shared = params.has("shared")

  useEffect(() => {
    if (!shared) return
    // No cancellation: React runs this twice in development, and the first run is the one that
    // reads (and deletes) the files.
    void takeSharedFiles().then((received) => {
      if (received.length) setHandoff(received)
    })
  }, [shared])

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{t("open.title")}</h1>
        <p className="mt-3 text-muted-foreground text-pretty">
          {files.length ? t("open.subtitle") : t("open.none")}
        </p>
      </div>

      {files.length > 0 && (
        <ul className="mx-auto mt-6 grid max-w-md gap-2">
          {files.map((file, index) => (
            <li key={index} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-medium">{file.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(file.bytes.length)}</span>
            </li>
          ))}
          {files.length > 1 && (
            <li className="text-center text-xs text-muted-foreground">{t("open.multiple", { n: files.length })}</li>
          )}
        </ul>
      )}

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TOOLS.filter(({ fromImages }) => !fromImages).map(({ id, path, icon: Icon, accent }) => (
          <button
            key={id}
            type="button"
            disabled={!files.length}
            onPointerEnter={() => preloadTool(id)}
            onFocus={() => preloadTool(id)}
            onClick={() => void navigate(path)}
            className="group rounded-xl border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          >
            <div className={`grid size-10 place-items-center rounded-lg ${accent}`}>
              <Icon className="size-5" />
            </div>
            <h2 className="mt-4 font-medium">{t(`tools.${id}.title`)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t(`tools.${id}.description`)}</p>
          </button>
        ))}
      </div>

      {!files.length && (
        <p className="mt-8 text-center">
          <Link to="/" className="text-sm underline underline-offset-4 hover:text-muted-foreground">
            {t("common.allTools")}
          </Link>
        </p>
      )}
    </div>
  )
}

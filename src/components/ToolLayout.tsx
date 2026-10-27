import { ArrowLeft } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { cn } from "@/lib/utils"
import { TOOLS, type ToolInfo } from "@/tools/registry"

interface ToolLayoutProps {
  tool: ToolInfo["id"]
  children: ReactNode
  /** Extra content on the right of the title row (e.g. "Change file"). */
  actions?: ReactNode
  /** Wider layout for editors. */
  wide?: boolean
}

export function ToolLayout({ tool, children, actions, wide }: ToolLayoutProps) {
  const { t } = useTranslation()
  const info = TOOLS.find((x) => x.id === tool)!
  const Icon = info.icon
  return (
    <div className={cn("mx-auto px-4 py-6 sm:py-8", wide ? "max-w-[1600px]" : "max-w-6xl")}>
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 rounded-sm py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        <ArrowLeft className="size-4" />
        {t("common.allTools")}
      </Link>
      <div className="mt-4 mb-8 flex flex-wrap items-start gap-3 sm:gap-4">
        <div className={`grid size-12 shrink-0 place-items-center rounded-xl ${info.accent}`}>
          <Icon className="size-6" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">{t(`tools.${tool}.title`)}</h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{t(`tools.${tool}.description`)}</p>
        </div>
        {actions && <div className="flex w-full min-w-0 flex-wrap gap-2 sm:w-auto">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

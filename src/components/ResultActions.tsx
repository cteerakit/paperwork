import { ArrowRight, Download } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ToolResult } from "@/hooks/useResult"
import { downloadPdf } from "@/lib/download"
import { setHandoff } from "@/lib/handoff"
import { TOOLS, type ToolInfo } from "@/tools/registry"

/** Download the result again, or carry it straight into another tool. */
export function ResultActions({
  result,
  tool,
  showDownload = true,
}: {
  result: ToolResult
  tool: ToolInfo["id"]
  showDownload?: boolean
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const continueIn = (target: ToolInfo) => {
    setHandoff(result)
    void navigate(target.path)
  }
  return (
    <div className="flex flex-wrap items-center gap-2" role="status">
      {showDownload && (
        <Button variant="outline" onClick={() => downloadPdf(result.bytes, result.name)}>
          <Download />
          {t("common.download")}
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" />}>
          <ArrowRight />
          {t("common.continueIn")}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-52">
          {TOOLS.filter(({ id, fromImages }) => id !== tool && !fromImages).map((target) => (
            <DropdownMenuItem key={target.id} onClick={() => continueIn(target)}>
              <target.icon />
              {t(`tools.${target.id}.title`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

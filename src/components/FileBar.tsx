import { FileText, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { useFormat } from "@/hooks/useFormat"
import type { LoadedPdf } from "@/lib/render/pdfjs"

/** Shows the open file with a button to close it and pick another. */
export function FileBar({ pdf, onClose }: { pdf: LoadedPdf; onClose: () => void }) {
  const { t } = useTranslation()
  const { bytes } = useFormat()
  return (
    <div className="relative flex min-w-0 flex-wrap items-center gap-2 pr-14 sm:flex-nowrap rounded-lg border bg-card px-3 py-2 text-sm">
      <FileText className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 basis-[calc(100%-2rem)] truncate font-medium sm:basis-auto">{pdf.name}</span>
      <span className="min-w-0 text-xs text-muted-foreground sm:shrink-0 sm:text-sm">
        · {t("common.pageCount", { count: pdf.pageCount })} · {bytes(pdf.bytes.length)}
      </span>
      <Button variant="ghost" size="icon-xs" className="absolute top-1/2 right-2 -translate-y-1/2" onClick={onClose} aria-label={t("common.closeFile")}>
        <X />
      </Button>
    </div>
  )
}

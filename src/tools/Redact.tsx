import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FileBar } from "@/components/FileBar"
import { FileDropzone } from "@/components/FileDropzone"
import { RedactionPage } from "@/components/RedactionPage"
import { Spinner } from "@/components/Spinner"
import { ToolLayout } from "@/components/ToolLayout"
import { Button } from "@/components/ui/button"
import { usePdfFile, useTask } from "@/hooks/usePdfFile"
import { downloadPdf, outputName } from "@/lib/download"
import type { Redaction } from "@/lib/pdf/redact"
import { exportRedactedPdf } from "@/lib/pdf/redactClient"
import type { LoadedPdf } from "@/lib/render/pdfjs"

export default function Redact() {
  const { pdf, loading, open, reset } = usePdfFile()
  return (
    <ToolLayout tool="redact">
      {pdf ? (
        <Editor key={pdf.id} pdf={pdf} onClose={reset} />
      ) : loading ? (
        <Spinner />
      ) : (
        <FileDropzone onFiles={([file]) => open(file)} />
      )}
    </ToolLayout>
  )
}

function Editor({ pdf, onClose }: { pdf: LoadedPdf; onClose: () => void }) {
  const { t } = useTranslation()
  const { busy, run } = useTask()
  const [page, setPage] = useState(0)
  const [selections, setSelections] = useState<Redaction[][]>([])
  const areas = selections.flat()
  const [progress, setProgress] = useState(0)
  const save = () =>
    run(async () => {
      setProgress(0)
      const bytes = await exportRedactedPdf(pdf.bytes, areas, setProgress)
      downloadPdf(bytes, outputName(pdf.name, "redacted"))
      toast.success(t("common.done"))
    })
  return (
    <div className="grid gap-4">
      <FileBar pdf={pdf} onClose={busy ? () => {} : onClose} />
      <p className="rounded-lg border bg-muted/40 p-3 text-sm">
        {t("tools.redact.notice")}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          disabled={busy || page === 0}
          onClick={() => setPage(page - 1)}
        >
          {t("tools.redact.previous")}
        </Button>
        <span className="text-sm" aria-live="polite">
          {page + 1} / {pdf.pageCount}
        </span>
        <Button
          variant="outline"
          disabled={busy || page === pdf.pageCount - 1}
          onClick={() => setPage(page + 1)}
        >
          {t("tools.redact.next")}
        </Button>
        <Button
          variant="outline"
          disabled={busy || !areas.length}
          onClick={() => setSelections(selections.slice(0, -1))}
        >
          {t("tools.redact.undo")}
        </Button>
        <Button
          variant="outline"
          disabled={busy || !areas.length}
          onClick={() => setSelections([])}
        >
          {t("tools.redact.clear")}
        </Button>
        <Button disabled={busy || !areas.length} onClick={save}>
          {busy ? `${progress} / ${pdf.pageCount}` : t("tools.redact.save")}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {t("tools.redact.instructions", { count: areas.length })}
      </p>
      <RedactionPage
        key={page}
        pdf={pdf}
        page={page}
        areas={areas}
        disabled={busy}
        onMark={(selected) =>
          setSelections((previous) => [...previous, selected])
        }
      />
    </div>
  )
}

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FileBar } from "@/components/FileBar"
import { FileDropzone } from "@/components/FileDropzone"
import { ResultActions } from "@/components/ResultActions"
import { RedactionPage } from "@/components/RedactionPage"
import { RedactionSearch } from "@/components/RedactionSearch"
import { Spinner } from "@/components/Spinner"
import { ToolLayout } from "@/components/ToolLayout"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { usePdfFile, useTask } from "@/hooks/usePdfFile"
import { useResult } from "@/hooks/useResult"
import { outputName } from "@/lib/download"
import type { Redaction } from "@/lib/pdf/redact"
import { exportRedactedPdf } from "@/lib/pdf/redactClient"
import type { TextMatch } from "@/lib/pdf/textSearch"
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
  const { result: output, deliver } = useResult()
  const [page, setPage] = useState(0)
  const [selections, setSelections] = useState<Redaction[][]>([])
  const areas = selections.flat()
  // Search results are reviewed on the page first; "redact all" turns them into one undoable selection.
  const [matches, setMatches] = useState<TextMatch[]>([])
  const [progress, setProgress] = useState(0)
  const [removeHiddenInfo, setRemoveHiddenInfo] = useState(true)
  const save = () =>
    run(async () => {
      setProgress(0)
      const bytes = await exportRedactedPdf(
        pdf.bytes,
        areas,
        setProgress,
        removeHiddenInfo
      )
      deliver(bytes, outputName(pdf.name, "redacted"))
      toast.success(t("common.done"))
    })
  return (
    <div className="grid gap-4">
      <FileBar pdf={pdf} onClose={busy ? () => {} : onClose} />
      {output && <ResultActions result={output} tool="redact" />}
      <p className="rounded-lg border bg-muted/40 p-3 text-sm">
        {t("tools.redact.notice")}
      </p>
      <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
        <div className="grid gap-1">
          <Label htmlFor="remove-hidden-info">
            {t("tools.redact.removeHiddenInfo")}
          </Label>
          <p className="text-sm text-muted-foreground">
            {t("tools.redact.removeHiddenInfoHint")}
          </p>
        </div>
        <Switch
          id="remove-hidden-info"
          checked={removeHiddenInfo}
          disabled={busy}
          onCheckedChange={setRemoveHiddenInfo}
        />
      </div>
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
      <RedactionSearch
        pdf={pdf}
        disabled={busy}
        matches={matches}
        onMatches={setMatches}
        onPage={setPage}
        onMarkAll={() => {
          setSelections((previous) => [...previous, matches.flatMap((match) => match.areas)])
          setMatches([])
        }}
      />
      <p className="text-sm text-muted-foreground">
        {t("tools.redact.instructions", { count: areas.length })}
      </p>
      <RedactionPage
        key={page}
        pdf={pdf}
        page={page}
        areas={areas}
        highlights={matches.flatMap((match) => match.areas)}
        disabled={busy}
        onMark={(selected) =>
          setSelections((previous) => [...previous, selected])
        }
      />
    </div>
  )
}

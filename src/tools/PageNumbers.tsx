import { ListOrdered } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ColorField, Field, NumberField, RangeField, SliderField, usePageRange } from "@/components/fields"
import { FileBar } from "@/components/FileBar"
import { FileDropzone } from "@/components/FileDropzone"
import { ResultActions } from "@/components/ResultActions"
import { PagePreview } from "@/components/PagePreview"
import { Spinner } from "@/components/Spinner"
import { ToolLayout } from "@/components/ToolLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { usePdfFile, useTask } from "@/hooks/usePdfFile"
import { useResult } from "@/hooks/useResult"
import { useTextLayout } from "@/hooks/useTextLayout"
import { outputName } from "@/lib/download"
import { addPageNumbers, formatPageNumber, pageNumberPlacement, type Position } from "@/lib/pdf/pageNumbers"
import type { LoadedPdf } from "@/lib/render/pdfjs"
import { cn } from "@/lib/utils"

const POSITIONS: Position[] = ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"]

export default function PageNumbers() {
  const { pdf, loading, open, reset } = usePdfFile()
  return (
    <ToolLayout tool="pageNumbers">
      {!pdf ? (
        loading ? (
          <div className="grid h-64 place-items-center">
            <Spinner />
          </div>
        ) : (
          <FileDropzone onFiles={([f]) => open(f)} />
        )
      ) : (
        <Settings pdf={pdf} onClose={reset} />
      )}
    </ToolLayout>
  )
}

function Settings({ pdf, onClose }: { pdf: LoadedPdf; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const { busy, run, reportMissing } = useTask()
  const { result: output, deliver } = useResult()
  const [position, setPosition] = useState<Position>("bottom-center")
  // Track whether the user edited the template, so it can follow the UI language until then.
  const [customTemplate, setCustomTemplate] = useState<string>()
  const template = customTemplate ?? t("tools.pageNumbers.defaultTemplate")
  const [startAt, setStartAt] = useState(1)
  const [fontSize, setFontSize] = useState(11)
  const [color, setColor] = useState("#333333")
  const [range, setRange] = useState("")
  const { pages, error } = usePageRange(range, pdf.pageCount)

  const previewPage = pages[0] ?? 0
  const total = startAt + pages.length - 1
  const label = formatPageNumber(template, startAt, Math.max(total, startAt))
  const preview = useTextLayout(label, { fontSize, lang: i18n.resolvedLanguage })

  const apply = () =>
    run(async () => {
      const result = await addPageNumbers(pdf.bytes, {
        position,
        template,
        startAt: Number.isFinite(startAt) ? startAt : 1,
        pages,
        fontSize,
        color,
        lang: i18n.resolvedLanguage,
      })
      reportMissing(result.missing)
      deliver(result.bytes, outputName(pdf.name, "numbered"))
      toast.success(t("common.done"))
    })

  const size = pdf.pageSizes[previewPage]
  const placement =
    preview && pageNumberPlacement(position, size.width, size.height, preview.layout.width, preview.layout.height)

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid min-w-0 content-start gap-4">
        <FileBar pdf={pdf} onClose={onClose} />
        <div className="grid min-w-0 grid-cols-1 place-items-center rounded-xl bg-muted/50 p-3 sm:p-6">
          <PagePreview doc={pdf.doc} index={previewPage} size={size} width={Math.min(480, size.width * 0.8)}>
            {preview && placement && (
              <path d={preview.path} fill={color} transform={`translate(${placement.x} ${placement.y})`} />
            )}
          </PagePreview>
          <p className="mt-3 text-xs text-muted-foreground">{t("common.previewOfPage", { n: previewPage + 1 })}</p>
        </div>
      </div>

      <aside className="grid content-start gap-5 rounded-xl border bg-card p-4 lg:sticky lg:top-20">
        <Field label={t("tools.pageNumbers.position")}>
          <div className="grid w-fit grid-cols-3 gap-1.5 rounded-lg border bg-muted/40 p-2">
            {POSITIONS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPosition(p)}
                aria-label={t(`tools.pageNumbers.positions.${p}`)}
                aria-pressed={position === p}
                title={t(`tools.pageNumbers.positions.${p}`)}
                className={cn(
                  "grid h-9 w-12 rounded border bg-background p-1",
                  p.startsWith("top") ? "items-start" : "items-end",
                  p.endsWith("left") ? "justify-items-start" : p.endsWith("right") ? "justify-items-end" : "justify-items-center",
                  position === p && "border-primary ring-2 ring-primary/30"
                )}
              >
                <span className={cn("h-1.5 w-4 rounded-sm", position === p ? "bg-primary" : "bg-muted-foreground/40")} />
              </button>
            ))}
          </div>
        </Field>
        <Field label={t("tools.pageNumbers.template")} hint={t("tools.pageNumbers.templateHint")}>
          <Input value={template} onChange={(e) => setCustomTemplate(e.target.value)} />
        </Field>
        <NumberField label={t("tools.pageNumbers.startAt")} value={startAt} min={0} onChange={setStartAt} />
        <SliderField label={t("common.fontSize")} value={fontSize} min={6} max={36} onChange={setFontSize} format={(v) => `${v} pt`} />
        <ColorField label={t("common.color")} value={color} onChange={setColor} />
        <RangeField value={range} onChange={setRange} error={error} />
        <Button onClick={apply} disabled={busy || Boolean(error) || template.trim() === ""}>
          {busy ? <Spinner className="size-4 text-current" /> : <ListOrdered />}
          {t("tools.pageNumbers.action")}
        </Button>
        {output && <ResultActions result={output} tool="pageNumbers" />}
      </aside>
    </div>
  )
}

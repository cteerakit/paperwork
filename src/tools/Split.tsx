import { Scissors } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field, NumberField } from "@/components/fields"
import { FileBar } from "@/components/FileBar"
import { FileDropzone } from "@/components/FileDropzone"
import { PageThumbnail } from "@/components/PageThumbnail"
import { Spinner } from "@/components/Spinner"
import { ToolLayout } from "@/components/ToolLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { usePdfFile, useTask } from "@/hooks/usePdfFile"
import { downloadPdf, downloadZip, outputName } from "@/lib/download"
import { splitPdf } from "@/lib/pdf/pages"
import { chunkPages, formatRanges, PageRangeError, parseRangeGroups } from "@/lib/pdf/ranges"

type Mode = "ranges" | "every" | "single"

export default function Split() {
  const { t } = useTranslation()
  const { pdf, loading, open, reset } = usePdfFile()
  const { busy, run } = useTask()
  const [mode, setMode] = useState<Mode>("ranges")
  const [ranges, setRanges] = useState("")
  const [every, setEvery] = useState(2)

  let groups: number[][] = []
  let error: string | undefined
  if (pdf) {
    try {
      groups =
        mode === "single"
          ? chunkPages(pdf.pageCount, 1)
          : mode === "every"
            ? chunkPages(pdf.pageCount, every)
            : parseRangeGroups(ranges, pdf.pageCount)
    } catch (e) {
      if (!(e instanceof PageRangeError)) throw e
      error = mode === "ranges" && ranges.trim() === "" ? undefined : t(`errors.range.${e.code}`, e.values)
    }
  }

  const split = () =>
    run(async () => {
      const outputs = await splitPdf(pdf!.bytes, groups)
      const named = outputs.map((bytes, i) => ({
        name: outputName(pdf!.name, `pages-${formatRanges(groups[i]).replace(/, /g, "_")}`),
        bytes,
      }))
      if (named.length === 1) downloadPdf(named[0].bytes, named[0].name)
      else downloadZip(named, outputName(pdf!.name, "split", "zip"))
      toast.success(t("common.done"))
    })

  return (
    <ToolLayout tool="split">
      {!pdf ? (
        loading ? (
          <div className="grid h-64 place-items-center">
            <Spinner />
          </div>
        ) : (
          <FileDropzone onFiles={([f]) => open(f)} />
        )
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid min-w-0 content-start gap-4">
            <FileBar pdf={pdf} onClose={reset} />
            <div className="grid gap-3">
              {groups.slice(0, 50).map((group, i) => (
                <div key={i} className="rounded-lg border bg-card p-3">
                  <p className="mb-2 text-sm font-medium">
                    {t("tools.split.fileN", { n: i + 1 })}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {t("common.pagesList", { pages: formatRanges(group) })}
                    </span>
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {group.slice(0, 12).map((p) => (
                      <PageThumbnail key={p} doc={pdf.doc} index={p} box={72} size={pdf.pageSizes[p]} />
                    ))}
                    {group.length > 12 && (
                      <div className="grid w-16 shrink-0 place-items-center text-sm text-muted-foreground">
                        +{group.length - 12}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {groups.length > 50 && (
                <p className="text-sm text-muted-foreground">{t("tools.split.andMore", { count: groups.length - 50 })}</p>
              )}
            </div>
          </div>

          <aside className="grid content-start gap-5 rounded-xl border bg-card p-4 lg:sticky lg:top-20">
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="gap-3">
              {(["ranges", "every", "single"] as const).map((m) => (
                <Label key={m} className="flex cursor-pointer items-start gap-3 font-normal">
                  <RadioGroupItem value={m} className="mt-0.5" />
                  <span>
                    <span className="block font-medium">{t(`tools.split.modes.${m}`)}</span>
                    <span className="block text-xs text-muted-foreground">{t(`tools.split.modes.${m}Hint`)}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>

            {mode === "ranges" && (
              <Field
                label={t("tools.split.rangesLabel")}
                hint={error ? <span className="text-destructive">{error}</span> : t("tools.split.rangesHint")}
              >
                <Input
                  value={ranges}
                  onChange={(e) => setRanges(e.target.value)}
                  placeholder="1-3, 4-6, 7"
                  aria-invalid={Boolean(error)}
                />
              </Field>
            )}
            {mode === "every" && (
              <NumberField label={t("tools.split.everyLabel")} value={every} min={1} max={pdf.pageCount} onChange={setEvery} />
            )}
            {mode === "every" && error && <p className="text-xs text-destructive">{error}</p>}

            <Button onClick={split} disabled={busy || groups.length === 0}>
              {busy ? <Spinner className="size-4 text-current" /> : <Scissors />}
              {t("tools.split.action", { count: groups.length })}
            </Button>
          </aside>
        </div>
      )}
    </ToolLayout>
  )
}

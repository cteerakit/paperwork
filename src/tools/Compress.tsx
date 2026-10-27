import { Minimize2, TriangleAlert } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { FileBar } from "@/components/FileBar"
import { FileDropzone } from "@/components/FileDropzone"
import { ResultActions } from "@/components/ResultActions"
import { Spinner } from "@/components/Spinner"
import { ToolLayout } from "@/components/ToolLayout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useFormat } from "@/hooks/useFormat"
import { usePdfFile, useTask } from "@/hooks/usePdfFile"
import { outputName } from "@/lib/download"
import { compressPdf, type CompressionLevel } from "@/lib/pdf/compress"
import { recodeJpeg, renderPageToJpeg } from "@/lib/render/pdfjs"
import { cn } from "@/lib/utils"

const LEVELS: CompressionLevel[] = ["light", "medium", "strong"]

export default function Compress() {
  const { t } = useTranslation()
  const format = useFormat()
  const { pdf, loading, open, reset } = usePdfFile()
  const { busy, run } = useTask()
  const [level, setLevel] = useState<CompressionLevel>("medium")
  const [progress, setProgress] = useState<number>()
  const [result, setResult] = useState<{ bytes: Uint8Array; level: CompressionLevel }>()

  const close = () => {
    reset()
    setResult(undefined)
  }

  const compress = () =>
    run(async () => {
      setResult(undefined)
      setProgress(0)
      try {
        const bytes = await compressPdf(pdf!.bytes, level, {
          recodeJpeg,
          rasterize: (i) => renderPageToJpeg(pdf!.doc, i, 110, 0.6),
          onProgress: (done, total) => setProgress(done / total),
        })
        setResult({ bytes, level })
      } finally {
        setProgress(undefined)
      }
    })

  const saved = result ? 1 - result.bytes.length / pdf!.bytes.length : 0

  return (
    <ToolLayout tool="compress">
      {!pdf ? (
        loading ? (
          <div className="grid h-64 place-items-center">
            <Spinner />
          </div>
        ) : (
          <FileDropzone onFiles={([f]) => open(f)} />
        )
      ) : (
        <div className="mx-auto grid max-w-2xl gap-5">
          <FileBar pdf={pdf} onClose={close} />

          <RadioGroup
            value={level}
            onValueChange={(v) => {
              setLevel(v as CompressionLevel)
              setResult(undefined)
            }}
            className="grid gap-3 sm:grid-cols-3"
          >
            {LEVELS.map((l) => (
              <Label
                key={l}
                className={cn(
                  "flex cursor-pointer flex-col items-start gap-1.5 rounded-xl border bg-card p-4 font-normal transition-colors",
                  level === l && "border-primary ring-2 ring-primary/20"
                )}
              >
                <span className="flex items-center gap-2 font-medium">
                  <RadioGroupItem value={l} />
                  {t(`tools.compress.levels.${l}`)}
                </span>
                <span className="text-xs text-muted-foreground">{t(`tools.compress.levels.${l}Hint`)}</span>
              </Label>
            ))}
          </RadioGroup>

          {level === "strong" && (
            <Alert>
              <TriangleAlert />
              <AlertDescription>{t("tools.compress.strongWarning")}</AlertDescription>
            </Alert>
          )}

          {progress !== undefined && <Progress value={progress * 100} />}

          {result ? (
            <div className="grid gap-4 rounded-xl border bg-card p-5">
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label={t("tools.compress.before")} value={format.bytes(pdf.bytes.length)} />
                <Stat label={t("tools.compress.after")} value={format.bytes(result.bytes.length)} />
                <Stat
                  label={t("tools.compress.saved")}
                  value={saved > 0.005 ? format.percent(saved) : "—"}
                  highlight={saved > 0.005}
                />
              </div>
              {saved <= 0.005 && <p className="text-center text-sm text-muted-foreground">{t("tools.compress.noGain")}</p>}
              {saved > 0.005 && (
                <ResultActions
                  result={{ bytes: result.bytes, name: outputName(pdf.name, "compressed") }}
                  tool="compress"
                />
              )}
            </div>
          ) : (
            <Button onClick={compress} disabled={busy}>
              {busy ? <Spinner className="size-4 text-current" /> : <Minimize2 />}
              {t("tools.compress.action")}
            </Button>
          )}
        </div>
      )}
    </ToolLayout>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-semibold tabular-nums", highlight && "text-emerald-600 dark:text-emerald-400")}>
        {value}
      </p>
    </div>
  )
}

import { Download, Images, TriangleAlert } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field, RangeField, SliderField, usePageRange } from "@/components/fields"
import { FileBar } from "@/components/FileBar"
import { FileDropzone } from "@/components/FileDropzone"
import { Spinner } from "@/components/Spinner"
import { ToolLayout } from "@/components/ToolLayout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { usePdfFile, useTask } from "@/hooks/usePdfFile"
import { downloadBlob, downloadZip, outputName } from "@/lib/download"
import { exportSize, renderPageToBlob, type LoadedPdf } from "@/lib/render/pdfjs"
import { cn } from "@/lib/utils"

type Format = "png" | "jpg"

const FORMATS: Record<Format, { type: "image/png" | "image/jpeg"; ext: string }> = {
  png: { type: "image/png", ext: "png" },
  jpg: { type: "image/jpeg", ext: "jpg" },
}
const RESOLUTIONS = [72, 150, 300]
/** Past this many pixels in total, the images alone can fill a browser's memory. */
const MEMORY_WARNING_PIXELS = 400_000_000

export default function ToImages() {
  const { pdf, loading, open, reset } = usePdfFile()
  return (
    <ToolLayout tool="toImages">
      {!pdf ? (
        loading ? (
          <div className="grid h-64 place-items-center">
            <Spinner />
          </div>
        ) : (
          <FileDropzone onFiles={([f]) => open(f)} />
        )
      ) : (
        <Settings key={pdf.id} pdf={pdf} onClose={reset} />
      )}
    </ToolLayout>
  )
}

function Settings({ pdf, onClose }: { pdf: LoadedPdf; onClose: () => void }) {
  const { t } = useTranslation()
  const { busy, run } = useTask()
  const [format, setFormat] = useState<Format>("png")
  const [dpi, setDpi] = useState(150)
  const [quality, setQuality] = useState(90)
  const [range, setRange] = useState("")
  const [progress, setProgress] = useState<number>()
  const { pages, error } = usePageRange(range, pdf.pageCount)

  const sizes = pages.map((page) => exportSize(pdf.pageSizes[page], dpi))
  const totalPixels = sizes.reduce((sum, { width, height }) => sum + width * height, 0)
  const first = sizes[0]

  const convert = () =>
    run(async () => {
      const { type, ext } = FORMATS[format]
      const digits = String(pdf.pageCount).length
      const files: { name: string; bytes: Uint8Array }[] = []
      setProgress(0)
      try {
        for (const [n, page] of pages.entries()) {
          const blob = await renderPageToBlob(pdf.doc, page, dpi, type, quality / 100)
          const number = String(page + 1).padStart(digits, "0")
          files.push({
            name: outputName(pdf.name, `page-${number}`, ext),
            bytes: new Uint8Array(await blob.arrayBuffer()),
          })
          setProgress((n + 1) / pages.length)
        }
      } finally {
        setProgress(undefined)
      }
      if (files.length === 1) downloadBlob(new Blob([files[0].bytes as BlobPart], { type }), files[0].name)
      else downloadZip(files, outputName(pdf.name, "images", "zip"))
      toast.success(t("common.done"))
    })

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <FileBar pdf={pdf} onClose={busy ? () => {} : onClose} />

      <div className="grid gap-5 rounded-xl border bg-card p-5">
        <RadioGroup
          value={format}
          onValueChange={(value) => setFormat(value as Format)}
          disabled={busy}
          className="grid gap-3 sm:grid-cols-2"
          aria-label={t("tools.toImages.format")}
        >
          {(Object.keys(FORMATS) as Format[]).map((value) => (
            <Label
              key={value}
              className={cn(
                "flex cursor-pointer flex-col items-start gap-1.5 rounded-xl border p-4 font-normal transition-colors",
                format === value && "border-primary ring-2 ring-primary/20"
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                <RadioGroupItem value={value} />
                {t(`tools.toImages.formats.${value}`)}
              </span>
              <span className="text-xs text-muted-foreground">{t(`tools.toImages.formats.${value}Hint`)}</span>
            </Label>
          ))}
        </RadioGroup>

        <Field label={t("tools.toImages.resolution")}>
          <ToggleGroup
            variant="outline"
            value={[String(dpi)]}
            onValueChange={(value) => value[0] && setDpi(Number(value[0]))}
            disabled={busy}
          >
            {RESOLUTIONS.map((value) => (
              <ToggleGroupItem key={value} value={String(value)}>
                {t(`tools.toImages.dpi.${value}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>

        {format === "jpg" && (
          <SliderField
            label={t("tools.toImages.quality")}
            value={quality}
            min={50}
            max={100}
            step={5}
            onChange={setQuality}
            format={(value) => `${value}%`}
          />
        )}

        <RangeField value={range} onChange={setRange} error={error} />

        {first && (
          <p className="text-sm text-muted-foreground">
            {t("tools.toImages.summary", { count: pages.length, width: first.width, height: first.height })}
          </p>
        )}
      </div>

      {totalPixels > MEMORY_WARNING_PIXELS && (
        <Alert>
          <TriangleAlert />
          <AlertDescription>{t("tools.toImages.memoryWarning")}</AlertDescription>
        </Alert>
      )}

      {progress !== undefined && <Progress value={progress * 100} />}

      <Button onClick={convert} disabled={busy || Boolean(error)}>
        {busy ? <Spinner className="size-4 text-current" /> : pages.length > 1 ? <Images /> : <Download />}
        {t("tools.toImages.action")}
      </Button>
    </div>
  )
}

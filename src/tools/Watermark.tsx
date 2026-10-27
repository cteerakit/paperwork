import { Stamp, Upload } from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { newId } from "@/components/editor/types"
import { useAnnotations } from "@/components/editor/useAnnotations"
import { Workspace, type WorkspaceApi } from "@/components/editor/Workspace"
import { ColorField, Field, RangeField, SliderField, usePageRange } from "@/components/fields"
import { FileBar } from "@/components/FileBar"
import { FileDropzone } from "@/components/FileDropzone"
import { PagePreview } from "@/components/PagePreview"
import { Spinner } from "@/components/Spinner"
import { ToolLayout } from "@/components/ToolLayout"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { usePdfFile, useTask } from "@/hooks/usePdfFile"
import { useTextLayout } from "@/hooks/useTextLayout"
import type { ImageObject } from "@/lib/annotate/model"
import { downloadPdf, outputName } from "@/lib/download"
import { fitSize, readImageFile } from "@/lib/images"
import { addImageStamp, addTextWatermark, centeredPlacement, tileCenters } from "@/lib/pdf/watermark"
import type { LoadedPdf } from "@/lib/render/pdfjs"

export default function Watermark() {
  const { t } = useTranslation()
  const { pdf, loading, open, reset } = usePdfFile()
  return (
    <ToolLayout tool="watermark" wide={Boolean(pdf)}>
      {!pdf ? (
        loading ? (
          <div className="grid h-64 place-items-center">
            <Spinner />
          </div>
        ) : (
          <FileDropzone onFiles={([f]) => open(f)} />
        )
      ) : (
        <div className="grid gap-4">
          <FileBar pdf={pdf} onClose={reset} />
          <Tabs defaultValue="text">
            <TabsList>
              <TabsTrigger value="text">{t("tools.watermark.textTab")}</TabsTrigger>
              <TabsTrigger value="image">{t("tools.watermark.imageTab")}</TabsTrigger>
            </TabsList>
            <TabsContent value="text" className="pt-3">
              <TextWatermark pdf={pdf} />
            </TabsContent>
            <TabsContent value="image" className="pt-3">
              <ImageWatermark key={pdf.id} pdf={pdf} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </ToolLayout>
  )
}

function TextWatermark({ pdf }: { pdf: LoadedPdf }) {
  const { t, i18n } = useTranslation()
  const { busy, run, reportMissing } = useTask()
  const [text, setText] = useState(() => t("tools.watermark.defaultText"))
  const [fontSize, setFontSize] = useState(56)
  const [color, setColor] = useState("#dc2626")
  const [opacity, setOpacity] = useState(0.2)
  const [angle, setAngle] = useState(45)
  const [layout, setLayout] = useState<"center" | "tile">("center")
  const [bold, setBold] = useState(true)
  const [range, setRange] = useState("")
  const { pages, error } = usePageRange(range, pdf.pageCount)

  const lang = i18n.resolvedLanguage
  const preview = useTextLayout(text || " ", { fontSize, weight: bold ? "bold" : "regular", align: "center", lang })
  const previewPage = pages[0] ?? 0
  const size = pdf.pageSizes[previewPage]
  const rotation = -angle

  const apply = () =>
    run(async () => {
      const result = await addTextWatermark(pdf.bytes, { text, fontSize, color, opacity, angle, layout, bold, pages, lang })
      reportMissing(result.missing)
      downloadPdf(result.bytes, outputName(pdf.name, "watermarked"))
      toast.success(t("common.done"))
    })

  const placements =
    preview &&
    (layout === "tile"
      ? tileCenters(size.width, size.height, preview.layout.width, preview.layout.height, rotation, fontSize)
      : [[size.width / 2, size.height / 2] as [number, number]]
    ).map(([cx, cy]) => centeredPlacement(cx, cy, preview.layout.width, preview.layout.height, rotation))

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid min-w-0 grid-cols-1 place-items-center rounded-xl bg-muted/50 p-3 sm:p-6">
        <PagePreview doc={pdf.doc} index={previewPage} size={size} width={Math.min(520, size.width * 0.85)}>
          {preview && (
            <g opacity={opacity} fill={color}>
              {placements?.map((p, i) => (
                <path key={i} d={preview.path} transform={`translate(${p.x} ${p.y}) rotate(${p.rotation})`} />
              ))}
            </g>
          )}
        </PagePreview>
        <p className="mt-3 text-xs text-muted-foreground">{t("common.previewOfPage", { n: previewPage + 1 })}</p>
      </div>

      <aside className="grid content-start gap-5 rounded-xl border bg-card p-4 lg:sticky lg:top-20">
        <Field label={t("tools.watermark.text")} hint={t("tools.watermark.textHint")}>
          <Textarea rows={3} className="min-h-24 resize-y" value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <Field label={t("tools.watermark.layout")}>
          <ToggleGroup
            variant="outline"
            value={[layout]}
            onValueChange={(v) => v[0] && setLayout(v[0] as "center" | "tile")}
          >
            <ToggleGroupItem value="center">{t("tools.watermark.center")}</ToggleGroupItem>
            <ToggleGroupItem value="tile">{t("tools.watermark.tile")}</ToggleGroupItem>
          </ToggleGroup>
        </Field>
        <SliderField label={t("common.fontSize")} value={fontSize} min={12} max={160} onChange={setFontSize} format={(v) => `${v} pt`} />
        <SliderField label={t("tools.watermark.angle")} value={angle} min={-90} max={90} step={5} onChange={setAngle} format={(v) => `${v}°`} />
        <SliderField
          label={t("editor.props.opacity")}
          value={Math.round(opacity * 100)}
          min={5}
          max={100}
          step={5}
          onChange={(v) => setOpacity(v / 100)}
          format={(v) => `${v}%`}
        />
        <ColorField label={t("common.color")} value={color} onChange={setColor} />
        <div className="flex items-center justify-between">
          <Label>{t("editor.props.bold")}</Label>
          <Switch checked={bold} onCheckedChange={setBold} />
        </div>
        <RangeField value={range} onChange={setRange} error={error} />
        <Button onClick={apply} disabled={busy || Boolean(error) || !text.trim()}>
          {busy ? <Spinner className="size-4 text-current" /> : <Stamp />}
          {t("tools.watermark.action")}
        </Button>
      </aside>
    </div>
  )
}

function ImageWatermark({ pdf }: { pdf: LoadedPdf }) {
  const { t, i18n } = useTranslation()
  const api = useAnnotations()
  const { busy, run } = useTask()
  const [range, setRange] = useState("")
  const { pages, error } = usePageRange(range, pdf.pageCount)
  const stamp = api.objects.find((o): o is ImageObject => o.type === "image")

  const apply = () =>
    run(async () => {
      if (!stamp) return
      const bytes = await addImageStamp(pdf.bytes, {
        image: stamp.src,
        box: stamp,
        reference: pdf.pageSizes[stamp.page],
        opacity: stamp.opacity,
        pages,
      })
      downloadPdf(bytes, outputName(pdf.name, "stamped"))
      toast.success(t("common.done"))
    })

  return (
    <Workspace
      pdf={pdf}
      api={api}
      tools={["select"]}
      lang={i18n.resolvedLanguage}
      sidebar={(ws) => (
        <div className="grid gap-4 border-b pb-4">
          <StampPicker workspace={ws} hasStamp={Boolean(stamp)} onReplace={() => stamp && api.remove(stamp.id)} />
          <RangeField value={range} onChange={setRange} error={error} />
          <p className="text-xs text-muted-foreground">{t("tools.watermark.imageHint")}</p>
        </div>
      )}
      actions={
        <Button size="sm" onClick={apply} disabled={busy || !stamp || Boolean(error)}>
          {busy ? <Spinner className="size-4 text-current" /> : <Stamp />}
          {t("tools.watermark.action")}
        </Button>
      }
    />
  )
}

function StampPicker({ workspace, hasStamp, onReplace }: { workspace: WorkspaceApi; hasStamp: boolean; onReplace: () => void }) {
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ""
          if (!file) return
          try {
            const image = await readImageFile(file)
            const { pageSize, page } = workspace
            const box = fitSize(image.width, image.height, pageSize.width * 0.4, pageSize.height * 0.3)
            onReplace()
            workspace.add({
              id: newId(),
              type: "image",
              page,
              src: image.src,
              x: (pageSize.width - box.width) / 2,
              y: (pageSize.height - box.height) / 2,
              rotation: 0,
              opacity: 0.5,
              ...box,
            })
          } catch {
            toast.error(t("editor.imageError"))
          }
        }}
      />
      <Button variant={hasStamp ? "outline" : "default"} size="sm" onClick={() => input.current?.click()}>
        <Upload />
        {hasStamp ? t("tools.watermark.replaceImage") : t("tools.watermark.chooseImage")}
      </Button>
    </>
  )
}

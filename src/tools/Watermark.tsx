import { Check, Minus, Plus, Stamp, Upload } from "lucide-react"
import { useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { newId } from "@/components/editor/types"
import { useAnnotations } from "@/components/editor/useAnnotations"
import { Workspace, type WorkspaceApi } from "@/components/editor/Workspace"
import {
  ColorField,
  Field,
  RangeField,
  usePageRange,
} from "@/components/fields"
import { FileBar } from "@/components/FileBar"
import { FileDropzone } from "@/components/FileDropzone"
import { ResultActions } from "@/components/ResultActions"
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
import { useResult } from "@/hooks/useResult"
import { useTextLayout } from "@/hooks/useTextLayout"
import type { ImageObject } from "@/lib/annotate/model"
import type { FontFamily } from "@/lib/text/fonts"
import { outputName } from "@/lib/download"
import { fitSize, readImageFile } from "@/lib/images"
import {
  addImageStamp,
  addTextWatermark,
  centeredPlacement,
  tileCenters,
} from "@/lib/pdf/watermark"
import type { LoadedPdf } from "@/lib/render/pdfjs"

const FAMILIES: FontFamily[] = ["sans", "serif", "mono", "signature"]
const WATERMARK_COLORS = ["#dc2626", "#2563eb", "#6b7280", "#000000"]

function WatermarkColor({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const [custom, setCustom] = useState(
    () => !WATERMARK_COLORS.includes(value.toLowerCase())
  )
  return (
    <div className="grid gap-2 lg:gap-1.5">
      <Label id={`${id}-label`}>{t("common.color")}</Label>
      <div
        className="grid grid-cols-[repeat(4,minmax(0,1fr))_auto] gap-1"
        role="group"
        aria-labelledby={`${id}-label`}
      >
        {WATERMARK_COLORS.map((color) => (
          <Button
            key={color}
            type="button"
            variant={
              !custom && value.toLowerCase() === color ? "secondary" : "outline"
            }
            className="h-11 min-w-0 px-1 lg:h-8"
            aria-label={`${t("common.color")} ${color}`}
            aria-pressed={!custom && value.toLowerCase() === color}
            title={color.toUpperCase()}
            onClick={() => {
              setCustom(false)
              onChange(color)
            }}
          >
            <span
              className="flex size-6 items-center justify-center rounded-full border border-black/10 lg:size-5"
              style={{ backgroundColor: color }}
            >
              {!custom && value.toLowerCase() === color && (
                <Check className="size-4 text-white" />
              )}
            </span>
          </Button>
        ))}
        <Button
          type="button"
          variant={custom ? "secondary" : "outline"}
          className="h-11 px-2 lg:h-8"
          aria-expanded={custom}
          aria-controls={`${id}-custom`}
          onClick={() => setCustom(true)}
        >
          {t("common.custom")}
        </Button>
      </div>
      {custom && (
        <div id={`${id}-custom`} className="[&_input]:h-11 lg:[&_input]:h-8">
          <ColorField
            label={t("common.custom")}
            value={value}
            onChange={onChange}
          />
        </div>
      )}
    </div>
  )
}

function WatermarkValue({
  label,
  value,
  min,
  max,
  step,
  unit,
  presets,
  presetLabels,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  presets: number[]
  presetLabels?: string[]
  onChange: (value: number) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const [custom, setCustom] = useState(() => !presets.includes(value))
  const [draft, setDraft] = useState<string | null>(null)
  const clamp = (next: number) => Math.min(max, Math.max(min, Math.round(next)))
  return (
    <div className="grid gap-2 lg:gap-1.5">
      <Label id={`${id}-label`}>{label}</Label>
      <div
        className="grid grid-cols-[repeat(4,minmax(0,1fr))_auto] gap-1"
        role="group"
        aria-labelledby={`${id}-label`}
      >
        {presets.map((preset, index) => (
          <Button
            key={preset}
            type="button"
            variant={!custom && value === preset ? "secondary" : "outline"}
            aria-pressed={!custom && value === preset}
            title={`${preset}${unit === "pt" ? " pt" : unit}`}
            className="h-11 min-w-0 px-1 tabular-nums lg:h-8"
            onClick={() => {
              setCustom(false)
              setDraft(null)
              onChange(preset)
            }}
          >
            {presetLabels?.[index] ?? `${preset}${unit === "pt" ? "" : unit}`}
          </Button>
        ))}
        <Button
          type="button"
          variant={custom ? "secondary" : "outline"}
          className="h-11 px-2 lg:h-8"
          aria-expanded={custom}
          aria-controls={`${id}-custom`}
          onClick={() => setCustom(true)}
        >
          {t("common.custom")}
        </Button>
      </div>
      {custom && (
        <div
          id={`${id}-custom`}
          className="flex h-11 items-center rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 lg:h-8"
        >
          <Button
            type="button"
            variant="ghost"
            className="size-11 rounded-r-none lg:size-8"
            aria-label={`${label} −`}
            disabled={value <= min}
            onClick={() => {
              setDraft(null)
              onChange(clamp(value - step))
            }}
          >
            <Minus />
          </Button>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
            <input
              id={id}
              aria-labelledby={`${id}-label`}
              type="number"
              inputMode={min < 0 ? "text" : "numeric"}
              min={min}
              max={max}
              step={1}
              value={draft ?? value}
              className="h-10 w-16 min-w-0 [appearance:textfield] bg-transparent text-center text-base tabular-nums outline-none lg:h-7 lg:text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              onChange={(event) => {
                const raw = event.target.value
                setDraft(raw)
                const next = event.target.valueAsNumber
                if (Number.isFinite(next) && next >= min && next <= max)
                  onChange(Math.round(next))
              }}
              onBlur={() => {
                if (
                  draft !== null &&
                  draft.trim() !== "" &&
                  Number.isFinite(Number(draft))
                )
                  onChange(clamp(Number(draft)))
                setDraft(null)
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur()
              }}
            />
            <span className="text-sm text-muted-foreground">{unit}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="size-11 rounded-l-none lg:size-8"
            aria-label={`${label} +`}
            disabled={value >= max}
            onClick={() => {
              setDraft(null)
              onChange(clamp(value + step))
            }}
          >
            <Plus />
          </Button>
        </div>
      )}
    </div>
  )
}

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
              <TabsTrigger value="text">
                {t("tools.watermark.textTab")}
              </TabsTrigger>
              <TabsTrigger value="image">
                {t("tools.watermark.imageTab")}
              </TabsTrigger>
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
  const { result: output, deliver } = useResult()
  const [text, setText] = useState(() => t("tools.watermark.defaultText"))
  const [fontSize, setFontSize] = useState(56)
  const [color, setColor] = useState("#dc2626")
  const [opacity, setOpacity] = useState(0.2)
  const [angle, setAngle] = useState(45)
  const [layout, setLayout] = useState<"center" | "tile">("center")
  const [bold, setBold] = useState(true)
  const [family, setFamily] = useState<FontFamily>("sans")
  const [range, setRange] = useState("")
  const { pages, error } = usePageRange(range, pdf.pageCount)

  const lang = i18n.resolvedLanguage
  const preview = useTextLayout(text || " ", {
    fontSize,
    weight: bold ? "bold" : "regular",
    family,
    align: "center",
    lang,
  })
  const previewPage = pages[0] ?? 0
  const size = pdf.pageSizes[previewPage]
  const rotation = -angle

  const apply = () =>
    run(async () => {
      const result = await addTextWatermark(pdf.bytes, {
        text,
        fontSize,
        color,
        opacity,
        angle,
        layout,
        bold,
        family,
        pages,
        lang,
      })
      reportMissing(result.missing)
      deliver(result.bytes, outputName(pdf.name, "watermarked"))
      toast.success(t("common.done"))
    })

  const placements =
    preview &&
    (layout === "tile"
      ? tileCenters(
          size.width,
          size.height,
          preview.layout.width,
          preview.layout.height,
          rotation,
          fontSize
        )
      : [[size.width / 2, size.height / 2] as [number, number]]
    ).map(([cx, cy]) =>
      centeredPlacement(
        cx,
        cy,
        preview.layout.width,
        preview.layout.height,
        rotation
      )
    )

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid min-w-0 grid-cols-1 place-items-center rounded-xl bg-muted/50 p-3 sm:p-6">
        <PagePreview
          doc={pdf.doc}
          index={previewPage}
          size={size}
          width={Math.min(520, size.width * 0.85)}
        >
          {preview && (
            <g opacity={opacity} fill={color}>
              {placements?.map((p, i) => (
                <path
                  key={i}
                  d={preview.path}
                  transform={`translate(${p.x} ${p.y}) rotate(${p.rotation})`}
                />
              ))}
            </g>
          )}
        </PagePreview>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("common.previewOfPage", { n: previewPage + 1 })}
        </p>
      </div>

      <aside className="grid content-start gap-5 rounded-xl border bg-card p-4 lg:sticky lg:top-20 lg:gap-4">
        <Field
          label={t("tools.watermark.text")}
          hint={t("tools.watermark.textHint")}
        >
          <Textarea
            rows={3}
            className="min-h-24 resize-y"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </Field>
        <Field label={t("tools.watermark.layout")}>
          <ToggleGroup
            variant="outline"
            value={[layout]}
            onValueChange={(v) => v[0] && setLayout(v[0] as "center" | "tile")}
          >
            <ToggleGroupItem value="center">
              {t("tools.watermark.center")}
            </ToggleGroupItem>
            <ToggleGroupItem value="tile">
              {t("tools.watermark.tile")}
            </ToggleGroupItem>
          </ToggleGroup>
        </Field>
        <Field label={t("tools.watermark.font")}>
          <ToggleGroup
            variant="outline"
            className="flex-wrap"
            value={[family]}
            onValueChange={(v) => v[0] && setFamily(v[0] as FontFamily)}
          >
            {FAMILIES.map((value) => (
              <ToggleGroupItem key={value} value={value}>
                {t(`tools.watermark.fonts.${value}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
        <WatermarkValue
          label={t("common.fontSize")}
          value={fontSize}
          min={12}
          max={160}
          step={4}
          unit="pt"
          presets={[24, 40, 56, 80]}
          presetLabels={["S", "M", "L", "XL"]}
          onChange={setFontSize}
        />
        <WatermarkValue
          label={t("tools.watermark.angle")}
          value={angle}
          min={-90}
          max={90}
          step={5}
          unit="°"
          presets={[-45, 0, 45, 90]}
          onChange={setAngle}
        />
        <WatermarkValue
          label={t("editor.props.opacity")}
          value={Math.round(opacity * 100)}
          min={5}
          max={100}
          step={5}
          unit="%"
          presets={[10, 20, 50, 100]}
          onChange={(v) => setOpacity(v / 100)}
        />
        <WatermarkColor value={color} onChange={setColor} />
        <div className="flex items-center justify-between">
          <Label>{t("editor.props.bold")}</Label>
          <Switch checked={bold} onCheckedChange={setBold} />
        </div>
        <RangeField value={range} onChange={setRange} error={error} />
        <Button
          onClick={apply}
          disabled={busy || Boolean(error) || !text.trim()}
        >
          {busy ? <Spinner className="size-4 text-current" /> : <Stamp />}
          {t("tools.watermark.action")}
        </Button>
        {output && <ResultActions result={output} tool="watermark" />}
      </aside>
    </div>
  )
}

function ImageWatermark({ pdf }: { pdf: LoadedPdf }) {
  const { t, i18n } = useTranslation()
  const api = useAnnotations()
  const { busy, run } = useTask()
  const { result: output, deliver } = useResult()
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
      deliver(bytes, outputName(pdf.name, "stamped"))
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
          <StampPicker
            workspace={ws}
            hasStamp={Boolean(stamp)}
            onReplace={() => stamp && api.remove(stamp.id)}
          />
          <RangeField value={range} onChange={setRange} error={error} />
          <p className="text-xs text-muted-foreground">
            {t("tools.watermark.imageHint")}
          </p>
          {output && <ResultActions result={output} tool="watermark" />}
        </div>
      )}
      actions={
        <Button
          size="sm"
          onClick={apply}
          disabled={busy || !stamp || Boolean(error)}
        >
          {busy ? <Spinner className="size-4 text-current" /> : <Stamp />}
          {t("tools.watermark.action")}
        </Button>
      }
    />
  )
}

function StampPicker({
  workspace,
  hasStamp,
  onReplace,
}: {
  workspace: WorkspaceApi
  hasStamp: boolean
  onReplace: () => void
}) {
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
            const box = fitSize(
              image.width,
              image.height,
              pageSize.width * 0.4,
              pageSize.height * 0.3
            )
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
      <Button
        variant={hasStamp ? "outline" : "default"}
        size="sm"
        onClick={() => input.current?.click()}
      >
        <Upload />
        {hasStamp
          ? t("tools.watermark.replaceImage")
          : t("tools.watermark.chooseImage")}
      </Button>
    </>
  )
}

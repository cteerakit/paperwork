import { Download, Eraser, Upload } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import SignaturePad from "signature_pad"
import { toast } from "sonner"
import { placeSaved, SignatureLibrary, TYPED_SIZE } from "@/components/editor/SignatureLibrary"
import { useAnnotations } from "@/components/editor/useAnnotations"
import { useSignatureLibrary } from "@/components/editor/useSignatureLibrary"
import { Workspace, type WorkspaceApi } from "@/components/editor/Workspace"
import { FileBar } from "@/components/FileBar"
import { FileDropzone } from "@/components/FileDropzone"
import { ResultActions } from "@/components/ResultActions"
import { Spinner } from "@/components/Spinner"
import { ToolLayout } from "@/components/ToolLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { usePdfFile, useTask } from "@/hooks/usePdfFile"
import { useResult } from "@/hooks/useResult"
import { useTextLayout } from "@/hooks/useTextLayout"
import { outputName } from "@/lib/download"
import { readImageFile } from "@/lib/images"
import { applyAnnotations } from "@/lib/pdf/annotate"
import type { LoadedPdf } from "@/lib/render/pdfjs"
import { SAVED_CATEGORIES, type SavedCategory, type SavedContent } from "@/lib/signatures"
import { cn } from "@/lib/utils"

const INK = ["#111827", "#1d4ed8", "#0f766e"]

export default function Sign() {
  const { pdf, loading, open, reset } = usePdfFile()
  return (
    <ToolLayout tool="sign" wide={Boolean(pdf)}>
      {!pdf ? (
        loading ? (
          <div className="grid h-64 place-items-center">
            <Spinner />
          </div>
        ) : (
          <FileDropzone onFiles={([f]) => open(f)} />
        )
      ) : (
        <Editor key={pdf.id} pdf={pdf} onClose={reset} />
      )}
    </ToolLayout>
  )
}

function Editor({ pdf, onClose }: { pdf: LoadedPdf; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const api = useAnnotations()
  const { busy, run, reportMissing } = useTask()
  const { result: output, deliver } = useResult()

  const save = () =>
    run(async () => {
      const result = await applyAnnotations(pdf.bytes, api.objects, { lang: i18n.resolvedLanguage })
      reportMissing(result.missing)
      deliver(result.bytes, outputName(pdf.name, "signed"))
      toast.success(t("common.done"))
    })

  return (
    <div className="grid gap-3">
      <FileBar pdf={pdf} onClose={onClose} />
      {output && <ResultActions result={output} tool="sign" />}
      <Workspace
        pdf={pdf}
        api={api}
        tools={["select"]}
        lang={i18n.resolvedLanguage}
        sidebar={(ws) => <SignaturePicker workspace={ws} />}
        actions={
          <Button size="sm" onClick={save} disabled={busy || api.objects.length === 0}>
            {busy ? <Spinner className="size-4 text-current" /> : <Download />}
            {t("common.save")}
          </Button>
        }
      />
    </div>
  )
}

function SignaturePicker({ workspace }: { workspace: WorkspaceApi }) {
  const { t } = useTranslation()
  const library = useSignatureLibrary()
  const [category, setCategory] = useState<SavedCategory>("signature")

  const create = (content: SavedContent) => {
    placeSaved(workspace, library.add(content, category))
  }

  return (
    <div className="grid gap-4 border-b pb-4">
      <p className="text-sm font-medium">{t("tools.sign.create")}</p>
      <div className="grid gap-1.5">
        <p className="text-xs text-muted-foreground">{t("tools.sign.saveAs")}</p>
        <ToggleGroup
          variant="outline"
          size="sm"
          value={[category]}
          onValueChange={(value) => value[0] && setCategory(value[0] as SavedCategory)}
        >
          {SAVED_CATEGORIES.map((value) => (
            <ToggleGroupItem key={value} value={value}>
              {t(`tools.sign.categories.${value}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <Tabs defaultValue="draw">
        <TabsList className="w-full">
          <TabsTrigger value="draw">{t("tools.sign.draw")}</TabsTrigger>
          <TabsTrigger value="type">{t("tools.sign.type")}</TabsTrigger>
          <TabsTrigger value="upload">{t("tools.sign.upload")}</TabsTrigger>
        </TabsList>
        <TabsContent value="draw">
          <DrawPad onDone={create} />
        </TabsContent>
        <TabsContent value="type">
          <TypePad onDone={create} />
        </TabsContent>
        <TabsContent value="upload">
          <UploadPad onDone={create} />
        </TabsContent>
      </Tabs>

      <SignatureLibrary workspace={workspace} library={library} />
    </div>
  )
}

function InkPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-1.5" role="radiogroup" aria-label={t("common.color")}>
      {INK.map((c) => (
        <button
          key={c}
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className={cn("size-5 rounded-full ring-offset-2 ring-offset-background", value === c && "ring-2 ring-primary")}
          style={{ background: c }}
        />
      ))}
    </div>
  )
}

/** Crops a canvas to its non-transparent pixels and returns a PNG data URL. */
function trimCanvas(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!
  const { width, height } = canvas
  const data = ctx.getImageData(0, 0, width, height).data
  let [minX, minY, maxX, maxY] = [width, height, -1, -1]
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
    }
  }
  if (maxX < 0) return undefined
  const pad = 4
  const w = maxX - minX + 1 + pad * 2
  const h = maxY - minY + 1 + pad * 2
  const out = document.createElement("canvas")
  out.width = w
  out.height = h
  out.getContext("2d")!.drawImage(canvas, minX - pad, minY - pad, w, h, 0, 0, w, h)
  return { src: out.toDataURL("image/png"), width: w, height: h }
}

function DrawPad({ onDone }: { onDone: (content: SavedContent) => void }) {
  const { t } = useTranslation()
  const canvas = useRef<HTMLCanvasElement>(null)
  const pad = useRef<SignaturePad>(null)
  const [ink, setInk] = useState(INK[0])
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const el = canvas.current!
    const ratio = Math.max(window.devicePixelRatio || 1, 2)
    el.width = el.offsetWidth * ratio
    el.height = el.offsetHeight * ratio
    el.getContext("2d")!.scale(ratio, ratio)
    const signature = new SignaturePad(el, { penColor: INK[0], minWidth: 0.8, maxWidth: 2.6 })
    signature.addEventListener("endStroke", () => setEmpty(signature.isEmpty()))
    pad.current = signature
    const observer = new ResizeObserver(() => {
      const width = el.offsetWidth * ratio
      const height = el.offsetHeight * ratio
      if (el.width === width && el.height === height) return
      const strokes = signature.toData()
      const previousWidth = el.width / ratio
      const previousHeight = el.height / ratio
      el.width = width
      el.height = height
      el.getContext("2d")!.scale(ratio, ratio)
      signature.clear()
      signature.fromData(strokes.map((stroke) => ({
        ...stroke,
        points: stroke.points.map((point) => ({
          ...point,
          x: point.x * el.offsetWidth / previousWidth,
          y: point.y * el.offsetHeight / previousHeight,
        })),
      })))
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      signature.off()
    }
  }, [])

  useEffect(() => {
    const signature = pad.current
    if (!signature) return
    signature.penColor = ink
    signature.fromData(signature.toData().map((stroke) => ({ ...stroke, penColor: ink })))
  }, [ink])

  return (
    <div className="grid gap-2">
      <canvas ref={canvas} className="h-32 w-full touch-none rounded-md border bg-white" aria-label={t("tools.sign.drawHere")} />
      <div className="flex items-center justify-between">
        <InkPicker value={ink} onChange={setInk} />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            pad.current?.clear()
            setEmpty(true)
          }}
        >
          <Eraser />
          {t("tools.sign.clear")}
        </Button>
      </div>
      <Button
        size="sm"
        disabled={empty}
        onClick={() => {
          const trimmed = trimCanvas(canvas.current!)
          if (!trimmed) return
          onDone({ kind: "image", ...trimmed })
          pad.current?.clear()
          setEmpty(true)
        }}
      >
        {t("tools.sign.use")}
      </Button>
    </div>
  )
}

function TypePad({ onDone }: { onDone: (content: SavedContent) => void }) {
  const { t } = useTranslation()
  const [text, setText] = useState("")
  const [ink, setInk] = useState(INK[1])
  const preview = useTextLayout(text || " ", { fontSize: TYPED_SIZE, family: "signature" })
  return (
    <div className="grid gap-2">
      <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("tools.sign.typePlaceholder")} />
      <div className="grid h-20 place-items-center overflow-hidden rounded-md border bg-white px-2">
        {preview && text && (
          <svg
            viewBox={`-4 0 ${preview.layout.width + 8} ${preview.layout.height}`}
            className="max-h-full max-w-full"
            style={{ height: preview.layout.height }}
          >
            <path d={preview.path} fill={ink} />
          </svg>
        )}
      </div>
      <InkPicker value={ink} onChange={setInk} />
      <Button size="sm" disabled={!text.trim()} onClick={() => onDone({ kind: "text", text: text.trim(), color: ink })}>
        {t("tools.sign.use")}
      </Button>
    </div>
  )
}

function UploadPad({ onDone }: { onDone: (content: SavedContent) => void }) {
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="grid gap-2">
      <p className="text-xs text-muted-foreground">{t("tools.sign.uploadHint")}</p>
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
            onDone({ kind: "image", ...(await readImageFile(file)) })
          } catch {
            toast.error(t("editor.imageError"))
          }
        }}
      />
      <Button variant="outline" size="sm" onClick={() => input.current?.click()}>
        <Upload />
        {t("tools.sign.chooseImage")}
      </Button>
    </div>
  )
}

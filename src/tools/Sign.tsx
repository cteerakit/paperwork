import { Download, Eraser, Upload, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import SignaturePad from "signature_pad"
import { toast } from "sonner"
import { newId } from "@/components/editor/types"
import { useAnnotations } from "@/components/editor/useAnnotations"
import { Workspace, type WorkspaceApi } from "@/components/editor/Workspace"
import { FileBar } from "@/components/FileBar"
import { FileDropzone } from "@/components/FileDropzone"
import { Spinner } from "@/components/Spinner"
import { ToolLayout } from "@/components/ToolLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePdfFile, useTask } from "@/hooks/usePdfFile"
import { useTextLayout } from "@/hooks/useTextLayout"
import { TEXT_LINE_HEIGHT } from "@/lib/annotate/model"
import { downloadPdf, outputName } from "@/lib/download"
import { fitSize, readImageFile } from "@/lib/images"
import { applyAnnotations } from "@/lib/pdf/annotate"
import type { LoadedPdf } from "@/lib/render/pdfjs"
import { cn } from "@/lib/utils"

type SavedSignature =
  | { id: string; kind: "image"; src: string; width: number; height: number }
  | { id: string; kind: "text"; text: string; color: string }

const STORAGE_KEY = "paperwork.signatures"
const INK = ["#111827", "#1d4ed8", "#0f766e"]
const TYPED_SIZE = 28

function loadSaved(): SavedSignature[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")
  } catch {
    return []
  }
}

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

  const save = () =>
    run(async () => {
      const result = await applyAnnotations(pdf.bytes, api.objects, { lang: i18n.resolvedLanguage })
      reportMissing(result.missing)
      downloadPdf(result.bytes, outputName(pdf.name, "signed"))
      toast.success(t("common.done"))
    })

  return (
    <div className="grid gap-3">
      <FileBar pdf={pdf} onClose={onClose} />
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
  const [saved, setSaved] = useState<SavedSignature[]>(loadSaved)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  }, [saved])

  const place = (sig: SavedSignature) => {
    const { page, pageSize } = workspace
    if (sig.kind === "image") {
      const box = fitSize(sig.width, sig.height, 180, 80)
      workspace.add({
        id: newId(),
        type: "image",
        page,
        src: sig.src,
        x: (pageSize.width - box.width) / 2,
        y: pageSize.height * 0.72,
        rotation: 0,
        opacity: 1,
        ...box,
      })
    } else {
      const width = Math.min(pageSize.width * 0.6, Math.max(120, sig.text.length * TYPED_SIZE * 0.6))
      workspace.add({
        id: newId(),
        type: "text",
        page,
        text: sig.text,
        x: (pageSize.width - width) / 2,
        y: pageSize.height * 0.72,
        width,
        height: TYPED_SIZE * TEXT_LINE_HEIGHT,
        rotation: 0,
        opacity: 1,
        fontSize: TYPED_SIZE,
        color: sig.color,
        bold: false,
        align: "center",
        family: "signature",
      })
    }
  }

  const create = (sig: SavedSignature) => {
    setSaved((list) => [sig, ...list].slice(0, 8))
    place(sig)
  }

  return (
    <div className="grid gap-4 border-b pb-4">
      <p className="text-sm font-medium">{t("tools.sign.create")}</p>
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

      {saved.length > 0 && (
        <div className="grid gap-2">
          <p className="text-xs text-muted-foreground">{t("tools.sign.saved")}</p>
          <div className="grid grid-cols-2 gap-2">
            {saved.map((sig) => (
              <div key={sig.id} className="group relative">
                <button
                  onClick={() => place(sig)}
                  className="grid h-14 w-full place-items-center overflow-hidden rounded-md border bg-white p-1 hover:border-primary"
                  title={t("tools.sign.placeAgain")}
                >
                  {sig.kind === "image" ? (
                    <img src={sig.src} alt="" className="max-h-full max-w-full" />
                  ) : (
                    <span className="truncate font-signature text-xl" style={{ color: sig.color }}>
                      {sig.text}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setSaved((list) => list.filter((s) => s.id !== sig.id))}
                  className="absolute -top-1.5 -right-1.5 grid size-8 place-items-center rounded-full border bg-background sm:hidden sm:group-hover:grid sm:group-focus-within:grid [@media(hover:none)]:grid"
                  aria-label={t("common.remove")}
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
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

function DrawPad({ onDone }: { onDone: (sig: SavedSignature) => void }) {
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
          onDone({ id: newId(), kind: "image", ...trimmed })
          pad.current?.clear()
          setEmpty(true)
        }}
      >
        {t("tools.sign.use")}
      </Button>
    </div>
  )
}

function TypePad({ onDone }: { onDone: (sig: SavedSignature) => void }) {
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
      <Button size="sm" disabled={!text.trim()} onClick={() => onDone({ id: newId(), kind: "text", text: text.trim(), color: ink })}>
        {t("tools.sign.use")}
      </Button>
    </div>
  )
}

function UploadPad({ onDone }: { onDone: (sig: SavedSignature) => void }) {
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
            onDone({ id: newId(), kind: "image", ...(await readImageFile(file)) })
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

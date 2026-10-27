/**
 * The full editor: toolbar, page strip, the page canvas and a properties panel.
 * Used by Annotate, Sign and the image watermark (with fewer tools).
 */
import {
  ArrowUpRight,
  Circle,
  Highlighter,
  Image as ImageIcon,
  Minus,
  MousePointer2,
  Pencil,
  Redo2,
  Square,
  StickyNote,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { PageThumbnail } from "@/components/PageThumbnail"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Annotation, NoteObject } from "@/lib/annotate/model"
import { fitSize, readImageFile } from "@/lib/images"
import type { LoadedPdf } from "@/lib/render/pdfjs"
import { cn } from "@/lib/utils"
import { EditorCanvas } from "./EditorCanvas"
import { NoteDialog } from "./NoteDialog"
import { PropertiesPanel } from "./PropertiesPanel"
import { DEFAULT_STYLE, newId, type ToolId, type ToolStyle } from "./types"
import type { AnnotationsApi } from "./useAnnotations"

const TOOL_ICONS: Record<ToolId, LucideIcon> = {
  select: MousePointer2,
  text: Type,
  image: ImageIcon,
  rect: Square,
  ellipse: Circle,
  line: Minus,
  arrow: ArrowUpRight,
  pen: Pencil,
  highlight: Highlighter,
  note: StickyNote,
}

const SHORTCUTS: Partial<Record<string, ToolId>> = {
  v: "select",
  t: "text",
  r: "rect",
  o: "ellipse",
  l: "line",
  a: "arrow",
  p: "pen",
  h: "highlight",
  n: "note",
  i: "image",
}

export interface WorkspaceApi {
  page: number
  pageSize: { width: number; height: number }
  /** Adds an object to the current page and selects it. */
  add: (object: Annotation) => void
}

interface WorkspaceProps {
  pdf: LoadedPdf
  api: AnnotationsApi
  tools: ToolId[]
  lang?: string
  /** Extra content at the top of the side panel (e.g. the signature picker). */
  sidebar?: (workspace: WorkspaceApi) => ReactNode
  /** Buttons at the end of the toolbar (e.g. Save). */
  actions?: ReactNode
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

export function Workspace({ pdf, api, tools, lang, sidebar, actions }: WorkspaceProps) {
  const { t } = useTranslation()
  const [page, setPage] = useState(0)
  const [tool, setTool] = useState<ToolId>("select")
  const [style, setStyleState] = useState<ToolStyle>(DEFAULT_STYLE)
  const [selectedId, setSelectedId] = useState<string>()
  const [editingId, setEditingId] = useState<string>()
  const [noteId, setNoteId] = useState<string>()
  const [zoom, setZoom] = useState(1)
  const [containerWidth, setContainerWidth] = useState(800)
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight)
  const container = useRef<HTMLDivElement>(null)
  const imageInput = useRef<HTMLInputElement>(null)

  const size = pdf.pageSizes[page]
  // Fit the whole page in view: limited by the canvas width and the window height.
  const fitScale = Math.max(
    0.01,
    Math.min((containerWidth - 48) / size.width, (viewportHeight - 144 - 48) / size.height)
  )
  const scale = Math.min(fitScale, 2.5) * zoom
  const selected = api.objects.find((o) => o.id === selectedId)
  const note = api.objects.find((o) => o.id === noteId) as NoteObject | undefined

  const setStyle = useCallback((patch: Partial<ToolStyle>) => setStyleState((s) => ({ ...s, ...patch })), [])

  useEffect(() => {
    const el = container.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width))
    observer.observe(el)
    const onResize = () => setViewportHeight(window.innerHeight)
    window.addEventListener("resize", onResize)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", onResize)
    }
  }, [])

  const goToPage = (index: number) => {
    setPage(index)
    setSelectedId(undefined)
    setEditingId(undefined)
  }

  const add = useCallback(
    (object: Annotation) => {
      api.add(object)
      setTool("select")
      setSelectedId(object.id)
    },
    [api]
  )

  const addImage = async (file: File) => {
    try {
      const image = await readImageFile(file)
      const box = fitSize(image.width, image.height, size.width * 0.5, size.height * 0.5)
      add({
        id: newId(),
        type: "image",
        page,
        src: image.src,
        x: (size.width - box.width) / 2,
        y: (size.height - box.height) / 2,
        rotation: 0,
        opacity: 1,
        ...box,
      })
    } catch {
      toast.error(t("editor.imageError"))
    }
  }

  const chooseTool = (next: ToolId) => {
    if (next === "image") {
      imageInput.current?.click()
      return
    }
    setTool(next)
    setEditingId(undefined)
    if (next !== "select") setSelectedId(undefined)
  }

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || noteId) return
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      if (mod && key === "z") {
        e.preventDefault()
        if (e.shiftKey) api.redo()
        else api.undo()
      } else if (mod && key === "y") {
        e.preventDefault()
        api.redo()
      } else if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        e.preventDefault()
        api.remove(selected.id)
      } else if (e.key === "Escape") {
        setSelectedId(undefined)
        setTool("select")
      } else if (e.key === "Enter" && selected?.type === "text") {
        e.preventDefault()
        setEditingId(selected.id)
      } else if (e.key.startsWith("Arrow") && selected) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0
        if ("points" in selected) {
          api.update(selected.id, { points: selected.points.map((v, i) => v + (i % 2 ? dy : dx)) }, "nudge")
        } else {
          api.update(selected.id, { x: selected.x + dx, y: selected.y + dy }, "nudge")
        }
      } else if (!mod && !e.altKey && SHORTCUTS[key] && tools.includes(SHORTCUTS[key]!)) {
        chooseTool(SHORTCUTS[key]!)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const counts = useMemo(() => {
    const c = new Map<number, number>()
    for (const o of api.objects) c.set(o.page, (c.get(o.page) ?? 0) + 1)
    return c
  }, [api.objects])

  const workspaceApi: WorkspaceApi = { page, pageSize: size, add }

  return (
    <div className="grid gap-3">
      {/* Toolbar */}
      <div className="sticky top-14 z-30 flex flex-wrap items-center gap-1 rounded-lg border bg-background/95 p-1.5 backdrop-blur">
        {tools.length > 1 &&
          tools.map((id) => {
            const Icon = TOOL_ICONS[id]
            const shortcut = Object.entries(SHORTCUTS).find(([, v]) => v === id)?.[0]
            return (
              <Tooltip key={id}>
                <TooltipTrigger
                  render={
                    <Button
                      variant={tool === id ? "secondary" : "ghost"}
                      size="icon-sm"
                      aria-label={t(`editor.tools.${id}`)}
                      aria-pressed={tool === id}
                      onClick={() => chooseTool(id)}
                      className={cn(tool === id && "ring-1 ring-foreground/15")}
                    />
                  }
                >
                  <Icon />
                </TooltipTrigger>
                <TooltipContent>
                  {t(`editor.tools.${id}`)}
                  {shortcut && <kbd className="ml-2 rounded bg-background/20 px-1 font-mono text-[10px] uppercase">{shortcut}</kbd>}
                </TooltipContent>
              </Tooltip>
            )
          })}
        {tools.length > 1 && <span className="mx-1 h-5 w-px bg-border" />}
        <ToolbarButton icon={Undo2} label={t("editor.undo")} onClick={api.undo} disabled={!api.canUndo} />
        <ToolbarButton icon={Redo2} label={t("editor.redo")} onClick={api.redo} disabled={!api.canRedo} />
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton icon={ZoomOut} label={t("editor.zoomOut")} onClick={() => setZoom((z) => Math.max(0.25, z / 1.25))} />
        <button
          className="min-h-11 min-w-12 rounded px-1 sm:min-h-0 text-xs text-muted-foreground tabular-nums hover:bg-muted"
          onClick={() => setZoom(1)}
          title={t("editor.fitPage")}
        >
          {Math.round(scale * 100)}%
        </button>
        <ToolbarButton icon={ZoomIn} label={t("editor.zoomIn")} onClick={() => setZoom((z) => Math.min(4, z * 1.25))} />
        <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>
      </div>
      <input
        ref={imageInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void addImage(file)
          e.target.value = ""
        }}
      />

      <div className="grid gap-3 lg:grid-cols-[132px_minmax(0,1fr)_280px]">
        {/* Page strip */}
        <nav className="flex min-w-0 gap-2 overflow-x-auto pb-1 lg:max-h-[calc(100svh-9rem)] lg:flex-col lg:overflow-y-auto lg:pb-0" aria-label={t("editor.pages")}>
          {pdf.pageSizes.map((pageSize, i) => (
            <button
              key={i}
              onClick={() => goToPage(i)}
              aria-current={i === page}
              className={cn(
                "relative flex shrink-0 flex-col items-center gap-1 rounded-lg border p-1.5 text-xs transition-colors",
                i === page ? "border-primary bg-primary/5" : "hover:bg-muted"
              )}
            >
              <PageThumbnail doc={pdf.doc} index={i} box={96} size={pageSize} />
              <span className="tabular-nums">{i + 1}</span>
              {counts.get(i) ? (
                <span className="absolute top-1 right-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                  {counts.get(i)}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        {/* Canvas */}
        <div ref={container} className="min-w-0 overflow-auto rounded-xl bg-muted/60 p-6 lg:max-h-[calc(100svh-9rem)]">
          <div className="mx-auto w-fit">
            <EditorCanvas
              pdf={pdf}
              page={page}
              scale={scale}
              api={api}
              tool={tool}
              setTool={setTool}
              style={style}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              editingId={editingId}
              setEditingId={setEditingId}
              onEditNote={setNoteId}
              lang={lang}
            />
          </div>
        </div>

        {/* Side panel */}
        <aside className="grid min-w-0 content-start gap-4 rounded-xl border bg-card p-4 lg:sticky lg:top-20 lg:max-h-[calc(100svh-9rem)] lg:overflow-y-auto">
          {sidebar?.(workspaceApi)}
          <PropertiesPanel
            selected={selected}
            tool={tool}
            style={style}
            setStyle={setStyle}
            update={(patch, key) => selected && api.update(selected.id, patch, key)}
            onDelete={() => selected && api.remove(selected.id)}
            onEditNote={() => selected && setNoteId(selected.id)}
          />
          <p className="border-t pt-3 text-xs text-muted-foreground">{t("editor.hint")}</p>
        </aside>
      </div>

      <NoteDialog
        text={note?.text}
        onClose={() => {
          // A brand-new note left empty is removed.
          if (note && note.text === "") api.remove(note.id)
          setNoteId(undefined)
        }}
        onSave={(text) => {
          if (!note) return
          if (text.trim() === "") api.remove(note.id)
          else api.update(note.id, { text })
          setNoteId(undefined)
        }}
      />
    </div>
  )
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} disabled={disabled} />}>
        <Icon />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

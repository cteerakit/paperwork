import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Download, RotateCcw, RotateCw, Trash2, Undo2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FileBar } from "@/components/FileBar"
import { FileDropzone } from "@/components/FileDropzone"
import { PageThumbnail } from "@/components/PageThumbnail"
import { Spinner } from "@/components/Spinner"
import { ToolLayout } from "@/components/ToolLayout"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/Checkbox"
import { usePdfFile, useTask } from "@/hooks/usePdfFile"
import { downloadPdf, outputName } from "@/lib/download"
import { buildFromPages } from "@/lib/pdf/pages"
import type { LoadedPdf } from "@/lib/render/pdfjs"
import { cn } from "@/lib/utils"

interface PageItem {
  id: string
  index: number
  rotation: number
}

const initialItems = (count: number): PageItem[] =>
  Array.from({ length: count }, (_, index) => ({ id: `p${index}`, index, rotation: 0 }))

export default function Organize() {
  const { t } = useTranslation()
  const { pdf, loading, open, reset } = usePdfFile()
  const [items, setItems] = useState<PageItem[]>([])

  const onFiles = async ([file]: File[]) => {
    const loaded = await open(file)
    if (loaded) setItems(initialItems(loaded.pageCount))
  }

  return (
    <ToolLayout tool="organize">
      {!pdf ? (
        loading ? <Loading /> : <FileDropzone onFiles={onFiles} />
      ) : (
        <Editor
          pdf={pdf}
          items={items}
          setItems={setItems}
          onClose={() => {
            reset()
            setItems([])
          }}
        />
      )}
      {pdf && <p className="mt-4 text-center text-xs text-muted-foreground">{t("tools.organize.hint")}</p>}
    </ToolLayout>
  )
}

function Loading() {
  return (
    <div className="grid h-64 place-items-center">
      <Spinner />
    </div>
  )
}

function Editor({
  pdf,
  items,
  setItems,
  onClose,
}: {
  pdf: LoadedPdf
  items: PageItem[]
  setItems: (update: PageItem[] | ((items: PageItem[]) => PageItem[])) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { busy, run } = useTask()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const targets = (id?: string) => (id ? [id] : [...selected])
  const rotate = (delta: number, id?: string) => {
    const ids = new Set(targets(id))
    setItems((list) => list.map((p) => (ids.has(p.id) ? { ...p, rotation: p.rotation + delta } : p)))
  }
  const remove = (id?: string) => {
    const ids = new Set(targets(id))
    if (ids.size >= items.length) {
      toast.warning(t("tools.organize.keepOne"))
      return
    }
    setItems((list) => list.filter((p) => !ids.has(p.id)))
    setSelected((s) => new Set([...s].filter((x) => !ids.has(x))))
  }
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setItems((list) => {
      const from = list.findIndex((p) => p.id === active.id)
      const to = list.findIndex((p) => p.id === over.id)
      return arrayMove(list, from, to)
    })
  }

  const save = () =>
    run(async () => {
      const bytes = await buildFromPages(
        pdf.bytes,
        items.map((p) => ({ index: p.index, rotate: p.rotation }))
      )
      downloadPdf(bytes, outputName(pdf.name, "organized"))
      toast.success(t("common.done"))
    })

  const changed = items.some((p, i) => p.index !== i || p.rotation % 360 !== 0) || items.length !== pdf.pageCount
  const hasSelection = selected.size > 0

  return (
    <div className="grid gap-4">
      <FileBar pdf={pdf} onClose={onClose} />
      <div className="sticky top-14 z-30 -mx-1 flex flex-wrap items-center gap-2 rounded-lg border bg-background/95 p-2 backdrop-blur">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelected(hasSelection ? new Set() : new Set(items.map((p) => p.id)))}
        >
          {hasSelection ? t("common.selectNone") : t("common.selectAll")}
        </Button>
        <span className="text-sm text-muted-foreground">
          {hasSelection ? t("common.selectedCount", { count: selected.size }) : t("tools.organize.selectHint")}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Button variant="outline" size="sm" disabled={!hasSelection} onClick={() => rotate(-90)}>
            <RotateCcw />
            <span className="hidden md:inline">{t("tools.organize.rotateLeft")}</span>
          </Button>
          <Button variant="outline" size="sm" disabled={!hasSelection} onClick={() => rotate(90)}>
            <RotateCw />
            <span className="hidden md:inline">{t("tools.organize.rotateRight")}</span>
          </Button>
          <Button variant="outline" size="sm" disabled={!hasSelection} onClick={() => remove()}>
            <Trash2 />
            <span className="hidden md:inline">{t("common.delete")}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!changed}
            onClick={() => {
              setItems(initialItems(pdf.pageCount))
              setSelected(new Set())
            }}
          >
            <Undo2 />
            <span className="hidden md:inline">{t("common.reset")}</span>
          </Button>
          <Button size="sm" onClick={save} disabled={busy}>
            {busy ? <Spinner className="size-4 text-current" /> : <Download />}
            {t("common.save")}
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((p) => p.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
            {items.map((item, position) => (
              <SortablePage
                key={item.id}
                item={item}
                position={position}
                pdf={pdf}
                selected={selected.has(item.id)}
                onToggle={() => toggle(item.id)}
                onRotate={(d) => rotate(d, item.id)}
                onDelete={() => remove(item.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

function SortablePage({
  item,
  position,
  pdf,
  selected,
  onToggle,
  onRotate,
  onDelete,
}: {
  item: PageItem
  position: number
  pdf: LoadedPdf
  selected: boolean
  onToggle: () => void
  onRotate: (delta: number) => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative flex cursor-grab touch-none flex-col items-center gap-2 rounded-lg border bg-card p-3 active:cursor-grabbing",
        selected && "border-primary ring-2 ring-primary/30",
        isDragging && "z-10 opacity-80 shadow-lg"
      )}
      {...attributes}
      {...listeners}
      onClick={onToggle}
    >
      <PageThumbnail doc={pdf.doc} index={item.index} box={136} size={pdf.pageSizes[item.index]} rotation={item.rotation} />
      <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
        <Checkbox checked={selected} onChange={onToggle} label={t("common.selectPage", { n: position + 1 })} />
        <span className="tabular-nums">
          {position + 1}
          {item.index !== position && <span className="opacity-60"> ({t("tools.organize.was", { n: item.index + 1 })})</span>}
        </span>
      </div>
      <div
        className="absolute top-2 right-2 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <Button variant="secondary" size="icon-xs" onClick={() => onRotate(-90)} aria-label={t("tools.organize.rotateLeft")}>
          <RotateCcw />
        </Button>
        <Button variant="secondary" size="icon-xs" onClick={() => onRotate(90)} aria-label={t("tools.organize.rotateRight")}>
          <RotateCw />
        </Button>
        <Button variant="secondary" size="icon-xs" onClick={onDelete} aria-label={t("common.delete")}>
          <Trash2 />
        </Button>
      </div>
    </div>
  )
}

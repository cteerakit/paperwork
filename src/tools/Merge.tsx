import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Combine, GripVertical, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FileDropzone } from "@/components/FileDropzone"
import { ResultActions } from "@/components/ResultActions"
import { PageThumbnail } from "@/components/PageThumbnail"
import { Spinner } from "@/components/Spinner"
import { ToolLayout } from "@/components/ToolLayout"
import { Button } from "@/components/ui/button"
import { useTask } from "@/hooks/usePdfFile"
import { useResult } from "@/hooks/useResult"
import { useFormat } from "@/hooks/useFormat"
import { outputName } from "@/lib/download"
import { handoffToFile, takeHandoff } from "@/lib/handoff"
import { errorMessage } from "@/lib/errors"
import { mergePdfs } from "@/lib/pdf/pages"
import { closePdf, openPdf, type LoadedPdf } from "@/lib/render/pdfjs"
import { cn } from "@/lib/utils"

export default function Merge() {
  const { t } = useTranslation()
  const { busy, run } = useTask()
  const { result: output, deliver } = useResult()
  const [files, setFiles] = useState<LoadedPdf[]>([])
  const [loading, setLoading] = useState(0)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Release pdf.js documents when leaving the tool.
  const latest = useRef(files)
  useEffect(() => {
    latest.current = files
  }, [files])
  useEffect(() => () => latest.current.forEach(closePdf), [])

  const add = async (incoming: File[]) => {
    setLoading((n) => n + incoming.length)
    for (const file of incoming) {
      try {
        const loaded = await openPdf(file)
        setFiles((list) => [...list, loaded])
      } catch (error) {
        toast.error(`${file.name}: ${errorMessage(t, error)}`)
      } finally {
        setLoading((n) => n - 1)
      }
    }
  }

  // Start from a file passed on from another tool ("Continue in…").
  useEffect(() => {
    const handoff = takeHandoff()
    if (handoff) queueMicrotask(() => void add([handoffToFile(handoff)]))
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const remove = (id: string) =>
    setFiles((list) => {
      closePdf(list.find((f) => f.id === id))
      return list.filter((f) => f.id !== id)
    })

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setFiles((list) => arrayMove(list, list.findIndex((f) => f.id === active.id), list.findIndex((f) => f.id === over.id)))
  }

  const merge = () =>
    run(async () => {
      const bytes = await mergePdfs(files.map((f) => f.bytes))
      deliver(bytes, outputName(files[0].name, "merged"))
      toast.success(t("common.done"))
    })

  const totalPages = files.reduce((sum, f) => sum + f.pageCount, 0)

  return (
    <ToolLayout tool="merge">
      {files.length === 0 && loading === 0 ? (
        <FileDropzone multiple onFiles={add} />
      ) : (
        <div className="mx-auto grid max-w-3xl gap-3">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={files.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              {files.map((file, i) => (
                <FileRow key={file.id} file={file} position={i + 1} onRemove={() => remove(file.id)} />
              ))}
            </SortableContext>
          </DndContext>
          {loading > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <Spinner />
              {t("common.loading")}
            </div>
          )}
          <FileDropzone multiple compact onFiles={add} />
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-sm text-muted-foreground">
              {t("tools.merge.summary", { files: files.length, pages: totalPages })}
            </p>
            <Button onClick={merge} disabled={busy || files.length < 2}>
              {busy ? <Spinner className="size-4 text-current" /> : <Combine />}
              {t("tools.merge.action")}
            </Button>
          </div>
          {files.length === 1 && <p className="text-right text-xs text-muted-foreground">{t("tools.merge.needTwo")}</p>}
          {output && <ResultActions result={output} tool="merge" />}
        </div>
      )}
    </ToolLayout>
  )
}

function FileRow({ file, position, onRemove }: { file: LoadedPdf; position: number; onRemove: () => void }) {
  const { t } = useTranslation()
  const { bytes } = useFormat()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: file.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-center gap-3 rounded-lg border bg-card p-2 pr-3", isDragging && "z-10 shadow-lg")}
    >
      <button
        className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
        aria-label={t("common.dragToReorder")}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <span className="w-5 text-center text-sm text-muted-foreground tabular-nums">{position}</span>
      <PageThumbnail doc={file.doc} index={0} box={56} size={file.pageSizes[0]} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{file.name}</p>
        <p className="text-xs text-muted-foreground">
          {t("common.pageCount", { count: file.pageCount })} · {bytes(file.bytes.length)}
        </p>
      </div>
      <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label={t("common.remove")}>
        <X />
      </Button>
    </div>
  )
}

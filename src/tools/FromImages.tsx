import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { FileImage, GripVertical, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@/components/fields"
import { FileDropzone } from "@/components/FileDropzone"
import { ResultActions } from "@/components/ResultActions"
import { Spinner } from "@/components/Spinner"
import { ToolLayout } from "@/components/ToolLayout"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useTask } from "@/hooks/usePdfFile"
import { useResult } from "@/hooks/useResult"
import { useFormat } from "@/hooks/useFormat"
import { readImageForPdf } from "@/lib/images"
import { imagesToPdf, type ImagePageSize } from "@/lib/pdf/images"
import { cn } from "@/lib/utils"

interface ImageItem {
  id: string
  name: string
  /** Object URL of the original file, for the thumbnail. */
  url: string
  bytes: Uint8Array
  width: number
  height: number
}

const PAGE_SIZES: ImagePageSize[] = ["a4", "letter", "fit"]
/** Margin choices, in points. */
const MARGINS = { none: 0, small: 18, large: 48 }
type Margin = keyof typeof MARGINS

export default function FromImages() {
  const { t } = useTranslation()
  const { busy, run } = useTask()
  const { result: output, deliver, clear } = useResult()
  const [images, setImages] = useState<ImageItem[]>([])
  const [loading, setLoading] = useState(0)
  const [pageSize, setPageSize] = useState<ImagePageSize>("a4")
  const [margin, setMargin] = useState<Margin>("small")
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Release thumbnails when leaving the tool.
  const latest = useRef(images)
  useEffect(() => {
    latest.current = images
  }, [images])
  useEffect(() => () => latest.current.forEach((image) => URL.revokeObjectURL(image.url)), [])

  const add = async (incoming: File[]) => {
    setLoading((n) => n + incoming.length)
    for (const file of incoming) {
      try {
        const image = await readImageForPdf(file)
        const item = { id: crypto.randomUUID(), name: file.name, url: URL.createObjectURL(file), ...image }
        setImages((list) => [...list, item])
        clear()
      } catch (error) {
        console.error(error)
        toast.error(`${file.name}: ${t("tools.fromImages.unreadable")}`)
      } finally {
        setLoading((n) => n - 1)
      }
    }
  }

  const remove = (id: string) => {
    setImages((list) => {
      const image = list.find((i) => i.id === id)
      if (image) URL.revokeObjectURL(image.url)
      return list.filter((i) => i.id !== id)
    })
    clear()
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setImages((list) => arrayMove(list, list.findIndex((i) => i.id === active.id), list.findIndex((i) => i.id === over.id)))
    clear()
  }

  const convert = () =>
    run(async () => {
      const bytes = await imagesToPdf(images, { pageSize, margin: MARGINS[margin] })
      deliver(bytes, `${images[0].name.replace(/\.[^.]*$/, "") || "images"}.pdf`)
      toast.success(t("common.done"))
    })

  return (
    <ToolLayout tool="fromImages">
      {images.length === 0 && loading === 0 ? (
        <FileDropzone multiple accept="images" onFiles={add} />
      ) : (
        <div className="mx-auto grid max-w-3xl gap-3">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={images.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              {images.map((image, i) => (
                <ImageRow key={image.id} image={image} position={i + 1} onRemove={() => remove(image.id)} />
              ))}
            </SortableContext>
          </DndContext>
          {loading > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <Spinner />
              {t("common.loading")}
            </div>
          )}
          <FileDropzone multiple compact accept="images" onFiles={add} />

          <div className="mt-2 grid gap-5 rounded-xl border bg-card p-5 sm:grid-cols-2">
            <Field label={t("tools.fromImages.pageSize")} hint={t(`tools.fromImages.pageSizes.${pageSize}Hint`)}>
              <ToggleGroup
                variant="outline"
                value={[pageSize]}
                onValueChange={(value) => {
                  if (!value[0]) return
                  setPageSize(value[0] as ImagePageSize)
                  clear()
                }}
                disabled={busy}
              >
                {PAGE_SIZES.map((value) => (
                  <ToggleGroupItem key={value} value={value}>
                    {t(`tools.fromImages.pageSizes.${value}`)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
            <Field label={t("tools.fromImages.margin")}>
              <ToggleGroup
                variant="outline"
                value={[margin]}
                onValueChange={(value) => {
                  if (!value[0]) return
                  setMargin(value[0] as Margin)
                  clear()
                }}
                disabled={busy}
              >
                {(Object.keys(MARGINS) as Margin[]).map((value) => (
                  <ToggleGroupItem key={value} value={value}>
                    {t(`tools.fromImages.margins.${value}`)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-sm text-muted-foreground">{t("common.pageCount", { count: images.length })}</p>
            <Button onClick={convert} disabled={busy || loading > 0 || images.length === 0}>
              {busy ? <Spinner className="size-4 text-current" /> : <FileImage />}
              {t("tools.fromImages.action")}
            </Button>
          </div>
          {output && <ResultActions result={output} tool="fromImages" />}
        </div>
      )}
    </ToolLayout>
  )
}

function ImageRow({ image, position, onRemove }: { image: ImageItem; position: number; onRemove: () => void }) {
  const { t } = useTranslation()
  const { bytes } = useFormat()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id })
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
      <div className="grid size-14 shrink-0 place-items-center">
        <img src={image.url} alt="" className="max-h-14 max-w-14 rounded-sm border bg-white object-contain" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{image.name}</p>
        <p className="text-xs text-muted-foreground">
          {image.width} × {image.height} px · {bytes(image.bytes.length)}
        </p>
      </div>
      <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label={t("common.remove")}>
        <X />
      </Button>
    </div>
  )
}

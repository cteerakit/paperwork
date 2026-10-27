import { Pencil, Upload, X } from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TEXT_LINE_HEIGHT } from "@/lib/annotate/model"
import { fitSize, readImageFile } from "@/lib/images"
import { SAVED_CATEGORIES, type SavedCategory, type SavedContent, type SavedItem } from "@/lib/signatures"
import { newId } from "./types"
import type { SignatureLibraryApi } from "./useSignatureLibrary"
import type { WorkspaceApi } from "./Workspace"

export const TYPED_SIZE = 28

/** How large each kind of saved item is when first placed, in page points. */
const PLACED_SIZE: Record<SavedCategory, [number, number]> = {
  signature: [180, 80],
  initials: [90, 50],
  stamp: [160, 160],
}

/** Puts a saved item on the current page, centred a little below the middle. */
export function placeSaved(workspace: WorkspaceApi, item: SavedItem | (SavedContent & { category: SavedCategory })) {
  const { page, pageSize } = workspace
  if (item.kind === "image") {
    const [maxWidth, maxHeight] = PLACED_SIZE[item.category]
    const box = fitSize(item.width, item.height, maxWidth, maxHeight)
    workspace.add({
      id: newId(),
      type: "image",
      page,
      src: item.src,
      x: (pageSize.width - box.width) / 2,
      y: pageSize.height * 0.72,
      rotation: 0,
      opacity: 1,
      ...box,
    })
    return
  }
  const width = Math.min(pageSize.width * 0.6, Math.max(120, item.text.length * TYPED_SIZE * 0.6))
  workspace.add({
    id: newId(),
    type: "text",
    page,
    text: item.text,
    x: (pageSize.width - width) / 2,
    y: pageSize.height * 0.72,
    width,
    height: TYPED_SIZE * TEXT_LINE_HEIGHT,
    rotation: 0,
    opacity: 1,
    fontSize: TYPED_SIZE,
    color: item.color,
    bold: false,
    align: "center",
    family: "signature",
  })
}

/** Saved signatures, initials and stamps, ready to place again, rename or remove. */
export function SignatureLibrary({
  workspace,
  library,
  canAddStamp,
}: {
  workspace: WorkspaceApi
  library: SignatureLibraryApi
  /** Offers an upload button that saves an image as a stamp. */
  canAddStamp?: boolean
}) {
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)

  const upload = async (file: File | undefined) => {
    if (!file) return
    try {
      const image = await readImageFile(file)
      const item = library.add({ kind: "image", ...image }, "stamp")
      placeSaved(workspace, item)
    } catch {
      toast.error(t("editor.imageError"))
    }
  }

  if (!library.items.length && !canAddStamp) return null
  return (
    <div className="grid gap-3">
      <p className="text-xs text-muted-foreground">{t("tools.sign.saved")}</p>
      {SAVED_CATEGORIES.map((category) => {
        const items = library.items.filter((item) => item.category === category)
        if (!items.length) return null
        return (
          <section key={category} className="grid gap-1.5" aria-label={t(`tools.sign.categories.${category}`)}>
            <h3 className="text-xs font-medium">{t(`tools.sign.categories.${category}`)}</h3>
            <div className="grid grid-cols-2 gap-2">
              {items.map((item) => (
                <SavedCard
                  key={item.id}
                  item={item}
                  onPlace={() => placeSaved(workspace, item)}
                  onRename={(name) => library.rename(item.id, name)}
                  onRemove={() => library.remove(item.id)}
                />
              ))}
            </div>
          </section>
        )
      })}
      {canAddStamp && (
        <>
          <input
            ref={input}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              void upload(file)
            }}
          />
          <Button variant="outline" size="sm" onClick={() => input.current?.click()}>
            <Upload />
            {t("tools.sign.addStamp")}
          </Button>
        </>
      )}
    </div>
  )
}

function SavedCard({
  item,
  onPlace,
  onRename,
  onRemove,
}: {
  item: SavedItem
  onPlace: () => void
  onRename: (name: string) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const finish = (name?: string) => {
    if (name !== undefined) onRename(name)
    setEditing(false)
  }
  return (
    <div className="grid gap-1">
      <button
        onClick={onPlace}
        className="grid h-14 w-full place-items-center overflow-hidden rounded-md border bg-white p-1 hover:border-primary"
        title={t("tools.sign.placeAgain")}
      >
        {item.kind === "image" ? (
          <img src={item.src} alt="" className="max-h-full max-w-full" />
        ) : (
          <span className="truncate font-signature text-xl" style={{ color: item.color }}>
            {item.text}
          </span>
        )}
      </button>
      <div className="flex items-center gap-1">
        {editing ? (
          <Input
            autoFocus
            defaultValue={item.name ?? ""}
            aria-label={t("tools.sign.rename")}
            className="h-7 min-w-0 flex-1 text-xs"
            onBlur={(event) => finish(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") finish(event.currentTarget.value)
              else if (event.key === "Escape") finish()
            }}
          />
        ) : (
          <button
            className="flex min-w-0 flex-1 items-center gap-1 rounded text-left text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setEditing(true)}
            aria-label={t("tools.sign.rename")}
          >
            <span className="truncate">{item.name ?? t("tools.sign.unnamed")}</span>
            <Pencil className="size-3 shrink-0" />
          </button>
        )}
        <Button variant="ghost" size="icon-xs" onClick={onRemove} aria-label={t("common.remove")}>
          <X />
        </Button>
      </div>
    </div>
  )
}

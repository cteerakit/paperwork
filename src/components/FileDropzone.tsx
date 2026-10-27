import { FileUp, ShieldCheck } from "lucide-react"
import { useRef, useState, type DragEvent } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface FileDropzoneProps {
  onFiles: (files: File[]) => void
  multiple?: boolean
  /** A smaller, single-line version for adding more files. */
  compact?: boolean
  className?: string
}

const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name)

export function FileDropzone({ onFiles, multiple, compact, className }: FileDropzoneProps) {
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const accept = (list: FileList | null) => {
    const files = Array.from(list ?? [])
    const pdfs = files.filter(isPdf)
    if (pdfs.length < files.length) toast.warning(t("dropzone.notPdf"))
    if (pdfs.length) onFiles(multiple ? pdfs : pdfs.slice(0, 1))
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    accept(event.dataTransfer.files)
  }

  const picker = (
    <input
      ref={input}
      type="file"
      accept="application/pdf,.pdf"
      multiple={multiple}
      className="hidden"
      onChange={(e) => {
        accept(e.target.files)
        e.target.value = ""
      }}
    />
  )

  if (compact) {
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex items-center justify-center gap-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground",
          dragging && "border-primary bg-primary/5",
          className
        )}
      >
        {picker}
        <Button variant="outline" size="sm" onClick={() => input.current?.click()}>
          <FileUp />
          {t("dropzone.addMore")}
        </Button>
        <span className="hidden sm:inline">{t("dropzone.orDrop")}</span>
      </div>
    )
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => input.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      className={cn(
        "flex min-h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-card p-8 text-center transition-colors hover:border-foreground/30 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        dragging && "border-primary bg-primary/5",
        className
      )}
    >
      {picker}
      <div className="grid size-12 place-items-center rounded-full bg-muted">
        <FileUp className="size-6 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium">{t(multiple ? "dropzone.titleMultiple" : "dropzone.title")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("dropzone.orDrop")}</p>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" />
        {t("common.privacy")}
      </p>
    </div>
  )
}

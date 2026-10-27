import { Download } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useAnnotations } from "@/components/editor/useAnnotations"
import { Workspace } from "@/components/editor/Workspace"
import type { ToolId } from "@/components/editor/types"
import { FileBar } from "@/components/FileBar"
import { FileDropzone } from "@/components/FileDropzone"
import { Spinner } from "@/components/Spinner"
import { ToolLayout } from "@/components/ToolLayout"
import { Button } from "@/components/ui/button"
import { usePdfFile, useTask } from "@/hooks/usePdfFile"
import type { Annotation } from "@/lib/annotate/model"
import { downloadPdf, outputName } from "@/lib/download"
import { applyAnnotations } from "@/lib/pdf/annotate"
import type { LoadedPdf } from "@/lib/render/pdfjs"
import { fileKey, storage } from "@/lib/storage"

const TOOLS: ToolId[] = ["select", "text", "highlight", "pen", "rect", "ellipse", "line", "arrow", "image", "note"]

export default function Annotate() {
  const { pdf, loading, open, reset } = usePdfFile()
  return (
    <ToolLayout tool="annotate" wide={Boolean(pdf)}>
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
  const [key, setKey] = useState<string>()
  const restored = useRef(false)

  // Restore an autosaved session for this exact file, then keep saving changes.
  useEffect(() => {
    let cancelled = false
    void fileKey(pdf.bytes).then(async (hash) => {
      const k = `annotate:${hash}`
      const saved = await storage.get<Annotation[]>(k)
      if (cancelled) return
      if (saved?.length) {
        api.reset(saved)
        toast.info(t("tools.annotate.restored", { count: saved.length }), {
          action: {
            label: t("tools.annotate.discard"),
            onClick: () => {
              api.reset([])
              void storage.delete(k)
            },
          },
        })
      }
      restored.current = true
      setKey(k)
    })
    return () => {
      cancelled = true
    }
    // Run once per file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf.bytes])

  useEffect(() => {
    if (!key || !restored.current) return
    const timer = setTimeout(() => {
      if (api.objects.length) void storage.set(key, api.objects)
      else void storage.delete(key)
    }, 600)
    return () => clearTimeout(timer)
  }, [api.objects, key])

  const save = () =>
    run(async () => {
      const result = await applyAnnotations(pdf.bytes, api.objects, { lang: i18n.resolvedLanguage })
      reportMissing(result.missing)
      downloadPdf(result.bytes, outputName(pdf.name, "annotated"))
      toast.success(t("common.done"))
    })

  return (
    <div className="grid gap-3">
      <FileBar pdf={pdf} onClose={onClose} />
      <Workspace
        pdf={pdf}
        api={api}
        tools={TOOLS}
        lang={i18n.resolvedLanguage}
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

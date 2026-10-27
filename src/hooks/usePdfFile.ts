import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { errorMessage } from "@/lib/errors"
import { handoffToFile, takeHandoff } from "@/lib/handoff"
import { onLargeFontLoad } from "@/lib/text/fonts"
import { closePdf, openPdf, type LoadedPdf } from "@/lib/render/pdfjs"

/** Opens one PDF for a tool, with loading state and friendly errors. */
export function usePdfFile() {
  const { t } = useTranslation()
  const [pdf, setPdf] = useState<LoadedPdf>()
  const [loading, setLoading] = useState(false)

  const open = useCallback(
    async (file: File) => {
      setLoading(true)
      try {
        const loaded = await openPdf(file)
        setPdf((previous) => {
          closePdf(previous)
          return loaded
        })
        return loaded
      } catch (error) {
        toast.error(errorMessage(t, error))
      } finally {
        setLoading(false)
      }
    },
    [t]
  )

  const reset = useCallback(() => {
    setPdf((previous) => {
      closePdf(previous)
      return undefined
    })
  }, [])

  // Pick up a file passed on from another tool ("Continue in…").
  useEffect(() => {
    const handoff = takeHandoff()
    // Deferred so the load starts after this effect, and survives StrictMode's double run.
    if (handoff) queueMicrotask(() => void open(handoffToFile(handoff)))
  }, [open])

  return { pdf, loading, open, reset }
}

/**
 * Runs a processing task with a busy flag and translated error toasts.
 * Also shows a "downloading font" toast while large CJK fonts load.
 */
export function useTask() {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const unsubscribe = onLargeFontLoad(({ id, state }) => {
      if (state === "start") toast.loading(t("common.downloadingFont"), { id: `font-${id}` })
      else toast.dismiss(`font-${id}`)
    })
    return () => void unsubscribe()
  }, [t])

  const run = useCallback(
    async <T,>(task: () => Promise<T>): Promise<T | undefined> => {
      setBusy(true)
      try {
        return await task()
      } catch (error) {
        toast.error(errorMessage(t, error))
      } finally {
        setBusy(false)
      }
    },
    [t]
  )

  /** Warns when some characters couldn't be drawn by any font. */
  const reportMissing = useCallback(
    (missing: string[]) => {
      if (missing.length) toast.warning(t("common.missingChars", { chars: missing.join(" ") }))
    },
    [t]
  )

  return { busy, run, reportMissing }
}

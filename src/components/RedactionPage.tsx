import { useEffect, useRef, useState } from "react"
import type { TextLayer } from "pdfjs-dist"
import { useTranslation } from "react-i18next"
import type { LoadedPdf } from "@/lib/render/pdfjs"
import type { Redaction } from "@/lib/pdf/redact"
import { selectedTextAreas } from "@/lib/pdf/textSelection"
import { PagePreview } from "./PagePreview"
import { Button } from "./ui/button"
import "./redaction-text-layer.css"

export function RedactionPage({
  pdf,
  page,
  areas,
  highlights = [],
  disabled,
  onMark,
}: {
  pdf: LoadedPdf
  page: number
  areas: Redaction[]
  /** Search matches waiting to be redacted: shown outlined so they can be reviewed first. */
  highlights?: Redaction[]
  disabled: boolean
  onMark: (areas: Redaction[]) => void
}) {
  const { t } = useTranslation()
  const root = useRef<HTMLDivElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">(
    "loading"
  )
  const [selection, setSelection] = useState<Redaction[]>([])
  const size = pdf.pageSizes[page]

  useEffect(() => {
    const element = root.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width)
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const element = layer.current
    if (!element || !width) return
    let cancelled = false
    let textLayer: TextLayer | undefined
    const container = document.createElement("div")
    container.className = "redaction-text-layer"
    element.replaceChildren(container)
    void (async () => {
      const [{ TextLayer }, pdfPage] = await Promise.all([
        import("pdfjs-dist"),
        pdf.doc.getPage(page + 1),
      ])
      if (cancelled) return
      const viewport = pdfPage.getViewport({ scale: width / size.width })
      container.style.setProperty(
        "--total-scale-factor",
        String(viewport.scale * pdfPage.userUnit)
      )
      textLayer = new TextLayer({
        textContentSource: pdfPage.streamTextContent(),
        container,
        viewport,
      })
      await textLayer.render()
      if (!cancelled)
        setStatus(
          textLayer.textContentItemsStr.some((text) => text.trim())
            ? "ready"
            : "empty"
        )
    })().catch(() => {
      if (!cancelled) setStatus("error")
    })
    return () => {
      cancelled = true
      textLayer?.cancel()
      container.remove()
    }
  }, [pdf.doc, page, size.width, width])

  useEffect(() => {
    const update = () => {
      if (!root.current || !layer.current) return
      setSelection(
        selectedTextAreas({
          selection: window.getSelection(),
          layer: layer.current,
          bounds: root.current.getBoundingClientRect(),
          size,
          page,
        })
      )
    }
    document.addEventListener("selectionchange", update)
    return () => document.removeEventListener("selectionchange", update)
  }, [page, size])

  const mark = () => {
    if (!selection.length || disabled) return
    onMark(selection)
    window.getSelection()?.removeAllRanges()
    setSelection([])
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={disabled || status !== "ready" || !selection.length}
          onPointerDown={(event) => event.preventDefault()}
          onClick={mark}
        >
          {t("tools.redact.markSelection")}
        </Button>
        <span className="text-sm text-muted-foreground" role="status">
          {status === "loading"
            ? t("tools.redact.loadingText")
            : status === "empty"
              ? t("tools.redact.noText")
              : status === "error"
                ? t("tools.redact.textError")
                : t("tools.redact.selectText")}
        </span>
      </div>
      <div
        ref={root}
        className="relative mx-auto w-full max-w-[800px]"
        aria-busy={disabled}
      >
        <PagePreview doc={pdf.doc} index={page} size={size} width={800} />
        <div
          ref={layer}
          className={
            disabled ? "pointer-events-none select-none" : "select-text"
          }
        />
        <svg
          className="pointer-events-none absolute inset-0 size-full"
          viewBox={`0 0 ${size.width} ${size.height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {areas
            .filter((area) => area.page === page)
            .map((area, index) => (
              <rect
                key={index}
                x={area.x}
                y={area.y}
                width={area.width}
                height={area.height}
                fill="black"
              />
            ))}
          {highlights
            .filter((area) => area.page === page)
            .map((area, index) => (
              <rect
                key={`match-${index}`}
                x={area.x}
                y={area.y}
                width={area.width}
                height={area.height}
                fill="rgb(245 158 11 / 0.3)"
                stroke="rgb(217 119 6)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
        </svg>
      </div>
    </div>
  )
}

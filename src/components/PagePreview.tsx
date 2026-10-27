import { useEffect, useState, type ReactNode } from "react"
import { renderPage, type PdfDoc } from "@/lib/render/pdfjs"
import { Spinner } from "./Spinner"

interface PagePreviewProps {
  doc: PdfDoc
  index: number
  /** Page size in points (visual). */
  size: { width: number; height: number }
  /** Display width in CSS pixels. */
  width: number
  /** SVG content drawn on top, in page points (top-left origin, y down). */
  children?: ReactNode
}

/** A page image with an SVG overlay in page coordinates, for live previews. */
export function PagePreview({ doc, index, size, width, children }: PagePreviewProps) {
  const [src, setSrc] = useState<string>()

  useEffect(() => {
    const controller = new AbortController()
    const scale = (width / size.width) * Math.min(2, window.devicePixelRatio || 1)
    renderPage(doc, index, scale, controller.signal)
      .then((canvas) => {
        if (controller.signal.aborted) return
        setSrc(canvas.toDataURL("image/jpeg", 0.9))
        canvas.width = canvas.height = 0
      })
      .catch(() => {})
    return () => controller.abort()
  }, [doc, index, width, size.width])

  return (
    <div className="relative overflow-hidden bg-white shadow-md ring-1 ring-black/10" style={{ width: `min(100%, ${width}px)`, aspectRatio: `${size.width} / ${size.height}` }}>
      {src ? (
        <img src={src} alt="" className="absolute inset-0 size-full" draggable={false} />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <Spinner />
        </div>
      )}
      <svg
        className="pointer-events-none absolute inset-0 size-full"
        viewBox={`0 0 ${size.width} ${size.height}`}
        preserveAspectRatio="none"
      >
        {children}
      </svg>
    </div>
  )
}

import { useEffect, useRef, useState } from "react"
import { renderPage, type PdfDoc } from "@/lib/render/pdfjs"
import { cn } from "@/lib/utils"

interface PageThumbnailProps {
  /** The document to render from. Omit for a blank page. */
  doc?: PdfDoc
  /** 0-based page index. */
  index: number
  /** Size of the square cell in CSS pixels; the page is fitted inside it. */
  box: number
  /** Page size in points (visual). */
  size: { width: number; height: number }
  /** Extra clockwise rotation to preview, in degrees. */
  rotation?: number
  className?: string
}

/** A lazily rendered page image. Pages render only when scrolled into view. */
export function PageThumbnail({ doc, index, box, size, rotation = 0, className }: PageThumbnailProps) {
  const host = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [src, setSrc] = useState<string>()

  const sideways = (((rotation % 360) + 360) % 360) % 180 === 90
  const [visualW, visualH] = sideways ? [size.height, size.width] : [size.width, size.height]
  const scale = Math.min(box / visualW, box / visualH)
  const width = size.width * scale
  const height = size.height * scale

  useEffect(() => {
    const el = host.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setVisible(true), {
      rootMargin: "300px",
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible || !doc) return
    const controller = new AbortController()
    // Render once at the largest size the page can take in the box, whatever the rotation.
    const renderScale = (box / Math.min(size.width, size.height)) * Math.min(2, window.devicePixelRatio || 1)
    renderPage(doc, index, renderScale, controller.signal)
      .then((canvas) => {
        if (controller.signal.aborted) return
        setSrc(canvas.toDataURL("image/jpeg", 0.85))
        canvas.width = canvas.height = 0
      })
      .catch(() => {})
    return () => controller.abort()
  }, [visible, doc, index, box, size.width, size.height])

  return (
    <div ref={host} className={cn("grid shrink-0 place-items-center", className)} style={{ width: box, height: box }}>
      <div
        className="bg-white shadow-sm ring-1 ring-black/10 transition-transform duration-200"
        style={{ width, height, transform: `rotate(${rotation}deg)` }}
      >
        {src && <img src={src} alt="" className="size-full" draggable={false} />}
      </div>
    </div>
  )
}

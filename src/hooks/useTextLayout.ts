import { useEffect, useState } from "react"
import { layoutToSvgPath } from "@/lib/text/draw"
import { prepareLayout, type LayoutOptions, type TextLayout } from "@/lib/text/layout"

export interface PreparedText {
  layout: TextLayout
  /** SVG path data in box coordinates (top-left origin, y down). */
  path: string
  missing: string[]
}

/**
 * Lays out text with the PDF text engine (loading fonts as needed), so previews
 * show exactly the outlines that will be saved.
 */
export function useTextLayout(text: string, options: LayoutOptions): PreparedText | undefined {
  const [result, setResult] = useState<PreparedText>()
  const key = JSON.stringify([text, options])

  useEffect(() => {
    let cancelled = false
    const [t, o] = JSON.parse(key) as [string, LayoutOptions]
    prepareLayout(t, o)
      .then(({ layout, missing }) => {
        if (!cancelled) setResult({ layout, path: layoutToSvgPath(layout), missing })
      })
      .catch((error) => console.error(error))
    return () => {
      cancelled = true
    }
  }, [key])

  return result
}

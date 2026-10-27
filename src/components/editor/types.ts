import type { Annotation, AnnotationType } from "@/lib/annotate/model"

export type ToolId = "select" | AnnotationType

/** Style used for new objects; the properties panel edits it when nothing is selected. */
export interface ToolStyle {
  stroke: string
  fill: string | null
  strokeWidth: number
  opacity: number
  textColor: string
  fontSize: number
  bold: boolean
  align: "left" | "center" | "right"
  highlight: string
  note: string
}

export const DEFAULT_STYLE: ToolStyle = {
  stroke: "#dc2626",
  fill: null,
  strokeWidth: 2,
  opacity: 1,
  textColor: "#111827",
  fontSize: 16,
  bold: false,
  align: "left",
  highlight: "#fde047",
  note: "#facc15",
}

/** Tools that stay active after drawing, for drawing several in a row. */
export const STICKY_TOOLS: ToolId[] = ["pen", "highlight"]

export const newId = () => crypto.randomUUID()

/** Builds a new object of the given type at a box, using the current style. */
export function createObject(
  type: Exclude<AnnotationType, "image">,
  page: number,
  box: { x: number; y: number; width: number; height: number },
  style: ToolStyle,
  points?: number[]
): Annotation {
  const base = { id: newId(), page, opacity: style.opacity }
  switch (type) {
    case "text":
      return {
        ...base,
        type,
        ...box,
        rotation: 0,
        text: "",
        fontSize: style.fontSize,
        color: style.textColor,
        bold: style.bold,
        align: style.align,
      }
    case "rect":
    case "ellipse":
      return { ...base, type, ...box, rotation: 0, stroke: style.stroke, fill: style.fill, strokeWidth: style.strokeWidth }
    case "highlight":
      return { ...base, type, ...box, rotation: 0, color: style.highlight, opacity: Math.min(style.opacity, 0.6) }
    case "line":
    case "arrow":
    case "pen":
      return { ...base, type, points: points ?? [], stroke: style.stroke, strokeWidth: style.strokeWidth }
    case "note":
      return { ...base, type, x: box.x, y: box.y, text: "", color: style.note }
  }
}

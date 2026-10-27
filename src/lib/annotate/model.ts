/**
 * Annotation objects, shared by the editor (Konva) and the PDF exporter.
 *
 * Coordinates are in visual page points: origin at the top-left of the page
 * as displayed (after /Rotate), y pointing down. Box objects rotate clockwise
 * around their top-left corner, exactly like Konva nodes.
 */

interface Base {
  id: string
  /** 0-based page index. */
  page: number
  opacity: number
}

export interface Box {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

export interface TextObject extends Base, Box {
  type: "text"
  text: string
  fontSize: number
  color: string
  bold: boolean
  align: "left" | "center" | "right"
  /** Font family; "signature" is a handwriting style used for typed signatures. */
  family?: "sans" | "signature"
}

export interface ImageObject extends Base, Box {
  type: "image"
  /** A data: URL (PNG or JPEG). */
  src: string
}

export interface ShapeObject extends Base, Box {
  type: "rect" | "ellipse"
  stroke: string | null
  fill: string | null
  strokeWidth: number
}

export interface HighlightObject extends Base, Box {
  type: "highlight"
  color: string
}

export interface LineObject extends Base {
  type: "line" | "arrow" | "pen"
  /** Flat list of x,y pairs in page points. */
  points: number[]
  stroke: string
  strokeWidth: number
}

export interface NoteObject extends Base {
  type: "note"
  x: number
  y: number
  text: string
  color: string
}

export type Annotation = TextObject | ImageObject | ShapeObject | HighlightObject | LineObject | NoteObject
export type AnnotationType = Annotation["type"]

export const isBox = (a: Annotation): a is Annotation & Box => "width" in a

/** Arrowhead size, shared by the editor and the exporter so they match. */
export function arrowHead(strokeWidth: number) {
  return { length: 6 + strokeWidth * 3, width: 6 + strokeWidth * 3 }
}

export const TEXT_LINE_HEIGHT = 1.3
export const NOTE_SIZE = 24

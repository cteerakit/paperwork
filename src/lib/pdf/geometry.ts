/**
 * Coordinate helpers. Tools work in "visual" coordinates: points measured from
 * the top-left of the page as the user sees it (after /Rotate), y pointing down.
 * PDF content lives in unrotated user space with y pointing up, offset by the CropBox.
 */
import { degrees, type PDFPage } from "pdf-lib"

export type Matrix = [number, number, number, number, number, number]

export interface PageFrame {
  /** Visual size in points (width and height swap for 90/270 rotation). */
  width: number
  height: number
  rotation: 0 | 90 | 180 | 270
  /** Maps visual coordinates (bottom-left origin, y up) to PDF user space. */
  matrix: Matrix
}

export function normalizeRotation(angle: number): 0 | 90 | 180 | 270 {
  return ((((Math.round(angle / 90) * 90) % 360) + 360) % 360) as 0 | 90 | 180 | 270
}

export function pageFrame(page: PDFPage): PageFrame {
  const { x, y, width: w, height: h } = page.getCropBox()
  const rotation = normalizeRotation(page.getRotation().angle)
  switch (rotation) {
    case 90:
      return { width: h, height: w, rotation, matrix: [0, 1, -1, 0, x + w, y] }
    case 180:
      return { width: w, height: h, rotation, matrix: [-1, 0, 0, -1, x + w, y + h] }
    case 270:
      return { width: h, height: w, rotation, matrix: [0, -1, 1, 0, x, y + h] }
    default:
      return { width: w, height: h, rotation, matrix: [1, 0, 0, 1, x, y] }
  }
}

/** Adds `delta` degrees (a multiple of 90) to a page's rotation. */
export function rotatePage(page: PDFPage, delta: number) {
  page.setRotation(degrees(normalizeRotation(page.getRotation().angle + delta)))
}

export interface Placement {
  /** Top-left corner in visual points (y down). */
  x: number
  y: number
  /** Clockwise rotation in degrees around the top-left corner (as on screen). */
  rotation?: number
}

/**
 * Maps an object's local coordinates (origin at its top-left, y up, so the
 * object occupies negative y) into visual bottom-left coordinates.
 */
export function placementMatrix({ x, y, rotation = 0 }: Placement, pageHeight: number): Matrix {
  const r = (rotation * Math.PI) / 180
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  return [cos, -sin, sin, cos, x, pageHeight - y]
}

/** Applies a matrix to a point. */
export function apply(m: Matrix, px: number, py: number): [number, number] {
  return [m[0] * px + m[2] * py + m[4], m[1] * px + m[3] * py + m[5]]
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "")
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h.padEnd(6, "0")
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [number, number, number]
}

/** Shape and image drawing in visual page coordinates (see geometry.ts). */
import type { PDFDocument, PDFRef } from "pdf-lib"
import { matrix, num, rgb, type BlendMode, type PageWriter } from "./content"
import { hexToRgb, placementMatrix, type Placement } from "./geometry"

export interface Paint {
  stroke?: string | null
  fill?: string | null
  strokeWidth?: number
  opacity?: number
  blend?: BlendMode
}

/** Runs `body` inside a local frame: origin at the placement's top-left, y up. */
function local(writer: PageWriter, placement: Placement, paint: Paint, body: string[]) {
  const ops = ["q"]
  if ((paint.opacity ?? 1) < 1 || paint.blend) {
    ops.push(`${writer.graphicsState(paint.opacity ?? 1, paint.blend)} gs`)
  }
  ops.push(matrix(placementMatrix(placement, writer.frame.height)))
  if (paint.stroke) ops.push(`${rgb(hexToRgb(paint.stroke))} RG`, `${num(paint.strokeWidth ?? 1)} w`)
  if (paint.fill) ops.push(`${rgb(hexToRgb(paint.fill))} rg`)
  ops.push(...body, "Q")
  writer.push(...ops)
}

function paintOp(paint: Paint, closed: boolean) {
  const stroke = Boolean(paint.stroke) && (paint.strokeWidth ?? 1) > 0
  if (closed && paint.fill && stroke) return "B"
  if (closed && paint.fill) return "f"
  if (stroke) return closed ? "s" : "S"
  return "n"
}

export function drawRect(writer: PageWriter, box: Placement & { width: number; height: number }, paint: Paint) {
  local(writer, box, paint, [`0 ${num(-box.height)} ${num(box.width)} ${num(box.height)} re`, paintOp(paint, true)])
}

export function drawEllipse(writer: PageWriter, box: Placement & { width: number; height: number }, paint: Paint) {
  // Four cubic Béziers approximate an ellipse; k is the standard control-point ratio.
  const k = 0.5522847498
  const rx = box.width / 2
  const ry = box.height / 2
  const cx = rx
  const cy = -ry
  const ops = [
    `${num(cx + rx)} ${num(cy)} m`,
    `${num(cx + rx)} ${num(cy + ry * k)} ${num(cx + rx * k)} ${num(cy + ry)} ${num(cx)} ${num(cy + ry)} c`,
    `${num(cx - rx * k)} ${num(cy + ry)} ${num(cx - rx)} ${num(cy + ry * k)} ${num(cx - rx)} ${num(cy)} c`,
    `${num(cx - rx)} ${num(cy - ry * k)} ${num(cx - rx * k)} ${num(cy - ry)} ${num(cx)} ${num(cy - ry)} c`,
    `${num(cx + rx * k)} ${num(cy - ry)} ${num(cx + rx)} ${num(cy - ry * k)} ${num(cx + rx)} ${num(cy)} c`,
    paintOp(paint, true),
  ]
  local(writer, box, paint, ops)
}

/** A polyline through page points (flat x,y list), with round caps and joins. */
export function drawPolyline(writer: PageWriter, points: number[], paint: Paint) {
  if (points.length < 4) return
  const ops = ["1 J", "1 j", `${num(points[0])} ${num(-points[1])} m`]
  for (let i = 2; i < points.length; i += 2) ops.push(`${num(points[i])} ${num(-points[i + 1])} l`)
  ops.push(paintOp(paint, false))
  local(writer, { x: 0, y: 0 }, paint, ops)
}

/** A filled triangle arrowhead pointing from (x1,y1) to (x2,y2). */
export function drawArrowHead(
  writer: PageWriter,
  [x1, y1, x2, y2]: number[],
  size: { length: number; width: number },
  color: string,
  opacity?: number
) {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const back = (dx: number, dy: number): [number, number] => [x2 + dx * cos - dy * sin, y2 + dx * sin + dy * cos]
  const [ax, ay] = back(-size.length, size.width / 2)
  const [bx, by] = back(-size.length, -size.width / 2)
  local(writer, { x: 0, y: 0 }, { fill: color, opacity }, [
    `${num(x2)} ${num(-y2)} m`,
    `${num(ax)} ${num(-ay)} l`,
    `${num(bx)} ${num(-by)} l`,
    "f",
  ])
}

export function drawImage(
  writer: PageWriter,
  ref: PDFRef,
  box: Placement & { width: number; height: number },
  opacity = 1
) {
  local(writer, box, { opacity }, [
    `${num(box.width)} 0 0 ${num(box.height)} 0 ${num(-box.height)} cm`,
    `${writer.xObject(ref)} Do`,
  ])
}

/** Embeds a PNG or JPEG image (bytes or data: URL) and returns its reference. */
export async function embedImage(doc: PDFDocument, image: Uint8Array | string): Promise<PDFRef> {
  const bytes = typeof image === "string" ? dataUrlToBytes(image) : image
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50
  const embedded = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
  return embedded.ref
}

export function dataUrlToBytes(url: string): Uint8Array {
  const base64 = url.slice(url.indexOf(",") + 1)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * Turns a text layout into vector outlines: SVG path data for on-screen previews
 * and PDF path operators for export. Both come from the same glyph outlines, so
 * the preview matches the PDF exactly.
 */
import type { LoadedFont } from "./fonts"
import type { TextLayout } from "./layout"

type Command = { type: string; values: number[] }

const outlineCache = new WeakMap<LoadedFont, Map<number, Command[]>>()

function outline(font: LoadedFont, gid: number): Command[] {
  let perFont = outlineCache.get(font)
  if (!perFont) {
    perFont = new Map()
    outlineCache.set(font, perFont)
  }
  let commands = perFont.get(gid)
  if (!commands) {
    commands = font.hb.glyphToJson(gid)
    perFont.set(gid, commands)
  }
  return commands
}

const n = (v: number) => {
  const r = Math.round(v * 100) / 100
  return Object.is(r, -0) ? "0" : String(r)
}

/**
 * Walks every glyph outline in box coordinates: origin at the box's top-left,
 * y pointing down. Quadratic curves are converted to cubic, since PDF only has cubic.
 */
function walk(
  layout: TextLayout,
  emit: {
    move(x: number, y: number): void
    line(x: number, y: number): void
    cubic(x1: number, y1: number, x2: number, y2: number, x: number, y: number): void
    close(): void
  }
) {
  for (const line of layout.lines) {
    for (const g of line.glyphs) {
      const s = layout.fontSize / g.font.upem
      const ox = line.x + g.x
      const oy = line.baseline - g.y
      const X = (v: number) => ox + v * s
      const Y = (v: number) => oy - v * s
      let cx = 0
      let cy = 0
      for (const { type, values: v } of outline(g.font, g.gid)) {
        switch (type) {
          case "M":
            emit.move(X(v[0]), Y(v[1]))
            ;[cx, cy] = [v[0], v[1]]
            break
          case "L":
            emit.line(X(v[0]), Y(v[1]))
            ;[cx, cy] = [v[0], v[1]]
            break
          case "Q": {
            const [qx, qy, x, y] = v
            emit.cubic(
              X(cx + (2 / 3) * (qx - cx)),
              Y(cy + (2 / 3) * (qy - cy)),
              X(x + (2 / 3) * (qx - x)),
              Y(y + (2 / 3) * (qy - y)),
              X(x),
              Y(y)
            )
            ;[cx, cy] = [x, y]
            break
          }
          case "C":
            emit.cubic(X(v[0]), Y(v[1]), X(v[2]), Y(v[3]), X(v[4]), Y(v[5]))
            ;[cx, cy] = [v[4], v[5]]
            break
          case "Z":
            emit.close()
            break
        }
      }
    }
  }
}

/** SVG path data in box coordinates (top-left origin, y down). */
export function layoutToSvgPath(layout: TextLayout): string {
  const parts: string[] = []
  walk(layout, {
    move: (x, y) => parts.push(`M${n(x)} ${n(y)}`),
    line: (x, y) => parts.push(`L${n(x)} ${n(y)}`),
    cubic: (a, b, c, d, x, y) => parts.push(`C${n(a)} ${n(b)} ${n(c)} ${n(d)} ${n(x)} ${n(y)}`),
    close: () => parts.push("Z"),
  })
  return parts.join("")
}

/**
 * PDF path construction operators with the origin at the box's top-left and
 * y pointing up (so text occupies negative y). The caller sets colour and
 * transform, then fills with "f".
 */
export function layoutToPdfPath(layout: TextLayout): string {
  const parts: string[] = []
  walk(layout, {
    move: (x, y) => parts.push(`${n(x)} ${n(-y)} m`),
    line: (x, y) => parts.push(`${n(x)} ${n(-y)} l`),
    cubic: (a, b, c, d, x, y) => parts.push(`${n(a)} ${n(-b)} ${n(c)} ${n(-d)} ${n(x)} ${n(-y)} c`),
    close: () => parts.push("h"),
  })
  return parts.join("\n")
}

/**
 * A small writer for raw PDF content streams. Everything we add to a page goes
 * through here, in visual coordinates, so rotated pages and CropBox offsets are
 * handled in one place.
 */
import type { PDFDict, PDFDocument, PDFPage, PDFRef } from "pdf-lib"
import { pageFrame, type Matrix, type PageFrame } from "./geometry"

const fmt = (v: number) => {
  const r = Math.round(v * 1000) / 1000
  return Object.is(r, -0) ? "0" : String(r)
}
export const num = fmt
export const matrix = (m: Matrix) => `${m.map(fmt).join(" ")} cm`
export const rgb = ([r, g, b]: [number, number, number]) => `${fmt(r)} ${fmt(g)} ${fmt(b)}`

export type BlendMode = "Normal" | "Multiply"

const wrapped = new WeakSet<object>()

export class PageWriter {
  readonly frame: PageFrame
  private ops: string[] = []
  private gsCache = new Map<string, string>()
  private resourceNames = new Map<PDFRef, string>()

  readonly doc: PDFDocument
  readonly page: PDFPage

  constructor(doc: PDFDocument, page: PDFPage) {
    this.doc = doc
    this.page = page
    this.frame = pageFrame(page)
  }

  push(...ops: string[]) {
    this.ops.push(...ops)
  }

  /** Name of an ExtGState with the given fill/stroke opacity and blend mode. */
  graphicsState(opacity: number, blend: BlendMode = "Normal"): string {
    const key = `${opacity}:${blend}`
    let name = this.gsCache.get(key)
    if (!name) {
      const dict = this.doc.context.obj({ Type: "ExtGState", ca: opacity, CA: opacity, BM: blend })
      name = this.page.node.newExtGState("GS", this.doc.context.register(dict)).asString()
      this.gsCache.set(key, name)
    }
    return name
  }

  xObject(ref: PDFRef): string {
    let name = this.resourceNames.get(ref)
    if (!name) {
      name = this.page.node.newXObject("X", ref).asString()
      this.resourceNames.set(ref, name)
    }
    return name
  }

  font(ref: PDFRef): string {
    let name = this.resourceNames.get(ref)
    if (!name) {
      name = this.page.node.newFontDictionary("F", ref).asString()
      this.resourceNames.set(ref, name)
    }
    return name
  }

  /** Appends the collected operators to the page, inside the visual-space transform. */
  commit() {
    if (this.ops.length === 0) return
    const { context } = this.doc
    const node = this.page.node

    // Existing content may leave the graphics state changed (e.g. an unbalanced cm).
    // Wrap it in q/Q once so our drawing starts from a clean state.
    if (!wrapped.has(node)) {
      node.normalize()
      if (node.Contents()) {
        node.wrapContentStreams(context.register(context.stream("q")), context.register(context.stream("Q")))
      }
      wrapped.add(node)
    }

    const content = ["q", matrix(this.frame.matrix), ...this.ops, "Q"].join("\n")
    node.addContentStream(context.register(context.flateStream(content)))
    this.ops = []
  }
}

/** Registers a Form XObject (a reusable drawing) and returns its reference. */
export function formXObject(
  doc: PDFDocument,
  content: string,
  bbox: [number, number, number, number],
  resources: PDFDict | Record<string, never> = {}
): PDFRef {
  const stream = doc.context.flateStream(content, {
    Type: "XObject",
    Subtype: "Form",
    BBox: bbox,
    Resources: resources,
  })
  return doc.context.register(stream)
}


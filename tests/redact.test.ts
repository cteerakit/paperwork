import { readFile } from "node:fs/promises"
import { init, type WrappedPdfiumModule } from "@embedpdf/pdfium"
import { createCanvas } from "@napi-rs/canvas"
import {
  PDFArray,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFString,
  StandardFonts,
  decodePDFRawStream,
  degrees,
  rgb,
} from "pdf-lib"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import { afterAll, beforeAll, expect, it } from "vitest"
import { RedactionError } from "@/lib/pdf/redactionError"
import { redactPdf, type Redaction } from "@/lib/pdf/redact"
import { pdfText } from "./helpers"

let engine: WrappedPdfiumModule
beforeAll(async () => {
  engine = await init({
    wasmBinary: await readFile(
      new URL(import.meta.resolve("@embedpdf/pdfium/pdfium.wasm"))
    ),
  })
  engine.PDFiumExt_Init()
})
afterAll(() => engine?.FPDF_DestroyLibrary())

function decodedObjects(doc: PDFDocument) {
  return doc.context
    .enumerateIndirectObjects()
    .map(([, object]) => {
      if (
        object instanceof PDFRawStream &&
        object.dict.get(PDFName.of("Subtype")) !== PDFName.of("Image")
      ) {
        return new TextDecoder("latin1").decode(
          decodePDFRawStream(object).decode()
        )
      }
      return object.toString()
    })
    .join("\n")
}

async function fixture(rotation = 0, crop = false) {
  const doc = await PDFDocument.create()
  doc.setTitle("Public document title")
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.addPage([400, 300])
  page.drawText("KEEP1 SECRET KEEP2 HIDDEN KEEP3", {
    x: 40,
    y: 240,
    size: 14,
    font,
  })
  page.drawRectangle({
    x: 20,
    y: 20,
    width: 30,
    height: 30,
    color: rgb(1, 0, 0),
  })
  const link = doc.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [20, 20, 50, 50],
    A: { S: "URI", URI: PDFString.of("https://example.com/") },
  })
  page.node.set(
    PDFName.of("Annots"),
    doc.context.obj([doc.context.register(link)])
  )
  const field = doc.getForm().createTextField("public-field")
  field.setText("Public form value")
  field.addToPage(page, { x: 150, y: 20, width: 150, height: 30 })
  doc
    .addPage([400, 300])
    .drawText("Untouched second page", { x: 40, y: 240, size: 14, font })
  if (crop) page.setCropBox(10, 15, 370, 270)
  page.setRotation(degrees(rotation))
  const bytes = await doc.save()
  const task = getDocument({ data: bytes.slice(), verbosity: 0 })
  try {
    const viewport = (await (await task.promise).getPage(1)).getViewport({
      scale: 1,
    })
    const regions = [
      { prefix: "KEEP1 ", text: "SECRET" },
      { prefix: "KEEP1 SECRET KEEP2 ", text: "HIDDEN" },
    ].map(({ prefix, text }): Redaction => {
      const left = 40 + font.widthOfTextAtSize(prefix, 14)
      const right = left + font.widthOfTextAtSize(text, 14)
      const [x1, y1] = viewport.convertToViewportPoint(left, 237)
      const [x2, y2] = viewport.convertToViewportPoint(right, 252)
      return {
        page: 0,
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
      }
    })
    return { bytes, regions }
  } finally {
    await task.destroy()
  }
}

it.each([0, 90, 180, 270])(
  "removes selected characters at rotation %i while preserving searchable neighbors and PDF features",
  async (rotation) => {
    const { bytes, regions } = await fixture(rotation, true)
    const output = await redactPdf(bytes, regions, engine)
    const texts = await pdfText(output)
    expect(texts[0]).not.toMatch(/SECRET|HIDDEN/)
    for (const word of ["KEEP1", "KEEP2", "KEEP3"])
      expect(texts[0]).toContain(word)
    expect(texts[1]).toBe("Untouched second page")
    const doc = await PDFDocument.load(output)
    const original = await PDFDocument.load(bytes)
    expect(doc.getTitle()).toBe("Public document title")
    expect(doc.getPage(0).getRotation()).toEqual(
      original.getPage(0).getRotation()
    )
    expect(doc.getPage(0).getCropBox()).toEqual(
      original.getPage(0).getCropBox()
    )
    expect(doc.getForm().getTextField("public-field").getText()).toBe(
      "Public form value"
    )
    const objects = decodedObjects(doc)
    for (const secret of ["SECRET", "HIDDEN"]) {
      expect(objects).not.toContain(secret)
      expect(objects.toLowerCase()).not.toContain(
        Buffer.from(secret).toString("hex")
      )
    }
    expect(objects).toContain("https://example.com/")
    expect(objects).not.toContain("/Subtype /Image")
  }
)

it("paints a permanent black bar and keeps surrounding vector artwork unchanged", async () => {
  const { bytes, regions } = await fixture()
  const output = await redactPdf(bytes, regions, engine)
  const task = getDocument({ data: output.slice(), verbosity: 0 })
  try {
    const page = await (await task.promise).getPage(1)
    const canvas = createCanvas(400, 300)
    await page.render({
      canvas: null,
      canvasContext: canvas.getContext(
        "2d"
      ) as unknown as CanvasRenderingContext2D,
      viewport: page.getViewport({ scale: 1 }),
    }).promise
    const ctx = canvas.getContext("2d")
    const area = regions[0]
    expect([
      ...ctx.getImageData(Math.ceil(area.x + 2), Math.ceil(area.y + 2), 1, 1)
        .data,
    ]).toEqual([0, 0, 0, 255])
    expect([...ctx.getImageData(30, 270, 1, 1).data]).toEqual([255, 0, 0, 255])
    expect([...ctx.getImageData(5, 5, 1, 1).data]).toEqual([255, 255, 255, 255])
  } finally {
    await task.destroy()
  }
})

it("rejects empty, malformed, and out-of-page selections", async () => {
  const { bytes } = await fixture()
  await expect(redactPdf(bytes, [], engine)).rejects.toThrow("Select an area")
  for (const area of [
    { page: 2, x: 0, y: 0, width: 10, height: 10 },
    { page: 0, x: -1, y: 0, width: 10, height: 10 },
    { page: 0, x: 0, y: 0, width: NaN, height: 10 },
    { page: 0, x: 390, y: 0, width: 20, height: 10 },
  ])
    await expect(redactPdf(bytes, [area], engine)).rejects.toThrow(
      /redaction area/i
    )
})

it("rejects selections over images or form fields instead of leaving covered data in the file", async () => {
  const { bytes } = await fixture()
  for (const region of [{ page: 0, x: 150, y: 250, width: 50, height: 20 }])
    await expect(redactPdf(bytes, [region], engine)).rejects.toBeInstanceOf(
      RedactionError
    )
  const doc = await PDFDocument.create()
  const page = doc.addPage([400, 300])
  const canvas = createCanvas(30, 30)
  const context = canvas.getContext("2d")
  context.fillStyle = "#ff00ff"
  context.fillRect(0, 0, 30, 30)
  const image = await doc.embedPng(canvas.toBuffer("image/png"))
  page.drawImage(image, { x: 100, y: 100, width: 30, height: 30 })
  await expect(
    redactPdf(
      await doc.save(),
      [{ page: 0, x: 95, y: 165, width: 40, height: 40 }],
      engine
    )
  ).rejects.toBeInstanceOf(RedactionError)
})

it("keeps images and pre-existing redaction marks outside the selected text unchanged", async () => {
  const { bytes, regions } = await fixture()
  const doc = await PDFDocument.load(bytes)
  const page = doc.getPage(0)
  const canvas = createCanvas(20, 20)
  canvas.getContext("2d").fillRect(0, 0, 20, 20)
  const image = await doc.embedPng(canvas.toBuffer("image/png"))
  page.drawImage(image, { x: 60, y: 20, width: 20, height: 20 })
  const pending = doc.context.register(
    doc.context.obj({
      Type: "Annot",
      Subtype: "Redact",
      Rect: [10, 100, 50, 150],
    })
  )
  page.node.Annots()?.push(pending)
  const output = await redactPdf(await doc.save(), regions, engine)
  const saved = await PDFDocument.load(output)
  const imageStreams = saved.context
    .enumerateIndirectObjects()
    .filter(
      ([, object]) =>
        object instanceof PDFRawStream &&
        object.dict.get(PDFName.of("Subtype")) === PDFName.of("Image")
    )
  expect(imageStreams).toHaveLength(1)
  expect(saved.getPage(0).node.Annots()?.size()).toBe(3)
  expect(decodedObjects(saved)).toContain("/Subtype /Redact")
})

it("handles scaled PDF user units without moving the bar or removing neighboring text", async () => {
  const { bytes, regions } = await fixture()
  const doc = await PDFDocument.load(bytes)
  doc.getPage(0).node.set(PDFName.of("UserUnit"), doc.context.obj(2))
  const output = await redactPdf(
    await doc.save(),
    regions.map((region) => ({
      ...region,
      x: region.x * 2,
      y: region.y * 2,
      width: region.width * 2,
      height: region.height * 2,
    })),
    engine
  )
  const [text] = await pdfText(output)
  expect(text).not.toMatch(/SECRET|HIDDEN/)
  expect(text).toContain("KEEP2")
})

it("redacts text inside a shared form only at the selected occurrence", async () => {
  const source = await PDFDocument.create()
  source
    .addPage([200, 100])
    .drawText("SECRET PUBLIC", { x: 20, y: 60, size: 12 })
  const doc = await PDFDocument.create()
  const [embedded] = await doc.embedPdf(await source.save())
  const page = doc.addPage([400, 300])
  page.drawPage(embedded, { x: 0, y: 0 })
  page.drawPage(embedded, { x: 100, y: 180 })
  const output = await redactPdf(
    await doc.save(),
    [{ page: 0, x: 119, y: 48, width: 50, height: 16 }],
    engine
  )
  const [text] = await pdfText(output)
  expect(text.match(/SECRET/g)).toHaveLength(1)
  expect(text.match(/PUBLIC/g)).toHaveLength(2)
})

it("removes replacement text and obsolete streams associated with redacted characters", async () => {
  const { bytes, regions } = await fixture()
  const source = await PDFDocument.load(bytes)
  const page = source.getPage(0)
  const contents = page.node.Contents()
  const streams = contents instanceof PDFArray ? contents.asArray() : [contents]
  const original = streams
    .map((ref) => {
      const stream = source.context.lookup(ref)
      if (!(stream instanceof PDFRawStream))
        throw new Error("Expected a PDF content stream")
      return new TextDecoder().decode(decodePDFRawStream(stream).decode())
    })
    .join("\n")
  const marked = source.context.flateStream(
    `/Span << /ActualText (SECRET HIDDEN) /Alt (SECRET HIDDEN) /E (SECRET HIDDEN) >> BDC\n${original}\nEMC`
  )
  page.node.set(PDFName.of("Contents"), source.context.register(marked))
  const output = await redactPdf(await source.save(), regions, engine)
  const [text] = await pdfText(output)
  expect(text).not.toMatch(/SECRET|HIDDEN/)
  expect(text).toContain("KEEP2")
  const objects = decodedObjects(await PDFDocument.load(output))
  expect(objects).not.toMatch(/SECRET|HIDDEN/)
})

it("saves selected text over an ordinary page background", async () => {
  const doc = await PDFDocument.create()
  const page = doc.addPage([400, 300])
  page.drawRectangle({
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    color: rgb(1, 1, 1),
  })
  page.drawText("PUBLIC SECRET REMAINS", { x: 40, y: 240, size: 16 })
  const output = await redactPdf(
    await doc.save(),
    [{ page: 0, x: 102, y: 47, width: 65, height: 18 }],
    engine
  )
  const [text] = await pdfText(output)
  expect(text).not.toContain("SECRET")
  expect(text).toContain("PUBLIC")
  expect(text).toContain("REMAINS")
})

it("removes a transparent hyperlink over selected text, including its target", async () => {
  const doc = await PDFDocument.create()
  const page = doc.addPage([400, 300])
  page.drawText("PUBLIC SECRET REMAINS", { x: 40, y: 240, size: 16 })
  const link = doc.context.register(
    doc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [102, 237, 167, 255],
      A: { S: "URI", URI: PDFString.of("https://example.com/SECRET") },
    })
  )
  page.node.set(PDFName.of("Annots"), doc.context.obj([link]))
  const output = await redactPdf(
    await doc.save(),
    [{ page: 0, x: 102, y: 47, width: 65, height: 18 }],
    engine
  )
  const [text] = await pdfText(output)
  expect(text).not.toContain("SECRET")
  expect(text).toContain("REMAINS")
  const saved = await PDFDocument.load(output)
  expect(saved.getPage(0).node.Annots()?.size() ?? 0).toBe(0)
  expect(decodedObjects(saved)).not.toContain("https://example.com/SECRET")
})

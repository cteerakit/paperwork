import { createCanvas, loadImage } from "@napi-rs/canvas"
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName } from "pdf-lib"
import { describe, expect, it } from "vitest"
import { applyAnnotations } from "@/lib/pdf/annotate"
import { compressPdf, type JpegRecoder } from "@/lib/pdf/compress"
import { loadPdf, PdfError } from "@/lib/pdf/load"
import { addPageNumbers } from "@/lib/pdf/pageNumbers"
import { buildFromPages, mergePdfs, splitPdf } from "@/lib/pdf/pages"
import { addTextWatermark } from "@/lib/pdf/watermark"
import { makeImagePdf, makePdf, pdfText } from "./helpers"

const nodeRecoder: JpegRecoder = async (jpeg, maxSize, quality) => {
  const image = await loadImage(Buffer.from(jpeg))
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
  const canvas = createCanvas(
    Math.round(image.width * scale),
    Math.round(image.height * scale)
  )
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height)
  return {
    bytes: canvas.toBuffer("image/jpeg", Math.round(quality * 100)),
    width: canvas.width,
    height: canvas.height,
  }
}

const xObjectNames = (doc: PDFDocument, i: number) =>
  doc
    .getPage(i)
    .node.Resources()
    ?.lookupMaybe(PDFName.of("XObject"), PDFDict)
    ?.keys() ?? []

describe("page operations", () => {
  it("reorders, rotates and deletes in one pass", async () => {
    const out = await buildFromPages(await makePdf(4), [
      { index: 2 },
      { index: 0, rotate: 90 },
      { index: 3, rotate: -90 },
    ])
    expect(await pdfText(out)).toEqual(["Page 3", "Page 1", "Page 4"])
    const doc = await PDFDocument.load(out)
    expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([
      0, 90, 270,
    ])
  })

  it("merges and splits", async () => {
    const merged = await mergePdfs([await makePdf(2), await makePdf(3)])
    expect(await pdfText(merged)).toEqual([
      "Page 1",
      "Page 2",
      "Page 1",
      "Page 2",
      "Page 3",
    ])
    const parts = await splitPdf(await makePdf(5), [[0, 1], [2], [3, 4]])
    expect(await Promise.all(parts.map(pdfText))).toEqual([
      ["Page 1", "Page 2"],
      ["Page 3"],
      ["Page 4", "Page 5"],
    ])
  })

  it("reports invalid files with a code", async () => {
    await expect(
      loadPdf(new TextEncoder().encode("not a pdf"))
    ).rejects.toMatchObject({ code: "invalid" })
    await expect(loadPdf(new Uint8Array())).rejects.toBeInstanceOf(PdfError)
  })
})

describe("text on pages", () => {
  it.each([
    "مرحبا بالعالم، هذا مستند تجريبي 2026",
    "שלום עולם, זהו מסמך לדוגמה",
    "English: abc שלום def",
    "Arabic: مرحبا بالعالم، هذا مستند تجريبي 2026",
    "ที่นี่ ปั้น กุ้ง น้ำ ผู้ใหญ่",
  ])("preserves searchable annotation text: %s", async (text) => {
    const { bytes } = await applyAnnotations(await makePdf(1), [
      {
        id: "searchable",
        type: "text",
        page: 0,
        x: 40,
        y: 80,
        width: 510,
        height: 40,
        rotation: 0,
        opacity: 1,
        text,
        fontSize: 14,
        color: "#000000",
        bold: false,
        align: "left",
      },
    ])
    expect((await pdfText(bytes))[0]).toContain(text)
  })

  it("adds Thai page numbers as outlines on the chosen pages", async () => {
    const { bytes, missing } = await addPageNumbers(await makePdf(3), {
      position: "bottom-center",
      template: "หน้า {n} จาก {total}",
      startAt: 1,
      pages: [1, 2],
      fontSize: 12,
      color: "#000000",
    })
    expect(missing).toEqual([])
    const doc = await PDFDocument.load(bytes)
    expect([0, 1, 2].map((i) => xObjectNames(doc, i).length)).toEqual([0, 1, 1])
    // Outlines only: the page numbers are not part of the searchable text.
    expect(await pdfText(bytes)).toEqual(["Page 1", "Page 2", "Page 3"])
  })

  it("tiles a watermark using one XObject shared by every page", async () => {
    const { bytes } = await addTextWatermark(await makePdf(2), {
      text: "ลับเฉพาะ CONFIDENTIAL",
      fontSize: 40,
      color: "#ff0000",
      opacity: 0.3,
      angle: 45,
      layout: "tile",
      pages: [0, 1],
    })
    const doc = await PDFDocument.load(bytes)
    const refs = [0, 1].map((i) =>
      doc
        .getPage(i)
        .node.Resources()!
        .lookup(PDFName.of("XObject"), PDFDict)
        .values()
        .map(String)
    )
    expect(refs[0]).toHaveLength(1)
    expect(refs[0]).toEqual(refs[1])
  })

  it("makes annotation text searchable and keeps sticky notes as comments", async () => {
    const thai = "สวัสดีครับ ที่นี่คือเอกสาร"
    const { bytes } = await applyAnnotations(
      await makePdf(1, { rotate: { 0: 90 } }),
      [
        {
          id: "t1",
          type: "text",
          page: 0,
          x: 40,
          y: 40,
          width: 300,
          height: 40,
          rotation: 0,
          opacity: 1,
          text: thai,
          fontSize: 18,
          color: "#1d4ed8",
          bold: false,
          align: "left",
        },
        {
          id: "n1",
          type: "note",
          page: 0,
          x: 100,
          y: 100,
          text: "ตรวจสอบหน้านี้",
          color: "#facc15",
          opacity: 1,
        },
        {
          id: "r1",
          type: "rect",
          page: 0,
          x: 30,
          y: 30,
          width: 320,
          height: 60,
          rotation: 0,
          opacity: 1,
          stroke: "#ff0000",
          fill: null,
          strokeWidth: 2,
        },
      ]
    )
    const [text] = await pdfText(bytes)
    expect(text).toContain(thai)

    const doc = await PDFDocument.load(bytes)
    const note = doc
      .getPage(0)
      .node.lookup(PDFName.of("Annots"), PDFArray)
      .lookup(0, PDFDict)
    expect(note.lookup(PDFName.of("Contents"), PDFHexString).decodeText()).toBe(
      "ตรวจสอบหน้านี้"
    )
  })
})

describe("compression", () => {
  it("shrinks large JPEGs at medium level", async () => {
    const input = await makeImagePdf()
    const output = await compressPdf(input, "medium", {
      recodeJpeg: nodeRecoder,
    })
    expect(output.length).toBeLessThan(input.length * 0.8)
    expect((await PDFDocument.load(output)).getPageCount()).toBe(1)
  })

  it("keeps every page and its text at light level", async () => {
    const output = await compressPdf(await makePdf(3), "light")
    expect(await pdfText(output)).toEqual(["Page 1", "Page 2", "Page 3"])
  })
})

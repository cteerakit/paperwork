/**
 * Builds a multilingual test sheet using every text feature (annotations,
 * watermark, page numbers) and renders each page to PNG, so rendering can be
 * checked by eye. Page 2 is rotated 90° to check coordinate mapping.
 *
 * Usage: pnpm render-pdf [outDir]                 build and render the test sheet (default: tmp/render)
 *        pnpm render-pdf --input file.pdf [outDir] render an existing PDF and print its text
 */
import { createCanvas } from "@napi-rs/canvas"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { basename, join, resolve } from "node:path"
import { degrees, PDFDocument, StandardFonts } from "pdf-lib"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import type { Annotation } from "../src/lib/annotate/model"
import { applyAnnotations } from "../src/lib/pdf/annotate"
import { addPageNumbers } from "../src/lib/pdf/pageNumbers"
import { addTextWatermark } from "../src/lib/pdf/watermark"
import { setFontLoader } from "../src/lib/text/fonts"

const root = resolve(import.meta.dirname, "..")
const args = process.argv.slice(2)
const inputIndex = args.indexOf("--input")
const input = inputIndex >= 0 ? args.splice(inputIndex, 2)[1] : undefined
const outDir = resolve(args[0] ?? join(root, "tmp", "render"))

setFontLoader(async (file) => {
  const bytes = await readFile(join(root, "public", "fonts", file))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
})

const SAMPLES: [string, string][] = [
  ["English", "The quick brown fox jumps over the lazy dog."],
  ["Thai", "ที่นี่ ปั้น กุ้ง น้ำ ผู้ใหญ่ ฤๅษี — สวัสดีครับ ยินดีต้อนรับสู่ระบบจัดการเอกสาร"],
  ["Vietnamese", "Tiếng Việt có dấu: Đường phố Hà Nội"],
  ["Arabic", "مرحبا بالعالم، هذا مستند تجريبي 2026"],
  ["Hebrew", "שלום עולם, זהו מסמך לדוגמה"],
  ["Hindi", "नमस्ते दुनिया, क्षत्रिय श्री"],
  ["Chinese", "你好，世界。这是一份测试文件。"],
  ["Japanese", "こんにちは世界。テスト文書です。"],
  ["Korean", "안녕하세요 세계. 테스트 문서입니다."],
]

async function basePdf() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < 2; i++) {
    const page = doc.addPage([595, 842])
    page.drawText(`Original content, page ${i + 1}`, { x: 40, y: 800, size: 14, font })
    if (i === 1) page.setRotation(degrees(90))
  }
  return doc.save()
}

function annotations(): Annotation[] {
  const base = { opacity: 1, rotation: 0 }
  const items: Annotation[] = SAMPLES.map(([label, text], i) => ({
    ...base,
    id: `t${i}`,
    type: "text",
    page: 0,
    x: 40,
    y: 70 + i * 62,
    width: 380,
    height: 50,
    text: `${label}: ${text}`,
    fontSize: 14,
    color: "#111827",
    bold: i === 0,
    align: "left",
  }))
  items.push(
    { ...base, id: "h", type: "highlight", page: 0, x: 36, y: 128, width: 390, height: 46, color: "#fde047" },
    { ...base, id: "r", type: "rect", page: 0, x: 440, y: 70, width: 110, height: 70, stroke: "#dc2626", fill: null, strokeWidth: 3 },
    { ...base, id: "e", type: "ellipse", page: 0, x: 440, y: 160, width: 110, height: 70, stroke: "#2563eb", fill: "#bfdbfe", strokeWidth: 2 },
    { ...base, id: "a", type: "arrow", page: 0, points: [450, 300, 540, 250], stroke: "#16a34a", strokeWidth: 3 },
    { ...base, id: "p", type: "pen", page: 0, points: [450, 340, 470, 360, 490, 335, 510, 365, 530, 340], stroke: "#9333ea", strokeWidth: 2 },
    {
      ...base,
      id: "sig",
      type: "text",
      page: 0,
      x: 440,
      y: 390,
      width: 140,
      height: 40,
      rotation: -10,
      text: "สมชาย ใจดี",
      fontSize: 22,
      color: "#1e3a8a",
      bold: false,
      align: "left",
      family: "signature",
    },
    { ...base, id: "n", type: "note", page: 0, x: 560, y: 70, text: "ตรวจสอบหน้านี้ / Check this page", color: "#facc15" },
    // Rotated page: these should appear upright in the top-left of the page as displayed.
    {
      ...base,
      id: "rt",
      type: "text",
      page: 1,
      x: 40,
      y: 40,
      width: 500,
      height: 40,
      text: "หน้านี้หมุน 90° — This page is rotated 90°",
      fontSize: 18,
      color: "#b91c1c",
      bold: true,
      align: "left",
    },
    { ...base, id: "rr", type: "rect", page: 1, x: 30, y: 30, width: 520, height: 50, stroke: "#b91c1c", fill: null, strokeWidth: 2 }
  )
  return items
}

async function render(bytes: Uint8Array, prefix = "page") {
  const task = getDocument({ data: bytes.slice(), verbosity: 0 })
  const pdf = await task.promise
  const files: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    if (input) {
      const text = (await page.getTextContent()).items.map((item) => ("str" in item ? item.str : "")).join("")
      const annots = (await page.getAnnotations()).map((a) => `[${a.subtype}] ${a.contentsObj?.str ?? ""}`)
      console.log(`Page ${i} text: ${text}`)
      if (annots.length) console.log(`Page ${i} annotations: ${annots.join(" | ")}`)
    }
    const viewport = page.getViewport({ scale: 1.5 })
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    const context = canvas.getContext("2d")
    context.fillStyle = "white"
    context.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise
    const file = join(outDir, `${prefix}-${i}.png`)
    await writeFile(file, canvas.toBuffer("image/png"))
    files.push(file)
  }
  await task.destroy()
  return files
}

if (input) {
  await mkdir(outDir, { recursive: true })
  const name = basename(input).replace(/\.pdf$/i, "")
  console.log((await render(new Uint8Array(await readFile(input)), name)).join("\n"))
  process.exit(0)
}

let bytes: Uint8Array = await basePdf()
bytes = (
  await addTextWatermark(bytes, {
    text: "ลับเฉพาะ · CONFIDENTIAL · سري",
    fontSize: 36,
    color: "#ef4444",
    opacity: 0.12,
    angle: 45,
    layout: "tile",
    pages: [0, 1],
  })
).bytes
bytes = (
  await addPageNumbers(bytes, {
    position: "bottom-center",
    template: "หน้า {n} จาก {total}",
    startAt: 1,
    pages: [0, 1],
    fontSize: 11,
    color: "#374151",
  })
).bytes
const result = await applyAnnotations(bytes, annotations())

await mkdir(outDir, { recursive: true })
const pdfPath = join(outDir, "test-sheet.pdf")
await writeFile(pdfPath, result.bytes)
const pngs = await render(result.bytes)
console.log([pdfPath, ...pngs].join("\n"))
if (result.missing.length) console.log("Missing characters:", result.missing.join(" "))

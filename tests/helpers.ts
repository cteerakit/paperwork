import { createCanvas } from "@napi-rs/canvas"
import { PDFDocument, StandardFonts, degrees } from "pdf-lib"
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs"

GlobalWorkerOptions.workerSrc = "pdfjs-dist/legacy/build/pdf.worker.mjs"

/** A PDF whose pages say "Page 1", "Page 2", … so tests can check order by text. */
export async function makePdf(
  pageCount: number,
  options: { rotate?: Record<number, number>; size?: [number, number] } = {}
) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage(options.size ?? [595, 842])
    page.drawText(`Page ${i + 1}`, { x: 50, y: 750, size: 24, font })
    if (options.rotate?.[i]) page.setRotation(degrees(options.rotate[i]))
  }
  return doc.save()
}

/** A one-page PDF containing a large, high-quality, photo-like JPEG. */
export async function makeImagePdf() {
  const canvas = createCanvas(2400, 1600)
  const ctx = canvas.getContext("2d")
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = `hsl(${(i * 37) % 360} 70% ${30 + (i % 50)}%)`
    ctx.beginPath()
    ctx.arc((i * 97) % 2400, (i * 61) % 1600, 10 + (i % 60), 0, Math.PI * 2)
    ctx.fill()
  }
  const doc = await PDFDocument.create()
  const image = await doc.embedJpg(canvas.toBuffer("image/jpeg", 95))
  doc.addPage([595, 842]).drawImage(image, { x: 0, y: 0, width: 595, height: 397 })
  return doc.save()
}

export interface OutlineEntry {
  title: string
  /** 0-based page the bookmark opens, if it has a destination. */
  page?: number
  items: OutlineEntry[]
}

/** Reads bookmarks with pdf.js, independently of the code that writes them. */
export async function pdfOutline(bytes: Uint8Array): Promise<OutlineEntry[]> {
  const task = getDocument({ data: bytes.slice(), verbosity: 0 })
  const pdf = await task.promise
  const read = async (items: Awaited<ReturnType<typeof pdf.getOutline>>): Promise<OutlineEntry[]> =>
    Promise.all(
      (items ?? []).map(async (item) => {
        const dest = typeof item.dest === "string" ? await pdf.getDestination(item.dest) : item.dest
        const ref = dest?.[0]
        return {
          title: item.title,
          page: ref && typeof ref === "object" ? await pdf.getPageIndex(ref) : undefined,
          items: await read(item.items),
        }
      })
    )
  const outline = await read(await pdf.getOutline())
  await task.destroy()
  return outline
}

export async function pdfText(bytes: Uint8Array): Promise<string[]> {
  const task = getDocument({ data: bytes.slice(), verbosity: 0 })
  const pdf = await task.promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent()
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(""))
  }
  await task.destroy()
  return pages
}

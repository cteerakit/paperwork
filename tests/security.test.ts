import { readFile } from "node:fs/promises"
import { init } from "@embedpdf/pdfium"
import { PDFDocument, PDFName, PDFString } from "pdf-lib"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import { expect, it } from "vitest"
import { cleanPdf, inspectPdfProtection, securePdf } from "@/lib/pdf/security"

it("requires the chosen password, rejects wrong passwords, and unlocks without losing text or metadata", async () => {
  const engine = await init({
    wasmBinary: await readFile(
      "node_modules/@embedpdf/pdfium/dist/pdfium.wasm"
    ),
  })
  engine.PDFiumExt_Init()
  try {
    const source = await PDFDocument.create()
    source.setTitle("Keep this title")
    source.addPage().drawText("Keep this text")
    const bytes = await source.save()
    const password = "secret-123"
    const protectedBytes = securePdf(
      bytes,
      { kind: "protect", currentPassword: "", password },
      engine
    )
    await expect(PDFDocument.load(protectedBytes)).rejects.toThrow(/encrypted/i)
    expect(inspectPdfProtection(bytes, engine)).toBe("unprotected")
    expect(inspectPdfProtection(protectedBytes, engine)).toBe("protected")
    const task = getDocument({ data: protectedBytes.slice(), password })
    const pdf = await task.promise
    try {
      expect(pdf.numPages).toBe(1)
    } finally {
      await task.destroy()
    }
    expect(() =>
      securePdf(
        protectedBytes,
        { kind: "unlock", currentPassword: "wrong" },
        engine
      )
    ).toThrow("password")
    const unlocked = securePdf(
      protectedBytes,
      { kind: "unlock", currentPassword: password },
      engine
    )
    expect(inspectPdfProtection(unlocked, engine)).toBe("unprotected")
    expect(() => inspectPdfProtection(new Uint8Array([1, 2]), engine)).toThrow(
      "invalid"
    )
    const output = await PDFDocument.load(unlocked)
    expect(output.getTitle()).toBe("Keep this title")
    expect(output.getPageCount()).toBe(1)
    const textTask = getDocument({ data: unlocked.slice() })
    const textPdf = await textTask.promise
    try {
      const content = await (await textPdf.getPage(1)).getTextContent()
      expect(
        content.items.some(
          (item) => "str" in item && item.str === "Keep this text"
        )
      ).toBe(true)
    } finally {
      await textTask.destroy()
    }
    expect(() =>
      securePdf(
        bytes,
        { kind: "protect", currentPassword: "", password: "" },
        engine
      )
    ).toThrow("emptyPassword")
    expect(() =>
      securePdf(
        new Uint8Array([1, 2]),
        { kind: "unlock", currentPassword: "" },
        engine
      )
    ).toThrow("invalid")
  } finally {
    engine.FPDF_DestroyLibrary()
  }
})

it("protects with AES-256 (PDF 2.0 security handler, revision 6)", async () => {
  const engine = await init({
    wasmBinary: await readFile(
      "node_modules/@embedpdf/pdfium/dist/pdfium.wasm"
    ),
  })
  engine.PDFiumExt_Init()
  try {
    const source = await PDFDocument.create()
    source.addPage()
    const protectedBytes = securePdf(
      await source.save(),
      { kind: "protect", currentPassword: "", password: "secret-123" },
      engine
    )
    const encrypt = new TextDecoder("latin1")
      .decode(protectedBytes)
      .match(/<<(?:(?!endobj)[\s\S])*\/Filter\s*\/Standard(?:(?!endobj)[\s\S])*endobj/)?.[0]
    expect(encrypt).toBeDefined()
    expect(encrypt).toMatch(/\/V\s*5\b/)
    expect(encrypt).toMatch(/\/R\s*6\b/)
    expect(encrypt).toMatch(/\/CFM\s*\/AESV3\b/)
  } finally {
    engine.FPDF_DestroyLibrary()
  }
})

it("removes hidden information, unlocking a protected PDF first", async () => {
  const engine = await init({
    wasmBinary: await readFile(
      "node_modules/@embedpdf/pdfium/dist/pdfium.wasm"
    ),
  })
  engine.PDFiumExt_Init()
  try {
    const source = await PDFDocument.create()
    source.setTitle("Private title")
    source.setAuthor("Private author")
    source.addPage().drawText("Visible text")
    source.catalog.set(
      PDFName.of("Metadata"),
      source.context.register(source.context.stream("<x:xmpmeta>Private</x:xmpmeta>"))
    )
    source.catalog.set(
      PDFName.of("OpenAction"),
      source.context.obj({ S: "JavaScript", JS: PDFString.of("app.alert(1)") })
    )
    const password = "secret-123"
    const protectedBytes = securePdf(
      await source.save(),
      { kind: "protect", currentPassword: "", password },
      engine
    )
    await expect(cleanPdf(protectedBytes, "wrong", engine)).rejects.toThrow("password")
    const cleaned = await cleanPdf(protectedBytes, password, engine)
    expect(inspectPdfProtection(cleaned, engine)).toBe("unprotected")
    const output = await PDFDocument.load(cleaned, { updateMetadata: false })
    expect(output.getTitle()).toBeUndefined()
    expect(output.getAuthor()).toBeUndefined()
    expect(output.catalog.get(PDFName.of("Metadata"))).toBeUndefined()
    expect(output.catalog.get(PDFName.of("OpenAction"))).toBeUndefined()
    expect(new TextDecoder("latin1").decode(cleaned)).not.toMatch(/Private|app\.alert/)
    const task = getDocument({ data: cleaned.slice() })
    try {
      const content = await (await (await task.promise).getPage(1)).getTextContent()
      expect(content.items.some((item) => "str" in item && item.str.includes("Visible text"))).toBe(true)
    } finally {
      await task.destroy()
    }
  } finally {
    engine.FPDF_DestroyLibrary()
  }
})

import { readFile } from "node:fs/promises"
import { init } from "@embedpdf/pdfium"
import { PDFDocument } from "pdf-lib"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import { expect, it } from "vitest"
import { inspectPdfProtection, securePdf } from "@/lib/pdf/security"

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

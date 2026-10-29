import type { WrappedPdfiumModule } from "@embedpdf/pdfium"
import { loadPdf } from "./load"
import { removeHiddenInformation, removeUnreferencedObjects } from "./sanitize"

export type SecurityOptions =
  | { kind: "unlock"; currentPassword: string }
  | { kind: "protect"; currentPassword: string; password: string }

export type SecurityErrorCode =
  "password" | "invalid" | "failed" | "emptyPassword"
export class SecurityError extends Error {
  readonly code: SecurityErrorCode
  constructor(code: SecurityErrorCode) {
    super(code)
    this.code = code
  }
}

function heap(engine: WrappedPdfiumModule) {
  if (
    !("HEAPU8" in engine.pdfium) ||
    !(engine.pdfium.HEAPU8 instanceof Uint8Array)
  )
    throw new SecurityError("failed")
  return engine.pdfium.HEAPU8
}

export function inspectPdfProtection(
  bytes: Uint8Array,
  engine: WrappedPdfiumModule
) {
  const memory = engine.pdfium.wasmExports
  const input = memory.malloc(bytes.length)
  if (!input) throw new SecurityError("failed")
  let document = 0
  try {
    heap(engine).set(bytes, input)
    document = engine.FPDF_LoadMemDocument(input, bytes.length, "")
    if (!document) {
      if (engine.FPDF_GetLastError() === 4) return "protected"
      throw new SecurityError("invalid")
    }
    return engine.EPDF_IsEncrypted(document) ? "protected" : "unprotected"
  } finally {
    if (document) engine.FPDF_CloseDocument(document)
    memory.free(input)
  }
}

export function securePdf(
  bytes: Uint8Array,
  options: SecurityOptions,
  engine: WrappedPdfiumModule
) {
  if (
    options.kind === "protect" &&
    (!options.password ||
      options.password.includes("\0") ||
      new TextEncoder().encode(options.password).length > 127)
  ) {
    throw new SecurityError("emptyPassword")
  }
  if (options.currentPassword.includes("\0"))
    throw new SecurityError("password")
  const memory = engine.pdfium.wasmExports
  const input = memory.malloc(bytes.length)
  if (!input) throw new SecurityError("failed")
  let document = 0
  let writer = 0
  let output = 0
  try {
    heap(engine).set(bytes, input)
    document = engine.FPDF_LoadMemDocument(
      input,
      bytes.length,
      options.currentPassword
    )
    if (!document)
      throw new SecurityError(
        engine.FPDF_GetLastError() === 4 ? "password" : "invalid"
      )
    const changed =
      options.kind === "unlock"
        ? !engine.EPDF_IsEncrypted(document) ||
          engine.EPDF_RemoveEncryption(document)
        : engine.EPDF_SetEncryption(
            document,
            options.password,
            options.password,
            0xfffffffc
          )
    if (!changed) throw new SecurityError("failed")
    writer = engine.PDFiumExt_OpenFileWriter()
    if (!writer || !engine.PDFiumExt_SaveAsCopy(document, writer))
      throw new SecurityError("failed")
    const length = engine.PDFiumExt_GetFileWriterSize(writer)
    if (length <= 0) throw new SecurityError("failed")
    output = memory.malloc(length)
    if (!output) throw new SecurityError("failed")
    engine.PDFiumExt_GetFileWriterData(writer, output, length)
    return heap(engine).slice(output, output + length)
  } finally {
    if (output) memory.free(output)
    if (writer) engine.PDFiumExt_CloseFileWriter(writer)
    if (document) engine.FPDF_CloseDocument(document)
    memory.free(input)
  }
}

/**
 * Saves a copy without document properties, XMP metadata, bookmarks, tags, scripts or attachments.
 * A protected PDF is unlocked with its current password first, so the copy has no password.
 */
export async function cleanPdf(
  bytes: Uint8Array,
  currentPassword: string,
  engine: WrappedPdfiumModule
) {
  const unlocked = securePdf(bytes, { kind: "unlock", currentPassword }, engine)
  let doc
  try {
    doc = await loadPdf(unlocked)
  } catch {
    throw new SecurityError("invalid")
  }
  removeHiddenInformation(doc)
  removeUnreferencedObjects(doc)
  return doc.save({ updateFieldAppearances: false })
}

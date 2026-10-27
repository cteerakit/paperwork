import { EncryptedPDFError, PDFDocument } from "pdf-lib"

export type PdfErrorCode = "encrypted" | "invalid"

/** An error with a code the UI can translate into a friendly message. */
export class PdfError extends Error {
  readonly code: PdfErrorCode

  constructor(code: PdfErrorCode, cause?: unknown) {
    super(code === "encrypted" ? "This PDF is password-protected." : "This file isn't a valid PDF.")
    this.code = code
    this.cause = cause
  }
}

export type PdfBytes = Uint8Array | ArrayBuffer

export async function loadPdf(bytes: PdfBytes): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false })
  } catch (error) {
    if (error instanceof EncryptedPDFError) throw new PdfError("encrypted", error)
    throw new PdfError("invalid", error)
  }
}

/** Saves with object streams, which pack small objects together for a smaller file. */
export function savePdf(doc: PDFDocument): Promise<Uint8Array> {
  return doc.save({ useObjectStreams: true })
}

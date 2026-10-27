/**
 * A single in-memory slot that carries a PDF from one tool to the next, so a
 * result can be processed further without downloading and re-uploading it.
 * It is never persisted and holds only the latest file.
 */
export interface HandoffFile {
  name: string
  bytes: Uint8Array
}

let slot: HandoffFile | undefined

export function setHandoff(file: HandoffFile) {
  slot = file
}

/** Returns the waiting file, if any, and empties the slot. */
export function takeHandoff() {
  const file = slot
  slot = undefined
  return file
}

export const handoffToFile = ({ name, bytes }: HandoffFile) =>
  new File([bytes as BlobPart], name, { type: "application/pdf" })

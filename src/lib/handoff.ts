/**
 * A single in-memory slot that carries PDFs from one place to the next: from one tool to another
 * ("Continue in…"), or from the operating system (Open with, Share) into a tool. It is never
 * persisted and holds only the latest files.
 */
export interface HandoffFile {
  name: string
  bytes: Uint8Array
}

const EMPTY: HandoffFile[] = []
let slot = EMPTY
const listeners = new Set<() => void>()

const publish = (files: HandoffFile[]) => {
  slot = files
  listeners.forEach((listener) => listener())
}

export function setHandoff(files: HandoffFile | HandoffFile[]) {
  const list = Array.isArray(files) ? files : [files]
  publish(list.length ? list : EMPTY)
}

/** The waiting files without taking them. The same array is returned until the slot changes. */
export const peekHandoff = () => slot

/** For `useSyncExternalStore`. */
export function subscribeHandoff(listener: () => void) {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

/** Takes the first waiting file and empties the slot. For tools that work on one PDF. */
export function takeHandoff() {
  const [first] = slot
  if (slot !== EMPTY) publish(EMPTY)
  return first
}

/** Takes every waiting file and empties the slot. For tools that work on several PDFs. */
export function takeAllHandoff() {
  const files = slot
  if (slot !== EMPTY) publish(EMPTY)
  return files
}

export const handoffToFile = ({ name, bytes }: HandoffFile) =>
  new File([bytes as BlobPart], name, { type: "application/pdf" })

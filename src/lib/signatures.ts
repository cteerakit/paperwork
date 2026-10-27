/** Signatures, initials and stamps saved on this device, kept in IndexedDB. */
import { storage } from "./storage"

export type SavedCategory = "signature" | "initials" | "stamp"

export const SAVED_CATEGORIES: SavedCategory[] = ["signature", "initials", "stamp"]

export type SavedContent =
  | { kind: "image"; src: string; width: number; height: number }
  | { kind: "text"; text: string; color: string }

export type SavedItem = SavedContent & {
  id: string
  category: SavedCategory
  /** A label the user can change. */
  name?: string
}

const KEY = "signatures"
/** Signatures were first saved here, before the library moved to IndexedDB. */
export const LEGACY_KEY = "paperwork.signatures"
export const LIBRARY_LIMIT = 24

const isString = (value: unknown): value is string => typeof value === "string"
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value)

/** Keeps the valid entries of a saved list. Entries from before categories existed become signatures. */
export function normalizeSaved(raw: unknown): SavedItem[] {
  if (!Array.isArray(raw)) return []
  const items: SavedItem[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || !isString(entry.id)) continue
    const category = SAVED_CATEGORIES.includes(entry.category) ? entry.category : "signature"
    const name = isString(entry.name) && entry.name.trim() ? entry.name.trim() : undefined
    if (entry.kind === "image" && isString(entry.src) && isNumber(entry.width) && isNumber(entry.height)) {
      items.push({ id: entry.id, category, name, kind: "image", src: entry.src, width: entry.width, height: entry.height })
    } else if (entry.kind === "text" && isString(entry.text) && isString(entry.color)) {
      items.push({ id: entry.id, category, name, kind: "text", text: entry.text, color: entry.color })
    }
  }
  return items
}

function readLegacy(): SavedItem[] {
  try {
    return normalizeSaved(JSON.parse(localStorage.getItem(LEGACY_KEY) ?? "[]"))
  } catch {
    return []
  }
}

/**
 * Loads the library. Items still in localStorage are moved to IndexedDB once; the old copy is removed
 * only after the new one reads back, so nothing is lost where IndexedDB is unavailable.
 */
export async function loadLibrary(): Promise<SavedItem[]> {
  const stored = await storage.get<unknown>(KEY)
  if (stored !== undefined) return normalizeSaved(stored)
  const legacy = readLegacy()
  if (!legacy.length) return []
  await storage.set(KEY, legacy)
  if ((await storage.get<unknown[]>(KEY))?.length === legacy.length) {
    try {
      localStorage.removeItem(LEGACY_KEY)
    } catch {
      // Leaving the old copy behind is harmless.
    }
  }
  return legacy
}

export function saveLibrary(items: SavedItem[]) {
  return storage.set(KEY, items)
}

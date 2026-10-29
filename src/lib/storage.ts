/** A tiny IndexedDB key-value store for autosaving editor sessions. */
import { discardSharedFiles } from "./sharedFiles"

const DB = "paperwork"
const STORE = "sessions"

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Autosaved sessions are kept this long after their last change. */
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000

interface Session<T> {
  savedAt: number
  value: T
}

/** Whether a stored value is an autosave that hasn't expired. Older untimestamped saves count as expired. */
export function isLiveSession(value: unknown, now = Date.now()): value is Session<unknown> {
  if (!value || typeof value !== "object" || !("savedAt" in value)) return false
  const { savedAt } = value
  return typeof savedAt === "number" && savedAt <= now && now - savedAt < SESSION_MAX_AGE
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const request = run(db.transaction(STORE, mode).objectStore(STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  }).finally(() => db.close()) as Promise<T>
}

export const storage = {
  get: <T>(key: string) => tx<T | undefined>("readonly", (s) => s.get(key)).catch(() => undefined),
  set: (key: string, value: unknown) => tx("readwrite", (s) => s.put(value, key)).catch(() => undefined),
  delete: (key: string) => tx("readwrite", (s) => s.delete(key)).catch(() => undefined),
}

/** Autosaved editor state that expires after {@link SESSION_MAX_AGE}. */
export const sessions = {
  async get<T>(key: string) {
    const saved = await storage.get<unknown>(key)
    if (saved === undefined) return undefined
    if (!isLiveSession(saved)) {
      await storage.delete(key)
      return undefined
    }
    return saved.value as T
  },
  set: (key: string, value: unknown) =>
    storage.set(key, { savedAt: Date.now(), value } satisfies Session<unknown>),
  delete: (key: string) => storage.delete(key),
}

/** Deletes expired autosaves, including ones for files that are never opened again. */
export async function pruneSessions(prefix: string) {
  try {
    const db = await openDb()
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE, "readwrite")
        const request = transaction.objectStore(STORE).openCursor()
        request.onsuccess = () => {
          const cursor = request.result
          if (!cursor) return
          if (
            typeof cursor.key === "string" &&
            cursor.key.startsWith(prefix) &&
            !isLiveSession(cursor.value)
          ) {
            cursor.delete()
          }
          cursor.continue()
        }
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      })
    } finally {
      db.close()
    }
  } catch {
    // No IndexedDB: nothing was saved.
  }
}

/** Removes everything Paperwork keeps in this browser: saved signatures, autosaves and settings. */
export async function clearLocalData() {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB)
    request.onsuccess = request.onerror = () => resolve()
    // Another tab holding the database open delays deletion until it closes; don't wait for that.
    request.onblocked = () => resolve()
  })
  try {
    localStorage.clear()
    sessionStorage.clear()
  } catch {
    // Storage is unavailable, so nothing is stored there.
  }
  await discardSharedFiles()
}

/** SHA-256 of the file contents, so a session is tied to the exact same PDF. */
export async function fileKey(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

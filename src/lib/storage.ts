/** A tiny IndexedDB key-value store for autosaving editor sessions. */

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

/** SHA-256 of the file contents, so a session is tied to the exact same PDF. */
export async function fileKey(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

import { useCallback, useEffect, useState } from "react"
import {
  LIBRARY_LIMIT,
  loadLibrary,
  saveLibrary,
  type SavedCategory,
  type SavedContent,
  type SavedItem,
} from "@/lib/signatures"
import { newId } from "./types"

/** The signatures, initials and stamps saved on this device. */
export function useSignatureLibrary() {
  const [items, setItems] = useState<SavedItem[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void loadLibrary().then((loaded) => {
      if (cancelled) return
      setItems(loaded)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Saving waits for the first load so an empty list never overwrites what's stored.
  useEffect(() => {
    if (ready) void saveLibrary(items)
  }, [items, ready])

  const add = useCallback((content: SavedContent, category: SavedCategory) => {
    const item: SavedItem = { ...content, id: newId(), category }
    setItems((list) => [item, ...list].slice(0, LIBRARY_LIMIT))
    return item
  }, [])

  const remove = useCallback((id: string) => setItems((list) => list.filter((item) => item.id !== id)), [])

  const rename = useCallback(
    (id: string, name: string) =>
      setItems((list) => list.map((item) => (item.id === id ? { ...item, name: name.trim() || undefined } : item))),
    []
  )

  return { items, add, remove, rename }
}

export type SignatureLibraryApi = ReturnType<typeof useSignatureLibrary>

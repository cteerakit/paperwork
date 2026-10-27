import { useCallback, useMemo, useRef, useState } from "react"
import type { Annotation } from "@/lib/annotate/model"

interface History {
  past: Annotation[][]
  present: Annotation[]
  future: Annotation[][]
}

const LIMIT = 100
/** Changes with the same key within this window merge into one undo step (e.g. dragging a slider). */
const COALESCE_MS = 600

export interface AnnotationsApi {
  objects: Annotation[]
  /** Replaces the whole list as one undo step. */
  setAll: (objects: Annotation[]) => void
  add: (object: Annotation) => void
  update: (id: string, patch: Partial<Annotation>, coalesceKey?: string) => void
  remove: (id: string) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  /** Replaces everything and clears history (e.g. after restoring a saved session). */
  reset: (objects: Annotation[]) => void
}

export function useAnnotations(initial: Annotation[] = []): AnnotationsApi {
  const [history, setHistory] = useState<History>({ past: [], present: initial, future: [] })
  const last = useRef<{ key?: string; at: number }>({ at: 0 })

  const commit = useCallback((next: (present: Annotation[]) => Annotation[], coalesceKey?: string) => {
    const now = Date.now()
    const merge = coalesceKey !== undefined && last.current.key === coalesceKey && now - last.current.at < COALESCE_MS
    last.current = { key: coalesceKey, at: now }
    setHistory((h) => {
      const present = next(h.present)
      if (present === h.present) return h
      return {
        past: merge ? h.past : [...h.past, h.present].slice(-LIMIT),
        present,
        future: [],
      }
    })
  }, [])

  const add = useCallback((object: Annotation) => commit((list) => [...list, object]), [commit])
  const setAll = useCallback((objects: Annotation[]) => commit(() => objects), [commit])
  const update = useCallback(
    (id: string, patch: Partial<Annotation>, coalesceKey?: string) =>
      commit(
        (list) => list.map((o) => (o.id === id ? ({ ...o, ...patch } as Annotation) : o)),
        coalesceKey ? `${id}:${coalesceKey}` : undefined
      ),
    [commit]
  )
  const remove = useCallback((id: string) => commit((list) => list.filter((o) => o.id !== id)), [commit])

  const undo = useCallback(() => {
    last.current = { at: 0 }
    setHistory((h) =>
      h.past.length ? { past: h.past.slice(0, -1), present: h.past.at(-1)!, future: [h.present, ...h.future] } : h
    )
  }, [])
  const redo = useCallback(() => {
    last.current = { at: 0 }
    setHistory((h) =>
      h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h
    )
  }, [])
  const reset = useCallback((objects: Annotation[]) => {
    last.current = { at: 0 }
    setHistory({ past: [], present: objects, future: [] })
  }, [])

  return useMemo(
    () => ({
      objects: history.present,
      setAll,
      add,
      update,
      remove,
      undo,
      redo,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      reset,
    }),
    [history, setAll, add, update, remove, undo, redo, reset]
  )
}

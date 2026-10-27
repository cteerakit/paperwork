import type { Redaction } from "./redact"

/** Read only selected text fragments, never the bounding rectangle of the whole selection. */
export function selectedTextAreas({
  selection,
  layer,
  bounds,
  size,
  page,
}: {
  selection: Selection | null
  layer: HTMLElement
  bounds: Pick<DOMRect, "left" | "top" | "width" | "height">
  size: { width: number; height: number }
  page: number
}): Redaction[] {
  if (!selection || selection.isCollapsed || !bounds.width || !bounds.height)
    return []
  const areas: Redaction[] = []
  const walker = layer.ownerDocument.createTreeWalker(
    layer,
    NodeFilter.SHOW_TEXT
  )
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? ""
    for (let index = 0; index < selection.rangeCount; index++) {
      const selected = selection.getRangeAt(index)
      if (!selected.intersectsNode(node)) continue
      let start = selected.startContainer === node ? selected.startOffset : 0
      let end =
        selected.endContainer === node ? selected.endOffset : text.length
      while (start < end && /\s/u.test(text[start])) start++
      while (end > start && /\s/u.test(text[end - 1])) end--
      if (end <= start) continue
      const fragment = layer.ownerDocument.createRange()
      fragment.setStart(node, start)
      fragment.setEnd(node, end)
      for (const rect of fragment.getClientRects()) {
        const x = Math.max(
          0,
          ((rect.left - bounds.left) * size.width) / bounds.width
        )
        const y = Math.max(
          0,
          ((rect.top - bounds.top) * size.height) / bounds.height
        )
        const right = Math.min(
          size.width,
          ((rect.right - bounds.left) * size.width) / bounds.width
        )
        const bottom = Math.min(
          size.height,
          ((rect.bottom - bounds.top) * size.height) / bounds.height
        )
        if (right > x && bottom > y)
          areas.push({ page, x, y, width: right - x, height: bottom - y })
      }
    }
  }
  return areas
}

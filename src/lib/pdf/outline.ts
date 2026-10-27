/**
 * Reading and writing PDF bookmarks (the /Outlines tree), so merging keeps them.
 * Malformed outlines are dropped rather than failing the whole operation.
 */
import {
  PDFArray,
  PDFDict,
  PDFHexString,
  PDFName,
  PDFRef,
  PDFString,
  type PDFDocument,
  type PDFObject,
} from "pdf-lib"

type Literal = Parameters<PDFDocument["context"]["obj"]>[0]

export interface OutlineNode {
  title: string
  /** A destination in the output document: [pageRef, ...view]. */
  dest?: PDFArray
  children: OutlineNode[]
}

/** Maps a source page's ref (`ref.tag`) to the ref of the same page in the output. */
export type PageMap = Map<string, PDFRef>

const MAX_DEPTH = 32
const MAX_ITEMS = 10_000

const key = PDFName.of

const textOf = (object: PDFObject | undefined) =>
  object instanceof PDFString || object instanceof PDFHexString || object instanceof PDFName
    ? object.decodeText()
    : undefined

/**
 * Reads a document's bookmarks, keeping only those whose pages are in `pages`.
 * Destinations are rewritten to point at the pages' refs in `target`.
 */
export function readOutline(source: PDFDocument, target: PDFDocument, pages: PageMap): OutlineNode[] {
  try {
    const root = source.catalog.lookupMaybe(key("Outlines"), PDFDict)
    const budget = { items: MAX_ITEMS }
    return root ? readSiblings(source, target, pages, root.lookupMaybe(key("First"), PDFDict), 0, budget) : []
  } catch {
    return []
  }
}

function readSiblings(
  source: PDFDocument,
  target: PDFDocument,
  pages: PageMap,
  first: PDFDict | undefined,
  depth: number,
  budget: { items: number }
): OutlineNode[] {
  const nodes: OutlineNode[] = []
  const seen = new Set<PDFDict>()
  for (let item = first; item && !seen.has(item) && budget.items-- > 0; item = item.lookupMaybe(key("Next"), PDFDict)) {
    seen.add(item)
    const children =
      depth < MAX_DEPTH
        ? readSiblings(source, target, pages, item.lookupMaybe(key("First"), PDFDict), depth + 1, budget)
        : []
    const dest = remap(resolveDestination(source, item), target, pages)
    if (dest || children.length) {
      nodes.push({ title: textOf(item.lookup(key("Title"))) ?? "", dest, children })
    }
  }
  return nodes
}

function remap(dest: PDFArray | undefined, target: PDFDocument, pages: PageMap) {
  const ref = dest?.get(0)
  const page = ref instanceof PDFRef ? pages.get(ref.tag) : undefined
  if (!dest || !page) return undefined
  return target.context.obj([page, ...dest.asArray().slice(1)])
}

/** The explicit destination array of an outline item, from /Dest or a GoTo /A action. */
function resolveDestination(doc: PDFDocument, item: PDFDict): PDFArray | undefined {
  let dest: PDFObject | undefined = item.get(key("Dest"))
  if (!dest) {
    const action = item.lookupMaybe(key("A"), PDFDict)
    if (action?.lookup(key("S")) === key("GoTo")) dest = action.get(key("D"))
  }
  if (!dest) return undefined
  return toArray(doc, dest, 0)
}

function toArray(doc: PDFDocument, object: PDFObject, depth: number): PDFArray | undefined {
  const value = doc.context.lookup(object)
  if (value instanceof PDFArray) return value
  if (value instanceof PDFDict) {
    const inner = value.get(key("D"))
    return inner && depth < 2 ? toArray(doc, inner, depth + 1) : undefined
  }
  const name = textOf(value)
  if (name === undefined || depth >= 2) return undefined
  const found = namedDestination(doc, name)
  return found ? toArray(doc, found, depth + 1) : undefined
}

function namedDestination(doc: PDFDocument, name: string): PDFObject | undefined {
  const legacy = doc.catalog.lookupMaybe(key("Dests"), PDFDict)?.get(key(name))
  if (legacy) return legacy
  const tree = doc.catalog.lookupMaybe(key("Names"), PDFDict)?.lookupMaybe(key("Dests"), PDFDict)
  return tree && searchNameTree(tree, name, 0)
}

function searchNameTree(node: PDFDict, name: string, depth: number): PDFObject | undefined {
  const names = node.lookupMaybe(key("Names"), PDFArray)
  for (let i = 0; names && i + 1 < names.size(); i += 2) {
    if (textOf(names.lookup(i)) === name) return names.get(i + 1)
  }
  const kids = node.lookupMaybe(key("Kids"), PDFArray)
  for (let i = 0; kids && depth < MAX_DEPTH && i < kids.size(); i++) {
    const found = searchNameTree(kids.lookup(i, PDFDict), name, depth + 1)
    if (found) return found
  }
  return undefined
}

/** Replaces the document's bookmarks with `roots`. Top-level entries are open; deeper ones start closed. */
export function writeOutline(doc: PDFDocument, roots: OutlineNode[]) {
  if (!roots.length) return
  const { context } = doc
  const rootRef = context.nextRef()
  const total = write(doc, roots, rootRef, true)
  context.assign(
    rootRef,
    context.obj({
      Type: "Outlines",
      First: total.first,
      Last: total.last,
      Count: total.visible,
    })
  )
  doc.catalog.set(key("Outlines"), rootRef)
}

function write(doc: PDFDocument, nodes: OutlineNode[], parent: PDFRef, open: boolean) {
  const { context } = doc
  const refs = nodes.map(() => context.nextRef())
  let visible = nodes.length
  nodes.forEach((node, i) => {
    const entry: Record<string, unknown> = {
      Title: PDFHexString.fromText(node.title),
      Parent: parent,
    }
    if (i > 0) entry.Prev = refs[i - 1]
    if (i < nodes.length - 1) entry.Next = refs[i + 1]
    if (node.dest) entry.Dest = node.dest
    if (node.children.length) {
      const children = write(doc, node.children, refs[i], false)
      entry.First = children.first
      entry.Last = children.last
      // A negative count marks a closed item; its magnitude is the number of descendants it would show.
      entry.Count = children.visible * (open ? 1 : -1)
      if (open) visible += children.visible
    }
    context.assign(refs[i], context.obj(entry as Literal))
  })
  return { first: refs[0], last: refs[refs.length - 1], visible }
}

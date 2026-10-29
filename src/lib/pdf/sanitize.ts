import {
  PDFArray,
  PDFDict,
  PDFName,
  PDFRef,
  PDFStream,
  type PDFDocument,
  type PDFObject,
} from "pdf-lib"

const CATALOG_KEYS = [
  // XMP metadata and application edit data can hold titles, authors and earlier copies of text.
  "Metadata",
  "PieceInfo",
  // Bookmark titles can repeat redacted text.
  "Outlines",
  // Tags carry alternate and actual text (Alt, ActualText) for the words on the page.
  "StructTreeRoot",
  "MarkInfo",
  // Scripts and actions that run when the file is opened.
  "OpenAction",
  "AA",
]
const PAGE_KEYS = ["Metadata", "PieceInfo", "Thumb", "AA", "StructParents"]
const NAME_TREES = ["JavaScript", "EmbeddedFiles"]

/**
 * Removes information a reader doesn't see on the page: document properties, XMP metadata, bookmarks,
 * tags, scripts, attached files, thumbnails and application data. Page content, links and form fields
 * are kept. Follow with {@link removeUnreferencedObjects} so the removed objects leave the file.
 */
export function removeHiddenInformation(doc: PDFDocument) {
  doc.context.trailerInfo.Info = undefined
  const catalog = doc.catalog
  for (const key of CATALOG_KEYS) catalog.delete(PDFName.of(key))
  if (catalog.get(PDFName.of("PageMode")) === PDFName.of("UseOutlines")) {
    catalog.delete(PDFName.of("PageMode"))
  }
  const names = catalog.lookupMaybe(PDFName.of("Names"), PDFDict)
  for (const key of NAME_TREES) names?.delete(PDFName.of(key))
  for (const page of doc.getPages()) {
    for (const key of PAGE_KEYS) page.node.delete(PDFName.of(key))
  }
}

/** Remove obsolete streams left behind by rewriting content, without copying or flattening pages. */
export function removeUnreferencedObjects(doc: PDFDocument) {
  const seen = new Set<PDFObject>()
  const visit = (object: PDFObject | undefined) => {
    if (!object || seen.has(object)) return
    seen.add(object)
    if (object instanceof PDFRef) visit(doc.context.lookup(object))
    else if (object instanceof PDFDict) object.values().forEach(visit)
    else if (object instanceof PDFArray) object.asArray().forEach(visit)
    else if (object instanceof PDFStream) visit(object.dict)
  }
  Object.values(doc.context.trailerInfo).forEach(visit)
  for (const [ref] of doc.context.enumerateIndirectObjects()) {
    if (!seen.has(ref)) doc.context.delete(ref)
  }
}

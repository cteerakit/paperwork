export const toolLoaders = {
  security: () => import("./Security"),
  redact: () => import("./Redact"),
  organize: () => import("./Organize"),
  merge: () => import("./Merge"),
  split: () => import("./Split"),
  compress: () => import("./Compress"),
  toImages: () => import("./ToImages"),
  pageNumbers: () => import("./PageNumbers"),
  watermark: () => import("./Watermark"),
  sign: () => import("./Sign"),
  annotate: () => import("./Annotate"),
}

export function preloadTool(id: keyof typeof toolLoaders) {
  // Speculation must not surface a network error before the user navigates.
  void toolLoaders[id]().catch(() => {})
}

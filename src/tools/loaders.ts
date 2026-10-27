export const toolLoaders = {
  organize: () => import("./Organize"),
  merge: () => import("./Merge"),
  split: () => import("./Split"),
  compress: () => import("./Compress"),
  pageNumbers: () => import("./PageNumbers"),
  watermark: () => import("./Watermark"),
  sign: () => import("./Sign"),
  annotate: () => import("./Annotate"),
}

export function preloadTool(id: keyof typeof toolLoaders) {
  // Speculation must not surface a network error before the user navigates.
  void toolLoaders[id]().catch(() => {})
}

export const SITE_URL = "https://paperwork.c-teerakit.workers.dev"
export const SOCIAL_IMAGE = `${SITE_URL}/og.png`
export const SOCIAL_IMAGE_ALT =
  "Paperwork — Everyday PDF tools. No sign-up. Your files stay on your device."

export const SOCIAL_PAGES = [
  {
    path: "/",
    title: "Paperwork — Free, private PDF tools",
    description:
      "Merge, split, compress, sign and annotate PDFs right in your browser. Free, no sign-up, and your files never leave your device.",
  },
  {
    path: "/pricing",
    title: "Pricing — Paperwork is free",
    description:
      "One plan. Zero dollars. I built Paperwork for myself. Feel free to use it. Free PDF tools, no sign-up, and your files stay on your device.",
  },
  {
    path: "/about",
    title: "About Paperwork — PDF tools for everyday jobs",
    description:
      "An ID card, a signature, and the story behind Paperwork: free PDF tools that keep your documents on your device.",
  },
  {
    path: "/merge",
    title: "Merge PDFs — Paperwork",
    description:
      "Combine multiple PDFs into one document in your browser. Free, no sign-up, and your files stay on your device.",
  },
  {
    path: "/split",
    title: "Split PDFs — Paperwork",
    description:
      "Extract pages or split a PDF into separate files in your browser. Free, no sign-up, and no uploads.",
  },
  {
    path: "/compress",
    title: "Compress PDFs — Paperwork",
    description:
      "Reduce PDF file size in your browser. Choose your compression level and download your file, with no sign-up or uploads.",
  },
  {
    path: "/sign",
    title: "Sign PDFs — Paperwork",
    description:
      "Add your signature to a PDF right in your browser. Free, no sign-up, and your documents stay on your device.",
  },
  {
    path: "/annotate",
    title: "Annotate PDFs — Paperwork",
    description:
      "Add text, highlights and notes to PDFs in your browser, with support for Thai text. Free, no sign-up, and no uploads.",
  },
  {
    path: "/organize",
    title: "Organize PDF pages — Paperwork",
    description:
      "Reorder, rotate and remove PDF pages right in your browser. Free, no sign-up, and your files stay on your device.",
  },
  {
    path: "/unlock-protect",
    title: "Unlock & protect PDFs — Paperwork",
    description:
      "Remove a PDF password you know or add password protection in your browser. Your documents stay on your device.",
  },
  {
    path: "/redact",
    title: "Redact PDFs — Paperwork",
    description:
      "Remove sensitive content from PDFs in your browser. Free, no sign-up, and your documents stay on your device.",
  },
  {
    path: "/watermark",
    title: "Watermark PDFs — Paperwork",
    description:
      "Add a text watermark to your PDF in your browser. Free, no sign-up, and your files never leave your device.",
  },
  {
    path: "/page-numbers",
    title: "Add PDF page numbers — Paperwork",
    description:
      "Number the pages of your PDF right in your browser. Free, no sign-up, and your files stay on your device.",
  },
  {
    path: "/pdf-to-images",
    title: "PDF to images — Paperwork",
    description:
      "Save PDF pages as PNG or JPG images right in your browser. Free, no sign-up, and your files never leave your device.",
  },
]

export const NOT_FOUND_PAGE = {
  path: "/404",
  title: "Page not found — Paperwork",
  description:
    "This page doesn’t exist. Browse Paperwork’s free, private PDF tools to find what you need.",
}

export const WEB_APPLICATION = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "@id": `${SITE_URL}/#application`,
  name: "Paperwork",
  url: SITE_URL,
  description: SOCIAL_PAGES[0].description,
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript and a modern web browser.",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
}

export const applicationJsonLd = () =>
  JSON.stringify(WEB_APPLICATION).replaceAll("<", "\\u003c")

export function socialPage(pathname: string) {
  return (
    SOCIAL_PAGES.find(
      (page) => page.path === (pathname.replace(/\/+$/, "") || "/")
    ) ?? NOT_FOUND_PAGE
  )
}

export function socialTags(
  page: (typeof SOCIAL_PAGES)[number]
): (
  { name: string; content: string } | { property: string; content: string }
)[] {
  const url = `${SITE_URL}${page.path}`
  return [
    { name: "description", content: page.description },
    {
      name: "robots",
      content: page === NOT_FOUND_PAGE ? "noindex, follow" : "index, follow",
    },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "Paperwork" },
    { property: "og:locale", content: "en_US" },
    { property: "og:title", content: page.title },
    { property: "og:description", content: page.description },
    { property: "og:url", content: url },
    { property: "og:image", content: SOCIAL_IMAGE },
    { property: "og:image:type", content: "image/png" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: SOCIAL_IMAGE_ALT },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: page.title },
    { name: "twitter:description", content: page.description },
    { name: "twitter:image", content: SOCIAL_IMAGE },
    { name: "twitter:image:alt", content: SOCIAL_IMAGE_ALT },
  ]
}

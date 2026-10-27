import { useEffect } from "react"
import { useLocation } from "react-router"
import {
  applicationJsonLd,
  NOT_FOUND_PAGE,
  OPEN_PAGE,
  SITE_URL,
  socialPage,
  socialTags,
} from "@/lib/social"

export function PageMetadata() {
  const { pathname } = useLocation()
  useEffect(() => {
    const page = socialPage(pathname)
    document.title = page.title
    const canonical = document.querySelector('link[rel="canonical"]')
    const structuredData = document.getElementById("application-jsonld")
    if (page === NOT_FOUND_PAGE || page === OPEN_PAGE) {
      canonical?.remove()
      structuredData?.remove()
    } else {
      const link = canonical ?? document.createElement("link")
      link.setAttribute("rel", "canonical")
      link.setAttribute("href", `${SITE_URL}${page.path}`)
      if (!canonical) document.head.appendChild(link)
      if (!structuredData) {
        const script = document.createElement("script")
        script.id = "application-jsonld"
        script.type = "application/ld+json"
        script.textContent = applicationJsonLd()
        document.head.appendChild(script)
      }
    }
    for (const tag of socialTags(page)) {
      const attribute = "property" in tag ? "property" : "name"
      const key = "property" in tag ? tag.property : tag.name
      const existing = document.querySelector(`meta[${attribute}="${key}"]`)
      const meta = existing ?? document.createElement("meta")
      meta.setAttribute(attribute, key)
      meta.setAttribute("content", tag.content)
      if (!existing) document.head.appendChild(meta)
    }
  }, [pathname])
  return null
}

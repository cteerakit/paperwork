import { useEffect } from "react"
import { useLocation } from "react-router"
import { SITE_URL, socialPage, socialTags } from "@/lib/social"

export function PageMetadata() {
  const { pathname } = useLocation()
  useEffect(() => {
    const page = socialPage(pathname)
    document.title = page.title
    document
      .querySelector('link[rel="canonical"]')
      ?.setAttribute("href", `${SITE_URL}${page.path}`)
    for (const tag of socialTags(page)) {
      const attribute = "property" in tag ? "property" : "name"
      const key = "property" in tag ? tag.property : tag.name
      document
        .querySelector(`meta[${attribute}="${key}"]`)
        ?.setAttribute("content", tag.content)
    }
  }, [pathname])
  return null
}

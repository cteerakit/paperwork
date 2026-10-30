import { lazy, Suspense } from "react"
import { Route, Routes } from "react-router"
import { AppHeader } from "@/components/AppHeader"
import { AppFooter } from "@/components/AppFooter"
import { LaunchHandler } from "@/components/LaunchHandler"
import { About } from "@/pages/About"
import { Pricing } from "@/pages/Pricing"
import { Privacy } from "@/pages/Privacy"
import { Changelog } from "@/pages/Changelog"
import { NotFound } from "@/pages/NotFound"
import { Open } from "@/pages/Open"
import { Home } from "@/tools/Home"
import { Spinner } from "@/components/Spinner"
import { toolLoaders } from "@/tools/loaders"
import { PageMetadata } from "@/components/PageMetadata"
import { ScrollToTop } from "@/components/ScrollToTop"

const Security = lazy(toolLoaders.security)
const Organize = lazy(toolLoaders.organize)
const Merge = lazy(toolLoaders.merge)
const Split = lazy(toolLoaders.split)
const Compress = lazy(toolLoaders.compress)
const ToImages = lazy(toolLoaders.toImages)
const FromImages = lazy(toolLoaders.fromImages)
const PageNumbers = lazy(toolLoaders.pageNumbers)
const Watermark = lazy(toolLoaders.watermark)
const Sign = lazy(toolLoaders.sign)
const Redact = lazy(toolLoaders.redact)
const Annotate = lazy(toolLoaders.annotate)

export function App() {
  return (
    <div className="flex min-h-svh flex-col">
      <PageMetadata />
      <LaunchHandler />
      <AppHeader />
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="grid h-64 place-items-center">
              <Spinner />
            </div>
          }
        >
          <ScrollToTop />
          <Routes>
            <Route index element={<Home />} />
            <Route caseSensitive path="about" element={<About />} />
            <Route caseSensitive path="pricing" element={<Pricing />} />
            <Route caseSensitive path="changelog" element={<Changelog />} />
            <Route caseSensitive path="privacy" element={<Privacy />} />
            <Route caseSensitive path="unlock-protect" element={<Security />} />
            <Route caseSensitive path="organize" element={<Organize />} />
            <Route caseSensitive path="merge" element={<Merge />} />
            <Route caseSensitive path="split" element={<Split />} />
            <Route caseSensitive path="compress" element={<Compress />} />
            <Route caseSensitive path="pdf-to-images" element={<ToImages />} />
            <Route caseSensitive path="images-to-pdf" element={<FromImages />} />
            <Route caseSensitive path="page-numbers" element={<PageNumbers />} />
            <Route caseSensitive path="watermark" element={<Watermark />} />
            <Route caseSensitive path="sign" element={<Sign />} />
            <Route caseSensitive path="redact" element={<Redact />} />
            <Route caseSensitive path="annotate" element={<Annotate />} />
            <Route caseSensitive path="open" element={<Open />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <AppFooter />
    </div>
  )
}

export default App

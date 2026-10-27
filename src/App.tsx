import { lazy, Suspense } from "react"
import { Route, Routes } from "react-router"
import { AppHeader } from "@/components/AppHeader"
import { AppFooter } from "@/components/AppFooter"
import { About } from "@/pages/About"
import { Home } from "@/tools/Home"
import { Spinner } from "@/components/Spinner"
import { toolLoaders } from "@/tools/loaders"

const Security = lazy(toolLoaders.security)
const Organize = lazy(toolLoaders.organize)
const Merge = lazy(toolLoaders.merge)
const Split = lazy(toolLoaders.split)
const Compress = lazy(toolLoaders.compress)
const PageNumbers = lazy(toolLoaders.pageNumbers)
const Watermark = lazy(toolLoaders.watermark)
const Sign = lazy(toolLoaders.sign)
const Redact = lazy(toolLoaders.redact)
const Annotate = lazy(toolLoaders.annotate)

export function App() {
  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader />
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="grid h-64 place-items-center">
              <Spinner />
            </div>
          }
        >
          <Routes>
            <Route index element={<Home />} />
            <Route path="about" element={<About />} />
            <Route path="unlock-protect" element={<Security />} />
            <Route path="organize" element={<Organize />} />
            <Route path="merge" element={<Merge />} />
            <Route path="split" element={<Split />} />
            <Route path="compress" element={<Compress />} />
            <Route path="page-numbers" element={<PageNumbers />} />
            <Route path="watermark" element={<Watermark />} />
            <Route path="sign" element={<Sign />} />
            <Route path="redact" element={<Redact />} />
            <Route path="annotate" element={<Annotate />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </main>
      <AppFooter />
    </div>
  )
}

export default App

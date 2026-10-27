import { lazy, Suspense } from "react"
import { Route, Routes } from "react-router"
import { AppHeader } from "@/components/AppHeader"
import { Home } from "@/tools/Home"
import { Spinner } from "@/components/Spinner"
import { toolLoaders } from "@/tools/loaders"

const Organize = lazy(toolLoaders.organize)
const Merge = lazy(toolLoaders.merge)
const Split = lazy(toolLoaders.split)
const Compress = lazy(toolLoaders.compress)
const PageNumbers = lazy(toolLoaders.pageNumbers)
const Watermark = lazy(toolLoaders.watermark)
const Sign = lazy(toolLoaders.sign)
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
            <Route path="organize" element={<Organize />} />
            <Route path="merge" element={<Merge />} />
            <Route path="split" element={<Split />} />
            <Route path="compress" element={<Compress />} />
            <Route path="page-numbers" element={<PageNumbers />} />
            <Route path="watermark" element={<Watermark />} />
            <Route path="sign" element={<Sign />} />
            <Route path="annotate" element={<Annotate />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}

export default App

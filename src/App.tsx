import { lazy, Suspense } from "react"
import { Route, Routes } from "react-router"
import { AppHeader } from "@/components/AppHeader"
import { Home } from "@/tools/Home"
import { Spinner } from "@/components/Spinner"

const Organize = lazy(() => import("@/tools/Organize"))
const Merge = lazy(() => import("@/tools/Merge"))
const Split = lazy(() => import("@/tools/Split"))
const Compress = lazy(() => import("@/tools/Compress"))
const PageNumbers = lazy(() => import("@/tools/PageNumbers"))
const Watermark = lazy(() => import("@/tools/Watermark"))
const Sign = lazy(() => import("@/tools/Sign"))
const Annotate = lazy(() => import("@/tools/Annotate"))

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

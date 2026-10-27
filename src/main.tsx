import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router"

import "./index.css"
import { i18nReady } from "./i18n"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { discardSharedFiles } from "@/lib/sharedFiles"

// Wait for the language's strings so the first screen isn't drawn in English.
await i18nReady

// Shared PDFs are only meant to live until /open reads them; clear any a closed tab left behind.
if (!new URLSearchParams(location.search).has("shared")) void discardSharedFiles()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <TooltipProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
        <Toaster richColors closeButton />
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>
)

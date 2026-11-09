import { createInstance } from "i18next"
import { renderToStaticMarkup } from "react-dom/server"
import { I18nextProvider } from "react-i18next"
import { StaticRouter } from "react-router"
import { AppFooter } from "@/components/AppFooter"
import { AppHeader } from "@/components/AppHeader"
import { ThemeProvider } from "@/components/theme-provider"
import { ToolLayout } from "@/components/ToolLayout"
import en from "@/i18n/locales/en.json"
import es from "@/i18n/locales/es.json"
import ja from "@/i18n/locales/ja.json"
import th from "@/i18n/locales/th.json"
import vi from "@/i18n/locales/vi.json"
import zh from "@/i18n/locales/zh.json"
import type { LanguageCode } from "@/i18n/languages"
import { About } from "@/pages/About"
import { Changelog } from "@/pages/Changelog"
import { NotFound } from "@/pages/NotFound"
import { Pricing } from "@/pages/Pricing"
import { Privacy } from "@/pages/Privacy"
import { Home } from "@/tools/Home"
import { TOOLS } from "@/tools/registry"

export async function renderPage(path: string, language: LanguageCode = "en") {
  const i18n = createInstance()
  await i18n.init({
    lng: language,
    fallbackLng: "en",
    resources: {
      en: { translation: en },
      th: { translation: th },
      ja: { translation: ja },
      zh: { translation: zh },
      vi: { translation: vi },
      es: { translation: es },
    },
    interpolation: { escapeValue: false },
  })
  const tool = TOOLS.find((tool) => tool.path === path)
  const content =
    path === "/" ? (
      <Home />
    ) : path === "/about" ? (
      <About />
    ) : path === "/pricing" ? (
      <Pricing />
    ) : path === "/changelog" ? (
      <Changelog />
    ) : path === "/privacy" ? (
      <Privacy />
    ) : tool ? (
      <ToolLayout tool={tool.id}>
        <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          {i18n.t("seo.workspacePlaceholder")}
        </p>
      </ToolLayout>
    ) : (
      <NotFound />
    )

  return renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <StaticRouter location={path}>
          <div className="flex min-h-svh flex-col">
            <AppHeader />
            <main className="flex-1">{content}</main>
            <AppFooter />
          </div>
        </StaticRouter>
      </ThemeProvider>
    </I18nextProvider>
  )
}

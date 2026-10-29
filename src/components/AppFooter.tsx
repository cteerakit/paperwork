import { useTranslation } from "react-i18next"
import { Link } from "react-router"

const linkClassName =
  "rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"

export function AppFooter() {
  const { t } = useTranslation()

  return (
    <footer>
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          {t("footer.copyright", { year: new Date().getFullYear() })}{" "}
          <a
            href="https://teerakit.com"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClassName}
          >
            Teerakit Chantrakul
          </a>
        </p>
        <nav
          aria-label={t("footer.navigation")}
          className="flex flex-wrap items-center gap-x-4 gap-y-2"
        >
          <Link to="/about" className={linkClassName}>
            {t("footer.about")}
          </Link>
          <Link to="/pricing" className={linkClassName}>
            {t("footer.pricing")}
          </Link>
          <Link to="/changelog" className={linkClassName}>
            {t("footer.changelog")}
          </Link>
          <Link to="/privacy" className={linkClassName}>
            {t("footer.privacy")}
          </Link>
          <a
            href="https://www.facebook.com/cteerakit"
            aria-label="Facebook"
            title="Facebook"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClassName}
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-3.5"
              aria-hidden="true"
            >
              <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.095 10.125 24v-8.437H7.078v-3.49h3.047v-2.66c0-3.026 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.973h-1.513c-1.49 0-1.956.931-1.956 1.887v2.261h3.328l-.532 3.49h-2.796V24C19.612 23.095 24 18.1 24 12.073Z" />
            </svg>
          </a>
          <a
            href="https://x.com/tearakit"
            aria-label="X"
            title="X"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClassName}
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-3.5"
              aria-hidden="true"
            >
              <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.64 7.584H.47l8.6-9.835L0 1.154h7.594l5.243 6.932 6.064-6.933Zm-1.29 19.49h2.039L6.487 3.24H4.3l13.31 17.403Z" />
            </svg>
          </a>
          <a
            href="https://www.linkedin.com/in/cteerakit/"
            aria-label="LinkedIn"
            title="LinkedIn"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClassName}
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-3.5"
              aria-hidden="true"
            >
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124Zm1.782 13.019H3.555V9h3.564v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003Z" />
            </svg>
          </a>
        </nav>
      </div>
    </footer>
  )
}

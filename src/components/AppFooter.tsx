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
            href="https://github.com/sponsors/cteerakit"
            target="_blank"
            rel="noopener noreferrer"
            className={`${linkClassName} inline-flex items-center gap-1`}
          >
            <svg
              viewBox="0 0 16 16"
              fill="currentColor"
              className="size-3.5 text-pink-500"
              aria-hidden="true"
            >
              <path d="m8 14.25.345.666a.75.75 0 0 1-.69 0l-.008-.004-.018-.01a7.152 7.152 0 0 1-.31-.17 22.055 22.055 0 0 1-3.434-2.414C2.045 10.731 0 8.35 0 5.5 0 2.836 2.086 1 4.25 1 5.797 1 7.153 1.802 8 3.02 8.847 1.802 10.203 1 11.75 1 13.914 1 16 2.836 16 5.5c0 2.85-2.045 5.231-3.885 6.818a22.066 22.066 0 0 1-3.744 2.584l-.018.01-.006.003h-.002ZM4.25 2.5c-1.336 0-2.75 1.164-2.75 3 0 2.15 1.58 4.144 3.365 5.682A20.58 20.58 0 0 0 8 13.393a20.58 20.58 0 0 0 3.135-2.211C12.92 9.644 14.5 7.65 14.5 5.5c0-1.836-1.414-3-2.75-3-1.373 0-2.609.986-3.029 2.456a.749.749 0 0 1-1.442 0C6.859 3.486 5.623 2.5 4.25 2.5Z" />
            </svg>
            {t("footer.sponsor")}
          </a>
          <a
            href="https://github.com/cteerakit/paperwork"
            aria-label="GitHub"
            title="GitHub"
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
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3.996.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.318 3.285-.996 3.285-.996.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
          </a>
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
            href="https://www.youtube.com/@tearakit"
            aria-label="YouTube"
            title="YouTube"
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
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814ZM9.545 15.568V8.432L15.818 12l-6.273 3.568Z" />
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

import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { LoadedPdf } from "@/lib/render/pdfjs"
import {
  compileQuery,
  SEARCH_PRESETS,
  searchDocument,
  SearchPatternError,
  type SearchQuery,
  type TextMatch,
} from "@/lib/pdf/textSearch"

const LISTED = 100

/** Finds text or common patterns across the whole document so every match can be redacted at once. */
export function RedactionSearch({
  pdf,
  disabled,
  matches,
  onMatches,
  onPage,
  onMarkAll,
}: {
  pdf: LoadedPdf
  disabled: boolean
  matches: TextMatch[]
  onMatches: (matches: TextMatch[]) => void
  onPage: (page: number) => void
  onMarkAll: () => void
}) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<"text" | "regex">("text")
  const [query, setQuery] = useState("")
  const [progress, setProgress] = useState<number>()
  const [error, setError] = useState<string>()
  const [searched, setSearched] = useState(false)
  const running = useRef<AbortController>(null)

  useEffect(() => () => running.current?.abort(), [])

  const run = async (search: SearchQuery) => {
    setError(undefined)
    let matcher
    try {
      matcher = compileQuery(search)
    } catch (cause) {
      if (!(cause instanceof SearchPatternError)) throw cause
      setError(t(`tools.redact.search.errors.${cause.code}`))
      return
    }
    running.current?.abort()
    const controller = new AbortController()
    running.current = controller
    setProgress(0)
    try {
      const found = await searchDocument(pdf.doc, matcher, (done, total) => setProgress(done / total), controller.signal)
      if (controller.signal.aborted) return
      onMatches(found)
      setSearched(true)
    } catch {
      if (!controller.signal.aborted) setError(t("tools.redact.search.failed"))
    } finally {
      if (running.current === controller) setProgress(undefined)
    }
  }

  const searching = progress !== undefined
  const pages = new Set(matches.map((match) => match.page)).size

  return (
    <section className="grid gap-3 rounded-lg border bg-card p-3" aria-label={t("tools.redact.search.title")}>
      <h2 className="text-sm font-medium">{t("tools.redact.search.title")}</h2>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void run(mode === "text" ? { kind: "text", text: query } : { kind: "regex", pattern: query })
        }}
      >
        <Input
          className="min-w-48 flex-1"
          value={query}
          disabled={disabled}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t(mode === "text" ? "tools.redact.search.placeholderText" : "tools.redact.search.placeholderRegex")}
          aria-label={t("tools.redact.search.title")}
          aria-invalid={Boolean(error)}
        />
        <ToggleGroup variant="outline" value={[mode]} onValueChange={(value) => value[0] && setMode(value[0] as typeof mode)}>
          <ToggleGroupItem value="text">{t("tools.redact.search.modeText")}</ToggleGroupItem>
          <ToggleGroupItem value="regex">{t("tools.redact.search.modeRegex")}</ToggleGroupItem>
        </ToggleGroup>
        <Button type="submit" disabled={disabled || searching}>
          {t("tools.redact.search.find")}
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{t("tools.redact.search.presetsLabel")}</span>
        {SEARCH_PRESETS.map((preset) => (
          <Button
            key={preset}
            variant="outline"
            size="sm"
            disabled={disabled || searching}
            onClick={() => void run({ kind: "preset", preset })}
          >
            {t(`tools.redact.search.presets.${preset}`)}
          </Button>
        ))}
      </div>
      {searching && <Progress value={progress * 100} aria-label={t("tools.redact.search.searching")} />}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {searched && !searching && !error && (
        <div className="grid gap-2" role="status">
          {matches.length ? (
            <>
              <p className="text-sm">
                {t("tools.redact.search.found", { count: matches.length })} · {t("common.pageCount", { count: pages })}
              </p>
              <ul className="max-h-36 overflow-y-auto rounded-md border text-sm">
                {matches.slice(0, LISTED).map((match, index) => (
                  <li key={index}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-2 py-1 text-left hover:bg-muted"
                      onClick={() => onPage(match.page)}
                    >
                      <span className="w-10 shrink-0 text-xs text-muted-foreground tabular-nums">p. {match.page + 1}</span>
                      <span className="min-w-0 truncate">{match.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">{t("tools.redact.search.note")}</p>
              <div className="flex flex-wrap gap-2">
                <Button disabled={disabled} onClick={onMarkAll}>
                  {t("tools.redact.search.markAll", { count: matches.length })}
                </Button>
                <Button variant="outline" disabled={disabled} onClick={() => onMatches([])}>
                  {t("tools.redact.search.clearResults")}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("tools.redact.search.noMatches")}</p>
          )}
        </div>
      )}
    </section>
  )
}

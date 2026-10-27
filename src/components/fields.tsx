/** Small labelled form controls shared by the tools. */
import { useId, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { PageRangeError, parseRanges } from "@/lib/pdf/ranges"
import { cn } from "@/lib/utils"

export function Field({ label, children, hint, className }: { label: ReactNode; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label className="text-sm">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

interface SliderFieldProps {
  label: ReactNode
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  format?: (value: number) => string
}

export function SliderField({ label, value, onChange, min, max, step = 1, format = String }: SliderFieldProps) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between text-sm">
        <Label>{label}</Label>
        <span className="text-muted-foreground tabular-nums">{format(value)}</span>
      </div>
      {/* Base UI's Slider renders one thumb per array item, so always pass an array. */}
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
      />
    </div>
  )
}

export function ColorField({ label, value, onChange }: { label: ReactNode; value: string; onChange: (v: string) => void }) {
  const id = useId()
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded-md border bg-transparent p-0.5"
        />
        <Input
          value={value}
          onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && onChange(e.target.value)}
          className="w-28 font-mono uppercase"
          maxLength={7}
        />
      </div>
    </div>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: ReactNode
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
}) {
  const id = useId()
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.valueAsNumber)}
        className="w-32"
      />
    </div>
  )
}

/** Parses a page range, returning the pages or a translated error message. */
export function usePageRange(value: string, pageCount: number) {
  const { t } = useTranslation()
  try {
    const pages = parseRanges(value, pageCount)
    return { pages, error: pages.length ? undefined : t("errors.range.empty") }
  } catch (error) {
    if (error instanceof PageRangeError) return { pages: [], error: t(`errors.range.${error.code}`, error.values) }
    throw error
  }
}

export function RangeField({
  label,
  value,
  onChange,
  error,
}: {
  label?: ReactNode
  value: string
  onChange: (v: string) => void
  error?: string
}) {
  const { t } = useTranslation()
  const id = useId()
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-sm">
        {label ?? t("common.pages")}
      </Label>
      <Input
        id={id}
        value={value}
        placeholder={t("common.allPages")}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
      />
      <p className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
        {error ?? t("common.rangeHint")}
      </p>
    </div>
  )
}

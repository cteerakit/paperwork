import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

/** A compact checkbox that doesn't start drags or toggle its parent twice. */
export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onChange()
      }}
      className={cn(
        "grid size-4 place-items-center rounded border transition-colors",
        checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"
      )}
    >
      {checked && <Check className="size-3" />}
    </button>
  )
}

import { AlignCenter, AlignLeft, AlignRight, Bold, Trash2 } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { ColorField, SliderField } from "@/components/fields"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Toggle } from "@/components/ui/toggle"
import type { Annotation } from "@/lib/annotate/model"
import type { ToolId, ToolStyle } from "./types"

interface PropertiesPanelProps {
  selected?: Annotation
  tool: ToolId
  style: ToolStyle
  setStyle: (patch: Partial<ToolStyle>) => void
  /** Updates the selected object; `key` merges rapid changes into one undo step. */
  update: (patch: Partial<Annotation>, key: string) => void
  onDelete: () => void
  onEditNote: () => void
}

/**
 * Edits the selected object, or the style for new objects when nothing is selected.
 * Each control maps to both: the object's own property and the matching style default.
 */
export function PropertiesPanel({ selected, tool, style, setStyle, update, onDelete, onEditNote }: PropertiesPanelProps) {
  const { t } = useTranslation()
  const kind = selected?.type ?? (tool === "select" ? undefined : tool)

  if (!kind) {
    return <p className="text-sm text-muted-foreground">{t("editor.nothingSelected")}</p>
  }

  // Read from the object when one is selected, otherwise from the default style.
  const o = selected as Record<string, unknown> | undefined
  const value = <T,>(objectKey: string, styleValue: T): T => (o && objectKey in o ? (o[objectKey] as T) : styleValue)
  const set = (objectKey: string, styleKey: keyof ToolStyle, v: unknown) => {
    if (selected) update({ [objectKey]: v } as Partial<Annotation>, objectKey)
    setStyle({ [styleKey]: v } as Partial<ToolStyle>)
  }

  const controls: ReactNode[] = []
  const opacity = (
    <SliderField
      key="opacity"
      label={t("editor.props.opacity")}
      value={Math.round(value("opacity", style.opacity) * 100)}
      min={10}
      max={100}
      step={5}
      format={(v) => `${v}%`}
      onChange={(v) => set("opacity", "opacity", v / 100)}
    />
  )

  if (kind === "text") {
    controls.push(
      <ColorField key="color" label={t("common.color")} value={value("color", style.textColor)} onChange={(v) => set("color", "textColor", v)} />,
      <SliderField
        key="size"
        label={t("common.fontSize")}
        value={value("fontSize", style.fontSize)}
        min={6}
        max={96}
        format={(v) => `${v} pt`}
        onChange={(v) => set("fontSize", "fontSize", v)}
      />,
      <div key="format" className="flex items-center gap-1">
        <Toggle
          size="sm"
          variant="outline"
          pressed={value("bold", style.bold)}
          onPressedChange={(v) => set("bold", "bold", v)}
          aria-label={t("editor.props.bold")}
        >
          <Bold />
        </Toggle>
        <span className="mx-1 h-5 w-px bg-border" />
        {(
          [
            ["left", AlignLeft],
            ["center", AlignCenter],
            ["right", AlignRight],
          ] as const
        ).map(([align, Icon]) => (
          <Toggle
            key={align}
            size="sm"
            variant="outline"
            pressed={value("align", style.align) === align}
            onPressedChange={() => set("align", "align", align)}
            aria-label={t(`editor.props.align.${align}`)}
          >
            <Icon />
          </Toggle>
        ))}
      </div>,
      opacity
    )
  } else if (kind === "rect" || kind === "ellipse") {
    const fill = value<string | null>("fill", style.fill)
    controls.push(
      <ColorField key="stroke" label={t("editor.props.stroke")} value={value("stroke", style.stroke) ?? "#000000"} onChange={(v) => set("stroke", "stroke", v)} />,
      <SliderField
        key="width"
        label={t("editor.props.strokeWidth")}
        value={value("strokeWidth", style.strokeWidth)}
        min={0}
        max={20}
        format={(v) => `${v} pt`}
        onChange={(v) => set("strokeWidth", "strokeWidth", v)}
      />,
      <div key="fill" className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">{t("editor.props.fill")}</Label>
          <Switch checked={fill !== null} onCheckedChange={(on) => set("fill", "fill", on ? "#fecaca" : null)} />
        </div>
        {fill !== null && <ColorField label="" value={fill} onChange={(v) => set("fill", "fill", v)} />}
      </div>,
      opacity
    )
  } else if (kind === "line" || kind === "arrow" || kind === "pen") {
    controls.push(
      <ColorField key="stroke" label={t("common.color")} value={value("stroke", style.stroke)} onChange={(v) => set("stroke", "stroke", v)} />,
      <SliderField
        key="width"
        label={t("editor.props.strokeWidth")}
        value={value("strokeWidth", style.strokeWidth)}
        min={1}
        max={20}
        format={(v) => `${v} pt`}
        onChange={(v) => set("strokeWidth", "strokeWidth", v)}
      />,
      opacity
    )
  } else if (kind === "highlight") {
    controls.push(
      <ColorField key="color" label={t("common.color")} value={value("color", style.highlight)} onChange={(v) => set("color", "highlight", v)} />,
      opacity
    )
  } else if (kind === "note") {
    controls.push(
      <ColorField key="color" label={t("common.color")} value={value("color", style.note)} onChange={(v) => set("color", "note", v)} />
    )
    if (selected) {
      controls.push(
        <Button key="edit" variant="outline" size="sm" onClick={onEditNote}>
          {t("editor.editNote")}
        </Button>
      )
    }
  } else if (kind === "image") {
    controls.push(opacity)
  }

  return (
    <div className="grid gap-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {selected ? t(`editor.tools.${kind}`) : t("editor.newObjectStyle", { tool: t(`editor.tools.${kind}`) })}
      </p>
      {controls}
      {selected && (
        <Button variant="destructive" size="sm" onClick={onDelete}>
          <Trash2 />
          {t("common.delete")}
        </Button>
      )}
    </div>
  )
}

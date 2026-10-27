/** Konva renderers for each annotation type. All coordinates are page points. */
import type { KonvaEventObject } from "konva/lib/Node"
import { useEffect, useState } from "react"
import { Arrow, Circle, Ellipse, Group, Image as KonvaImage, Line, Path, Rect } from "react-konva"
import { useTextLayout } from "@/hooks/useTextLayout"
import {
  arrowHead,
  NOTE_SIZE,
  TEXT_LINE_HEIGHT,
  type Annotation,
  type HighlightObject,
  type ImageObject,
  type LineObject,
  type NoteObject,
  type ShapeObject,
  type TextObject,
} from "@/lib/annotate/model"

export interface NodeProps<T extends Annotation = Annotation> {
  obj: T
  /** Whether objects can be selected/dragged (only with the Select tool). */
  interactive: boolean
  selected: boolean
  /** Text being edited in the HTML overlay is hidden on the canvas. */
  editing: boolean
  lang?: string
  onSelect: () => void
  onChange: (patch: Partial<Annotation>) => void
  onEdit: () => void
}

const TRANSPARENT = "rgba(0,0,0,0)"

export function AnnotationNode(props: NodeProps) {
  switch (props.obj.type) {
    case "text":
      return <TextNode {...(props as NodeProps<TextObject>)} />
    case "image":
      return <ImageNode {...(props as NodeProps<ImageObject>)} />
    case "rect":
    case "ellipse":
      return <ShapeNode {...(props as NodeProps<ShapeObject>)} />
    case "highlight":
      return <HighlightNode {...(props as NodeProps<HighlightObject>)} />
    case "line":
    case "arrow":
    case "pen":
      return <LineNode {...(props as NodeProps<LineObject>)} />
    case "note":
      return <NoteNode {...(props as NodeProps<NoteObject>)} />
  }
}

/** Shared props for objects with a box (x, y, size, rotation). */
function boxGroupProps(props: NodeProps) {
  const { obj, interactive, onSelect, onChange } = props
  const box = obj as Annotation & { x: number; y: number; rotation?: number }
  return {
    id: obj.id,
    name: "annotation",
    x: box.x,
    y: box.y,
    rotation: box.rotation ?? 0,
    draggable: interactive,
    listening: interactive,
    onMouseDown: onSelect,
    onTap: onSelect,
    onDragEnd: (e: KonvaEventObject<DragEvent>) => onChange({ x: e.target.x(), y: e.target.y() }),
    onTransformEnd: (e: KonvaEventObject<Event>) => {
      const node = e.target
      const patch: Record<string, number> = { x: node.x(), y: node.y(), rotation: node.rotation() }
      if ("width" in obj) {
        patch.width = Math.max(5, obj.width * node.scaleX())
        if (obj.type !== "text") patch.height = Math.max(5, obj.height * node.scaleY())
      }
      node.scale({ x: 1, y: 1 })
      onChange(patch)
    },
  }
}

function TextNode(props: NodeProps<TextObject>) {
  const { obj, editing, lang, onEdit } = props
  // While resizing, keep the font size and re-wrap instead of stretching the text.
  const [liveWidth, setLiveWidth] = useState<number>()
  const width = liveWidth ?? obj.width
  const prepared = useTextLayout(obj.text || " ", {
    fontSize: obj.fontSize,
    maxWidth: width,
    align: obj.align,
    lineHeight: TEXT_LINE_HEIGHT,
    weight: obj.bold ? "bold" : "regular",
    family: obj.family,
    lang,
  })
  const height = prepared?.layout.height ?? obj.fontSize * TEXT_LINE_HEIGHT

  const group = boxGroupProps(props)
  return (
    <Group
      {...group}
      opacity={obj.opacity}
      visible={!editing}
      onDblClick={onEdit}
      onDblTap={onEdit}
      onTransform={(e) => {
        const node = e.target
        setLiveWidth(Math.max(20, obj.width * node.scaleX()))
        node.scaleX(1)
      }}
      onTransformEnd={(e) => {
        const node = e.target
        const w = liveWidth ?? obj.width
        setLiveWidth(undefined)
        node.scale({ x: 1, y: 1 })
        props.onChange({ x: node.x(), y: node.y(), rotation: node.rotation(), width: w })
      }}
    >
      <Rect width={width} height={height} fill={TRANSPARENT} />
      {prepared && <Path data={prepared.path} fill={obj.color} listening={false} />}
    </Group>
  )
}

function useHtmlImage(src: string) {
  const [image, setImage] = useState<HTMLImageElement>()
  useEffect(() => {
    const img = new window.Image()
    img.onload = () => setImage(img)
    img.src = src
    return () => {
      img.onload = null
    }
  }, [src])
  return image
}

function ImageNode(props: NodeProps<ImageObject>) {
  const { obj } = props
  const image = useHtmlImage(obj.src)
  return (
    <Group {...boxGroupProps(props)} opacity={obj.opacity}>
      <Rect width={obj.width} height={obj.height} fill={TRANSPARENT} />
      {image && <KonvaImage image={image} width={obj.width} height={obj.height} listening={false} />}
    </Group>
  )
}

function ShapeNode(props: NodeProps<ShapeObject>) {
  const { obj } = props
  const style = {
    stroke: obj.stroke ?? undefined,
    strokeWidth: obj.stroke ? obj.strokeWidth : 0,
    // A transparent fill keeps the inside clickable.
    fill: obj.fill ?? TRANSPARENT,
    hitStrokeWidth: Math.max(10, obj.strokeWidth),
    strokeScaleEnabled: false,
  }
  return (
    <Group {...boxGroupProps(props)} opacity={obj.opacity}>
      {obj.type === "rect" ? (
        <Rect width={obj.width} height={obj.height} {...style} />
      ) : (
        <Ellipse x={obj.width / 2} y={obj.height / 2} radiusX={obj.width / 2} radiusY={obj.height / 2} {...style} />
      )}
    </Group>
  )
}

function HighlightNode(props: NodeProps<HighlightObject>) {
  const { obj } = props
  return (
    <Group {...boxGroupProps(props)} opacity={obj.opacity} globalCompositeOperation="multiply">
      <Rect width={obj.width} height={obj.height} fill={obj.color} />
    </Group>
  )
}

function LineNode({ obj, interactive, selected, onSelect, onChange }: NodeProps<LineObject>) {
  const [live, setLive] = useState<number[]>()
  const points = live ?? obj.points
  const common = {
    id: obj.id,
    name: "annotation",
    points,
    stroke: obj.stroke,
    strokeWidth: obj.strokeWidth,
    opacity: obj.opacity,
    lineCap: "round" as const,
    lineJoin: "round" as const,
    hitStrokeWidth: Math.max(12, obj.strokeWidth + 8),
    draggable: interactive,
    listening: interactive,
    onMouseDown: onSelect,
    onTap: onSelect,
    onDragEnd: (e: KonvaEventObject<DragEvent>) => {
      const node = e.target
      const dx = node.x()
      const dy = node.y()
      node.position({ x: 0, y: 0 })
      onChange({ points: obj.points.map((v, i) => v + (i % 2 ? dy : dx)) })
    },
  }
  const head = arrowHead(obj.strokeWidth)

  return (
    <>
      {obj.type === "arrow" ? (
        <Arrow {...common} fill={obj.stroke} pointerLength={head.length} pointerWidth={head.width} />
      ) : (
        <Line {...common} />
      )}
      {selected && interactive && obj.type !== "pen" && (
        <>
          {[0, 2].map((i) => (
            <Circle
              key={i}
              x={points[i]}
              y={points[i + 1]}
              radius={5}
              fill="#ffffff"
              stroke="#2563eb"
              strokeWidth={1.5}
              strokeScaleEnabled={false}
              draggable
              onDragMove={(e) => {
                const next = [...points]
                next[i] = e.target.x()
                next[i + 1] = e.target.y()
                setLive(next)
              }}
              onDragEnd={(e) => {
                const next = [...points]
                next[i] = e.target.x()
                next[i + 1] = e.target.y()
                setLive(undefined)
                onChange({ points: next })
              }}
            />
          ))}
        </>
      )}
    </>
  )
}

function NoteNode(props: NodeProps<NoteObject>) {
  const { obj, selected, onEdit } = props
  const s = NOTE_SIZE
  return (
    <Group {...boxGroupProps(props)} rotation={0} onDblClick={onEdit} onDblTap={onEdit} opacity={obj.opacity}>
      <Rect
        width={s}
        height={s}
        cornerRadius={4}
        fill={obj.color}
        stroke={selected ? "#2563eb" : "rgba(0,0,0,0.35)"}
        strokeWidth={selected ? 2 : 1}
        shadowColor="black"
        shadowOpacity={0.2}
        shadowBlur={3}
        shadowOffsetY={1}
      />
      {[7, 12, 17].map((y) => (
        <Line key={y} points={[6, y, y === 17 ? 13 : 18, y]} stroke="rgba(0,0,0,0.55)" strokeWidth={1.5} lineCap="round" />
      ))}
    </Group>
  )
}

/**
 * One page of the editor: the rendered PDF page as a background, the
 * annotation objects on top, and pointer handling for creating new objects.
 * The Konva stage is scaled so all coordinates are page points.
 */
import type Konva from "konva"
import type { KonvaEventObject } from "konva/lib/Node"
import { useEffect, useRef, useState } from "react"
import { Image as KonvaImage, Layer, Line, Rect, Ellipse, Stage, Transformer, Arrow } from "react-konva"
import { arrowHead, isBox, NOTE_SIZE, TEXT_LINE_HEIGHT, type Annotation, type TextObject } from "@/lib/annotate/model"
import { renderPage, type LoadedPdf } from "@/lib/render/pdfjs"
import { AnnotationNode } from "./nodes"
import { createObject, STICKY_TOOLS, type ToolId, type ToolStyle } from "./types"
import type { AnnotationsApi } from "./useAnnotations"

interface EditorCanvasProps {
  pdf: LoadedPdf
  page: number
  /** CSS pixels per point. */
  scale: number
  api: AnnotationsApi
  tool: ToolId
  setTool: (tool: ToolId) => void
  style: ToolStyle
  selectedId?: string
  setSelectedId: (id?: string) => void
  editingId?: string
  setEditingId: (id?: string) => void
  onEditNote: (id: string) => void
  lang?: string
}

type Draft =
  | { kind: "box"; type: "rect" | "ellipse" | "highlight"; x0: number; y0: number; x: number; y: number }
  | { kind: "line"; type: "line" | "arrow"; points: number[] }
  | { kind: "pen"; points: number[] }

export function EditorCanvas(props: EditorCanvasProps) {
  const { pdf, page, scale, api, tool, setTool, style, selectedId, setSelectedId, editingId, setEditingId, lang } = props
  const size = pdf.pageSizes[page]
  const stage = useRef<Konva.Stage>(null)
  const transformer = useRef<Konva.Transformer>(null)
  const [background, setBackground] = useState<HTMLCanvasElement>()
  const [draft, setDraft] = useState<Draft>()

  const objects = api.objects.filter((o) => o.page === page)
  const selected = objects.find((o) => o.id === selectedId)

  // Render the page, re-rendering (debounced) when the zoom changes.
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      renderPage(pdf.doc, page, scale * Math.min(2, window.devicePixelRatio || 1), controller.signal)
        .then((canvas) => !controller.signal.aborted && setBackground(canvas))
        .catch(() => {})
    }, 120)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [pdf.doc, page, scale])

  // Attach the resize/rotate handles to the selected box object.
  useEffect(() => {
    const tr = transformer.current
    if (!tr) return
    const node = selected && isBox(selected) && tool === "select" && !editingId ? stage.current?.findOne(`#${selected.id}`) : undefined
    tr.nodes(node ? [node] : [])
    tr.getLayer()?.batchDraw()
  }, [selected, tool, editingId, objects])

  const pointer = () => stage.current!.getRelativePointerPosition()!

  const onPointerDown = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    const onEmpty = e.target === e.target.getStage() || e.target.name() === "background"
    if (tool === "select") {
      if (onEmpty) {
        setSelectedId(undefined)
        setEditingId(undefined)
      }
      return
    }
    const { x, y } = pointer()
    switch (tool) {
      case "rect":
      case "ellipse":
      case "highlight":
        setDraft({ kind: "box", type: tool, x0: x, y0: y, x, y })
        break
      case "line":
      case "arrow":
        setDraft({ kind: "line", type: tool, points: [x, y, x, y] })
        break
      case "pen":
        setDraft({ kind: "pen", points: [x, y] })
        break
      case "text": {
        // Keep the canvas's native press from blurring the editor we focus below.
        e.evt.preventDefault()
        const obj = createObject("text", page, { x, y: y - style.fontSize * 0.7, width: 220, height: 0 }, style)
        api.add(obj)
        setSelectedId(obj.id)
        setEditingId(obj.id)
        setTool("select")
        break
      }
      case "note": {
        const obj = createObject("note", page, { x: x - NOTE_SIZE / 2, y: y - NOTE_SIZE / 2, width: 0, height: 0 }, style)
        api.add(obj)
        setSelectedId(obj.id)
        setTool("select")
        props.onEditNote(obj.id)
        break
      }
    }
  }

  const onPointerMove = () => {
    if (!draft) return
    const { x, y } = pointer()
    if (draft.kind === "box") setDraft({ ...draft, x, y })
    else if (draft.kind === "line") setDraft({ ...draft, points: [draft.points[0], draft.points[1], x, y] })
    else {
      const [lx, ly] = draft.points.slice(-2)
      // Skip points closer than half a point to keep strokes light.
      if (Math.hypot(x - lx, y - ly) > 0.5) setDraft({ ...draft, points: [...draft.points, x, y] })
    }
  }

  const onPointerUp = () => {
    if (!draft) return
    let obj: Annotation | undefined
    if (draft.kind === "box") {
      let box = {
        x: Math.min(draft.x0, draft.x),
        y: Math.min(draft.y0, draft.y),
        width: Math.abs(draft.x - draft.x0),
        height: Math.abs(draft.y - draft.y0),
      }
      // A click without dragging creates a default-sized shape.
      if (box.width < 4 && box.height < 4) {
        box = draft.type === "highlight"
          ? { x: draft.x0, y: draft.y0 - 8, width: 160, height: 18 }
          : { x: draft.x0 - 60, y: draft.y0 - 40, width: 120, height: 80 }
      }
      obj = createObject(draft.type, page, box, style)
    } else if (draft.kind === "line") {
      const [x1, y1, x2, y2] = draft.points
      const points = Math.hypot(x2 - x1, y2 - y1) < 4 ? [x1, y1, x1 + 120, y1] : draft.points
      obj = createObject(draft.type, page, { x: 0, y: 0, width: 0, height: 0 }, style, points)
    } else if (draft.points.length >= 4) {
      obj = createObject("pen", page, { x: 0, y: 0, width: 0, height: 0 }, style, draft.points)
    }
    setDraft(undefined)
    if (!obj) return
    api.add(obj)
    if (!STICKY_TOOLS.includes(tool)) {
      setTool("select")
      setSelectedId(obj.id)
    }
  }

  const editing = objects.find((o) => o.id === editingId) as TextObject | undefined
  const isText = selected?.type === "text"
  const isImage = selected?.type === "image"

  return (
    <div
      className="relative touch-none bg-white shadow-md ring-1 ring-black/10"
      style={{ width: size.width * scale, height: size.height * scale, cursor: tool === "select" ? "default" : "crosshair" }}
    >
      <Stage
        ref={stage}
        width={size.width * scale}
        height={size.height * scale}
        scaleX={scale}
        scaleY={scale}
        onMouseDown={onPointerDown}
        onTouchStart={onPointerDown}
        onMouseMove={onPointerMove}
        onTouchMove={onPointerMove}
        onMouseUp={onPointerUp}
        onTouchEnd={onPointerUp}
      >
        <Layer listening={false}>
          <Rect name="background" width={size.width} height={size.height} fill="#ffffff" />
          {background && <KonvaImage name="background" image={background} width={size.width} height={size.height} />}
        </Layer>
        <Layer>
          {objects.map((obj) => (
            <AnnotationNode
              key={obj.id}
              obj={obj}
              interactive={tool === "select"}
              selected={obj.id === selectedId}
              editing={obj.id === editingId}
              lang={lang}
              onSelect={() => setSelectedId(obj.id)}
              onChange={(patch) => api.update(obj.id, patch)}
              onEdit={() => (obj.type === "note" ? props.onEditNote(obj.id) : obj.type === "text" && setEditingId(obj.id))}
            />
          ))}
          {draft && <DraftShape draft={draft} style={style} />}
          <Transformer
            ref={transformer}
            rotateEnabled
            keepRatio={isImage}
            enabledAnchors={
              isText
                ? ["middle-left", "middle-right"]
                : isImage
                  ? ["top-left", "top-right", "bottom-left", "bottom-right"]
                  : undefined
            }
            ignoreStroke
            anchorSize={8}
            borderStroke="#2563eb"
            anchorStroke="#2563eb"
            rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
            boundBoxFunc={(oldBox, newBox) => (newBox.width < 5 || newBox.height < 5 ? oldBox : newBox)}
          />
        </Layer>
      </Stage>
      {editing && (
        <TextEditOverlay
          key={editing.id}
          obj={editing}
          scale={scale}
          onCommit={(text) => {
            setEditingId(undefined)
            if (text.trim() === "") {
              api.remove(editing.id)
              setSelectedId(undefined)
            } else if (text !== editing.text) {
              api.update(editing.id, { text })
            }
          }}
        />
      )}
    </div>
  )
}

function DraftShape({ draft, style }: { draft: Draft; style: ToolStyle }) {
  if (draft.kind === "pen") {
    return <Line points={draft.points} stroke={style.stroke} strokeWidth={style.strokeWidth} lineCap="round" lineJoin="round" opacity={style.opacity} />
  }
  if (draft.kind === "line") {
    const head = arrowHead(style.strokeWidth)
    return draft.type === "arrow" ? (
      <Arrow points={draft.points} stroke={style.stroke} fill={style.stroke} strokeWidth={style.strokeWidth} pointerLength={head.length} pointerWidth={head.width} lineCap="round" />
    ) : (
      <Line points={draft.points} stroke={style.stroke} strokeWidth={style.strokeWidth} lineCap="round" />
    )
  }
  const x = Math.min(draft.x0, draft.x)
  const y = Math.min(draft.y0, draft.y)
  const width = Math.abs(draft.x - draft.x0)
  const height = Math.abs(draft.y - draft.y0)
  if (draft.type === "highlight") {
    return <Rect x={x} y={y} width={width} height={height} fill={style.highlight} opacity={0.5} globalCompositeOperation="multiply" />
  }
  const paint = { stroke: style.stroke, strokeWidth: style.strokeWidth, fill: style.fill ?? undefined, opacity: style.opacity }
  return draft.type === "rect" ? (
    <Rect x={x} y={y} width={width} height={height} {...paint} />
  ) : (
    <Ellipse x={x + width / 2} y={y + height / 2} radiusX={width / 2} radiusY={height / 2} {...paint} />
  )
}

/** An HTML textarea placed exactly over a text box while editing it. */
function TextEditOverlay({ obj, scale, onCommit }: { obj: TextObject; scale: number; onCommit: (text: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [value, setValue] = useState(obj.text)
  const done = useRef(false)

  const commit = () => {
    if (done.current) return
    done.current = true
    onCommit(ref.current?.value ?? value)
  }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [value, scale])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) commit()
      }}
      spellCheck={false}
      className="absolute resize-none overflow-hidden border-0 bg-transparent p-0 outline-2 outline-offset-2 outline-blue-500 outline-dashed"
      style={{
        left: obj.x * scale,
        top: obj.y * scale,
        width: obj.width * scale,
        fontSize: obj.fontSize * scale,
        lineHeight: TEXT_LINE_HEIGHT,
        fontFamily: obj.family === "signature" ? "var(--font-signature)" : "var(--font-pdf)",
        fontWeight: obj.bold ? 700 : 400,
        color: obj.color,
        opacity: obj.opacity,
        textAlign: obj.align,
        transform: `rotate(${obj.rotation}deg)`,
        transformOrigin: "top left",
      }}
    />
  )
}

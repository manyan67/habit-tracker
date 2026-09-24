import { useState } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"
import type { Point, Shape, Tool } from "../types/shape"
import { screenToCanvas, type Viewport } from "../utils/geometry"
import ShapeElement from "./Shape"

const GRID_MINOR = 20
const GRID_MAJOR = 100

interface CanvasProps {
  containerRef: React.RefObject<HTMLDivElement | null>
  viewport: Viewport
  spacePressed: boolean
  isPanning: boolean
  tool: Tool
  shapes: Shape[]
  selectedIds: string[]
  draft?: Omit<Shape, "id"> | null
  onPointerDown: (event: ReactPointerEvent) => void
  onPointerMove: (event: ReactPointerEvent) => void
  onPointerUp: (event: ReactPointerEvent) => void
  onPointerCancel: (event: ReactPointerEvent) => void
}

export default function Canvas({
  containerRef,
  viewport,
  spacePressed,
  isPanning,
  tool,
  shapes,
  selectedIds,
  draft,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: CanvasProps) {
  const [cursor, setCursor] = useState<Point | null>(null)

  const handlePointerMove = (event: ReactPointerEvent) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setCursor({ x: event.clientX - rect.left, y: event.clientY - rect.top })
    onPointerMove(event)
  }

  const cursorClass =
    isPanning || spacePressed
      ? "cursor-grabbing"
      : tool === "select"
        ? "cursor-default"
        : "cursor-crosshair"

  const canvasPoint = cursor ? screenToCanvas(cursor, viewport) : null

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden bg-[#1e1e1e] select-none touch-none ${cursorClass}`}
      style={{
        backgroundImage: [
          "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1.2px)",
          "radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1.2px)",
        ].join(", "),
        backgroundSize: [
          `${GRID_MINOR * viewport.zoom}px ${GRID_MINOR * viewport.zoom}px`,
          `${GRID_MAJOR * viewport.zoom}px ${GRID_MAJOR * viewport.zoom}px`,
        ].join(", "),
        backgroundPosition: [
          `${viewport.x}px ${viewport.y}px`,
          `${viewport.x}px ${viewport.y}px`,
        ].join(", "),
      }}
      onPointerDown={onPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        }}
      >
        {shapes.map((shape) => (
          <ShapeElement
            key={shape.id}
            shape={shape}
            selected={selectedIds.includes(shape.id)}
          />
        ))}
        {draft && (
          <ShapeElement
            key="draft"
            shape={{ id: "draft", ...draft }}
            selected={false}
          />
        )}
      </div>

      {canvasPoint && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-md border border-white/10 bg-black/60 px-2 py-1 font-mono text-[11px] text-neutral-300 backdrop-blur">
          {canvasPoint.x.toFixed(1)}, {canvasPoint.y.toFixed(1)} · {Math.round(
            viewport.zoom * 100,
          )}
          %
        </div>
      )}
    </div>
  )
}
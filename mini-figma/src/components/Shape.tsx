import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react"
import type { HandlePosition, Shape } from "../types/shape"

interface ShapeElementProps {
  shape: Shape
  selected: boolean
  interactive?: boolean
  onHandlePointerDown?: (handle: HandlePosition, event: ReactPointerEvent) => void
  onDoubleClick?: (event: ReactMouseEvent) => void
}

const SHAPE_STYLE: Record<Shape["kind"], CSSProperties> = {
  rectangle: { borderRadius: 0 },
  ellipse: { borderRadius: "9999px" },
  text: {},
}

const SELECTION_COLOR = "#0b93ff"
const HANDLE_SIZE = 8

const HANDLE_POSITIONS: HandlePosition[] = [
  "nw",
  "n",
  "ne",
  "w",
  "e",
  "sw",
  "s",
  "se",
]

const HANDLE_LAYOUT: Record<HandlePosition, { top: string; left: string }> = {
  nw: { top: "0%", left: "0%" },
  n: { top: "0%", left: "50%" },
  ne: { top: "0%", left: "100%" },
  w: { top: "50%", left: "0%" },
  e: { top: "50%", left: "100%" },
  sw: { top: "100%", left: "0%" },
  s: { top: "100%", left: "50%" },
  se: { top: "100%", left: "100%" },
}

const HANDLE_CURSORS: Record<HandlePosition, string> = {
  nw: "nwse-resize",
  n: "ns-resize",
  ne: "nesw-resize",
  w: "ew-resize",
  e: "ew-resize",
  sw: "nesw-resize",
  s: "ns-resize",
  se: "nwse-resize",
}

interface HandleProps {
  position: HandlePosition
  onPointerDown?: (handle: HandlePosition, event: ReactPointerEvent) => void
}

function SelectionHandle({ position, onPointerDown }: HandleProps) {
  return (
    <div
      data-testid={`handle-${position}`}
      className="absolute z-10"
      style={{
        top: HANDLE_LAYOUT[position].top,
        left: HANDLE_LAYOUT[position].left,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        backgroundColor: SELECTION_COLOR,
        border: "2px solid #ffffff",
        borderRadius: 2,
        transform: "translate(-50%, -50%)",
        boxSizing: "border-box",
        pointerEvents: "auto",
        cursor: HANDLE_CURSORS[position],
      }}
      onPointerDown={(event) => {
        event.stopPropagation()
        onPointerDown?.(position, event)
      }}
    />
  )
}

interface SelectionFrameProps {
  interactive: boolean
  onHandlePointerDown?: (handle: HandlePosition, event: ReactPointerEvent) => void
}

function SelectionFrame({ interactive, onHandlePointerDown }: SelectionFrameProps) {
  return (
    <>
      <div
        className="pointer-events-none absolute z-10"
        style={{
          inset: 0,
          border: `2px solid ${SELECTION_COLOR}`,
          boxSizing: "border-box",
        }}
      />
      {interactive &&
        HANDLE_POSITIONS.map((position) => (
          <SelectionHandle
            key={position}
            position={position}
            onPointerDown={onHandlePointerDown}
          />
        ))}
    </>
  )
}

export default function ShapeElement({
  shape,
  selected,
  interactive = false,
  onHandlePointerDown,
  onDoubleClick,
}: ShapeElementProps) {
  const hidden = shape.visible === false
  const frame = selected ? (
    <SelectionFrame interactive={interactive} onHandlePointerDown={onHandlePointerDown} />
  ) : null
  const testId = shape.id === "draft" ? undefined : "shape"

  if (shape.kind === "text") {
    return (
      <div
        data-testid={testId}
        data-shape-id={shape.id}
        className="absolute"
        style={{
          left: shape.x,
          top: shape.y,
          width: shape.width,
          height: shape.height,
          transform: `rotate(${shape.rotation}deg)`,
          boxSizing: "border-box",
          display: hidden ? "none" : "flex",
          alignItems: "flex-start",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: shape.fontSize ?? 16,
          color: shape.fill,
          lineHeight: 1.4,
          pointerEvents: "none",
          userSelect: "none",
        }}
        onDoubleClick={onDoubleClick}
      >
        {frame}
        {shape.text}
      </div>
    )
  }

  const strokeWeight = shape.strokeWeight ?? 0
  const border =
    strokeWeight > 0 && shape.stroke !== "transparent"
      ? `${strokeWeight}px solid ${shape.stroke}`
      : undefined

  return (
    <div
      data-testid={testId}
      data-shape-id={shape.id}
      className="absolute"
      style={{
        left: shape.x,
        top: shape.y,
        width: shape.width,
        height: shape.height,
        background: shape.fill,
        transform: `rotate(${shape.rotation}deg)`,
        boxSizing: "border-box",
        border,
        display: hidden ? "none" : undefined,
        ...SHAPE_STYLE[shape.kind],
      }}
      onDoubleClick={onDoubleClick}
    >
      {frame}
    </div>
  )
}

import type { Shape } from "../types/shape"

interface ShapeElementProps {
  shape: Shape
  selected: boolean
}

const SHAPE_STYLE: Record<Shape["kind"], React.CSSProperties> = {
  rectangle: { borderRadius: 0 },
  ellipse: { borderRadius: "9999px" },
}

const SELECTION_COLOR = "#0b93ff"
const HANDLE_SIZE = 8

type HandlePosition =
  | "nw"
  | "n"
  | "ne"
  | "w"
  | "e"
  | "sw"
  | "s"
  | "se"

const HANDLE_STYLES: Record<HandlePosition, { top: string; left: string }> = {
  nw: { top: "0%", left: "0%" },
  n: { top: "0%", left: "50%" },
  ne: { top: "0%", left: "100%" },
  w: { top: "50%", left: "0%" },
  e: { top: "50%", left: "100%" },
  sw: { top: "100%", left: "0%" },
  s: { top: "100%", left: "50%" },
  se: { top: "100%", left: "100%" },
}

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

function SelectionHandle({ position }: { position: HandlePosition }) {
  return (
    <div
      className="pointer-events-none absolute z-10"
      style={{
        top: HANDLE_STYLES[position].top,
        left: HANDLE_STYLES[position].left,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        backgroundColor: SELECTION_COLOR,
        border: "2px solid #ffffff",
        borderRadius: 2,
        transform: "translate(-50%, -50%)",
        boxSizing: "border-box",
      }}
    />
  )
}

function SelectionFrame() {
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
      {HANDLE_POSITIONS.map((position) => (
        <SelectionHandle key={position} position={position} />
      ))}
    </>
  )
}

export default function ShapeElement({ shape, selected }: ShapeElementProps) {
  return (
    <div
      className="absolute"
      style={{
        left: shape.x,
        top: shape.y,
        width: shape.width,
        height: shape.height,
        background: shape.fill,
        transform: `rotate(${shape.rotation}deg)`,
        boxSizing: "border-box",
        ...SHAPE_STYLE[shape.kind],
      }}
    >
      {selected && <SelectionFrame />}
    </div>
  )
}
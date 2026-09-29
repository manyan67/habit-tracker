export type Tool = "select" | "rectangle" | "ellipse" | "text"

export type ShapeKind = "rectangle" | "ellipse" | "text"

export type HandlePosition =
  | "nw"
  | "n"
  | "ne"
  | "w"
  | "e"
  | "sw"
  | "s"
  | "se"

export interface Point {
  x: number
  y: number
}

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export interface Shape {
  id: string
  kind: ShapeKind
  x: number
  y: number
  width: number
  height: number
  fill: string
  stroke: string
  rotation: number
  text?: string
  fontSize?: number
  name?: string
  visible?: boolean
  strokeWeight?: number
}

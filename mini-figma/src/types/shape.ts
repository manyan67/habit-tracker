export type Tool = "select" | "rectangle" | "ellipse"

export type ShapeKind = "rectangle" | "ellipse"

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
}
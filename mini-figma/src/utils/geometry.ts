import type { Bounds, Point, Shape } from "../types/shape"

export interface Viewport {
  x: number
  y: number
  zoom: number
}

/**
 * Перевод экранных координат (относительно левого верхнего угла холста)
 * в координаты канваса с учётом зума и панорамирования.
 */
export function screenToCanvas(screen: Point, viewport: Viewport): Point {
  return {
    x: (screen.x - viewport.x) / viewport.zoom,
    y: (screen.y - viewport.y) / viewport.zoom,
  }
}

/**
 * Обратный перевод: координаты канваса в экранные.
 */
export function canvasToScreen(canvas: Point, viewport: Viewport): Point {
  return {
    x: canvas.x * viewport.zoom + viewport.x,
    y: canvas.y * viewport.zoom + viewport.y,
  }
}

/**
 * Нормализованный прямоугольник по двум противоположным углам
 * в координатах канваса. Учитывает перетаскивание влево/вверх
 * (отрицательные ширина/высота).
 */
export function rectFromPoints(a: Point, b: Point): Bounds {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  }
}

/**
 * Попадание точки в прямоугольник (координаты канваса).
 */
export function pointInRect(point: Point, bounds: Bounds): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  )
}

/**
 * Попадание точки в фигуру с учётом поворота: точка переводится
 * в локальную систему фигуры обратным поворотом вокруг центра,
 * для эллипса проверяется уравнение эллипса.
 */
export function pointInShape(shape: Shape, point: Point): boolean {
  if (shape.width <= 0 || shape.height <= 0) return false

  const cx = shape.x + shape.width / 2
  const cy = shape.y + shape.height / 2
  const rad = (-shape.rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = point.x - cx
  const dy = point.y - cy

  const local: Point = {
    x: dx * cos - dy * sin + shape.width / 2,
    y: dx * sin + dy * cos + shape.height / 2,
  }

  if (shape.kind === "ellipse") {
    const nx = (local.x - shape.width / 2) / (shape.width / 2)
    const ny = (local.y - shape.height / 2) / (shape.height / 2)
    return nx * nx + ny * ny <= 1
  }

  return pointInRect(local, shape)
}
import { useCallback, useRef, useState } from "react"
import type { Point, Shape, ShapeKind } from "../types/shape"
import {
  pointInShape,
  rectFromPoints,
  screenToCanvas,
  type Viewport,
} from "../utils/geometry"

const DEFAULT_FILL = "#3b82f6"
const MAX_HISTORY = 50

interface DragSnapshot {
  pointerId: number
  start: Point
  positions: { id: string; x: number; y: number }[]
}

let idCounter = 0

function nextId(): string {
  idCounter += 1
  return `shape-${idCounter}`
}

export function useShapes() {
  const [shapes, setShapes] = useState<Shape[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [draft, setDraft] = useState<Omit<Shape, "id"> | null>(null)
  const shapesRef = useRef<Shape[]>(shapes)
  const historyRef = useRef<Shape[][]>([])
  const redoHistoryRef = useRef<Shape[][]>([])
  const dragStartRef = useRef<Shape[] | null>(null)
  const draftRef = useRef<Omit<Shape, "id"> | null>(null)
  const dragRef = useRef<DragSnapshot | null>(null)

  /** Применить новое состояние фигур, синхронно обновив зеркало в ref. */
  const applyShapes = useCallback((next: Shape[]) => {
    shapesRef.current = next
    setShapes(next)
  }, [])

  /** Сохранить состояние в историю Undo и сбросить Redo. */
  const pushHistory = useCallback(
    (snapshot: Shape[] = shapesRef.current) => {
      historyRef.current.push(snapshot)
      if (historyRef.current.length > MAX_HISTORY) {
        historyRef.current.shift()
      }
      redoHistoryRef.current = []
    },
    [],
  )

  /** Верхняя фигура (последняя в списке) под точкой канваса. */
  const hitTest = useCallback(
    (point: Point): Shape | null => {
      for (let i = shapes.length - 1; i >= 0; i--) {
        if (pointInShape(shapes[i], point)) return shapes[i]
      }
      return null
    },
    [shapes],
  )

  /** Начало перетаскивания: запоминаем стартовую точку и позиции фигур. */
  const beginDrag = useCallback(
    (pointerId: number, screen: Point, viewport: Viewport, ids: string[]) => {
      dragRef.current = {
        pointerId,
        start: screenToCanvas(screen, viewport),
        positions: shapesRef.current
          .filter((s) => ids.includes(s.id))
          .map((s) => ({ id: s.id, x: s.x, y: s.y })),
      }
      dragStartRef.current = shapesRef.current
    },
    [],
  )

  /** Смещение перетаскиваемых фигур на дельту курсора в координатах канваса. */
  const updateDrag = useCallback(
    (pointerId: number, screen: Point, viewport: Viewport) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== pointerId) return
      const current = screenToCanvas(screen, viewport)
      const dx = current.x - drag.start.x
      const dy = current.y - drag.start.y
      const byId = new Map(drag.positions.map((p) => [p.id, p]))
      applyShapes(
        shapesRef.current.map((s) => {
          const origin = byId.get(s.id)
          return origin ? { ...s, x: origin.x + dx, y: origin.y + dy } : s
        }),
      )
    },
    [applyShapes],
  )

  /** Завершение перетаскивания: одна запись в истории, если фигуры двигались. */
  const endDrag = useCallback(
    (pointerId: number) => {
      if (dragRef.current?.pointerId !== pointerId) return
      dragRef.current = null
      const before = dragStartRef.current
      dragStartRef.current = null
      if (
        before &&
        JSON.stringify(before) !== JSON.stringify(shapesRef.current)
      ) {
        pushHistory(before)
      }
    },
    [pushHistory],
  )

  const addShape = useCallback(
    (shape: Omit<Shape, "id">) => {
      const withId: Shape = { ...shape, id: nextId() }
      pushHistory()
      applyShapes([...shapesRef.current, withId])
      setSelectedIds([withId.id])
      return withId
    },
    [applyShapes, pushHistory],
  )

  const updateShape = useCallback(
    (id: string, patch: Partial<Omit<Shape, "id">>) => {
      pushHistory()
      applyShapes(
        shapesRef.current.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      )
    },
    [applyShapes, pushHistory],
  )

  const removeShape = useCallback(
    (id: string) => {
      pushHistory()
      applyShapes(shapesRef.current.filter((s) => s.id !== id))
      setSelectedIds((prev) => prev.filter((s) => s !== id))
    },
    [applyShapes, pushHistory],
  )

  const selectShape = useCallback((id: string, additive = false) => {
    setSelectedIds((prev) =>
      additive ? Array.from(new Set([...prev, id])) : [id],
    )
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds([])
  }, [])

  /** Начало создания фигуры перетаскиванием (координаты уже в пространстве канваса). */
  const beginCreate = useCallback((kind: ShapeKind, start: Point) => {
    const next: Omit<Shape, "id"> = {
      kind,
      x: start.x,
      y: start.y,
      width: 0,
      height: 0,
      fill: DEFAULT_FILL,
      stroke: "transparent",
      rotation: 0,
    }
    draftRef.current = next
    setDraft(next)
    setSelectedIds([])
  }, [])

  /** Обновление размера фигуры при перетаскивании. */
  const updateCreate = useCallback((current: Point) => {
    const start = draftRef.current
    if (!start) return
    const next = { ...start, ...rectFromPoints(start, current) }
    draftRef.current = next
    setDraft(next)
  }, [])

  /** Завершение создания: фиксируем фигуру, если она не выродилась в точку. */
  const commitCreate = useCallback(() => {
    const next = draftRef.current
    draftRef.current = null
    setDraft(null)
    if (next && next.width > 1 && next.height > 1) {
      addShape(next)
    }
  }, [addShape])

  /** Отмена создания (например, отпускание вне области канваса). */
  const cancelCreate = useCallback(() => {
    draftRef.current = null
    setDraft(null)
  }, [])

  /** Undo: возврат к предыдущему состоянию фигур. */
  const undo = useCallback(() => {
    const previous = historyRef.current.pop()
    if (!previous) return
    redoHistoryRef.current.push(shapesRef.current)
    applyShapes(previous)
    setSelectedIds([])
  }, [applyShapes])

  /** Redo: повтор последнего отменённого изменения. */
  const redo = useCallback(() => {
    const next = redoHistoryRef.current.pop()
    if (!next) return
    pushHistory()
    applyShapes(next)
    setSelectedIds([])
  }, [applyShapes, pushHistory])

  return {
    shapes,
    selectedIds,
    draft,
    addShape,
    updateShape,
    removeShape,
    selectShape,
    clearSelection,
    hitTest,
    beginDrag,
    updateDrag,
    endDrag,
    beginCreate,
    updateCreate,
    commitCreate,
    cancelCreate,
    undo,
    redo,
  }
}
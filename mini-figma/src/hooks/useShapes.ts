import { useCallback, useRef, useState } from "react"
import type { Bounds, HandlePosition, Point, Shape, ShapeKind } from "../types/shape"
import {
  pointInShape,
  rectFromPoints,
  screenToCanvas,
  type Viewport,
} from "../utils/geometry"

const DEFAULT_FILL = "#D9D9D9"
const DEFAULT_TEXT_FILL = "#FFFFFF"
const DEFAULT_TEXT_WIDTH = 160
const DEFAULT_FONT_SIZE = 16
const MIN_SIZE = 2
const MAX_HISTORY = 50

interface DragSnapshot {
  pointerId: number
  start: Point
  positions: { id: string; x: number; y: number }[]
}

interface ResizeSnapshot {
  pointerId: number
  handle: HandlePosition
  origin: Shape
  start: Point
}

function nextId(): string {
  return `shape-${crypto.randomUUID()}`
}

/** Новый прямоугольник по хэндлу и текущему положению курсора (стороны ≥ MIN_SIZE). */
function resizeRect(handle: HandlePosition, origin: Shape, current: Point): Bounds {
  const right = origin.x + origin.width
  const bottom = origin.y + origin.height
  const rect: Bounds = { x: origin.x, y: origin.y, width: origin.width, height: origin.height }

  if (handle.includes("e")) {
    rect.width = Math.max(MIN_SIZE, current.x - origin.x)
  } else if (handle.includes("w")) {
    rect.width = Math.max(MIN_SIZE, right - current.x)
    rect.x = Math.min(current.x, right - MIN_SIZE)
  }
  if (handle.includes("s")) {
    rect.height = Math.max(MIN_SIZE, current.y - origin.y)
  } else if (handle.includes("n")) {
    rect.height = Math.max(MIN_SIZE, bottom - current.y)
    rect.y = Math.min(current.y, bottom - MIN_SIZE)
  }
  return rect
}

export function useShapes() {
  const [shapes, setShapes] = useState<Shape[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [draft, setDraft] = useState<Omit<Shape, "id"> | null>(null)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const shapesRef = useRef<Shape[]>(shapes)
  const historyRef = useRef<Shape[][]>([])
  const redoHistoryRef = useRef<Shape[][]>([])
  const dragStartRef = useRef<Shape[] | null>(null)
  const draftRef = useRef<Omit<Shape, "id"> | null>(null)
  const dragRef = useRef<DragSnapshot | null>(null)
  const resizeRef = useRef<ResizeSnapshot | null>(null)
  const resizeStartRef = useRef<Shape[] | null>(null)
  const clipboardRef = useRef<Shape[]>([])
  const pasteCountRef = useRef(0)

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

  /** Удаление всех выделенных фигур одной записью в истории. */
  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return
    const before = shapesRef.current
    const next = before.filter((s) => !selectedIds.includes(s.id))
    if (next.length === before.length) return
    pushHistory(before)
    applyShapes(next)
    setSelectedIds([])
  }, [applyShapes, pushHistory, selectedIds])

  /** Дублирование выделенных фигур со смещением; выделение переходит на копии. */
  const duplicateSelected = useCallback(
    (dx = 16, dy = 16) => {
      const picked = shapesRef.current.filter((s) => selectedIds.includes(s.id))
      if (picked.length === 0) return
      pushHistory()
      const copies = picked.map((s) => ({ ...s, id: nextId(), x: s.x + dx, y: s.y + dy }))
      applyShapes([...shapesRef.current, ...copies])
      setSelectedIds(copies.map((c) => c.id))
    },
    [applyShapes, pushHistory, selectedIds],
  )

  /** Копирование выделенных фигур во внутренний буфер (+ системный, если доступен). */
  const copySelected = useCallback(() => {
    const picked = shapesRef.current.filter((s) => selectedIds.includes(s.id))
    if (picked.length === 0) return
    clipboardRef.current = picked.map((s) => ({ ...s }))
    pasteCountRef.current = 0
    try {
      navigator.clipboard?.writeText(JSON.stringify(clipboardRef.current)).catch(() => {})
    } catch {
      // Системный буфер может быть недоступен — внутреннего достаточно
    }
  }, [selectedIds])

  /** Вставка из внутреннего буфера с накопленным смещением; выделение — на копии. */
  const pasteClipboard = useCallback(
    (offset = 16) => {
      const source = clipboardRef.current
      if (source.length === 0) return
      pasteCountRef.current += 1
      const shift = offset * pasteCountRef.current
      pushHistory()
      const copies = source.map((s) => ({ ...s, id: nextId(), x: s.x + shift, y: s.y + shift }))
      applyShapes([...shapesRef.current, ...copies])
      setSelectedIds(copies.map((c) => c.id))
    },
    [applyShapes, pushHistory],
  )

  /** Выделить все фигуры. */
  const selectAll = useCallback(() => {
    setSelectedIds(shapesRef.current.map((s) => s.id))
  }, [])

  const selectShape = useCallback((id: string, additive = false) => {
    setSelectedIds((prev) =>
      additive ? Array.from(new Set([...prev, id])) : [id],
    )
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds([])
  }, [])

  /** Сдвиг фигуры по z-порядку: массив = снизу вверх, последний сверху. */
  const moveLayer = useCallback(
    (id: string, dir: "forward" | "backward") => {
      const list = shapesRef.current
      const index = list.findIndex((s) => s.id === id)
      if (index < 0) return
      const target = dir === "forward" ? index + 1 : index - 1
      if (target < 0 || target >= list.length) return
      const next = [...list]
      const moved = next[index]
      next[index] = next[target]
      next[target] = moved
      pushHistory()
      applyShapes(next)
    },
    [applyShapes, pushHistory],
  )

  /** Переименование фигуры; пустое имя отклоняется вызывающим кодом. */
  const renameShape = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      pushHistory()
      applyShapes(
        shapesRef.current.map((s) => (s.id === id ? { ...s, name: trimmed } : s)),
      )
    },
    [applyShapes, pushHistory],
  )

  /** Переключение видимости фигуры. */
  const toggleVisibility = useCallback(
    (id: string) => {
      pushHistory()
      applyShapes(
        shapesRef.current.map((s) =>
          s.id === id ? { ...s, visible: s.visible === false ? true : false } : s,
        ),
      )
    },
    [applyShapes, pushHistory],
  )

  /** Начало создания фигуры перетаскиванием (координаты уже в пространстве канваса). */
  const beginCreate = useCallback((kind: ShapeKind, start: Point) => {
    const next: Omit<Shape, "id"> = {
      kind,
      x: start.x,
      y: start.y,
      width: 0,
      height: 0,
      fill: kind === "text" ? DEFAULT_TEXT_FILL : DEFAULT_FILL,
      stroke: "transparent",
      rotation: 0,
      ...(kind === "text" ? { text: "", fontSize: DEFAULT_FONT_SIZE } : {}),
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
    if (!next) return
    if (next.kind === "text") {
      if (next.width < 8 || next.height < 8) {
        const fontSize = next.fontSize ?? DEFAULT_FONT_SIZE
        addShape({
          ...next,
          width: DEFAULT_TEXT_WIDTH,
          height: Math.ceil(fontSize * 1.4),
          fontSize,
          text: "",
        })
        return
      }
      addShape(next)
      return
    }
    if (next.width > 1 && next.height > 1) {
      addShape(next)
    }
  }, [addShape])

  /** Отмена создания (например, отпускание вне области канваса). */
  const cancelCreate = useCallback(() => {
    draftRef.current = null
    setDraft(null)
  }, [])

  /** Начало ресайза одиночной выделенной фигуры за хэндл. */
  const beginResize = useCallback(
    (handle: HandlePosition, pointerId: number, screen: Point, viewport: Viewport) => {
      const picked = shapesRef.current.filter((s) => selectedIds.includes(s.id))
      if (picked.length !== 1) return
      resizeRef.current = {
        pointerId,
        handle,
        origin: picked[0],
        start: screenToCanvas(screen, viewport),
      }
      resizeStartRef.current = shapesRef.current
    },
    [selectedIds],
  )

  /** Пересчёт границ фигуры от противоположного угла/стороны (min 2px). */
  const updateResize = useCallback(
    (pointerId: number, screen: Point, viewport: Viewport) => {
      const resize = resizeRef.current
      if (!resize || resize.pointerId !== pointerId) return
      const current = screenToCanvas(screen, viewport)
      const rect = resizeRect(resize.handle, resize.origin, current)
      applyShapes(
        shapesRef.current.map((s) =>
          s.id === resize.origin.id ? { ...s, ...rect } : s,
        ),
      )
    },
    [applyShapes],
  )

  /** Завершение ресайза: одна запись в истории, если размеры изменились. */
  const endResize = useCallback(
    (pointerId: number) => {
      if (resizeRef.current?.pointerId !== pointerId) return
      resizeRef.current = null
      const before = resizeStartRef.current
      resizeStartRef.current = null
      if (
        before &&
        JSON.stringify(before) !== JSON.stringify(shapesRef.current)
      ) {
        pushHistory(before)
      }
    },
    [pushHistory],
  )

  /** Вход в режим редактирования текста фигуры. */
  const beginEditText = useCallback((id: string) => {
    setEditingTextId(id)
  }, [])

  /** Выход из режима редактирования текста. */
  const endEditText = useCallback(() => {
    setEditingTextId(null)
  }, [])

  /** Заменить весь список фигур (doc-sync из MCP/doc.json) — без записи в историю. */
  const replaceShapes = useCallback(
    (next: Shape[]) => {
      applyShapes(next)
      setSelectedIds([])
      setEditingTextId(null)
    },
    [applyShapes],
  )

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
    editingTextId,
    addShape,
    updateShape,
    removeShape,
    deleteSelected,
    duplicateSelected,
    copySelected,
    pasteClipboard,
    selectAll,
    selectShape,
    clearSelection,
    hitTest,
    moveLayer,
    renameShape,
    toggleVisibility,
    beginDrag,
    updateDrag,
    endDrag,
    beginCreate,
    updateCreate,
    commitCreate,
    cancelCreate,
    beginResize,
    updateResize,
    endResize,
    beginEditText,
    endEditText,
    replaceShapes,
    undo,
    redo,
  }
}

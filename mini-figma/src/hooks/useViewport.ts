import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import type { Point, Shape } from "../types/shape"
import { screenToCanvas, type Viewport } from "../utils/geometry"

const MIN_ZOOM = 0.1
const MAX_ZOOM = 4
const ZOOM_STEP = 1.1
const FIT_PADDING = 80
const FIT_MIN_ZOOM = 0.25

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

interface PanState {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
}

export function useViewport() {
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 })
  const [spacePressed, setSpacePressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const pan = useRef<PanState | null>(null)
  const spaceRef = useRef(false)

  const viewportRef = useRef(viewport)
  viewportRef.current = viewport

  /** Панорамирование: пробел + мышь, средняя кнопка — всегда. */
  const handlePointerDown = useCallback((event: ReactPointerEvent) => {
    if (event.button !== 0 && event.button !== 1) return
    const panEnabled = spaceRef.current
      ? event.button === 0 || event.button === 1
      : event.button === 1
    if (!panEnabled) return

    const el = containerRef.current
    if (!el) return

    event.preventDefault()
    el.setPointerCapture(event.pointerId)

    const rect = el.getBoundingClientRect()
    pan.current = {
      pointerId: event.pointerId,
      startX: event.clientX - rect.left,
      startY: event.clientY - rect.top,
      originX: viewportRef.current.x,
      originY: viewportRef.current.y,
    }
    setIsPanning(true)
  }, [])

  const handlePointerMove = useCallback((event: ReactPointerEvent) => {
    const current = pan.current
    if (!current || current.pointerId !== event.pointerId) return

    const el = containerRef.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    const dx = event.clientX - rect.left - current.startX
    const dy = event.clientY - rect.top - current.startY
    setViewport((v) => ({
      ...v,
      x: current.originX + dx,
      y: current.originY + dy,
    }))
  }, [])

  const endPan = useCallback((event: ReactPointerEvent) => {
    const current = pan.current
    if (!current || current.pointerId !== event.pointerId) return
    pan.current = null
    setIsPanning(false)
  }, [])

  /** Зум колесом к курсору в пределах 10%–400%. */
  const handleWheel = useCallback((event: WheelEvent) => {
    const el = containerRef.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    const screen: Point = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
    const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP

    setViewport((v) => {
      const nextZoom = clampZoom(v.zoom * factor)
      if (nextZoom === v.zoom) return v
      const canvas = screenToCanvas(screen, v)
      return {
        zoom: nextZoom,
        x: screen.x - canvas.x * nextZoom,
        y: screen.y - canvas.y * nextZoom,
      }
    })
  }, [])

  /** Центрирование канваса при старте. */
  const centerViewport = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setViewport((v) => ({
      ...v,
      x: rect.width / 2,
      y: rect.height / 2,
    }))
  }, [])

  /** Вписать все фигуры в окно с отступом 80px (зум ограничен 25%–400%). */
  const zoomToFit = useCallback((shapes: Shape[]) => {
    const el = containerRef.current
    if (!el || shapes.length === 0) return
    const rect = el.getBoundingClientRect()
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const shape of shapes) {
      minX = Math.min(minX, shape.x)
      minY = Math.min(minY, shape.y)
      maxX = Math.max(maxX, shape.x + shape.width)
      maxY = Math.max(maxY, shape.y + shape.height)
    }
    const boundsW = Math.max(maxX - minX, 1)
    const boundsH = Math.max(maxY - minY, 1)
    const nextZoom = Math.min(
      MAX_ZOOM,
      Math.max(
        FIT_MIN_ZOOM,
        Math.min(
          (rect.width - FIT_PADDING * 2) / boundsW,
          (rect.height - FIT_PADDING * 2) / boundsH,
        ),
      ),
    )
    const centerX = minX + (maxX - minX) / 2
    const centerY = minY + (maxY - minY) / 2
    setViewport({
      zoom: nextZoom,
      x: rect.width / 2 - centerX * nextZoom,
      y: rect.height / 2 - centerY * nextZoom,
    })
  }, [])

  useEffect(() => {
    centerViewport()
  }, [centerViewport])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener("wheel", handleWheel, { passive: false })
    return () => el.removeEventListener("wheel", handleWheel)
  }, [handleWheel])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return
      event.preventDefault()
      spaceRef.current = true
      setSpacePressed(true)
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return
      event.preventDefault()
      spaceRef.current = false
      pan.current = null
      setIsPanning(false)
      setSpacePressed(false)
    }
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [])

  return {
    containerRef,
    viewport,
    spacePressed,
    isPanning,
    zoomToFit,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp: endPan,
    handlePointerCancel: endPan,
  }
}

export type ViewportController = ReturnType<typeof useViewport>
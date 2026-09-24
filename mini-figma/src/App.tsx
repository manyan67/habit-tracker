import { useRef, useState } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"
import { DEFAULT_TOOL } from "./constants/tools"
import { useViewport } from "./hooks/useViewport"
import { useShapes } from "./hooks/useShapes"
import { useHotkeys } from "./hooks/useHotkeys"
import Canvas from "./components/Canvas"
import Toolbar from "./components/Toolbar"
import PropertiesPanel from "./components/PropertiesPanel"
import LayersPanel from "./components/LayersPanel"
import type { Point, ShapeKind, Tool } from "./types/shape"
import { screenToCanvas } from "./utils/geometry"

export default function App() {
  const [tool, setTool] = useState<Tool>(DEFAULT_TOOL)

  const viewport = useViewport()
  const shapes = useShapes()

  useHotkeys({
    onToolSelect: setTool,
    onUndo: shapes.undo,
    onRedo: shapes.redo,
  })

  const creatingPointerId = useRef<number | null>(null)
  const dragPointerId = useRef<number | null>(null)

  const {
    containerRef,
    viewport: viewportState,
    spacePressed,
  } = viewport
  const {
    shapes: shapeList,
    selectedIds,
    draft,
    updateShape,
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
  } = shapes

  const screenPoint = (event: ReactPointerEvent): Point => {
    const el = containerRef.current
    if (!el) return { x: 0, y: 0 }
    const rect = el.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const canvasPoint = (event: ReactPointerEvent): Point =>
    screenToCanvas(screenPoint(event), viewportState)

  const handlePointerDown = (event: ReactPointerEvent) => {
    const drawing = tool !== "select" && event.button === 0 && !spacePressed
    const selecting = tool === "select" && event.button === 0 && !spacePressed

    if (drawing) {
      const el = containerRef.current
      if (!el) return
      event.preventDefault()
      el.setPointerCapture(event.pointerId)
      creatingPointerId.current = event.pointerId
      beginCreate(tool as ShapeKind, canvasPoint(event))
      return
    }

    if (selecting) {
      const hit = hitTest(canvasPoint(event))
      if (hit) {
        const el = containerRef.current
        if (!el) return
        event.preventDefault()
        el.setPointerCapture(event.pointerId)
        dragPointerId.current = event.pointerId
        const alreadySelected = selectedIds.includes(hit.id)
        selectShape(hit.id, event.shiftKey && !alreadySelected)
        beginDrag(
          event.pointerId,
          screenPoint(event),
          viewportState,
          alreadySelected ? selectedIds : [hit.id],
        )
        return
      }
      clearSelection()
    }

    viewport.handlePointerDown(event)
  }

  const handlePointerMove = (event: ReactPointerEvent) => {
    if (creatingPointerId.current === event.pointerId) {
      updateCreate(canvasPoint(event))
    }
    if (dragPointerId.current === event.pointerId) {
      updateDrag(event.pointerId, screenPoint(event), viewportState)
    }
    viewport.handlePointerMove(event)
  }

  const handlePointerUp = (event: ReactPointerEvent) => {
    if (creatingPointerId.current === event.pointerId) {
      creatingPointerId.current = null
      commitCreate()
    }
    if (dragPointerId.current === event.pointerId) {
      dragPointerId.current = null
      endDrag(event.pointerId)
    }
    viewport.handlePointerUp(event)
  }

  const handlePointerCancel = (event: ReactPointerEvent) => {
    if (creatingPointerId.current === event.pointerId) {
      creatingPointerId.current = null
      cancelCreate()
    }
    if (dragPointerId.current === event.pointerId) {
      dragPointerId.current = null
      endDrag(event.pointerId)
    }
    viewport.handlePointerCancel(event)
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-neutral-900">
      <Canvas
        containerRef={containerRef}
        viewport={viewportState}
        spacePressed={spacePressed}
        isPanning={viewport.isPanning}
        tool={tool}
        shapes={shapeList}
        selectedIds={selectedIds}
        draft={draft}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />
      <Toolbar activeTool={tool} onSelect={setTool} />
      <PropertiesPanel
        shapes={shapeList}
        selectedIds={selectedIds}
        onUpdate={updateShape}
      />
      <LayersPanel shapes={shapeList} selectedIds={selectedIds} onSelect={selectShape} />
    </div>
  )
}
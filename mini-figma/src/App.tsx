import { useRef, useState } from "react"
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react"
import { DEFAULT_TOOL } from "./constants/tools"
import { useViewport } from "./hooks/useViewport"
import { useShapes } from "./hooks/useShapes"
import { useHotkeys } from "./hooks/useHotkeys"
import { useDocSync } from "./hooks/useDocSync"
import Canvas from "./components/Canvas"
import Toolbar from "./components/Toolbar"
import TopBar from "./components/TopBar"
import PropertiesPanel from "./components/PropertiesPanel"
import LayersPanel from "./components/LayersPanel"
import { exportShapesToSvg } from "./utils/svgExport"
import type { HandlePosition, Point, Shape, ShapeKind, Tool } from "./types/shape"
import { screenToCanvas } from "./utils/geometry"

export default function App() {
  const [tool, setTool] = useState<Tool>(DEFAULT_TOOL)

  const viewport = useViewport()
  const shapes = useShapes()

  const creatingPointerId = useRef<number | null>(null)
  const dragPointerId = useRef<number | null>(null)
  const resizePointerId = useRef<number | null>(null)

  const {
    containerRef,
    viewport: viewportState,
    spacePressed,
  } = viewport
  const {
    shapes: shapeList,
    selectedIds,
    draft,
    editingTextId,
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
    deleteSelected,
    duplicateSelected,
    copySelected,
    pasteClipboard,
    selectAll,
    moveLayer,
    renameShape,
    toggleVisibility,
    beginResize,
    updateResize,
    endResize,
    beginEditText,
    endEditText,
  } = shapes

  useHotkeys({
    onToolSelect: setTool,
    onUndo: shapes.undo,
    onRedo: shapes.redo,
    onDelete: deleteSelected,
    onDuplicate: () => duplicateSelected(),
    onCopy: copySelected,
    onPaste: () => pasteClipboard(),
    onSelectAll: selectAll,
    onZoomFit: () => viewport.zoomToFit(shapeList),
    onEscape: () => {
      if (editingTextId) endEditText()
      else clearSelection()
    },
  })

  useDocSync({
    shapes: shapeList,
    replaceShapes: shapes.replaceShapes,
    isInteracting: () =>
      creatingPointerId.current !== null ||
      dragPointerId.current !== null ||
      resizePointerId.current !== null ||
      editingTextId !== null,
  })

  const screenPoint = (event: { clientX: number; clientY: number }): Point => {
    const el = containerRef.current
    if (!el) return { x: 0, y: 0 }
    const rect = el.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const canvasPoint = (event: { clientX: number; clientY: number }): Point =>
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

  const handleShapeHandlePointerDown = (
    handle: HandlePosition,
    event: ReactPointerEvent,
  ) => {
    const el = containerRef.current
    if (!el || event.button !== 0 || spacePressed) return
    event.preventDefault()
    el.setPointerCapture(event.pointerId)
    resizePointerId.current = event.pointerId
    beginResize(handle, event.pointerId, screenPoint(event), viewportState)
  }

  const handlePointerMove = (event: ReactPointerEvent) => {
    if (creatingPointerId.current === event.pointerId) {
      updateCreate(canvasPoint(event))
    }
    if (dragPointerId.current === event.pointerId) {
      updateDrag(event.pointerId, screenPoint(event), viewportState)
    }
    if (resizePointerId.current === event.pointerId) {
      updateResize(event.pointerId, screenPoint(event), viewportState)
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
    if (resizePointerId.current === event.pointerId) {
      resizePointerId.current = null
      endResize(event.pointerId)
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
    if (resizePointerId.current === event.pointerId) {
      resizePointerId.current = null
      endResize(event.pointerId)
    }
    viewport.handlePointerCancel(event)
  }

  const handleShapeDoubleClick = (shape: Shape) => {
    if (tool === "select" && shape.kind === "text") beginEditText(shape.id)
  }

  const handleCanvasDoubleClick = (event: ReactMouseEvent) => {
    if (tool !== "select" || editingTextId) return
    const hit = hitTest(canvasPoint(event))
    if (hit && hit.kind === "text") beginEditText(hit.id)
  }

  const handleTextCommit = (text: string) => {
    const id = editingTextId
    endEditText()
    if (!id) return
    const shape = shapeList.find((s) => s.id === id)
    if (shape && (shape.text ?? "") !== text) updateShape(id, { text })
  }

  const handleExport = () => {
    const svg = exportShapesToSvg(shapeList)
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "mini-figma.svg"
    link.click()
    URL.revokeObjectURL(url)
  }

  const editingShape = editingTextId
    ? shapeList.find((s) => s.id === editingTextId && s.kind === "text") ?? null
    : null

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
        editingShape={editingShape}
        onTextCommit={handleTextCommit}
        onTextCancel={endEditText}
        onHandlePointerDown={handleShapeHandlePointerDown}
        onShapeDoubleClick={handleShapeDoubleClick}
        onCanvasDoubleClick={handleCanvasDoubleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />
      <TopBar
        onUndo={shapes.undo}
        onRedo={shapes.redo}
        onZoomFit={() => viewport.zoomToFit(shapeList)}
        onExport={handleExport}
      />
      <Toolbar activeTool={tool} onSelect={setTool} />
      <PropertiesPanel
        shapes={shapeList}
        selectedIds={selectedIds}
        onUpdate={updateShape}
      />
      <LayersPanel
        shapes={shapeList}
        selectedIds={selectedIds}
        onSelect={selectShape}
        onDelete={removeShape}
        onRename={renameShape}
        onToggleVisibility={toggleVisibility}
        onMoveLayer={moveLayer}
      />
    </div>
  )
}

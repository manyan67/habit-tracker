import type { Shape } from "../types/shape"

interface PropertiesPanelProps {
  shapes: Shape[]
  selectedIds: string[]
  onUpdate: (id: string, patch: Partial<Omit<Shape, "id">>) => void
}

export default function PropertiesPanel({
  shapes,
  selectedIds,
  onUpdate,
}: PropertiesPanelProps) {
  const selected = shapes.filter((s) => selectedIds.includes(s.id))
  const shape = selected[0]

  const applyFill = (fill: string) => {
    selected.forEach((s) => onUpdate(s.id, { fill }))
  }

  return (
    <aside className="absolute right-3 top-3 z-10 w-64 rounded-xl border border-white/10 bg-[#2c2c2c]/95 p-3 shadow-2xl backdrop-blur">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        Properties
      </h2>

      {!shape ? (
        <p className="text-sm text-neutral-500">
          {selectedIds.length > 0
            ? `Выбрано объектов: ${selectedIds.length}`
            : "Кликните, чтобы выбрать"}
        </p>
      ) : (
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-[11px] text-neutral-500">Kind</dt>
            <dd className="capitalize">{shape.kind}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-neutral-500">Fill</dt>
            <dd className="flex items-center gap-2">
              <input
                type="color"
                value={shape.fill}
                onChange={(event) => applyFill(event.target.value)}
                className="h-6 w-6 cursor-pointer rounded border border-white/10 bg-transparent p-0.5"
                title="Заливка"
              />
              <span className="font-mono text-xs">{shape.fill}</span>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-neutral-500">X</dt>
            <dd className="font-mono">{Math.round(shape.x)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-neutral-500">Y</dt>
            <dd className="font-mono">{Math.round(shape.y)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-neutral-500">W</dt>
            <dd className="font-mono">{Math.round(shape.width)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-neutral-500">H</dt>
            <dd className="font-mono">{Math.round(shape.height)}</dd>
          </div>
        </dl>
      )}
    </aside>
  )
}
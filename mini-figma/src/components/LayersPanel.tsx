import type { Shape } from "../types/shape"

interface LayersPanelProps {
  shapes: Shape[]
  selectedIds: string[]
  onSelect: (id: string, additive: boolean) => void
}

export default function LayersPanel({
  shapes,
  selectedIds,
  onSelect,
}: LayersPanelProps) {
  return (
    <aside className="absolute bottom-3 right-3 z-10 w-64 rounded-xl border border-white/10 bg-[#2c2c2c]/95 p-3 shadow-2xl backdrop-blur">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        Layers
      </h2>

      {shapes.length === 0 ? (
        <p className="text-sm text-neutral-500">Пусто</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {[...shapes]
            .reverse()
            .map((shape) => (
              <li key={shape.id}>
                <button
                  type="button"
                  onClick={(event) =>
                    onSelect(shape.id, event.shiftKey)
                  }
                  className={`w-full rounded-md px-2 py-1 text-left text-sm transition-colors ${
                    selectedIds.includes(shape.id)
                      ? "bg-blue-600 text-white"
                      : "text-neutral-300 hover:bg-white/10"
                  }`}
                >
                  <span
                    className="mr-2 inline-block h-3 w-3 rounded-sm border border-white/20 align-middle"
                    style={{ backgroundColor: shape.fill }}
                  />
                  <span className="capitalize">{shape.kind}</span>
                  <span className="ml-2 font-mono text-xs opacity-60">
                    {shape.id}
                  </span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </aside>
  )
}
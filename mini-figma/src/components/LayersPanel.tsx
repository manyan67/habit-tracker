import { useState } from "react"
import type { ReactNode } from "react"
import type { Shape } from "../types/shape"

interface LayersPanelProps {
  shapes: Shape[]
  selectedIds: string[]
  onSelect: (id: string, additive: boolean) => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
  onToggleVisibility: (id: string) => void
  onMoveLayer: (id: string, dir: "forward" | "backward") => void
}

function LayerIconButton({
  testId,
  label,
  onClick,
  children,
}: {
  testId: string
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      title={label}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] leading-none text-current opacity-70 transition-opacity hover:opacity-100"
    >
      {children}
    </button>
  )
}

export default function LayersPanel({
  shapes,
  selectedIds,
  onSelect,
  onDelete,
  onRename,
  onToggleVisibility,
  onMoveLayer,
}: LayersPanelProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState("")

  const startRename = (shape: Shape) => {
    setRenamingId(shape.id)
    setRenameDraft(shape.name ?? shape.kind)
  }

  const commitRename = () => {
    if (renamingId) {
      const trimmed = renameDraft.trim()
      if (trimmed) onRename(renamingId, trimmed)
    }
    setRenamingId(null)
  }

  return (
    <aside
      data-testid="layers-panel"
      className="absolute bottom-3 right-3 z-10 w-64 rounded-xl border border-white/10 bg-[#2c2c2c]/95 p-3 shadow-2xl backdrop-blur"
    >
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        Layers
      </h2>

      {shapes.length === 0 ? (
        <p className="text-sm text-neutral-500">Пусто</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {[...shapes].reverse().map((shape) => {
            const isSelected = selectedIds.includes(shape.id)
            const hidden = shape.visible === false
            const label = shape.name ?? shape.kind
            return (
              <li
                key={shape.id}
                data-testid="layer-item"
                onClick={(event) => onSelect(shape.id, event.shiftKey)}
                className={`flex items-center gap-1 rounded-md px-1.5 py-1 text-sm ${
                  isSelected
                    ? "bg-blue-600 text-white"
                    : "text-neutral-300 hover:bg-white/10"
                } ${hidden ? "opacity-40" : ""}`}
              >
                {shape.kind === "text" ? (
                  <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-[11px] font-semibold">
                    T
                  </span>
                ) : (
                  <span
                    className="h-3 w-3 shrink-0 rounded-sm border border-white/20"
                    style={{ backgroundColor: shape.fill }}
                  />
                )}
                {renamingId === shape.id ? (
                  <input
                    data-testid="layer-rename-input"
                    autoFocus
                    value={renameDraft}
                    spellCheck={false}
                    onChange={(event) => setRenameDraft(event.target.value)}
                    onBlur={commitRename}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.currentTarget.blur()
                      } else if (event.key === "Escape") {
                        setRenamingId(null)
                      }
                    }}
                    className="min-w-0 flex-1 rounded border border-blue-400 bg-black/40 px-1 text-xs text-white outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    data-testid="layer-name"
                    title={label}
                    onDoubleClick={(event) => {
                      event.stopPropagation()
                      startRename(shape)
                    }}
                    className="min-w-0 flex-1 truncate text-left capitalize"
                  >
                    {label}
                  </button>
                )}
                <LayerIconButton
                  testId="layer-visibility"
                  label="Видимость"
                  onClick={() => onToggleVisibility(shape.id)}
                >
                  {hidden ? "⊘" : "⊙"}
                </LayerIconButton>
                <LayerIconButton
                  testId="layer-forward"
                  label="Вперёд"
                  onClick={() => onMoveLayer(shape.id, "forward")}
                >
                  ↑
                </LayerIconButton>
                <LayerIconButton
                  testId="layer-backward"
                  label="Назад"
                  onClick={() => onMoveLayer(shape.id, "backward")}
                >
                  ↓
                </LayerIconButton>
                <LayerIconButton
                  testId="layer-delete"
                  label="Удалить"
                  onClick={() => onDelete(shape.id)}
                >
                  ×
                </LayerIconButton>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}

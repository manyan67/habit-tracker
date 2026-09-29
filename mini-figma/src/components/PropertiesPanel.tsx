import { useRef, useState } from "react"
import type { FocusEvent, KeyboardEvent, ReactNode } from "react"
import type { Shape } from "../types/shape"

interface PropertiesPanelProps {
  shapes: Shape[]
  selectedIds: string[]
  onUpdate: (id: string, patch: Partial<Omit<Shape, "id">>) => void
}

const HEX_RE = /^#[0-9a-f]{6}$/

/** Нормализация hex-строки к виду #rrggbb (lowercase); null при невалидной. */
function normalizeHex(raw: string): string | null {
  const value = raw.trim().toLowerCase()
  if (!value) return null
  const withHash = value.startsWith("#") ? value : `#${value}`
  return HEX_RE.test(withHash) ? withHash : null
}

const INPUT_CLASS =
  "h-7 w-full rounded-md border border-white/10 bg-black/30 px-1.5 font-mono text-xs text-neutral-200 outline-none focus:border-blue-500"

/**
 * Поле ввода с отложенным коммитом (Enter/blur): пока нет локального черновика,
 * показывается значение фигуры; невалидный коммит откатывается к нему же.
 */
function CommitField({
  label,
  testId,
  value,
  type,
  onCommit,
}: {
  label: string
  testId: string
  value: string
  type: "text" | "number"
  onCommit: (raw: string) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const cancelRef = useRef(false)
  const displayed = draft ?? value

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    const hadDraft = draft !== null
    const wasCancelled = cancelRef.current
    cancelRef.current = false
    setDraft(null)
    if (hadDraft && !wasCancelled) onCommit(event.currentTarget.value)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.currentTarget.blur()
    } else if (event.key === "Escape") {
      cancelRef.current = true
      event.currentTarget.blur()
    }
  }

  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[11px] text-neutral-500">{label}</span>
      <input
        data-testid={testId}
        type={type}
        spellCheck={false}
        value={displayed}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={INPUT_CLASS}
      />
    </label>
  )
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
      {children}
    </h3>
  )
}

export default function PropertiesPanel({
  shapes,
  selectedIds,
  onUpdate,
}: PropertiesPanelProps) {
  const selected = shapes.filter((s) => selectedIds.includes(s.id))
  const shape = selected.length === 1 ? selected[0] : undefined

  const applyToAll = (patch: Partial<Omit<Shape, "id">>) => {
    selected.forEach((s) => onUpdate(s.id, patch))
  }

  const panel = (children: ReactNode) => (
    <aside
      data-testid="props-panel"
      className="absolute right-3 top-3 z-10 w-64 rounded-xl border border-white/10 bg-[#2c2c2c]/95 p-3 shadow-2xl backdrop-blur"
    >
      {children}
    </aside>
  )

  if (!shape) {
    return panel(
      <>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Properties
        </h2>
        <p className="text-sm text-neutral-500">
          {selectedIds.length > 0
            ? `Выбрано объектов: ${selectedIds.length}`
            : "Кликните, чтобы выбрать"}
        </p>
      </>,
    )
  }

  const name = shape.name || shape.kind.charAt(0).toUpperCase() + shape.kind.slice(1)

  const commitNumber = (field: "x" | "y" | "width" | "height", raw: string) => {
    const parsed = Number(raw)
    if (raw.trim() === "" || !Number.isFinite(parsed)) return
    if ((field === "width" || field === "height") && parsed < 2) return
    if (selected.length === 1) {
      const patch: Partial<Omit<Shape, "id">> = {}
      patch[field] = parsed
      onUpdate(selected[0].id, patch)
      return
    }
    const delta = parsed - selected[0][field]
    selected.forEach((s) => {
      const next =
        field === "width" || field === "height"
          ? Math.max(2, s[field] + delta)
          : s[field] + delta
      const patch: Partial<Omit<Shape, "id">> = {}
      patch[field] = next
      onUpdate(s.id, patch)
    })
  }

  const commitFill = (raw: string) => {
    const hex = normalizeHex(raw)
    if (hex) applyToAll({ fill: hex })
  }

  const commitStroke = (raw: string) => {
    const hex = normalizeHex(raw)
    if (hex) applyToAll({ stroke: hex })
  }

  const commitStrokeWeight = (raw: string) => {
    const parsed = Number(raw)
    if (raw.trim() === "" || !Number.isFinite(parsed) || parsed < 0 || parsed > 20) return
    applyToAll({ strokeWeight: parsed })
  }

  const commitFontSize = (raw: string) => {
    const parsed = Number(raw)
    if (raw.trim() === "" || !Number.isFinite(parsed) || parsed < 1 || parsed > 500) return
    applyToAll({ fontSize: parsed })
  }

  const handleStrokeColor = (color: string) => {
    const weight = selected[0]?.strokeWeight ?? 0
    applyToAll({ stroke: color, ...(weight === 0 ? { strokeWeight: 1 } : {}) })
  }

  return panel(
    <>
      <h2
        data-testid="props-name"
        className="mb-3 truncate text-sm font-semibold capitalize text-neutral-200"
        title={name}
      >
        {name}
      </h2>

      <section className="mb-3">
        <SectionTitle>Position</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <CommitField
            label="X"
            testId="props-input-x"
            type="number"
            value={String(Math.round(shape.x))}
            onCommit={(raw) => commitNumber("x", raw)}
          />
          <CommitField
            label="Y"
            testId="props-input-y"
            type="number"
            value={String(Math.round(shape.y))}
            onCommit={(raw) => commitNumber("y", raw)}
          />
          <CommitField
            label="W"
            testId="props-input-width"
            type="number"
            value={String(Math.round(shape.width))}
            onCommit={(raw) => commitNumber("width", raw)}
          />
          <CommitField
            label="H"
            testId="props-input-height"
            type="number"
            value={String(Math.round(shape.height))}
            onCommit={(raw) => commitNumber("height", raw)}
          />
        </div>
      </section>

      <section className="mb-3">
        <SectionTitle>Appearance</SectionTitle>
        <div className="flex flex-col gap-2">
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-[11px] text-neutral-500">Fill</span>
              <input
                data-testid="props-input-fill"
                type="color"
                value={normalizeHex(shape.fill) ?? "#000000"}
                onChange={(event) => applyToAll({ fill: event.target.value })}
                className="h-7 w-9 cursor-pointer rounded-md border border-white/10 bg-transparent p-0.5"
                title="Заливка"
              />
            </label>
            <div className="min-w-0 flex-1">
              <CommitField
                label="Hex"
                testId="props-input-hex-fill"
                type="text"
                value={shape.fill}
                onCommit={commitFill}
              />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-[11px] text-neutral-500">Stroke</span>
              <input
                data-testid="props-input-stroke"
                type="color"
                value={normalizeHex(shape.stroke) ?? "#000000"}
                onChange={(event) => handleStrokeColor(event.target.value)}
                className="h-7 w-9 cursor-pointer rounded-md border border-white/10 bg-transparent p-0.5"
                title="Обводка"
              />
            </label>
            <div className="min-w-0 flex-1">
              <CommitField
                label="Hex"
                testId="props-input-hex-stroke"
                type="text"
                value={shape.stroke}
                onCommit={commitStroke}
              />
            </div>
            <div className="w-14">
              <CommitField
                label="Width"
                testId="props-input-stroke-weight"
                type="number"
                value={String(shape.strokeWeight ?? 0)}
                onCommit={commitStrokeWeight}
              />
            </div>
          </div>
        </div>
      </section>

      {shape.kind === "text" && (
        <section>
          <SectionTitle>Text</SectionTitle>
          <div className="w-24">
            <CommitField
              label="Size"
              testId="props-input-font-size"
              type="number"
              value={String(shape.fontSize ?? 16)}
              onCommit={commitFontSize}
            />
          </div>
        </section>
      )}
    </>,
  )
}

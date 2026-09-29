interface TopBarProps {
  onUndo: () => void
  onRedo: () => void
  onZoomFit: () => void
  onExport: () => void
}

function TopBarButton({
  testId,
  label,
  onClick,
}: {
  testId: string
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className="flex h-8 items-center rounded-lg px-2.5 text-sm text-neutral-300 transition-colors hover:bg-white/10 hover:text-neutral-200"
    >
      {label}
    </button>
  )
}

export default function TopBar({ onUndo, onRedo, onZoomFit, onExport }: TopBarProps) {
  return (
    <aside
      data-testid="topbar"
      className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-white/10 bg-[#2c2c2c]/95 px-2 py-1.5 shadow-2xl backdrop-blur"
    >
      <span className="mr-2 px-1 text-sm font-semibold text-neutral-200">
        Mini Figma
      </span>
      <TopBarButton testId="action-undo" label="Undo" onClick={onUndo} />
      <TopBarButton testId="action-redo" label="Redo" onClick={onRedo} />
      <TopBarButton testId="action-zoom-fit" label="Fit" onClick={onZoomFit} />
      <TopBarButton testId="action-export-svg" label="Export SVG" onClick={onExport} />
    </aside>
  )
}

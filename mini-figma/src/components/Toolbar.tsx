import { TOOLS, type ToolDefinition } from "../constants/tools"
import type { Tool } from "../types/shape"

interface ToolbarProps {
  activeTool: Tool
  onSelect: (tool: Tool) => void
}

function ToolIcon({ tool }: { tool: ToolDefinition }) {
  switch (tool.id) {
    case "select":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 3l14 8-6.2 1.5L9.5 19 5 3z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      )
    case "rectangle":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <rect
            x="4"
            y="5"
            width="16"
            height="14"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      )
    case "ellipse":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <ellipse
            cx="12"
            cy="12"
            rx="8"
            ry="6"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      )
  }
}

export default function Toolbar({ activeTool, onSelect }: ToolbarProps) {
  return (
    <aside className="absolute left-3 top-1/2 z-10 -translate-y-1/2">
      <div className="flex flex-col gap-1 rounded-xl border border-white/10 bg-[#2c2c2c]/95 p-1.5 shadow-2xl backdrop-blur">
        {TOOLS.map((tool) => {
          const isActive = tool.id === activeTool
          return (
            <button
              key={tool.id}
              type="button"
              title={`${tool.label} — ${tool.hotkey}`}
              onClick={() => onSelect(tool.id)}
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-neutral-400 hover:bg-white/10 hover:text-neutral-200"
              }`}
            >
              <ToolIcon tool={tool} />
            </button>
          )
        })}
      </div>
    </aside>
  )
}
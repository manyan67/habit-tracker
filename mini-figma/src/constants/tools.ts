import type { Tool } from "../types/shape"

export interface ToolDefinition {
  id: Tool
  label: string
  hotkey: string
}

export const TOOLS: ToolDefinition[] = [
  { id: "select", label: "Select", hotkey: "V" },
  { id: "rectangle", label: "Rectangle", hotkey: "R" },
  { id: "ellipse", label: "Ellipse", hotkey: "O" },
]

export const DEFAULT_TOOL: Tool = "select"

/** Комбинация модификаторов + клавиши (например, для Undo/Redo). */
export interface KeyCombo {
  /** Физическая клавиша: event.code, не зависит от раскладки. */
  code: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
}

/** Программа горячих клавиш R/O/V — правки только здесь.
 *  Ключи — физические клавиши (event.code), поэтому работают в любой раскладке. */
export const HOTKEYS: Record<string, Tool> = {
  KeyV: "select",
  KeyR: "rectangle",
  KeyO: "ellipse",
}

/** Горячие клавиши истории изменений. */
export const UNDO_HOTKEY: KeyCombo = { code: "KeyZ", ctrl: true }
export const REDO_HOTKEY: KeyCombo = { code: "KeyZ", ctrl: true, shift: true }
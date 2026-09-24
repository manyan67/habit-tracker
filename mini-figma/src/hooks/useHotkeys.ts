import { useEffect, useRef } from "react"
import { HOTKEYS, REDO_HOTKEY, UNDO_HOTKEY, type KeyCombo } from "../constants/tools"
import type { Tool } from "../types/shape"

interface UseHotkeysOptions {
  onToolSelect: (tool: Tool) => void
  onUndo?: () => void
  onRedo?: () => void
}

/** Комбинация, которая одновременно использует ctrl и alt, не обрабатываем. */
function matchesCombo(event: KeyboardEvent, combo: KeyCombo): boolean {
  const ctrl = Boolean(combo.ctrl)
  if (ctrl && event.altKey) return false
  const metaPressed = event.ctrlKey || event.metaKey
  if (event.code !== combo.code) return false
  if (!!event.shiftKey !== Boolean(combo.shift)) return false
  if (!!event.altKey !== Boolean(combo.alt)) return false
  return ctrl ? metaPressed : !metaPressed
}

/** Не перехватываем клавиши, когда пользователь печатает в поле ввода. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  )
}

export function useHotkeys({ onToolSelect, onUndo, onRedo }: UseHotkeysOptions) {
  const toolHandler = useRef(onToolSelect)
  const undoHandler = useRef(onUndo)
  const redoHandler = useRef(onRedo)

  useEffect(() => {
    toolHandler.current = onToolSelect
    undoHandler.current = onUndo
    redoHandler.current = onRedo
  })

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) return

      if (matchesCombo(event, UNDO_HOTKEY)) {
        event.preventDefault()
        undoHandler.current?.()
        return
      }
      if (matchesCombo(event, REDO_HOTKEY)) {
        event.preventDefault()
        redoHandler.current?.()
        return
      }

      const tool = HOTKEYS[event.code]
      if (tool && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        toolHandler.current(tool)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])
}
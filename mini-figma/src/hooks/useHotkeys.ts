import { useEffect, useRef } from "react"
import { HOTKEYS, REDO_HOTKEY, UNDO_HOTKEY, type KeyCombo } from "../constants/tools"
import type { Tool } from "../types/shape"

const DELETE_HOTKEYS: KeyCombo[] = [{ code: "Delete" }, { code: "Backspace" }]
const DUPLICATE_HOTKEY: KeyCombo = { code: "KeyD", ctrl: true }
const COPY_HOTKEY: KeyCombo = { code: "KeyC", ctrl: true }
const PASTE_HOTKEY: KeyCombo = { code: "KeyV", ctrl: true }
const SELECT_ALL_HOTKEY: KeyCombo = { code: "KeyA", ctrl: true }
const ZOOM_FIT_HOTKEY: KeyCombo = { code: "Digit1", shift: true }
const ESCAPE_HOTKEY: KeyCombo = { code: "Escape" }

interface UseHotkeysOptions {
  onToolSelect: (tool: Tool) => void
  onUndo?: () => void
  onRedo?: () => void
  onDelete?: () => void
  onDuplicate?: () => void
  onCopy?: () => void
  onPaste?: () => void
  onSelectAll?: () => void
  onZoomFit?: () => void
  onEscape?: () => void
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

export function useHotkeys(options: UseHotkeysOptions) {
  const optionsRef = useRef(options)

  useEffect(() => {
    optionsRef.current = options
  })

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) return
      const actions = optionsRef.current

      if (matchesCombo(event, UNDO_HOTKEY)) {
        event.preventDefault()
        actions.onUndo?.()
        return
      }
      if (matchesCombo(event, REDO_HOTKEY)) {
        event.preventDefault()
        actions.onRedo?.()
        return
      }
      if (DELETE_HOTKEYS.some((combo) => matchesCombo(event, combo))) {
        event.preventDefault()
        actions.onDelete?.()
        return
      }
      if (matchesCombo(event, DUPLICATE_HOTKEY)) {
        event.preventDefault()
        actions.onDuplicate?.()
        return
      }
      if (matchesCombo(event, COPY_HOTKEY)) {
        event.preventDefault()
        actions.onCopy?.()
        return
      }
      if (matchesCombo(event, PASTE_HOTKEY)) {
        event.preventDefault()
        actions.onPaste?.()
        return
      }
      if (matchesCombo(event, SELECT_ALL_HOTKEY)) {
        event.preventDefault()
        actions.onSelectAll?.()
        return
      }
      if (matchesCombo(event, ZOOM_FIT_HOTKEY)) {
        event.preventDefault()
        actions.onZoomFit?.()
        return
      }
      if (matchesCombo(event, ESCAPE_HOTKEY)) {
        event.preventDefault()
        actions.onEscape?.()
        return
      }

      const tool = HOTKEYS[event.code]
      if (tool && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        actions.onToolSelect(tool)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])
}

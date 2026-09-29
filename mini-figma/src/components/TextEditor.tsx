import { useEffect, useRef, useState } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"
import type { Shape } from "../types/shape"

interface TextEditorProps {
  shape: Shape
  onCommit: (text: string) => void
  onCancel?: () => void
}

/** Оверлей-редактор текста поверх текстовой фигуры; Esc/blur/Ctrl+Enter фиксируют. */
export default function TextEditor({ shape, onCommit, onCancel }: TextEditorProps) {
  const original = shape.text ?? ""
  const [value, setValue] = useState(original)
  const committedRef = useRef(false)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const commit = () => {
    if (committedRef.current) return
    committedRef.current = true
    onCommit(value)
  }

  return (
    <textarea
      ref={inputRef}
      data-testid="text-editor"
      value={value}
      spellCheck={false}
      onChange={(event) => setValue(event.target.value)}
      onPointerDown={(event: ReactPointerEvent) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === "Escape") {
          event.preventDefault()
          // Figma-паритет: Esc фиксирует и выделяет объект
          if (value === original) {
            committedRef.current = true
            onCancel?.()
          } else {
            commit()
          }
        } else if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          event.preventDefault()
          commit()
        }
      }}
      onBlur={commit}
      style={{
        position: "absolute",
        left: shape.x,
        top: shape.y,
        width: shape.width,
        height: shape.height,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: shape.fontSize ?? 16,
        lineHeight: 1.4,
        color: shape.fill,
        background: "transparent",
        outline: "none",
        resize: "none",
        border: "none",
        padding: 0,
        margin: 0,
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    />
  )
}

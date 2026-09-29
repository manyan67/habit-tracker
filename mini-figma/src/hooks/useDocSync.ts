// Синхронизация локального состояния фигур с mcp-server/doc.json через
// dev-middlewares плагина docBridgePlugin(): GET /api/doc (mount + poll)
// и PUT /api/doc (debounced автосейв). Транспорт — тот же origin.
import { useEffect, useRef } from "react"
import type { Shape } from "../types/shape"

/** Минимальный сетевой контракт фигуры: id обязателен, остальное — как есть. */
export interface DocShape {
  id: string
  [key: string]: unknown
}

export interface UseDocSyncOptions {
  shapes: Shape[]
  replaceShapes: (next: Shape[]) => void
  isInteracting: () => boolean
}

const POLL_MS = 700
const SAVE_DEBOUNCE_MS = 250

/** Валидирует пришедшие фигуры минимально (нужен строковый id) и отдаёт Shape[]. */
function toShapes(payload: unknown): Shape[] {
  const raw = (payload as { shapes?: unknown } | null)?.shapes
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (s): s is DocShape =>
      typeof s === "object" && s !== null && typeof (s as { id?: unknown }).id === "string",
  ) as unknown as Shape[]
}

export function useDocSync({ shapes, replaceShapes, isInteracting }: UseDocSyncOptions): void {
  // Зеркала колбэков: эффекты не пересоздаются при новых ссылках из пропсов
  const replaceRef = useRef(replaceShapes)
  const isInteractingRef = useRef(isInteracting)
  useEffect(() => {
    replaceRef.current = replaceShapes
    isInteractingRef.current = isInteracting
  })

  // Сериализация последнего принятого/сохранённого состояния — база для автосейва
  const serializedRef = useRef(JSON.stringify(shapes))
  const lastVersionRef = useRef<number | null>(null)
  const hydratedRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ---- On mount: GET /api/doc → replaceShapes (всегда замена) ----
  useEffect(() => {
    let disposed = false

    async function fetchDoc(): Promise<{ version: number; shapes: unknown[] } | null> {
      try {
        const res = await fetch("/api/doc")
        if (!res.ok) return null
        return (await res.json()) as { version: number; shapes: unknown[] }
      } catch (e) {
        console.warn("useDocSync: GET /api/doc failed", e)
        return null
      }
    }

    void fetchDoc().then((doc) => {
      if (disposed || !doc) return
      const incoming = toShapes(doc)
      replaceRef.current(incoming)
      lastVersionRef.current = doc.version
      // Принимаем серверную нормализацию как новую базу сравнения автосейва
      serializedRef.current = JSON.stringify(incoming)
      hydratedRef.current = true
    })

    return () => {
      disposed = true
    }
  }, [])

  // ---- Poll каждые 700 мс: замена, если version изменилась и не взаимодействуем ----
  useEffect(() => {
    let disposed = false

    const tick = async (): Promise<void> => {
      if (isInteractingRef.current()) return
      try {
        const res = await fetch("/api/doc")
        if (!res.ok || disposed) return
        const doc = (await res.json()) as { version: number; shapes: unknown[] }
        if (disposed) return
        if (lastVersionRef.current !== null && doc.version !== lastVersionRef.current) {
          replaceRef.current(toShapes(doc))
          lastVersionRef.current = doc.version
        }
      } catch (e) {
        console.warn("useDocSync: poll GET /api/doc failed", e)
      }
    }

    const pollTimer = setInterval(tick, POLL_MS)
    return () => {
      disposed = true
      clearInterval(pollTimer)
    }
  }, [])

  // ---- Автосейв: сериализация изменилась и не совпала с последней сохранённой ----
  useEffect(() => {
    const serialized = JSON.stringify(shapes)
    const prev = serializedRef.current
    if (serialized === prev) return
    serializedRef.current = serialized

    // До гидрации не сохраняем: ближайший GET заменит локальное состояние
    if (!hydratedRef.current) return

    if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      void fetch("/api/doc", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shapes }),
      })
        .then(async (res) => {
          if (!res.ok) return
          const data = (await res.json()) as { ok?: boolean; version?: number }
          // Гвард от self-loop: poll с этой же version не триггерит замену
          if (typeof data.version === "number") lastVersionRef.current = data.version
        })
        .catch((e: unknown) => {
          console.warn("useDocSync: PUT /api/doc failed", e)
        })
    }, SAVE_DEBOUNCE_MS)
  }, [shapes])

  // ---- Cleanup таймера автосейва при размонтировании ----
  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current)
    }
  }, [])

  return
}

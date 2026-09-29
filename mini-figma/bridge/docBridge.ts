// Vite-плагин синхронизации документа: dev-middlewares GET/PUT /api/doc
// читают и пишут тот же mcp-server/doc.json, что и MCP-сервер.
// Без внешних зависимостей: только node:fs/path/crypto/http и типы vite.

import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs"
import { randomBytes } from "node:crypto"
import { resolve } from "node:path"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { Plugin } from "vite"

// ---------- Типы документа (повторяют контракт mcp-server) ----------

interface BridgeDoc {
  version: number
  shapes: unknown[]
}

// ---------- Валидация (толерантная, по мотивам mcp-server) ----------

const KINDS = ["rectangle", "ellipse", "text"] as const
const HEX_RE = /^#[0-9a-f]{6}$/
const DEFAULT_FILL = "#3b82f6"
const MAX_BODY_BYTES = 16 * 1024 * 1024

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v)
}

function randomId(): string {
  return `shape-${randomBytes(3).toString("hex")}`
}

/** Нормализация одной фигуры; мусорные записи (не объект) отбрасываются. */
function normalizeShape(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null
  const s = raw as Record<string, unknown>

  const out: Record<string, unknown> = {
    id: typeof s.id === "string" && s.id.length > 0 ? s.id : randomId(),
    kind:
      typeof s.kind === "string" && (KINDS as readonly string[]).includes(s.kind)
        ? s.kind
        : "rectangle",
    x: isFiniteNumber(s.x) ? s.x : 0,
    y: isFiniteNumber(s.y) ? s.y : 0,
    width: isFiniteNumber(s.width) ? Math.max(2, s.width) : 2,
    height: isFiniteNumber(s.height) ? Math.max(2, s.height) : 2,
    fill: typeof s.fill === "string" && HEX_RE.test(s.fill) ? s.fill : DEFAULT_FILL,
  }
  if (typeof s.stroke === "string") out.stroke = s.stroke
  if (isFiniteNumber(s.rotation)) out.rotation = clamp(s.rotation, -360, 360)
  if (typeof s.text === "string") out.text = s.text
  if (isFiniteNumber(s.fontSize)) out.fontSize = clamp(s.fontSize, 1, 500)
  if (typeof s.visible === "boolean") out.visible = s.visible
  if (typeof s.name === "string") out.name = s.name
  if (isFiniteNumber(s.strokeWeight)) out.strokeWeight = Math.max(0, s.strokeWeight)
  return out
}

/** Чтение doc.json при каждом вызове; файла нет → version 0, битый → version 1. */
function toDoc(docPath: string): BridgeDoc {
  if (!existsSync(docPath)) return { version: 0, shapes: [] }
  try {
    const parsed = JSON.parse(readFileSync(docPath, "utf8")) as Partial<BridgeDoc>
    if (!Array.isArray(parsed.shapes)) return { version: 1, shapes: [] }
    return { version: statSync(docPath).mtimeMs, shapes: parsed.shapes as unknown[] }
  } catch {
    return { version: 1, shapes: [] }
  }
}

/** Атомарная запись: уникальный tmp + rename (не пересекается с tmp MCP-сервера). */
function saveDocAtomic(docPath: string, shapes: unknown[]): number {
  const tmp = `${docPath}.${randomBytes(4).toString("hex")}.tmp`
  writeFileSync(tmp, JSON.stringify({ version: 1, shapes }, null, 2), "utf8")
  renameSync(tmp, docPath)
  return statSync(docPath).mtimeMs
}

// ---------- HTTP-утилиты ----------

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status
  res.setHeader("Content-Type", "application/json; charset=utf-8")
  res.end(JSON.stringify(payload))
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buf: Buffer = typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer)
    size += buf.length
    if (size > MAX_BODY_BYTES) throw new Error("payload too large")
    chunks.push(buf)
  }
  return Buffer.concat(chunks).toString("utf8")
}

// ---------- Обработка запросов ----------

async function handleDocRequest(
  docPath: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    if (req.method === "GET") {
      sendJson(res, 200, toDoc(docPath))
      return
    }
    if (req.method === "PUT") {
      let parsed: unknown
      try {
        parsed = JSON.parse(await readBody(req))
      } catch {
        sendJson(res, 400, { ok: false, error: "тело запроса не является JSON" })
        return
      }
      const shapesRaw =
        typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
          ? (parsed as { shapes?: unknown }).shapes
          : undefined
      if (!Array.isArray(shapesRaw)) {
        sendJson(res, 400, { ok: false, error: "shapes: ожидается массив" })
        return
      }
      const shapes = shapesRaw
        .map(normalizeShape)
        .filter((s): s is Record<string, unknown> => s !== null)
      const version = saveDocAtomic(docPath, shapes)
      sendJson(res, 200, { ok: true, version })
      return
    }
    sendJson(res, 405, { ok: false, error: "метод не поддерживается" })
  } catch (e) {
    sendJson(res, 500, { ok: false, error: String(e) })
  }
}

// ---------- Плагин ----------

export function docBridgePlugin(): Plugin {
  let projectRoot = ""
  return {
    name: "mini-figma-doc-bridge",
    configResolved(config) {
      projectRoot = config.root
    },
    configureServer(server) {
      // Путь к doc.json — от корня vite-конфига: совпадает с файлом MCP-сервера
      // (dist/server.js → dirname/dist/../doc.json === <projectRoot>/mcp-server/doc.json).
      const docPath = resolve(projectRoot, "mcp-server", "doc.json")
      server.middlewares.use("/api/doc", (req, res) => {
        void handleDocRequest(docPath, req, res)
      })
    },
  }
}

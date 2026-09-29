// mini-figma MCP-сервер: stdio-транспорт (newline-JSON), без внешних зависимостей.
// Держит хранилище документа mcp-server/doc.json и предоставляет инструменты mf_*.

import { createInterface } from "node:readline"
import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { randomBytes } from "node:crypto"
import process from "node:process"

// ---------- Типы документа ----------

type ShapeKind = "rectangle" | "ellipse" | "text"

interface Shape {
  id: string
  kind: ShapeKind
  x: number
  y: number
  width: number
  height: number
  fill: string
  stroke?: string
  strokeWeight?: number
  rotation?: number
  text?: string
  fontSize?: number
  visible?: boolean
  name?: string
}

interface Document {
  version: number
  shapes: Shape[]
}

// ---------- Расположение doc.json (dist/server.js → ../doc.json) ----------

const __dirname = dirname(fileURLToPath(import.meta.url))
const DOC_PATH = resolve(__dirname, "..", "doc.json")

// ---------- Утилиты ----------

function logErr(msg: string): void {
  process.stderr.write(`[mini-figma-mcp] ${msg}\n`)
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

// ---------- Хранилище документа ----------

function emptyDoc(): Document {
  return { version: 1, shapes: [] }
}

// Читаем doc.json при каждом вызове — актуальность без кэша
function loadDoc(): Document {
  try {
    if (!existsSync(DOC_PATH)) return emptyDoc()
    const raw = readFileSync(DOC_PATH, "utf8")
    const parsed = JSON.parse(raw) as Partial<Document>
    if (
      parsed && typeof parsed === "object" &&
      parsed.version === 1 &&
      Array.isArray(parsed.shapes)
    ) {
      return { version: 1, shapes: parsed.shapes as Shape[] }
    }
    logErr("doc.json имеет неожиданную структуру — начинаю с пустого документа")
    return emptyDoc()
  } catch (e) {
    logErr(`doc.json не читается (${String(e)}) — начинаю с пустого документа`)
    return emptyDoc()
  }
}

// Атомарная запись: tmp-файл + rename
function saveDoc(doc: Document): void {
  const tmp = DOC_PATH + ".tmp"
  writeFileSync(tmp, JSON.stringify(doc, null, 2), "utf8")
  renameSync(tmp, DOC_PATH)
}

// nextId: max числового суффикса "shape-N" + 1, иначе случайный суффикс
function nextId(doc: Document): string {
  let max = 0
  for (const s of doc.shapes) {
    const m = /^shape-(\d+)$/.exec(s.id)
    if (m) max = Math.max(max, Number(m[1]))
  }
  if (max > 0) return `shape-${max + 1}`
  return `shape-${randomBytes(4).toString("hex")}`
}

// ---------- Экспорт SVG ----------

function escXml(s: string): string {
  // XML-спецсимволы -> HTML-entities; амперсанд собираем по коду, чтобы не писать entity в исходнике
  const amp = String.fromCharCode(38)
  return s
    .replace(/&/g, amp + "amp;")
    .replace(/</g, amp + "lt;")
    .replace(/>/g, amp + "gt;")
    .replace(/"/g, amp + "quot;")
}

function exportSvg(doc: Document): string {
  const parts: string[] = []
  for (const s of doc.shapes) {
    if (s.visible === false) continue
    const sw = s.strokeWeight ?? 0
    const strokeAttrs =
      sw > 0 && s.stroke && s.stroke !== "transparent" && HEX_RE.test(s.stroke)
        ? ` stroke="${escXml(s.stroke)}" stroke-width="${sw}"`
        : ""
    if (s.kind === "rectangle") {
      parts.push(
        `  <rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" fill="${escXml(s.fill)}"${strokeAttrs} ${s.rotation ? `transform="rotate(${s.rotation} ${s.x + s.width / 2} ${s.y + s.height / 2})"` : ""}/>`
      )
    } else if (s.kind === "ellipse") {
      parts.push(
        `  <ellipse cx="${s.x + s.width / 2}" cy="${s.y + s.height / 2}" rx="${s.width / 2}" ry="${s.height / 2}" fill="${escXml(s.fill)}"${strokeAttrs} ${s.rotation ? `transform="rotate(${s.rotation} ${s.x + s.width / 2} ${s.y + s.height / 2})"` : ""}/>`
      )
    } else if (s.kind === "text") {
      parts.push(
        `  <text x="${s.x}" y="${s.y}" font-size="${s.fontSize ?? 16}" fill="${escXml(s.fill)}">${escXml(s.text ?? "")}</text>`
      )
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900">\n${parts.join("\n")}\n</svg>`
}

// ---------- Валидация входов ----------

class ToolError extends Error {}

const KINDS: ShapeKind[] = ["rectangle", "ellipse", "text"]
const HEX_RE = /^#[0-9a-f]{6}$/

// Проверка и нормализация kind
function wantKind(v: unknown, field: string): ShapeKind {
  if (typeof v !== "string" || !KINDS.includes(v as ShapeKind)) {
    throw new ToolError(`${field}: ожидается "rectangle" | "ellipse" | "text", получено ${JSON.stringify(v)}`)
  }
  return v as ShapeKind
}

// Проверка строки цвета #rrggbb
function wantColor(v: unknown, field: string, fallback: string): string {
  if (v === undefined || v === null) return fallback
  if (typeof v !== "string" || !HEX_RE.test(v)) {
    throw new ToolError(`${field}: ожидается "#rrggbb", получено ${JSON.stringify(v)}`)
  }
  return v
}

// Проверка числа
function wantNumber(v: unknown, field: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new ToolError(`${field}: ожидается число, получено ${JSON.stringify(v)}`)
  }
  return v
}

function wantString(v: unknown, field: string): string {
  if (typeof v !== "string") {
    throw new ToolError(`${field}: ожидается строка, получено ${JSON.stringify(v)}`)
  }
  return v
}

// ---------- Инструменты ----------

interface ToolDef {
  name: string
  description: string
  inputSchema: {
    type: "object"
    properties: Record<string, unknown>
    required?: string[]
    additionalProperties: false
  }
  run(args: Record<string, unknown>): string
}

// mf_get_document: весь документ как есть
function toolGetDocument(args: Record<string, unknown>): string {
  return JSON.stringify(loadDoc())
}

// mf_list_shapes: опциональный фильтр по kind
function toolListShapes(args: Record<string, unknown>): string {
  let filter: ShapeKind | undefined
  if (args.kind !== undefined) filter = wantKind(args.kind, "kind")
  const doc = loadDoc()
  const list = filter ? doc.shapes.filter((s) => s.kind === filter) : doc.shapes
  return JSON.stringify(list)
}

// mf_create_shape: клампы w/h >= 2, fill по умолчанию #3b82f6 (для text — #ffffff)
function toolCreateShape(args: Record<string, unknown>): string {
  const kind = wantKind(args.kind, "kind")
  const x = wantNumber(args.x, "x")
  const y = wantNumber(args.y, "y")
  const width = clamp(wantNumber(args.width, "width"), 2, 1_000_000)
  const height = clamp(wantNumber(args.height, "height"), 2, 1_000_000)
  const fallbackFill = kind === "text" ? "#ffffff" : "#3b82f6"
  const fill = wantColor(args.fill, "fill", fallbackFill)

  const shape: Shape = {
    id: "",
    kind,
    x,
    y,
    width,
    height,
    fill,
    stroke: "transparent",
    rotation: 0,
  }
  if (args.stroke !== undefined) shape.stroke = wantColor(args.stroke, "stroke", "transparent")
  if (args.strokeWeight !== undefined) {
    const sw = wantNumber(args.strokeWeight, "strokeWeight")
    if (sw < 0 || sw > 20) {
      throw new ToolError(`strokeWeight: ожидается число 0..20, получено ${JSON.stringify(args.strokeWeight)}`)
    }
    shape.strokeWeight = sw
  }
  if (args.visible !== undefined) {
    if (typeof args.visible !== "boolean") {
      throw new ToolError(`visible: ожидается boolean, получено ${JSON.stringify(args.visible)}`)
    }
    shape.visible = args.visible
  }
  if (args.text !== undefined) shape.text = wantString(args.text, "text")
  if (args.fontSize !== undefined) {
    const fs = wantNumber(args.fontSize, "fontSize")
    if (fs < 1 || fs > 500) throw new ToolError(`fontSize: ожидается число 1..500, получено ${JSON.stringify(args.fontSize)}`)
    shape.fontSize = fs
  }
  if (args.name !== undefined) shape.name = wantString(args.name, "name")

  const doc = loadDoc()
  shape.id = nextId(doc)
  doc.shapes.push(shape)
  saveDoc(doc)
  return JSON.stringify(shape)
}

// mf_delete_shape: удалить по id
function toolDeleteShape(args: Record<string, unknown>): string {
  const doc = loadDoc()
  findShape(doc, args.id)
  doc.shapes = doc.shapes.filter((s) => s.id !== args.id)
  saveDoc(doc)
  return JSON.stringify({ deleted: args.id })
}

// mf_duplicate_shape: копия со смещением dx/dy (по умолчанию 16), новый id
function toolDuplicateShape(args: Record<string, unknown>): string {
  const doc = loadDoc()
  const src = findShape(doc, args.id)
  const dx = args.dx === undefined ? 16 : wantNumber(args.dx, "dx")
  const dy = args.dy === undefined ? 16 : wantNumber(args.dy, "dy")
  const copy: Shape = { ...src, id: nextId(doc) }
  copy.x = src.x + dx
  copy.y = src.y + dy
  doc.shapes.push(copy)
  saveDoc(doc)
  return JSON.stringify(copy)
}

// mf_clear_document: очистить shapes
function toolClearDocument(_args: Record<string, unknown>): string {
  const doc = loadDoc()
  const count = doc.shapes.length
  doc.shapes = []
  saveDoc(doc)
  return JSON.stringify({ cleared: count })
}

// mf_export_svg: SVG-строка всего документа
function toolExportSvg(_args: Record<string, unknown>): string {
  return exportSvg(loadDoc())
}

// Глубокая валидация импортируемого документа
function validateImportDocument(v: unknown): Document {
  if (typeof v !== "object" || v === null || Array.isArray(v)) {
    throw new ToolError("document: ожидается объект { version, shapes }")
  }
  const o = v as Record<string, unknown>
  if (o.version !== 1) {
    throw new ToolError(`document.version: ожидается 1, получено ${JSON.stringify(o.version)}`)
  }
  if (!Array.isArray(o.shapes)) {
    throw new ToolError("document.shapes: ожидается массив фигур")
  }
  const shapes: Shape[] = []
  o.shapes.forEach((raw, i) => {
    if (typeof raw !== "object" || raw === null) {
      throw new ToolError(`document.shapes[${i}]: ожидается объект`)
    }
    const s = raw as Record<string, unknown>
    if (typeof s.id !== "string" || s.id.length === 0) {
      throw new ToolError(`document.shapes[${i}].id: ожидается непустая строка`)
    }
    const kind = wantKind(s.kind, `document.shapes[${i}].kind`)
    const x = wantNumber(s.x, `document.shapes[${i}].x`)
    const y = wantNumber(s.y, `document.shapes[${i}].y`)
    const w = wantNumber(s.width, `document.shapes[${i}].width`)
    const h = wantNumber(s.height, `document.shapes[${i}].height`)
    if (w < 2 || h < 2) {
      throw new ToolError(`document.shapes[${i}]: width/height должны быть >= 2`)
    }
    const fill = typeof s.fill === "string" && HEX_RE.test(s.fill) ? s.fill : "#3b82f6"
    const shape: Shape = { id: s.id, kind, x, y, width: w, height: h, fill, stroke: "transparent", rotation: 0 }
    if (s.stroke !== undefined) {
      if (typeof s.stroke !== "string" || !HEX_RE.test(s.stroke)) {
        throw new ToolError(`document.shapes[${i}].stroke: ожидается "#rrggbb"`)
      }
      shape.stroke = s.stroke
    }
    if (s.strokeWeight !== undefined) {
      if (typeof s.strokeWeight !== "number" || !Number.isFinite(s.strokeWeight) || s.strokeWeight < 0 || s.strokeWeight > 20) {
        throw new ToolError(`document.shapes[${i}].strokeWeight: ожидается число 0..20`)
      }
      shape.strokeWeight = s.strokeWeight
    }
    if (s.text !== undefined) {
      if (typeof s.text === "string") shape.text = s.text
      else if (s.text !== null) throw new ToolError(`document.shapes[${i}].text: ожидается строка`)
    }
    if (s.fontSize !== undefined) {
      if (typeof s.fontSize !== "number" || !Number.isFinite(s.fontSize)) {
        throw new ToolError(`document.shapes[${i}].fontSize: ожидается число`)
      }
      shape.fontSize = s.fontSize
    }
    if (s.visible !== undefined) {
      if (typeof s.visible !== "boolean") {
        throw new ToolError(`document.shapes[${i}].visible: ожидается boolean`)
      }
      shape.visible = s.visible
    }
    if (s.name !== undefined) {
      if (typeof s.name !== "string") {
        throw new ToolError(`document.shapes[${i}].name: ожидается строка`)
      }
      shape.name = s.name
    }
    shapes.push(shape)
  })
  return { version: 1, shapes }
}

// mf_import_document: заменить документ целиком
function toolImportDocument(args: Record<string, unknown>): string {
  if (!Object.prototype.hasOwnProperty.call(args, "document")) {
    throw new ToolError("document: обязательный параметр не передан")
  }
  const doc = validateImportDocument(args.document)
  saveDoc(doc)
  return JSON.stringify({ imported: doc.shapes.length })
}

// ---------- Реестр инструментов (JSON Schema) ----------

const obj = (
  properties: Record<string, unknown>,
  required: string[] = []
): ToolDef["inputSchema"] => ({ type: "object", properties, required, additionalProperties: false })

const TOOLS: ToolDef[] = [
  {
    name: "mf_get_document",
    description: "Вернуть весь документ mini-figma (version + массив shapes) как JSON.",
    inputSchema: obj({}),
    run: toolGetDocument,
  },
  {
    name: "mf_list_shapes",
    description: "Список фигур документа; опциональный фильтр по kind.",
    inputSchema: obj(
      {
        kind: { type: "string", enum: ["rectangle", "ellipse", "text"], description: "Фильтр по типу фигуры" },
      },
      []
    ),
    run: toolListShapes,
  },
  {
    name: "mf_create_shape",
    description:
      "Создать фигуру (rectangle|ellipse|text). width/height >= 2. fill — #rrggbb (по умолчанию #3b82f6, для text — #ffffff). stroke — #rrggbb (по умолчанию transparent), strokeWeight — 0..20 (по умолчанию 0), visible — boolean.",
    inputSchema: obj(
      {
        kind: { type: "string", enum: ["rectangle", "ellipse", "text"] },
        x: { type: "number", description: "Координата X" },
        y: { type: "number", description: "Координата Y" },
        width: { type: "number", description: "Ширина (>= 2)" },
        height: { type: "number", description: "Высота (>= 2)" },
        fill: { type: "string", pattern: "^#[0-9a-f]{6}$", description: "Цвет заливки #rrggbb" },
        stroke: { type: "string", pattern: "^#[0-9a-f]{6}$", description: "Цвет обводки #rrggbb" },
        strokeWeight: { type: "number", description: "Толщина обводки 0..20 (по умолчанию 0)" },
        visible: { type: "boolean", description: "Видимость фигуры" },
        text: { type: "string", description: "Текст (для kind=text)" },
        fontSize: { type: "number", description: "Размер шрифта 1..500 (для kind=text)" },
        name: { type: "string", description: "Имя слоя" },
      },
      ["kind", "x", "y", "width", "height"]
    ),
    run: toolCreateShape,
  },
  {
    name: "mf_update_shape",
    description: "Обновить фигуру по id: x, y, width, height, fill, stroke, strokeWeight, text, fontSize, visible, name.",
    inputSchema: obj(
      {
        id: { type: "string", description: "ID фигуры" },
        x: { type: "number" },
        y: { type: "number" },
        width: { type: "number", description: ">= 2" },
        height: { type: "number", description: ">= 2" },
        fill: { type: "string", pattern: "^#[0-9a-f]{6}$" },
        stroke: { type: "string", pattern: "^#[0-9a-f]{6}$" },
        strokeWeight: { type: "number", description: "0..20" },
        text: { type: "string" },
        fontSize: { type: "number" },
        visible: { type: "boolean" },
        name: { type: "string" },
      },
      ["id"]
    ),
    run: toolUpdateShape,
  },
  {
    name: "mf_delete_shape",
    description: "Удалить фигуру по id.",
    inputSchema: obj({ id: { type: "string", description: "ID фигуры" } }, ["id"]),
    run: toolDeleteShape,
  },
  {
    name: "mf_duplicate_shape",
    description: "Копия фигуры со смещением dx/dy (по умолчанию 16/16), новый id.",
    inputSchema: obj(
      {
        id: { type: "string", description: "ID фигуры" },
        dx: { type: "number", description: "Смещение по X (по умолчанию 16)" },
        dy: { type: "number", description: "Смещение по Y (по умолчанию 16)" },
      },
      ["id"]
    ),
    run: toolDuplicateShape,
  },
  {
    name: "mf_clear_document",
    description: "Удалить все фигуры документа.",
    inputSchema: obj({}),
    run: toolClearDocument,
  },
  {
    name: "mf_export_svg",
    description:
      "Экспорт документа в SVG (viewBox 0 0 1440 900). Скрытые фигуры (visible:false) пропускаются.",
    inputSchema: obj({}),
    run: toolExportSvg,
  },
  {
    name: "mf_import_document",
    description: "Заменить документ целиком: { version:1, shapes:[...] }. Ошибка с деталями при невалидной структуре.",
    inputSchema: obj(
      {
        document: {
          type: "object",
          properties: {
            version: { type: "number", const: 1 },
            shapes: { type: "array", items: { type: "object" } },
          },
          required: ["version", "shapes"],
        },
      },
      ["document"]
    ),
    run: toolImportDocument,
  },
]

// ---------- JSON-RPC / MCP ----------

const PROTOCOL_VERSION = "2024-11-05"
const SERVER_INFO = { name: "mini-figma-mcp", version: "0.1.0" }

interface RpcRequest {
  jsonrpc: "2.0"
  id?: number | string | null
  method: string
  params?: unknown
}

function send(obj: unknown): void {
  process.stdout.write(JSON.stringify(obj) + "\n")
}

function respond(id: RpcRequest["id"], result: unknown): void {
  send({ jsonrpc: "2.0", id, result })
}

function respondError(id: RpcRequest["id"], code: number, message: string): void {
  send({ jsonrpc: "2.0", id, error: { code, message } })
}

// tools/call: запуск инструмента, ошибки — isError:true без крэша
function handleToolsCall(id: RpcRequest["id"], params: unknown): void {
  const p = (params ?? {}) as Record<string, unknown>
  const name = typeof p.name === "string" ? p.name : ""
  const tool = TOOLS.find((t) => t.name === name)
  if (!tool) {
    respond(id, {
      content: [{ type: "text", text: `Неизвестный инструмент: "${name}". Доступны: ${TOOLS.map((t) => t.name).join(", ")}` }],
      isError: true,
    })
    return
  }
  let args: Record<string, unknown> = {}
  if (p.arguments !== undefined) {
    if (typeof p.arguments !== "object" || p.arguments === null || Array.isArray(p.arguments)) {
      respond(id, { content: [{ type: "text", text: "arguments: ожидается объект" }], isError: true })
      return
    }
    args = p.arguments as Record<string, unknown>
  }
  try {
    const out = tool.run(args)
    respond(id, { content: [{ type: "text", text: out }] })
  } catch (e) {
    const msg = e instanceof ToolError ? e.message : `Внутренняя ошибка: ${String(e)}`
    logErr(`tools/call ${name}: ${msg}`)
    respond(id, { content: [{ type: "text", text: msg }], isError: true })
  }
}

// tools/list: дескрипторы инструментов
function handleToolsList(id: RpcRequest["id"]): void {
  respond(id, {
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
  })
}

// Один входящий запрос
function handleMessage(msg: RpcRequest): void {
  if (msg.method === "initialize") {
    respond(msg.id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    })
    return
  }
  if (msg.method === "notifications/initialized" || msg.method === "notifications/cancelled") {
    return // уведомления — без ответа
  }
  if (msg.method === "ping") {
    respond(msg.id, {})
    return
  }
  if (msg.method === "tools/list") {
    handleToolsList(msg.id)
    return
  }
  if (msg.method === "tools/call") {
    handleToolsCall(msg.id, msg.params)
    return
  }
  respondError(msg.id, -32601, "Method not found")
}

// ---------- main: stdin построчно ----------

function main(): void {
  logErr(`запуск, doc.json: ${DOC_PATH}`)
  const rl = createInterface({ input: process.stdin, terminal: false })
  rl.on("line", (line) => {
    const trimmed = line.trim()
    if (!trimmed) return
    let msg: RpcRequest
    try {
      msg = JSON.parse(trimmed) as RpcRequest
    } catch {
      respondError(null, -32700, "Parse error")
      return
    }
    try {
      handleMessage(msg)
    } catch (e) {
      logErr(`ошибка обработки: ${String(e)}`)
      if (msg.id !== undefined && msg.id !== null) {
        respondError(msg.id, -32603, "Internal error")
      }
    }
  })
  rl.on("close", () => {
    logErr("stdin закрыт — завершение")
    process.exit(0)
  })
}

main()

// Находит фигуру по id, иначе ToolError
function findShape(doc: Document, id: unknown): Shape {
  const idStr = wantString(id, "id")
  const s = doc.shapes.find((x) => x.id === idStr)
  if (!s) throw new ToolError(`id: фигура "${idStr}" не найдена (всего фигур: ${doc.shapes.length})`)
  return s
}

// mf_update_shape: { id, ...patch }
function toolUpdateShape(args: Record<string, unknown>): string {
  const doc = loadDoc()
  const shape = findShape(doc, args.id)
  const hasKey = (k: string) => Object.prototype.hasOwnProperty.call(args, k)

  if (hasKey("x")) shape.x = wantNumber(args.x, "x")
  if (hasKey("y")) shape.y = wantNumber(args.y, "y")
  if (hasKey("width")) {
    const w = wantNumber(args.width, "width")
    if (w < 2) throw new ToolError(`width: минимум 2, получено ${JSON.stringify(args.width)}`)
    shape.width = w
  }
  if (hasKey("height")) {
    const h = wantNumber(args.height, "height")
    if (h < 2) throw new ToolError(`height: минимум 2, получено ${JSON.stringify(args.height)}`)
    shape.height = h
  }
  if (hasKey("fill")) shape.fill = wantColor(args.fill, "fill", shape.fill)
  if (hasKey("stroke")) shape.stroke = wantColor(args.stroke, "stroke", "transparent")
  if (hasKey("strokeWeight")) {
    const sw = wantNumber(args.strokeWeight, "strokeWeight")
    if (sw < 0 || sw > 20) {
      throw new ToolError(`strokeWeight: ожидается число 0..20, получено ${JSON.stringify(args.strokeWeight)}`)
    }
    shape.strokeWeight = sw
  }
  if (hasKey("text")) shape.text = wantString(args.text, "text")
  if (hasKey("fontSize")) {
    const fs = wantNumber(args.fontSize, "fontSize")
    if (fs < 1 || fs > 500) throw new ToolError(`fontSize: ожидается число 1..500, получено ${JSON.stringify(args.fontSize)}`)
    shape.fontSize = fs
  }
  if (hasKey("visible")) {
    if (typeof args.visible !== "boolean") {
      throw new ToolError(`visible: ожидается boolean, получено ${JSON.stringify(args.visible)}`)
    }
    shape.visible = args.visible
  }
  if (hasKey("name")) shape.name = wantString(args.name, "name")

  saveDoc(doc)
  return JSON.stringify(shape)
}

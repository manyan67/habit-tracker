import { expect, type APIRequestContext, type Page } from "@playwright/test"
import { spawn, type ChildProcess } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"

// ---------- Документ (мост /api/doc, акт B) ----------

export const DOC_API = "http://localhost:5173/api/doc"

// vite.config.ts задаёт base "/mini-figma/" — приложение живёт на этом пути,
// baseURL из playwright.config.ts указывает на корень сервера.
export const APP_PATH = "/mini-figma/"

export interface DocShape extends Record<string, unknown> {
  id?: string
  kind?: "rectangle" | "ellipse" | "text"
  x?: number
  y?: number
  width?: number
  height?: number
  fill?: string
  stroke?: string
  strokeWeight?: number
  rotation?: number
  text?: string
  fontSize?: number
  visible?: boolean
  name?: string
}

export interface Doc {
  version: number
  shapes: DocShape[]
}

export async function resetDoc(request: APIRequestContext): Promise<void> {
  const res = await request.put(DOC_API, { data: { shapes: [] } })
  if (!res.ok()) {
    throw new Error(
      `resetDoc: PUT ${DOC_API} -> ${res.status()} (мост /api/doc не отвечает — реализует акт B)`,
    )
  }
}

// Мягкий сброс только для smoke: он проверяет статический UI и не должен
// падать в beforeEach, пока мост /api/doc ещё не написан агентом B.
export async function resetDocSoft(request: APIRequestContext): Promise<void> {
  try {
    await resetDoc(request)
  } catch (e) {
    console.warn(`[e2e] resetDoc недоступен (expected-mid-state): ${String(e)}`)
  }
}

export async function docState(request: APIRequestContext): Promise<Doc> {
  const res = await request.get(DOC_API)
  if (!res.ok()) {
    throw new Error(`docState: GET ${DOC_API} -> ${res.status()}`)
  }
  return (await res.json()) as Doc
}

/** Поллит docState до выполнения predicate и возвращает последнее состояние. */
export async function pollDoc(
  request: APIRequestContext,
  predicate: (doc: Doc) => boolean,
  timeout = 5000,
): Promise<Doc> {
  let latest: Doc = { version: 1, shapes: [] }
  await expect
    .poll(
      async () => {
        latest = await docState(request)
        return predicate(latest)
      },
      { timeout, intervals: [250, 500, 1000] },
    )
    .toBe(true)
  return latest
}

export const round = (n: number | undefined): number => Math.round(n ?? Number.NaN)

// ---------- Селекторы ----------

export const tid = (t: string) => `[data-testid="${t}"]`

// КОНТРАКТ (агент B обязан сохранить формулировку): панель свойств при
// мультиселекте показывает текст «Выбрано объектов: N» — эта строка уже
// существует в PropertiesPanel.tsx, от неё зависит properties.spec.ts.
export const MULTI_SELECT_MESSAGE = "Выбрано объектов"

// ---------- Приложение ----------

export async function openApp(page: Page): Promise<void> {
  await page.goto(APP_PATH)
  await page.locator(tid("canvas")).waitFor({ state: "visible", timeout: 10_000 })
}

// ---------- Инструменты и рисование ----------

export type DrawTool = "select" | "rectangle" | "ellipse" | "text"

const TOOL_HOTKEY: Record<DrawTool, string> = {
  select: "KeyV",
  rectangle: "KeyR",
  ellipse: "KeyO",
  text: "KeyT",
}

/** Горячие клавиши — физические коды (event.code), раскладконезависимо. */
export async function selectTool(page: Page, tool: DrawTool): Promise<void> {
  await page.keyboard.press(TOOL_HOTKEY[tool])
}

/**
 * Рисует фигуру мышью в page-координатах (viewport по умолчанию:
 * canvas (0,0) = page (640,400), zoom 1 — центр окна 1280x800).
 * Без `to` — клик (down+up в той же точке): для text-инструмента это
 * коммит дефолтного текст-бокса w≈160 h≈24. После создания возвращает
 * инструмент select, чтобы случайные клики не создавали фигуры.
 */
export async function drawShape(
  page: Page,
  kind: "rectangle" | "ellipse" | "text",
  from: { x: number; y: number },
  to?: { x: number; y: number },
): Promise<void> {
  await selectTool(page, kind)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  if (to && (to.x !== from.x || to.y !== from.y)) {
    await page.mouse.move(to.x, to.y, { steps: 8 })
  }
  await page.mouse.up()
  await selectTool(page, "select")
}

/** Тянет хендлер выделенной фигуры на дельту (dx, dy) в page-координатах. */
export async function dragHandle(
  page: Page,
  handle: "nw" | "n" | "ne" | "w" | "e" | "sw" | "s" | "se",
  dx: number,
  dy: number,
): Promise<void> {
  const box = await page.locator(tid(`handle-${handle}`)).boundingBox()
  if (!box) throw new Error(`handle-${handle} не найден (boundingBox вернул null)`)
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + dx, cy + dy, { steps: 8 })
  await page.mouse.up()
}

// ---------- MCP-клиент (stdio, newline-JSON) ----------

interface McpResponse {
  jsonrpc: string
  id?: number
  result?: { content?: Array<{ type: string; text?: string }>; isError?: boolean }
  error?: { code: number; message: string }
}

export interface McpClient {
  /** tools/call с JSON-парсингом content[0].text; бросает ошибку при isError. */
  callTool<T = unknown>(name: string, args?: Record<string, unknown>): Promise<T>
  kill(): Promise<void>
}

/**
 * Спавнит `node mcp-server/dist/server.js` из корня проекта (cwd — корень
 * mini-figma: Playwright запускается оттуда, где лежит playwright.config.ts).
 * Обязательно убить через kill() в afterEach/afterAll.
 */
export async function spawnMcp(): Promise<McpClient> {
  const serverPath = path.resolve(process.cwd(), "mcp-server", "dist", "server.js")
  if (!existsSync(serverPath)) {
    throw new Error(`MCP-сервер не собран: ${serverPath} (выполни npm run mcp:build)`)
  }
  const child: ChildProcess = spawn(process.execPath, [serverPath], {
    cwd: process.cwd(),
    stdio: ["pipe", "pipe", "pipe"],
  })

  const pending = new Map<number, (msg: McpResponse) => void>()
  let nextId = 1
  let stdoutBuffer = ""

  child.stdout?.setEncoding("utf8")
  child.stdout?.on("data", (chunk: string) => {
    stdoutBuffer += chunk
    for (;;) {
      const nl = stdoutBuffer.indexOf("\n")
      if (nl < 0) break
      const line = stdoutBuffer.slice(0, nl).trim()
      stdoutBuffer = stdoutBuffer.slice(nl + 1)
      if (!line) continue
      let msg: McpResponse
      try {
        msg = JSON.parse(line) as McpResponse
      } catch {
        continue
      }
      const resolver = typeof msg.id === "number" ? pending.get(msg.id) : undefined
      if (resolver) {
        pending.delete(msg.id as number)
        resolver(msg)
      }
    }
  })
  child.stderr?.on("data", () => {}) // drain stderr, чтобы не блокировать пайп

  const rpc = (method: string, params?: unknown): Promise<McpResponse> => {
    const id = nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`MCP RPC timeout: ${method}`))
      }, 10_000)
      pending.set(id, (msg) => {
        clearTimeout(timer)
        resolve(msg)
      })
      child.stdin?.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`)
    })
  }

  await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "mini-figma-e2e", version: "0.0.0" },
  })
  child.stdin?.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`)

  return {
    async callTool<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
      const msg = await rpc("tools/call", { name, arguments: args })
      if (msg.error) throw new Error(`MCP ${name} RPC error: ${msg.error.message}`)
      const result = msg.result ?? {}
      const text = result.content?.[0]?.text ?? ""
      if (result.isError) throw new Error(`MCP ${name} failed: ${text}`)
      try {
        return JSON.parse(text) as T
      } catch {
        return text as unknown as T
      }
    },
    async kill(): Promise<void> {
      if (child.exitCode !== null || child.killed) return
      child.kill()
      await new Promise<void>((resolve) => {
        const t = setTimeout(() => {
          child.kill("SIGKILL")
          resolve()
        }, 3000)
        child.once("exit", () => {
          clearTimeout(t)
          resolve()
        })
      })
    },
  }
}

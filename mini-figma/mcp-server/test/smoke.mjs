// Самотест MCP-сервера: spawn + newline-JSON протокол, без зависимостей.
// Запуск: node mcp-server/test/smoke.mjs (после npm run mcp:build)

import { spawn } from "node:child_process"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createInterface } from "node:readline"

const testDir = dirname(fileURLToPath(import.meta.url))
const SERVER = resolve(testDir, "..", "dist", "server.js")

const child = spawn(process.execPath, [SERVER], { stdio: ["pipe", "pipe", "pipe"] })
let failures = 0
let stderrAll = ""
child.stderr.on("data", (d) => { stderrAll += d.toString() })
child.on("error", (e) => {
  console.log("FAIL: spawn-server — " + e.message)
  process.exit(1)
})

// Копим строки stdout и матчим ответы по id
const rl = createInterface({ input: child.stdout })
const queue = []
rl.on("line", (line) => {
  if (line.trim()) queue.push(line)
})

const timers = []

function waitFor(id, timeoutMs = 5000) {
  return new Promise((resolvePromise, reject) => {
    const started = Date.now()
    const tick = () => {
      const idx = queue.findIndex((raw) => {
        try {
          return JSON.parse(raw).id === id
        } catch {
          return false
        }
      })
      if (idx >= 0) {
        const entry = queue.splice(idx, 1)[0]
        try {
          resolvePromise(JSON.parse(entry))
        } catch (e) {
          reject(e)
        }
        return
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error("timeout waiting for id=" + id))
        return
      }
      timers.push(setTimeout(tick, 25))
    }
    tick()
  })
}

let rpcCounter = 0
function rpc(method, params) {
  const id = ++rpcCounter
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n")
  return id
}

function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n")
}

function ok(step) {
  console.log("OK: " + step)
}

function fail(step, msg) {
  failures++
  console.log("FAIL: " + step + (msg ? " — " + msg : ""))
}

function parseResult(resp, step) {
  try {
    return JSON.parse(resp.result.content[0].text)
  } catch {
    fail(step, "не удалось разобрать content[0].text: " + JSON.stringify(resp.result).slice(0, 200))
    return null
  }
}

// Общий жёсткий таймаут всего теста — 10с
const hardTimer = setTimeout(() => {
  fail("hard-timeout", "тест не завершился за 10с")
  console.log("stderr сервера: " + stderrAll.slice(0, 500))
  try { child.kill("SIGKILL") } catch {}
  process.exit(1)
}, 10000)

try {
  // 1. initialize
  let id = rpc("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "smoke", version: "0.0.0" } })
  let resp = await waitFor(id)
  if (resp.result && resp.result.protocolVersion === "2024-11-05" && resp.result.serverInfo && resp.result.serverInfo.name === "mini-figma-mcp") {
    ok("initialize → protocolVersion 2024-11-05, serverInfo=mini-figma-mcp")
  } else {
    fail("initialize", JSON.stringify(resp).slice(0, 200))
  }

  // 2. notifications/initialized
  notify("notifications/initialized")
  ok("notifications/initialized отправлено")

  // 3. tools/list: все 9 инструментов
  id = rpc("tools/list", {})
  resp = await waitFor(id)
  const toolNames = (resp.result && resp.result.tools ? resp.result.tools : []).map((t) => t.name)
  const expected = [
    "mf_get_document",
    "mf_list_shapes",
    "mf_create_shape",
    "mf_update_shape",
    "mf_delete_shape",
    "mf_duplicate_shape",
    "mf_clear_document",
    "mf_export_svg",
    "mf_import_document",
  ]
  const missing = expected.filter((n) => !toolNames.includes(n))
  if (missing.length === 0) ok("tools/list → 9/9 инструментов, " + toolNames.length)
  else fail("tools/list", "нет: " + missing.join(", "))

  // 4. mf_create_shape rectangle → id
  id = rpc("tools/call", { name: "mf_create_shape", arguments: { kind: "rectangle", x: 10, y: 20, width: 100, height: 80, fill: "#ff0000" } })
  resp = await waitFor(id)
  let rect = parseResult(resp, "mf_create_shape")
  if (rect && rect.id && rect.kind === "rectangle" && rect.x === 10 && rect.y === 20) ok("mf_create_shape → " + rect.id)
  else if (rect) fail("mf_create_shape", JSON.stringify(rect))
  const rectId = rect ? rect.id : ""

  // 5. mf_get_document → 1 фигура
  id = rpc("tools/call", { name: "mf_get_document", arguments: {} })
  resp = await waitFor(id)
  let doc = parseResult(resp, "mf_get_document")
  if (doc && Array.isArray(doc.shapes) && doc.shapes.length === 1) ok("mf_get_document → 1 фигура")
  else if (doc) fail("mf_get_document", "shapes.length=" + doc.shapes.length)

  // 6. create text + update text = "Привет"
  id = rpc("tools/call", { name: "mf_create_shape", arguments: { kind: "text", x: 5, y: 5, width: 10, height: 10, text: "hello" } })
  resp = await waitFor(id)
  let txt = parseResult(resp, "mf_create_shape text")
  if (txt && txt.id) ok("mf_create_shape text → " + txt.id)
  if (txt && (txt.fill !== "#ffffff")) fail("mf_create_shape text fill", "ожидался #ffffff, " + txt.fill)

  id = rpc("tools/call", { name: "mf_update_shape", arguments: { id: txt.id, text: "Привет" } })
  resp = await waitFor(id)
  let updated = parseResult(resp, "mf_update_shape")
  if (updated && updated.text === "Привет") ok("mf_update_shape → text=Привет")
  else if (updated) fail("mf_update_shape", "text=" + updated.text)

  // 7. export svg → <svg и <rect
  id = rpc("tools/call", { name: "mf_export_svg", arguments: {} })
  resp = await waitFor(id)
  const svg = resp.result && resp.result.content ? resp.result.content[0].text : ""
  if (svg.includes("<svg") && svg.includes("<rect")) ok("mf_export_svg → <svg + <rect")
  else fail("mf_export_svg", svg.slice(0, 120))

  // 8. duplicate → 3 фигуры
  id = rpc("tools/call", { name: "mf_duplicate_shape", arguments: { id: rectId } })
  resp = await waitFor(id)
  const dup = parseResult(resp, "mf_duplicate_shape")
  if (dup && dup.id && dup.id !== rectId) ok("mf_duplicate_shape → " + dup.id + " (dx=16)")
  if (dup && (dup.x !== rect.x + 16)) fail("mf_duplicate_shape dx", "x=" + dup.x)

  id = rpc("tools/call", { name: "mf_get_document", arguments: {} })
  resp = await waitFor(id)
  doc = parseResult(resp, "mf_get_document after dup")
  if (doc && doc.shapes.length === 3) ok("после duplicate → 3 фигуры")
  else if (doc) fail("count-after-duplicate", "shapes.length=" + doc.shapes.length)

  // 9. delete → 2 фигуры
  id = rpc("tools/call", { name: "mf_delete_shape", arguments: { id: dup.id } })
  resp = await waitFor(id)
  const del = parseResult(resp, "mf_delete_shape")
  if (del && del.deleted === dup.id) ok("mf_delete_shape → " + dup.id)
  else if (del) fail("mf_delete_shape", JSON.stringify(del))

  id = rpc("tools/call", { name: "mf_get_document", arguments: {} })
  resp = await waitFor(id)
  doc = parseResult(resp, "mf_get_document after delete")
  if (doc && doc.shapes.length === 2) ok("после delete → 2 фигуры")
  else if (doc) fail("count-after-delete", "shapes.length=" + doc.shapes.length)

  // 10. clear → 0
  id = rpc("tools/call", { name: "mf_clear_document", arguments: {} })
  resp = await waitFor(id)
  const cleared = parseResult(resp, "mf_clear_document")
  if (cleared && typeof cleared.cleared === "number") ok("mf_clear_document → удалено " + cleared.cleared)
  id = rpc("tools/call", { name: "mf_get_document", arguments: {} })
  resp = await waitFor(id)
  doc = parseResult(resp, "mf_get_document after clear")
  if (doc && doc.shapes.length === 0) ok("после clear → 0 фигур")
  else if (doc) fail("count-after-clear", "shapes.length=" + doc.shapes.length)

  // 11. невалидный import → isError:true
  id = rpc("tools/call", { name: "mf_import_document", arguments: { document: { version: 2, shapes: "not-array" } } })
  resp = await waitFor(id)
  if (resp.result && resp.result.isError === true) ok("mf_import_document невалидный → isError:true")
  else fail("mf_import_document-invalid", JSON.stringify(resp.result).slice(0, 200))

  // 12. неизвестный метод → -32601
  id = rpc("foo/bar", {})
  resp = await waitFor(id)
  if (resp.error && resp.error.code === -32601) ok("foo/bar → -32601 Method not found")
  else fail("unknown-method", JSON.stringify(resp).slice(0, 200))
} catch (e) {
  fail("exception", e.message)
  process.exitCode = 1
} finally {
  clearTimeout(hardTimer)
  for (const t of timers) clearTimeout(t)
  try { child.stdin.end() } catch {}
  try { child.kill() } catch {}
  setTimeout(() => process.exit(process.exitCode || 0), 150)
}
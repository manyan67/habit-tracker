import { expect, test } from "@playwright/test"
import {
  drawShape,
  docState,
  openApp,
  resetDoc,
  spawnMcp,
  tid,
  type Doc,
  type McpClient,
} from "./helpers"

// ГЛАВНЫЙ E2E моста UI <-> doc.json <-> MCP-сервер.
test.describe("persistence & MCP bridge", () => {
  test.setTimeout(60_000)

  let mcp: McpClient | null = null

  test.beforeEach(async ({ page, request }) => {
    await resetDoc(request)
    await openApp(page)
  })

  test.afterEach(async () => {
    if (mcp) {
      await mcp.kill()
      mcp = null
    }
  })

  test("doc persists across page reload", async ({ page, request }) => {
    await drawShape(page, "rectangle", { x: 660, y: 420 }, { x: 780, y: 540 })

    // UI -> doc.json (автосейв через мост /api/doc)
    await expect
      .poll(async () => (await docState(request)).shapes.length, { timeout: 5000 })
      .toBe(1)

    await page.reload()

    await expect
      .poll(async () => (await docState(request)).shapes.length, { timeout: 5000 })
      .toBe(1)
    // после reload фигура отрисована на canvas
    await expect(page.locator(tid("shape"))).toHaveCount(1, { timeout: 5000 })
  })

  test("MCP server edits appear in UI without reload", async ({ page, request }) => {
    mcp = await spawnMcp()

    await mcp.callTool("mf_create_shape", {
      kind: "rectangle",
      x: 400,
      y: 300,
      width: 120,
      height: 80,
      fill: "#00aa88",
    })

    // файл -> мост -> UI: polling моста до ~2с, даём щедрый таймаут
    await expect
      .poll(async () => (await docState(request)).shapes.length, { timeout: 5000 })
      .toBe(1)

    await expect(page.locator(tid("layer-item")).first()).toBeVisible({ timeout: 5000 })
  })

  test("UI edits reach MCP get_document", async ({ page }) => {
    await drawShape(page, "rectangle", { x: 660, y: 420 }, { x: 780, y: 540 })

    mcp = await spawnMcp()

    // автосейв UI debounce 250мс + запись в файл: poll вместо фиксированной паузы
    await expect
      .poll(async () => {
        const doc = await mcp!.callTool<Doc>("mf_get_document")
        return doc.shapes.length
      }, { timeout: 8000 })
      .toBe(1)

    const doc = await mcp.callTool<Doc>("mf_get_document")
    expect(doc.shapes[0]?.kind).toBe("rectangle")
  })
})

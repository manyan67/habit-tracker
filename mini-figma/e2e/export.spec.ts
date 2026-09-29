import { expect, test } from "@playwright/test"
import { readFileSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { drawShape, openApp, resetDoc, tid } from "./helpers"

test.beforeEach(async ({ page, request }) => {
  await resetDoc(request)
  await openApp(page)
})

test.describe("export to SVG", () => {
  test("action-export-svg downloads file containing rect and text", async ({ page }) => {
    await drawShape(page, "rectangle", { x: 660, y: 420 }, { x: 780, y: 540 })
    await drawShape(page, "text", { x: 820, y: 470 })

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 10_000 }),
      page.locator(tid("action-export-svg")).click(),
    ])

    const file = path.join(os.tmpdir(), `mini-figma-export-${process.pid}-${Date.now()}.svg`)
    await download.saveAs(file)
    try {
      const svg = readFileSync(file, "utf8")
      expect(svg).toContain("<svg")
      expect(svg).toContain("<rect")
      expect(svg).toContain("<text")
    } finally {
      rmSync(file, { force: true })
    }
  })
})

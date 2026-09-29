import { expect, test, type APIRequestContext } from "@playwright/test"
import { APP_PATH, resetDocSoft, tid } from "./helpers"

test.describe("smoke", () => {
  let request: APIRequestContext

  test.beforeEach(async ({ request: req }) => {
    request = req
    await resetDocSoft(req)
  })

  test("app loads: canvas, topbar, toolbar, panels visible", async ({ page }) => {
    await page.goto(APP_PATH)

    await expect(page.locator(tid("canvas"))).toBeVisible()
    await expect(page.locator(tid("topbar"))).toBeVisible()

    for (const tool of ["tool-select", "tool-rectangle", "tool-ellipse", "tool-text"]) {
      await expect(page.locator(tid(tool))).toBeVisible()
    }

    await expect(page.locator(tid("layers-panel"))).toBeVisible()
    await expect(page.locator(tid("props-panel"))).toBeVisible()
  })

  test("canvas-hud appears after first mouse move over canvas", async ({ page }) => {
    await page.goto(APP_PATH)
    await page.locator(tid("canvas")).waitFor({ state: "visible", timeout: 10_000 })

    await expect(page.locator(tid("canvas-hud"))).toHaveCount(0)

    await page.mouse.move(640, 400)
    await page.mouse.move(680, 440)

    await expect(page.locator(tid("canvas-hud"))).toBeVisible()
  })
})

import { expect, test } from "@playwright/test"
import { drawShape, openApp, pollDoc, resetDoc, round } from "./helpers"

test.beforeEach(async ({ page, request }) => {
  await resetDoc(request)
  await openApp(page)
})

test.describe("history: undo / redo", () => {
  test("Ctrl+Z / Ctrl+Shift+Z / Delete restore positions and shapes", async ({
    page,
    request,
  }) => {
    // rect canvas (60,50) 100x100
    await drawShape(page, "rectangle", { x: 700, y: 450 }, { x: 800, y: 550 })

    // drag из центра фигуры одним жестом: select + move
    await page.mouse.move(750, 500)
    await page.mouse.down()
    await page.mouse.move(790, 540, { steps: 8 })
    await page.mouse.up()
    await pollDoc(
      request,
      (d) => d.shapes.length === 1 && round(d.shapes[0]?.x) === 100 && round(d.shapes[0]?.y) === 90,
    )

    await page.keyboard.press("Control+z")
    await pollDoc(
      request,
      (d) => d.shapes.length === 1 && round(d.shapes[0]?.x) === 60 && round(d.shapes[0]?.y) === 50,
    )

    await page.keyboard.press("Control+Shift+z")
    await pollDoc(
      request,
      (d) => d.shapes.length === 1 && round(d.shapes[0]?.x) === 100 && round(d.shapes[0]?.y) === 90,
    )

    // после redo выделение сброшено — выбираем фигуру кликом перед Delete
    await page.mouse.click(790, 540)
    await page.keyboard.press("Delete")
    await pollDoc(request, (d) => d.shapes.length === 0)

    await page.keyboard.press("Control+z")
    await pollDoc(request, (d) => d.shapes.length === 1)
  })

  test("action-undo / action-redo buttons mirror hotkeys", async ({ page, request }) => {
    await drawShape(page, "rectangle", { x: 700, y: 450 }, { x: 800, y: 550 })

    await page.mouse.move(750, 500)
    await page.mouse.down()
    await page.mouse.move(830, 580, { steps: 8 })
    await page.mouse.up()
    await pollDoc(
      request,
      (d) => d.shapes.length === 1 && round(d.shapes[0]?.x) === 140 && round(d.shapes[0]?.y) === 130,
    )

    await page.locator('[data-testid="action-undo"]').click()
    await pollDoc(
      request,
      (d) => d.shapes.length === 1 && round(d.shapes[0]?.x) === 60 && round(d.shapes[0]?.y) === 50,
    )

    await page.locator('[data-testid="action-redo"]').click()
    await pollDoc(
      request,
      (d) => d.shapes.length === 1 && round(d.shapes[0]?.x) === 140 && round(d.shapes[0]?.y) === 130,
    )
  })
})

import { expect, test } from "@playwright/test"
import {
  MULTI_SELECT_MESSAGE,
  drawShape,
  openApp,
  pollDoc,
  resetDoc,
  tid,
} from "./helpers"

test.beforeEach(async ({ page, request }) => {
  await resetDoc(request)
  await openApp(page)
})

test.describe("properties panel", () => {
  test("x/y/width/height inputs commit on Enter", async ({ page, request }) => {
    await drawShape(page, "rectangle", { x: 660, y: 420 }, { x: 760, y: 520 })
    await page.mouse.click(710, 470)

    await page.locator(tid("props-input-x")).fill("555")
    await page.keyboard.press("Enter")
    await pollDoc(request, (d) => Math.round((d.shapes[0]?.x as number) ?? NaN) === 555)

    await page.locator(tid("props-input-y")).fill("444")
    await page.keyboard.press("Enter")
    await pollDoc(request, (d) => Math.round((d.shapes[0]?.y as number) ?? NaN) === 444)

    await page.locator(tid("props-input-width")).fill("77")
    await page.keyboard.press("Enter")
    await pollDoc(request, (d) => Math.round((d.shapes[0]?.width as number) ?? NaN) === 77)

    await page.locator(tid("props-input-height")).fill("88")
    await page.keyboard.press("Enter")
    await pollDoc(request, (d) => Math.round((d.shapes[0]?.height as number) ?? NaN) === 88)
  })

  test("hex fill, hex stroke and stroke weight commit on Enter", async ({ page, request }) => {
    await drawShape(page, "rectangle", { x: 660, y: 420 }, { x: 760, y: 520 })
    await page.mouse.click(710, 470)

    await page.locator(tid("props-input-hex-fill")).fill("#ff0000")
    await page.keyboard.press("Enter")
    await pollDoc(request, (d) => d.shapes[0]?.fill === "#ff0000")

    // КОНТРАКТ: doc хранит stroke (#rrggbb) и strokeWeight (число) — оба поля
    // обязаны появиться в doc.json после правки в панели свойств.
    await page.locator(tid("props-input-hex-stroke")).fill("#00ff00")
    await page.keyboard.press("Enter")
    await pollDoc(request, (d) => d.shapes[0]?.stroke === "#00ff00")

    await page.locator(tid("props-input-stroke-weight")).fill("3")
    await page.keyboard.press("Enter")
    await pollDoc(request, (d) => d.shapes[0]?.strokeWeight === 3)
  })

  test("font size input commits for text shape", async ({ page, request }) => {
    await drawShape(page, "text", { x: 700, y: 450 })
    // текст-бокс canvas (60,50) 160x24, центр page (780,462)
    await page.mouse.click(780, 462)

    await page.locator(tid("props-input-font-size")).fill("24")
    await page.keyboard.press("Enter")
    await pollDoc(request, (d) => d.shapes[0]?.fontSize === 24)
  })

  test("multi-select shows 'Выбрано объектов: 2' message", async ({ page }) => {
    await drawShape(page, "rectangle", { x: 660, y: 420 }, { x: 760, y: 520 })
    await drawShape(page, "rectangle", { x: 820, y: 540 }, { x: 920, y: 640 })

    await page.mouse.click(710, 470)
    await page.keyboard.down("Shift")
    await page.mouse.click(870, 570)
    await page.keyboard.up("Shift")

    // Формулировка «Выбрано объектов: N» — существующий контракт PropertiesPanel.
    await expect(page.locator(tid("props-panel"))).toContainText(
      new RegExp(`${MULTI_SELECT_MESSAGE}: 2`),
    )
  })
})

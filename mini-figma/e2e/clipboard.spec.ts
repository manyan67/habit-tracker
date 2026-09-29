import { expect, test } from "@playwright/test"
import { drawShape, openApp, pollDoc, resetDoc, round } from "./helpers"

test.beforeEach(async ({ page, request }) => {
  await resetDoc(request)
  await openApp(page)
})

test.describe("clipboard: duplicate / copy-paste / select all", () => {
  test("Ctrl+D duplicates shape with +16/+16 offset", async ({ page, request }) => {
    // rect canvas (60,50) 100x100
    await drawShape(page, "rectangle", { x: 700, y: 450 }, { x: 800, y: 550 })

    await page.keyboard.press("Control+d")
    const doc = await pollDoc(request, (d) => d.shapes.length === 2)
    const dup = doc.shapes.find((s) => round(s.x) === 76 && round(s.y) === 66)
    expect(dup, "копия должна быть со смещением +16/+16").toBeDefined()
    expect(dup?.kind).toBe("rectangle")
  })

  test("Ctrl+C then Ctrl+V pastes a third shape with offset", async ({ page, request }) => {
    await drawShape(page, "rectangle", { x: 700, y: 450 }, { x: 800, y: 550 })

    await page.keyboard.press("Control+d") // 2 фигуры, выделена копия (76,66)
    await pollDoc(request, (d) => d.shapes.length === 2)

    await page.keyboard.press("Control+c")
    await page.keyboard.press("Control+v")
    const doc = await pollDoc(request, (d) => d.shapes.length === 3)
    // вставка обязана применить смещение: позиция третьей фигуры не совпадает с источником
    const pasted = doc.shapes[2]
    expect(pasted).toBeDefined()
    const source = doc.shapes[1]
    expect(
      round(pasted.x) !== round(source.x) || round(pasted.y) !== round(source.y),
      "paste должен вставить фигуру со смещением",
    ).toBe(true)
  })

  test("Ctrl+A selects all shapes, Delete removes everything", async ({ page, request }) => {
    await drawShape(page, "rectangle", { x: 700, y: 450 }, { x: 800, y: 550 })
    await drawShape(page, "rectangle", { x: 820, y: 540 }, { x: 920, y: 640 })

    await page.keyboard.press("Control+a")
    await page.keyboard.press("Delete")

    await pollDoc(request, (d) => d.shapes.length === 0)
  })
})

import { expect, test } from "@playwright/test"
import { dragHandle, drawShape, openApp, pollDoc, resetDoc, round, tid } from "./helpers"

test.beforeEach(async ({ page, request }) => {
  await resetDoc(request)
  await openApp(page)
})

test.describe("resize via handles", () => {
  // ВАЖНО: после растяжения фигуры handle `se` может уйти под LayersPanel
  // (панель: page x>=1012, y>=560) и pointerdown будет перехвачен панелью.
  // Поэтому фигуру создаём в левом-верхнем секторе: canvas (60,50).
  test("se handle grows width/height without moving x/y; nw moves x/y; min clamp to 2", async ({
    page,
    request,
  }) => {
    await drawShape(page, "rectangle", { x: 700, y: 450 }, { x: 800, y: 550 })
    await page.mouse.click(750, 500)

    await dragHandle(page, "se", 50, 30)
    let doc = await pollDoc(
      request,
      (d) => d.shapes.length === 1 && round(d.shapes[0].width) === 150,
    )
    let shape = doc.shapes[0]
    expect(round(shape.height)).toBe(130)
    expect(round(shape.x)).toBe(60)
    expect(round(shape.y)).toBe(50)

    await dragHandle(page, "nw", -40, -20)
    doc = await pollDoc(
      request,
      (d) => d.shapes.length === 1 && round(d.shapes[0].x) === 20,
    )
    shape = doc.shapes[0]
    expect(round(shape.y)).toBe(30)
    expect(round(shape.width)).toBe(190)
    expect(round(shape.height)).toBe(150)

    // тянем se сильно внутрь: w/h клампятся к минимуму 2
    await dragHandle(page, "se", -250, -250)
    doc = await pollDoc(
      request,
      (d) => d.shapes.length === 1 && round(d.shapes[0].width) === 2,
    )
    shape = doc.shapes[0]
    expect(round(shape.height)).toBe(2)
    expect(round(shape.x)).toBe(20)
  })

  test("ellipse resize via se handle changes bbox", async ({ page, request }) => {
    await drawShape(page, "ellipse", { x: 680, y: 440 }, { x: 780, y: 540 })
    await page.mouse.click(730, 490)

    await dragHandle(page, "se", 40, 20)
    const doc = await pollDoc(
      request,
      (d) => d.shapes.length === 1 && round(d.shapes[0].width) === 140,
    )
    const shape = doc.shapes[0]
    expect(round(shape.height)).toBe(120)
    expect(round(shape.x)).toBe(40)
    expect(round(shape.y)).toBe(40)
  })
})

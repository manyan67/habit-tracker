import { expect, test } from "@playwright/test"
import { drawShape, openApp, pollDoc, resetDoc, round, tid } from "./helpers"

// Точки фигур в page-координатах (canvas = page - (640,400) при viewport по умолчанию):
// rect1: canvas (20,20) 100x100, центр page (710,470)
// rect2: canvas (180,140) 100x100, центр page (870,570)
const RECT1 = { from: { x: 660, y: 420 }, to: { x: 760, y: 520 }, center: { x: 710, y: 470 } }
const RECT2 = { from: { x: 820, y: 540 }, to: { x: 920, y: 640 }, center: { x: 870, y: 570 } }

test.beforeEach(async ({ page, request }) => {
  await resetDoc(request)
  await openApp(page)
})

test.describe("select & move", () => {
  test("click selects a shape and drag moves only it", async ({ page, request }) => {
    await drawShape(page, "rectangle", RECT1.from, RECT1.to)
    await drawShape(page, "rectangle", RECT2.from, RECT2.to)

    await page.mouse.click(RECT1.center.x, RECT1.center.y)
    await page.mouse.move(RECT1.center.x, RECT1.center.y)
    await page.mouse.down()
    await page.mouse.move(RECT1.center.x + 40, RECT1.center.y + 30, { steps: 8 })
    await page.mouse.up()

    await pollDoc(
      request,
      (d) =>
        d.shapes.length === 2 &&
        d.shapes.some((s) => round(s.x) === 60 && round(s.y) === 50) &&
        d.shapes.some((s) => round(s.x) === 180 && round(s.y) === 140),
    )
  })

  test("shift+click adds to selection and drag moves both by same delta", async ({
    page,
    request,
  }) => {
    await drawShape(page, "rectangle", RECT1.from, RECT1.to)
    await drawShape(page, "rectangle", RECT2.from, RECT2.to)

    await page.mouse.click(RECT1.center.x, RECT1.center.y)
    await page.keyboard.down("Shift")
    await page.mouse.click(RECT2.center.x, RECT2.center.y)
    await page.keyboard.up("Shift")

    await page.mouse.move(RECT2.center.x, RECT2.center.y)
    await page.mouse.down()
    await page.mouse.move(RECT2.center.x + 30, RECT2.center.y + 20, { steps: 8 })
    await page.mouse.up()

    // дельта (30,20): rect1 -> (50,40), rect2 -> (210,160)
    await pollDoc(
      request,
      (d) =>
        d.shapes.length === 2 &&
        d.shapes.some((s) => round(s.x) === 50 && round(s.y) === 40) &&
        d.shapes.some((s) => round(s.x) === 210 && round(s.y) === 160),
    )
  })

  test("click on empty area clears selection and drag moves nothing", async ({
    page,
    request,
  }) => {
    await drawShape(page, "rectangle", RECT1.from, RECT1.to)

    await page.mouse.click(400, 650)
    await page.mouse.move(400, 650)
    await page.mouse.down()
    await page.mouse.move(500, 700, { steps: 8 })
    await page.mouse.up()

    await page.waitForTimeout(300)
    const doc = await pollDoc(request, (d) => d.shapes.length === 1)
    const shape = doc.shapes[0]
    expect(round(shape.x)).toBe(20)
    expect(round(shape.y)).toBe(20)
  })

  test("top shape wins hit-test: click in overlap selects and moves only ellipse", async ({
    page,
    request,
  }) => {
    // rect: canvas (60,50) 100x100; ellipse поверх: canvas (80,70) 100x100
    await drawShape(page, "rectangle", { x: 700, y: 450 }, { x: 800, y: 550 })
    await drawShape(page, "ellipse", { x: 720, y: 470 }, { x: 820, y: 570 })

    const overlap = { x: 760, y: 510 }
    await page.mouse.click(overlap.x, overlap.y)
    await page.mouse.move(overlap.x, overlap.y)
    await page.mouse.down()
    await page.mouse.move(overlap.x + 50, overlap.y + 50, { steps: 8 })
    await page.mouse.up()

    // ellipse -> canvas (130,120), rect остаётся (60,50)
    const doc = await pollDoc(
      request,
      (d) =>
        d.shapes.length === 2 &&
        d.shapes.some((s) => s.kind === "ellipse" && round(s.x) === 130 && round(s.y) === 120),
    )
    const rect = doc.shapes.find((s) => s.kind === "rectangle")
    expect(round(rect?.x)).toBe(60)
    expect(round(rect?.y)).toBe(50)
  })
})

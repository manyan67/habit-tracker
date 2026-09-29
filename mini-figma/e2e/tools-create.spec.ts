import { expect, test } from "@playwright/test"
import { docState, drawShape, openApp, pollDoc, resetDoc, round, selectTool, tid } from "./helpers"

test.beforeEach(async ({ page, request }) => {
  await resetDoc(request)
  await openApp(page)
})

test.describe("tools: creating shapes", () => {
  test("R + drag creates rectangle", async ({ page, request }) => {
    await drawShape(page, "rectangle", { x: 660, y: 420 }, { x: 780, y: 540 })

    const doc = await pollDoc(request, (d) => d.shapes.length === 1)
    const shape = doc.shapes[0]
    expect(shape.kind).toBe("rectangle")
    expect(shape.width as number).toBeGreaterThan(20)
    expect(shape.height as number).toBeGreaterThan(20)
    // viewport по умолчанию: canvas (0,0) = page (640,400); допускаем округление
    expect(Math.abs(round(shape.x) - 20)).toBeLessThanOrEqual(3)
    expect(Math.abs(round(shape.y) - 20)).toBeLessThanOrEqual(3)
  })

  test("O + drag creates ellipse", async ({ page, request }) => {
    await drawShape(page, "ellipse", { x: 680, y: 440 }, { x: 790, y: 530 })

    const doc = await pollDoc(request, (d) => d.shapes.length === 1)
    const shape = doc.shapes[0]
    expect(shape.kind).toBe("ellipse")
    expect(shape.width as number).toBeGreaterThan(20)
    expect(shape.height as number).toBeGreaterThan(20)
  })

  test("T + click creates default text box ~160x24", async ({ page, request }) => {
    await drawShape(page, "text", { x: 700, y: 450 })

    const doc = await pollDoc(request, (d) => d.shapes.length === 1)
    const shape = doc.shapes[0]
    expect(shape.kind).toBe("text")
    expect(Math.abs((shape.width as number) - 160)).toBeLessThanOrEqual(2)
    expect(Math.abs((shape.height as number) - 24)).toBeLessThanOrEqual(2)
  })

  test("T + drag creates text with drag size", async ({ page, request }) => {
    await drawShape(page, "text", { x: 700, y: 450 }, { x: 900, y: 510 })

    const doc = await pollDoc(request, (d) => d.shapes.length === 1)
    const shape = doc.shapes[0]
    expect(shape.kind).toBe("text")
    expect(Math.abs((shape.width as number) - 200)).toBeLessThanOrEqual(3)
    expect(Math.abs((shape.height as number) - 60)).toBeLessThanOrEqual(3)
  })

  test("toolbar buttons switch tools and create shapes", async ({ page, request }) => {
    await page.locator(tid("tool-rectangle")).click()
    await page.mouse.move(660, 420)
    await page.mouse.down()
    await page.mouse.move(760, 520, { steps: 8 })
    await page.mouse.up()

    await page.locator(tid("tool-ellipse")).click()
    await page.mouse.move(820, 540)
    await page.mouse.down()
    await page.mouse.move(920, 640, { steps: 8 })
    await page.mouse.up()

    const doc = await pollDoc(request, (d) => d.shapes.length === 2)
    expect(doc.shapes.map((s) => s.kind)).toEqual(["rectangle", "ellipse"])
  })

  test("draft is not committed on drag < 2px", async ({ page, request }) => {
    await selectTool(page, "rectangle")
    await page.mouse.move(700, 450)
    await page.mouse.down()
    await page.mouse.move(701, 450)
    await page.mouse.up()

    await page.waitForTimeout(500)
    const doc = await docState(request)
    expect(doc.shapes).toHaveLength(0)
  })
})

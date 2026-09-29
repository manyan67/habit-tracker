import { expect, test, type Page } from "@playwright/test"
import { docState, drawShape, openApp, pollDoc, resetDoc, tid } from "./helpers"

test.beforeEach(async ({ page, request }) => {
  await resetDoc(request)
  await openApp(page)
})

/** Достаёт процент зума из canvas-hud («x, y · 110%»). */
async function hudZoom(page: Page): Promise<number> {
  const text = await page.locator(tid("canvas-hud")).innerText()
  const m = /([\d.]+)\s*%/.exec(text)
  if (!m) throw new Error(`canvas-hud не содержит процент зума: "${text}"`)
  return Number(m[1])
}

test.describe("viewport: zoom & pan", () => {
  test("mouse wheel zooms in; clamp max 400%; clamp min below 100%", async ({ page }) => {
    await drawShape(page, "rectangle", { x: 700, y: 450 }, { x: 800, y: 550 })
    await page.mouse.move(640, 400)
    await page.mouse.move(660, 420)
    await expect(page.locator(tid("canvas-hud"))).toBeVisible()

    await page.mouse.wheel(0, -240)
    await expect
      .poll(async () => hudZoom(page), { timeout: 5000 })
      .toBeGreaterThan(100)

    // кламп сверху: контракт — максимум 400%
    for (let i = 0; i < 25; i++) await page.mouse.wheel(0, -240)
    await expect.poll(async () => hudZoom(page), { timeout: 5000 }).toBe(400)

    for (let i = 0; i < 25; i++) await page.mouse.wheel(0, 240)
    await expect.poll(async () => hudZoom(page), { timeout: 5000 }).toBeLessThan(100)
  })

  test("action-zoom-fit changes zoom and keeps doc untouched", async ({ page, request }) => {
    // маленькая фигура (100x100 < зона 640x800) — fit обязан дать zoom > 100%
    await drawShape(page, "rectangle", { x: 700, y: 450 }, { x: 800, y: 550 })
    // дождаться автосейва, иначе before может быть пустым доком
    await pollDoc(request, (d) => d.shapes.length === 1)
    await page.mouse.move(640, 400)
    await page.mouse.move(660, 420)
    await expect(page.locator(tid("canvas-hud"))).toBeVisible()
    const beforeZoom = await hudZoom(page)

    const before = await docState(request)
    await page.locator(tid("action-zoom-fit")).click()
    await expect.poll(async () => hudZoom(page), { timeout: 5000 }).not.toBe(beforeZoom)

    const after = await docState(request)
    expect(after.shapes).toHaveLength(1)
    expect(JSON.stringify(after.shapes)).toBe(JSON.stringify(before.shapes))

    const zoom = await hudZoom(page)
    expect(zoom, "фигура меньше зоны видимости — fit должен увеличить зум").toBeGreaterThan(100)
  })

  test("space + drag pans canvas without moving shapes in doc", async ({ page, request }) => {
    await drawShape(page, "rectangle", { x: 700, y: 450 }, { x: 800, y: 550 })
    await pollDoc(request, (d) => d.shapes.length === 1)

    // трансформ-слой — первый div-ребёнок canvas (translate+scale)
    const layer = page.locator(`${tid("canvas")} > div`).first()
    const transformBefore = await layer.getAttribute("style")
    const before = await docState(request)

    await page.keyboard.down("Space")
    await page.mouse.move(600, 450)
    await page.mouse.down()
    await page.mouse.move(700, 520, { steps: 6 })
    await page.mouse.up()
    await page.keyboard.up("Space")

    const after = await docState(request)
    expect(JSON.stringify(after.shapes)).toBe(JSON.stringify(before.shapes))

    const transformAfter = await layer.getAttribute("style")
    expect(transformAfter).not.toBe(transformBefore)
    expect(transformAfter).toContain("translate")
  })
})

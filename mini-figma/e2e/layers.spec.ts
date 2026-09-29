import { expect, test } from "@playwright/test"
import { drawShape, openApp, pollDoc, resetDoc, tid } from "./helpers"

test.beforeEach(async ({ page, request }) => {
  await resetDoc(request)
  await openApp(page)
})

test.describe("layers panel", () => {
  test("two layer items, last created on top", async ({ page, request }) => {
    await drawShape(page, "rectangle", { x: 660, y: 420 }, { x: 760, y: 520 })
    await drawShape(page, "ellipse", { x: 800, y: 480 }, { x: 900, y: 580 })

    const items = page.locator(tid("layer-item"))
    await expect(items).toHaveCount(2)
    // список отображается в обратном порядке: сверху — последняя созданная
    await expect(items.first()).toContainText(/ellipse/i)
    await expect(items.nth(1)).toContainText(/rectangle/i)

    await pollDoc(
      request,
      (d) => d.shapes.length === 2 && d.shapes[0]?.kind === "rectangle" && d.shapes[1]?.kind === "ellipse",
    )
  })

  test("click layer name selects the shape", async ({ page }) => {
    await drawShape(page, "rectangle", { x: 660, y: 420 }, { x: 760, y: 520 })
    await drawShape(page, "ellipse", { x: 800, y: 480 }, { x: 900, y: 580 })

    await page.locator(tid("layer-item")).first().locator(tid("layer-name")).click()

    // Допущение: props-name показывает имя фигуры, а дефолтное имя содержит kind
    // (например «Ellipse»); точную дефолтную формулировку определяет акт B.
    await expect(page.locator(tid("props-name"))).toContainText(/ellipse/i)
  })

  test("double click renames layer and commits to doc", async ({ page, request }) => {
    await drawShape(page, "rectangle", { x: 660, y: 420 }, { x: 760, y: 520 })
    await drawShape(page, "ellipse", { x: 800, y: 480 }, { x: 900, y: 580 })

    await page.locator(tid("layer-item")).first().locator(tid("layer-name")).dblclick()
    const input = page.locator(tid("layer-rename-input"))
    await expect(input).toBeVisible()
    await input.fill("Hero")
    await input.press("Enter")

    await pollDoc(request, (d) => d.shapes.some((s) => s.kind === "ellipse" && s.name === "Hero"))
  })

  test("visibility toggle hides shape in doc", async ({ page, request }) => {
    await drawShape(page, "rectangle", { x: 660, y: 420 }, { x: 760, y: 520 })
    await drawShape(page, "ellipse", { x: 800, y: 480 }, { x: 900, y: 580 })

    await page.locator(tid("layer-item")).first().locator(tid("layer-visibility")).click()

    await pollDoc(
      request,
      (d) => d.shapes.some((s) => s.kind === "ellipse" && s.visible === false),
    )
  })

  test("layer-forward moves shape up in z-order", async ({ page, request }) => {
    await drawShape(page, "rectangle", { x: 660, y: 420 }, { x: 760, y: 520 })
    await drawShape(page, "ellipse", { x: 800, y: 480 }, { x: 900, y: 580 })

    // items: [ellipse, rect]; forward на rect (второй item) поднимает его наверх
    await page.locator(tid("layer-item")).nth(1).locator(tid("layer-forward")).click()

    const doc = await pollDoc(
      request,
      (d) => d.shapes.length === 2 && d.shapes[d.shapes.length - 1]?.kind === "rectangle",
    )
    expect(doc.shapes[0]?.kind).toBe("ellipse")
    // в списке первый item теперь rect
    await expect(page.locator(tid("layer-item")).first()).toContainText(/rectangle/i)
  })

  test("layer-delete removes shape from doc", async ({ page, request }) => {
    await drawShape(page, "rectangle", { x: 660, y: 420 }, { x: 760, y: 520 })
    await drawShape(page, "ellipse", { x: 800, y: 480 }, { x: 900, y: 580 })

    await page.locator(tid("layer-item")).first().locator(tid("layer-delete")).click()

    const doc = await pollDoc(request, (d) => d.shapes.length === 1)
    expect(doc.shapes[0]?.kind).toBe("rectangle")
  })
})

import { defineConfig, devices } from "@playwright/test"

// ВАЖНО: vite.config.ts задаёт base "/mini-figma/", поэтому приложение отдаётся
// на http://localhost:5173/mini-figma/, а корень "/" в dev-режиме отвечает 404.
// webServer.url поэтому указывает на base-путь — иначе Playwright никогда
// не сочтёт сервер готовым (404 не входит в список «готовых» статусов).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // doc.json — общий ресурс между тестами, UI и MCP-сервером: гонки недопустимы.
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173/mini-figma/",
    reuseExistingServer: true,
    timeout: 60_000,
  },
})

# mini-figma

Минимальный веб-редактор (аналог Figma, sprint-1 по правилу Парето) + MCP-сервер.

## Стек

- Vite 8 + React 19 + TypeScript + Tailwind 4
- MCP-сервер на stdio (`mcp-server/`), инструменты `mf_*` — без внешних зависимостей
- E2E: Playwright 1.63 (`e2e/`), workers: 1 (общий `doc.json`)

## S1 (Pareto 20/80) — что уже есть

- Отрисовка rect/ellipse/text (V/R/O/T), hit-test с поворотом
- Выделение (клик/Shift-мультиселект/перетаскивание), resize-хэндлы (8, anchor-модель)
- Delete / Ctrl+D / Ctrl+C / Ctrl+V / Ctrl+A / Ctrl+Z / Ctrl+Shift+Z / Escape / Shift+1
- Undo/Redo (кнопки + хоткеи), история до 50 шагов
- Слои: клик-выбор, переименование, видимость, z-order ↑↓, удаление
- Properties: X/Y/W/H/Fill/Stroke/StrokeWeight/FontSize — коммит по Enter/blur
- Zoom-to-fit, экспорт SVG (TopBar → `mini-figma.svg`)
- **Мост MCP ↔ App**: Vite-плагин `bridge/docBridge.ts` (`GET/PUT /api/doc`) + хук
  `src/hooks/useDocSync.ts` — общий `mcp-server/doc.json`; например, `mf_create_shape`
  через MCP появляется на канвасе за ~1 секунду, и наоборот.

## Figma-parity backlog (S2+)

- Marquee-выделение, группировка, snapping/align-guides, rotation-хэндлы
- Frames/Artboards, компоненты, стили/токены, шрифты
- Collaborative (multiplayer CRDT), комментарии, история версий
- Миграция `mf_*` инструментов на frame-иерархию

## Команды

```powershell
npm run dev        # http://localhost:5173/mini-figma/
npm run build      # tsc -b + vite build
npm run lint       # oxlint
npm run mcp:build  # tsc -p mcp-server/tsconfig.json -> mcp-server/dist/server.js
npm run mcp        # stdio-сервер (используется opencode.jsonc как MCP "mini-figma")
npm run test:e2e   # playwright test (webServer поднимается сам)
```

Примечание: `doc.json` — общий ресурс; MCP-сервер и dev-бридж пишут его атомарно (tmp + rename).

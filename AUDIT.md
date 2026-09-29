# AUDIT.md — аудит проекта (2026-09-29)

Аудит по правилам AGENTS.md. Правок **не вносилось** — только осмотр и отчёт.

## 1. Git-состояние

| Параметр | Значение |
|---|---|
| Текущая ветка | `main` (up to date с `origin/main`) |
| Ветки `refactor/*` | **Нет** (ни локально, ни на remote) |
| Remote | `https://github.com/manyan67/habit-tracker.git` |
| Незакоммиченные изменения | 20 изменённых файлов (+1181 / −173 строк) |
| Некоммиченные (untracked) | `AGENTS.md`, `opencode.json`, `mini-figma/bridge/`, `mini-figma/e2e/`, `mini-figma/mcp-server/` (источник + тест), `mini-figma/playwright.config.ts`, `mini-figma/src/components/TextEditor.tsx`, `mini-figma/src/components/TopBar.tsx`, `mini-figma/src/hooks/useDocSync.ts`, `mini-figma/src/utils/svgExport.ts` |
| Stash | Пусто |
| `.gitignore` (mini-figma) | Покрывает logs, node_modules, dist, test-results, playwright-report, `mcp-server/dist`; **не** покрывает `mcp-server/doc.json` и временные `*.tmp` |

Вся новая подсистема (MCP-сервер, e2e-тесты, doc-мост) существует только в рабочей директории — ни одного коммита.

## 2. Сводная таблица проблем

### P0 — критично

Найдено: **0**. Секретов в коде/конфигах/истории нет (единственные совпадения по ключам — плейсхолдеры `GEMINI_API_KEY="your-key"` в документации скиллов, не в коде проекта). Сборка `npm run build` проходит. Краш-багов уровня «падает при запуске» нет.

### P1 — важно

| № | Проблема | Файл:строка | Что делать |
|---|---|---|---|
| 1 | **Многошаговый Redo сломан.** `redo()` после извлечения состояния вызывает `pushHistory()`, который всегда затирает `redoHistoryRef = []`. Первый Redo «съедает» весь остаток стека: цепочка из N undo восстанавливается Redo только на 1 шаг, остальное безвозвратно теряется | `mini-figma/src/hooks/useShapes.ts:78-87` (pushHistory → `redoHistoryRef.current = []`) и `mini-figma/src/hooks/useShapes.ts:430-436` (redo) | В `redo` не вызывать `pushHistory()`, а вручную положить текущее состояние в `historyRef` (со сдвигом при переполнении), не трогая redo-стек. Накрыть e2e-тестом «create ×2 → undo ×2 → redo ×2» |
| 2 | **Пробел не вводится в поля ввода.** Глобальный keydown-обработчик в useViewport делает `preventDefault()` на Space для любого события без проверки `isEditableTarget` — при переименовании слоя в LayersPanel пробел не печатается и включается курсор «pan». Хоткеи в useHotkeys проверяют editable-таргет, а viewport нет | `mini-figma/src/hooks/useViewport.ts:173-187` | Добавить guard `isEditableTarget(event.target)` (общая утилита) в keydown/keyup обработчик |
| 3 | **~1200 строк работы не закоммичены на main, ветки `refactor/*` нет.** Риск потери (рабочая папка синхронизируется с OneDrive, конфликт синка может повредить файлы), нарушение регламента AGENTS.md (работа должна идти в ветке `refactor/*`) | `git status` — 20 modified + 9 untracked | С разрешения пользователя: создать `refactor/mini-figma-mcp-bridge` от main и закоммитить изменения логичными сериями; перед `git add` дополнить `.gitignore` (см. №7) |
| 4 | **Лендинг: контент не согласован.** Hero и заголовки про «трекер привычек», но весь остальной контент — от шаблона SaaS-автоматизаций: макет «New leads workflow», метрика «1,284 automations run», фичи «1,000+ integrations / AI that follows the rules / Real-time observability», CTA «Start automating today», логотипы «Trusted by 4,000+ modern teams» | `index.html:88-89, 118-141, 146, 155-179, 240-241` | Переписать sections (mock, features, CTA) под habit tracker, чтобы страница говорила об одном продукте |

### P2 — желательно

| № | Проблема | Файл:строка | Что делать |
|---|---|---|---|
| 5 | Дублирующиеся конфиги opencode: `opencode.json` (untracked, полный: instructions + permissions + mcp) и `opencode.jsonc` (tracked, обновлён: только mcp). Два источника правды расходятся | `opencode.json:1-26`, `opencode.jsonc:1-16` | Оставить один файл (json), второй удалить |
| 6 | `mcp-server/doc.json` — это рантайм-«БД» (её пишут UI-автосейв, MCP-сервер и e2e-тесты), но каталог `mcp-server/` untracked: при `git add mini-figma/mcp-server/` изменяемое состояние попадёт в коммит и будет шуметь в каждом diff | `mini-figma/mcp-server/doc.json` | Добавить в `mini-figma/.gitignore`: `mcp-server/doc.json` и `mcp-server/doc.json*.tmp` |
| 7 | watcher-ignore в Vite не покрывает временный файл MCP-сервера: MCP пишет `doc.json.tmp`, а паттерн — `**/mcp-server/doc.json.*.tmp` (с точкой), расхождение с комментарием | `mini-figma/vite.config.ts:13`, `mini-figma/mcp-server/src/server.ts:81` | Паттерн заменить на `**/mcp-server/doc.json*.tmp` |
| 8 | Экспорт SVG расходится между UI и MCP: app-экспорт смещает текст на `y + fontSize*0.9` и теряет `rotation` у текста; MCP-экспорт — без смещения. Один и тот же документ даёт разный результат | `mini-figma/src/utils/svgExport.ts:40-42` vs `mini-figma/mcp-server/src/server.ts:126-128` | Унифицировать формулу/атрибуты в обоих экспортах (общий контракт) |
| 9 | Семантика `version` в doc.json расплывчата: MCP пишет константу `1`, бридж отдаёт `mtimeMs` (float). Сравнение версий в poll завязано на устаревшие mtimes; после смены инструмент загрузки поведение меняется | `mini-figma/mcp-server/src/server.ts:80-84`, `mini-figma/bridge/docBridge.ts:70,79-82` | Зафиксировать контракт: монотонный счётчик или единое правило (mtime везде) |
| 10 | `normalizeShape` не ограничивает `strokeWeight` сверху (MCP: 0..20, бридж: только ≥0) | `mini-figma/bridge/docBridge.ts:60` | Кламп 0..20 как в mcp-server |
| 11 | `stroke` нельзя явно задать «transparent», хотя дефолт — «transparent» и описание инструмента это обещает (`wantColor` принимает только `#rrggbb`) | `mini-figma/mcp-server/src/server.ts:223,639` | Принять «transparent» как валидное значение или убрать из описания |
| 12 | 7 линт-предупреждений (0 ошибок): unused `expect`/`request`/`tid`, unused `args` в `toolGetDocument`; запись в ref во время рендера (`viewportRef.current = viewport`) — анти-паттерн React | `mini-figma/e2e/history.spec.ts:1`, `mini-figma/e2e/smoke.spec.ts:5`, `mini-figma/mcp-server/src/server.ts:189`, `mini-figma/src/hooks/useViewport.ts:39` | Убрать неиспользуемое; ref-запись перенести в `useEffect` |
| 13 | В git трекаются бинарные кэши `__pycache__/*.pyc` и тысячи служебных skill-файлов — замусоривает историю и diff | `.opencode/skills/ui-ux-pro-max/scripts/__pycache__/*.pyc` | `git rm --cached` + корневой `.gitignore` с `__pycache__/` |
| 14 | `about.html` — рудимент: заголовок «Страница emya», `lang="ru"`, не связан с лендингом Nimbus и не ссылается на него | `about.html:6`, `index.html` (нет ссылок) | Решить судьбу: привести к бренду или удалить из репо |
| 15 | Имя файла с пробелами, кириллицей и длинным тире — проблемы с URL-энкодингом в GH Pages/CI/ссылках | `Главный экран трекера привычек — 3 направления.html` | Переименовать в ascii (например `habit-tracker-3-directions.html`) |
| 16 | CDN-скрипты без SRI (`integrity`): Tailwind CDN (официально «не для production»), GSAP, шрифты | `index.html:11,13,266-267` | Для учебного проекта допустимо; при dụcствии — самохост-ассеты или добавить integrity |
| 17 | Запуск e2e молча стирает текущий документ: `resetDoc` PUT'ит пустой `shapes` в общий `doc.json` | `mini-figma/e2e/helpers.ts:36-43` | Документировать или подменять путь doc.json в тестовом окружении |
| 18 | Копирует буфер обмена наружу (`navigator.clipboard.writeText`), но `pasteClipboard` читает только внутренний ref — вставка из другой вкладки/системы не работает | `mini-figma/src/hooks/useShapes.ts:206-231` | Backlog S2 (заявлено в README), либо async clipboard read |
| 19 | `revokeObjectURL` вызывается сразу после `click()` — в Safari файл может не скачаться | `mini-figma/src/App.tsx:213-222` | Отложить revoke в `setTimeout`/`onload` |
| 20 | `lang="en"` в mini-figma, но UI-строки на русском («Выбрано объектов», «Пусто», «Видимость»); текст фигур рисуется шрифтом «Inter», которого нет в списке загрузок | `mini-figma/index.html:2`, `mini-figma/src/components/PropertiesPanel.tsx:116-117`, `mini-figma/src/components/LayersPanel.tsx:77,139`, `mini-figma/src/components/Shape.tsx:141`, `mini-figma/src/components/TextEditor.tsx:60` | Привести `lang` в соответствие или тексты; подключить Inter или заменить на системный стек |

## 3. План-fix (порядок P0 → P1 → P2)

1. **Fix P1-1**: rewrite redo в `useShapes.ts` (не затирать redo-стек) + e2e-проверка многошагового Redo.
2. **Fix P1-2**: guard `isEditableTarget` в `useViewport.ts`.
3. **Git P1-3**: по команде пользователя — ветка `refactor/mini-figma-mcp-bridge`, `.gitignore` += `mcp-server/doc.json`, `doc.json*.tmp`, затем логичные коммиты (сервис → бридж → e2e → конфиги).
4. **Fix P1-4**: согласовать контент лендинга (mock/features/CTA) с habit tracker.
5. **P2 по списку сверху**: экспорт SVG, watcher-паттерн, версия документа, strokeWeight-кламп, stroke «transparent», линт-чистота, `__pycache__` из индекса, судьба about.html, переименование кириллического файла, opencode-конфиги.

## 4. Как проверял

- Полный обход файлов: корень (3 HTML, README, конфиги), `mini-figma/src/**`, `mini-figma/bridge/`, `mini-figma/mcp-server/**` (src + smoke-тест), `mini-figma/e2e/**` (helpers + spec'ы), конфиги ts/vite/playwright/oxlint, CI-workflow, логи.
- `git status`, `git branch -a`, `git log --all`, `git diff --stat`, `git ls-files`.
- Поиск секретов по коду (regex по token/secret/apikey/bearer/password) — чисто.
- `npm run build` — ✅ (tsc -b + vite build, 30 модулей, без ошибок).
- `npm run lint` — 0 ошибок, 7 предупреждений (описаны в таблице).
- Живая проверка dev-сервера на :5173 — HTTP 200 (в т.ч. проверка гипотезы о 404 на `/` при `base: "/mini-figma/"` — не подтвердилась, Vite отдаёт корень).
- Покемоново: страницы-генерация doc.json — трассировка контрактов мост ↔ app ↔ MCP по коду; статусы Playwright `.last-run.json` — passed.

## 5. Итог

Найдено: 0 × P0, 4 × P1, 16 × P2.
Исправлено: ничего (аудит без правок, по заданию).
Осталось: весь список выше; критический минимум — P1-1..P1-3.

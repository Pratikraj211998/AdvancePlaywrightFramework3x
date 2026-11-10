# Project Changes Log

This document explains, step by step, every change made to the project so far: setting up the
folder structure, and then fixing the project so it compiles and runs via the custom reporter.

---

## 1. Folder Structure

**Goal:** match the target layout (`src/{api,config,fixtures,pages,testdata,tests,utils}`,
`docs/`, `rules/`, `.github/`).

| Step | Change | Why |
|---|---|---|
| 1 | Created `src/api/`, `src/config/`, `src/fixtures/`, `src/pages/`, `src/testdata/`, `src/tests/`, `src/utils/`, `docs/`, `rules/` | These didn't exist yet; only a root-level `tests/` folder did. |
| 2 | Moved `tests/example.spec.ts` → `src/tests/example.spec.ts`, deleted the empty `tests/` folder | Tests now live under `src/tests` per the target structure. |
| 3 | Added a `.gitkeep` file to every empty new folder | Git doesn't track empty directories; this keeps them in version control until real files land in them. |
| 4 | `playwright.config.ts`: `testDir: './tests'` → `testDir: './src/tests'` | Had to follow the move in step 2, otherwise Playwright would find zero tests. |
| 5 | Created `tsconfig.json` (didn't exist) with `@api/*`, `@config/*`, `@fixtures/*`, `@pages/*`, `@testdata/*`, `@utils/*` path aliases into `src/` | Target structure included `tsconfig.json`; aliases make imports like `@pages/LoginPage` possible instead of long relative paths. |
| 6 | Created `.env` with placeholder `BASE_URL` / `API_BASE_URL` | Target structure showed a root `.env` file. |
| 7 | `.gitignore`: added `.env` | Environment files should never be committed (they end up holding secrets/URLs that differ per machine). |

> Note: `tsconfig.json` was later edited directly by the project owner (switched `module`/`moduleResolution` to `ESNext`/`bundler`, added `types: ["node"]`, `noEmit: true`). That edit is not part of this log — it was made outside this conversation.

---

## 2. Making the Project Actually Run

Running `npx playwright test` surfaced two different kinds of problems: **missing source files**
that page objects and the custom reporter depended on, and **one logic bug** in the test itself.

### 2.1 Missing files (the project didn't compile without them)

`LoginPage.ts`, `InventoryPage.ts`, and `CartPage.ts` all `extend BasePage` — but `BasePage.ts`
didn't exist anywhere in the repo. Separately, `CustomReporter.ts` imports several AI/self-heal
modules under `src/ai/` that also didn't exist. Both had to be created from scratch, inferring
their shape from how the existing files called them.

| File created | Purpose | What was inferred from existing code |
|---|---|---|
| `src/pages/BasePage.ts` | Base class every page object extends. | Page objects call `super(page, 'SomeName')`, then use `this.log.info(...)`, `this.el.fill(...)`, `this.el.click(...)`, `this.el.waitForHidden(...)`, `this.el.getAllTexts(...)`, `this.goto(path)`, and `this.page` directly — so `BasePage` had to expose exactly those as `protected` members. |
| `src/utils/logger.ts` | `createLogger(name)` factory using **winston** (already a devDependency). | `BasePage` needed something to assign to `this.log`. |
| `src/utils/elementActions.ts` | `ElementActions` class implementing `fill`, `click`, `waitForHidden`, `getText`, `getAllTexts`. | These exact method names were called as `this.el.<method>(...)` across `LoginPage`/`InventoryPage`/`CartPage`. |
| `src/ai/config/providers.ts` | `hasApiKey()` and `activeProvider()` — checks for `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`. | `CustomReporter.ts` calls `hasApiKey()` before running RCA analysis and logs "no LLM API key set — skipping AI verdict" when it's false. |
| `src/ai/agents/rcaAgent.ts` | `analyzeFailure()` + `RcaVerdict` type — root-cause analysis for a failed test via whichever LLM provider has a key configured. | `CustomReporter.ts` imports `analyzeFailure` and `RcaVerdict` and renders the result on its "AI Verdict" tab. |
| `src/ai/agents/flakyAnalyzer.ts` | `analyzeFlaky()` + `BuildSummary`/`FlakyResult` types — diffs this run's pass/fail snapshot against the previous one. | `CustomReporter.ts` imports these and renders the result on its "Flaky" tab; it already had the snapshot-reading/writing logic (`reports/runs/*.json`), it just had nothing to call. |
| `src/utils/selfHeal.ts` | `HealReport` type (+ `HealCandidate`, `HealRejection`). | `CustomReporter.ts` imports `HealReport` as a type only, to render a "Self-Heal" tab from `self-heal` test attachments. |

None of the AI pieces are required for tests to pass — with no API key configured, the reporter
logs that it's skipping AI analysis and still produces a full report.

### 2.2 Config changes

**`playwright.config.ts`**
- Uncommented the `dotenv` loader (`dotenv.config({ path: path.resolve(__dirname, '.env') })`) —
  it was present but commented out, so `.env` was never actually being read.
- Set `use.baseURL` to `process.env.BASE_URL || 'https://app.thetestingacademy.com'`.
  `LoginPage.PATH` is a *relative* path (`/playwright/ttacart/index.html`), which only resolves
  once a `baseURL` is set. The host was found by searching for where the course's "TTACart" demo
  app is hosted, then confirmed with `curl` (the URL 308-redirects to
  `https://app.thetestingacademy.com/playwright/ttacart/`, which returns `200`).
- Changed `reporter: 'html'` → `reporter: [['./src/utils/CustomReporter.ts']]` so the project's
  own custom reporter runs (and produces `tta-report/index.html`) instead of Playwright's built-in
  HTML reporter.

**`.env`**
- Set `BASE_URL=https://app.thetestingacademy.com`.

**`package.json`**
- Added `scripts.test` → `"playwright test"`.
- Added `scripts["report:open"]` → opens `tta-report/index.html` with the OS-appropriate opener
  (`open` on macOS, `start` on Windows, `xdg-open` on Linux).

**`.gitignore`**
- Added `/tta-report/` and `/reports/` — the custom reporter's generated HTML/screenshots/videos
  and its per-run JSON snapshots (used for flaky-test comparison) are build output, not source.

### 2.3 The actual test bug

`src/tests/login.spec.ts` called:

```ts
const loginPage = new LoginPage(page);
await loginPage.loginAs("standard_user", "tta_secret");   // never navigated anywhere first
await expect(page).toHaveTitle("TTACart - Products");
```

It never called `loginPage.open()`, so the page was still blank when `loginAs()` tried to fill
the username field — which is why the run failed with:

```
Error: locator.waitFor: Test timeout of 30000ms exceeded.
  - waiting for locator('[data-test="username"]') to be visible
```

**Fix:** added the missing navigation call:

```ts
const loginPage = new LoginPage(page);
await loginPage.open();
await loginPage.loginAs("standard_user", "tta_secret");
await expect(page).toHaveTitle("TTACart - Products");
```

### 2.4 Verification

Ran `npx playwright test` across all three projects (chromium, firefox, webkit) — all passed —
then opened `tta-report/index.html`, the HTML report generated by `CustomReporter.ts`.

---

## 3. Multi-Environment Base URL & Debug Artifacts (project owner's edits)

Made directly by the project owner, outside this conversation's earlier changes. Identified by
re-reading `playwright.config.ts` and `.env` after being asked to check for edits.

### `.env`

| Key | Before | Now |
|---|---|---|
| `BASE_URL` | `https://app.thetestingacademy.com` | *(empty — lets `TTA_ENV` drive the URL instead)* |
| `TTA_ENV` | — | `qa` *(new)* |
| `QA_BASE_URL` | — | `https://app.thetestingacademy.com` *(new)* |
| `STG_BASE_URL` | — | `https://stage.thetestingacademy.com` *(new)* |
| `PROD_BASE_URL` | — | `https://app.thetestingacademy.com` *(new)* |
| `DEV_BASE_URL` | — | `http://localhost:3000` *(new)* |
| `API_BASE_URL` | *(empty)* | `https://restful-booker.herokuapp.com` *(new)* |
| `LOG_LEVEL` | — | `info` *(new)* |
| `TEST_ENV` | — | `QA` *(new)* |
| `TEST_AUTHOR` | — | `Pratik` *(new)* |
| `USERNAME` / `PASSWORD` | — | `admin` / `ADMIN123` *(new)* |

### `playwright.config.ts`

1. **Added `resolveBaseURL()`** — picks a `baseURL` based on `TTA_ENV`
   (`qa` / `dev` / `local` / `stg` / `stage` / `staging` / `prod` / `production`), each with its
   own env-var override and a hardcoded fallback. An explicit `BASE_URL` still wins over everything
   else if set.
2. **`use.baseURL: resolveBaseURL()`** replaces the previous inline
   `process.env.BASE_URL || 'https://app.thetestingacademy.com'`.
3. **Added `screenshot: 'on'`, `video: 'on'`, `trace: 'on'`** — previously only
   `trace: 'on-first-retry'`. Every run now captures a screenshot, video, and trace for every test,
   pass or fail.
4. **Added `headless: !!process.env.CI`** — tests run **headed by default locally** and headless
   only when `CI` is set, so no more needing `--headed` on every local run.
5. **`firefox` and `webkit` projects commented out** — only `chromium` runs by default now.

⚠️ **Heads up:** with `screenshot`/`video`/`trace` all `'on'` (not just on failure), `tta-report/`
will accumulate media for every passing test too — this can grow large fast with frequent runs. If
that becomes a problem, switch to `'retain-on-failure'` (or `'on-first-retry'` for trace).

---

## Quick Reference: All Files Touched

**Created**
- `src/pages/BasePage.ts`
- `src/utils/logger.ts`
- `src/utils/elementActions.ts`
- `src/ai/config/providers.ts`
- `src/ai/agents/rcaAgent.ts`
- `src/ai/agents/flakyAnalyzer.ts`
- `src/utils/selfHeal.ts`
- `tsconfig.json` (folder-structure task)
- `.env` (folder-structure task)
- `docs/CHANGES.md` (this file)

**Edited**
- `playwright.config.ts` (testDir, dotenv, baseURL, reporter, then owner's `resolveBaseURL()`/media/headed/project changes)
- `.env` (BASE_URL value, then owner's multi-environment keys)
- `src/tests/login.spec.ts` (added missing `loginPage.open()`)
- `package.json` (added `test` and `report:open` scripts)
- `.gitignore` (added `.env`, `/tta-report/`, `/reports/`)

**Moved**
- `tests/example.spec.ts` → `src/tests/example.spec.ts`

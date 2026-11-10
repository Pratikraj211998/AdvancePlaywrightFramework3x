# Advance Playwright Framework 3x

A TypeScript + Playwright end-to-end test automation framework for **TTACart**
(The Testing Academy's practice app), built around Page Object Model, a
multi-environment config, and a custom HTML test reporter with AI-assisted
root-cause analysis, flaky-test detection, and self-heal suggestions.

## Tech Stack

- [Playwright Test](https://playwright.dev/) (`@playwright/test`)
- TypeScript
- Winston (logging)
- Custom HTML reporter (`src/utils/CustomReporter.ts`) — no external reporter dependency

## Folder Structure

```
AdvancePlaywrightFramework3x/
├── src/
│   ├── ai/            → AI agents backing the reporter (RCA, flaky analysis, provider config)
│   ├── api/            → API clients
│   ├── config/         → Environment configuration
│   ├── fixtures/        → Custom Playwright fixtures
│   ├── pages/           → Page Object Model (BasePage + page classes)
│   ├── testdata/        → Test data
│   ├── tests/           → Test specs
│   └── utils/           → Logger, element actions, data readers, custom reporter
├── docs/                → Project documentation (see docs/CHANGES.md)
├── rules/
├── .github/workflows/   → CI
├── .env                 → Environment variables (not committed)
├── playwright.config.ts
└── tsconfig.json
```

## Setup

```bash
npm install
npx playwright install   # downloads browser binaries
```

Copy the environment keys you need into `.env` at the project root (see
[Environment Configuration](#environment-configuration) below).

## Environment Configuration

`playwright.config.ts` resolves `baseURL` from `.env` at runtime via `resolveBaseURL()`:

- If `BASE_URL` is set, it always wins.
- Otherwise it switches on `TTA_ENV` (`qa` | `dev` / `local` | `stg` / `stage` / `staging` | `prod` / `production`), falling back to each environment's own `*_BASE_URL` (`QA_BASE_URL`, `DEV_BASE_URL`, `STG_BASE_URL`, `PROD_BASE_URL`), and defaults to `qa` → `https://app.thetestingacademy.com` if nothing is set.

Example `.env`:

```
TTA_ENV=qa
QA_BASE_URL=https://app.thetestingacademy.com
STG_BASE_URL=https://stage.thetestingacademy.com
PROD_BASE_URL=https://app.thetestingacademy.com
DEV_BASE_URL=http://localhost:3000
API_BASE_URL=https://restful-booker.herokuapp.com
LOG_LEVEL=info
```

## Running Tests

```bash
npx playwright test                       # run all tests (chromium, headed by default locally)
npx playwright test --project=chromium     # a specific project
npx playwright test --headed               # force headed
npx playwright test --ui                   # Playwright's interactive UI mode
npx playwright test --debug                # step through with the Inspector
npm test                                   # shortcut for `playwright test`
```

`use.headless` is `false` locally and `true` on CI (`process.env.CI`). Screenshots, videos and
traces are captured for every test run (`'on'`), not just failures.

## Custom HTML Reporter

The project uses its own reporter (`src/utils/CustomReporter.ts`) instead of Playwright's built-in
HTML reporter. After a run it writes a timestamped report plus a redirecting `index.html`:

```bash
npm run report:open   # opens tta-report/index.html
```

The report includes:
- **Test Results** — suite/test table with status, duration, screenshots, video, trace
- **AI Data** — any `ai-data` attachments from generated test data
- **AI Verdict** — root-cause analysis of failures via an LLM (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`); skipped gracefully with no key configured
- **Flaky** — diffs this run's pass/fail snapshot against the previous run (`reports/runs/*.json`)
- **Self-Heal** — suggested locator replacements from `self-heal` attachments (suggestions only, nothing auto-applied)

## Documentation

See [`docs/CHANGES.md`](docs/CHANGES.md) for a detailed, step-by-step log of every change made
to get this project from the initial scaffold to a working, running state.

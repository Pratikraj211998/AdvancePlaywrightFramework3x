# Advance Playwright Framework 3x

A TypeScript + Playwright end-to-end test automation framework for **TTACart**
(The Testing Academy's practice app), built around Page Object Model, a custom fixtures layer,
multi-environment config, Faker/AI-generated test data, and a custom HTML test reporter with
AI-assisted root-cause analysis, flaky-test detection, and self-heal suggestions.

## Tech Stack

- [Playwright Test](https://playwright.dev/) (`@playwright/test`)
- TypeScript
- Winston (scoped logging)
- [Faker](https://fakerjs.dev/) (`@faker-js/faker`) for generated test data
- A multi-provider LLM gateway (Groq / OpenRouter / OpenAI / Anthropic / DeepSeek) for AI-generated data and report analysis
- Custom HTML reporter (`src/utils/CustomReporter.ts`) — no external reporter dependency

## Folder Structure

```
AdvancePlaywrightFramework3x/
├── src/
│   ├── ai/
│   │   ├── LLMGateway.ts      → multi-provider LLM client (Groq/OpenRouter/OpenAI/Anthropic/DeepSeek)
│   │   ├── agents/            → rcaAgent, flakyAnalyzer (back the reporter's AI tabs)
│   │   └── config/            → provider/API-key resolution
│   ├── api/                   → API clients
│   ├── config/
│   │   ├── env.ts             → requireEnv / envOr / assertEnv (.env reader)
│   │   └── credentials.ts     → TTACart login credentials
│   ├── fixtures/
│   │   └── test-base.ts       → custom `test` — page objects + login-state fixtures
│   ├── pages/                 → Page Object Model (BasePage + one class per screen)
│   ├── testdata/              → test data (e.g. logintestdata.json)
│   ├── tests/
│   │   ├── login.spec.ts
│   │   └── e2e/               → checkout E2E specs
│   └── utils/                 → logger, UtilElementLocator, DataGenerator, visualSteps, custom reporter
├── docs/                      → project documentation (see Documentation below)
├── rules/
├── .github/workflows/         → CI
├── .env                       → environment variables (not committed)
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

Key `.env` groups:

```
# Which environment to target
TTA_ENV=qa
BASE_URL=
QA_BASE_URL=https://app.thetestingacademy.com
STG_BASE_URL=https://stage.thetestingacademy.com
PROD_BASE_URL=https://app.thetestingacademy.com
DEV_BASE_URL=http://localhost:3000
API_BASE_URL=https://restful-booker.herokuapp.com

LOG_LEVEL=info
TEST_ENV=QA
TEST_AUTHOR=your_name

# TTACart demo login (src/config/credentials.ts) — leave blank for standard_user/tta_secret
STANDARD_USER=
TTA_SECRET=

# Attaches a screenshot to every visualStep() in the TTA report
ATTACH_SCREENSHOTS=false

# Optional: enables the AI Verdict tab in the TTA report (any one key)
# ANTHROPIC_API_KEY=
# OPENAI_API_KEY=

# LLM Gateway (src/ai/LLMGateway.ts) — used by DataGenerator.checkoutCustomerAI()
LLM_PROVIDER=
# GROQ_API_KEY=
# OPENROUTER_API_KEY=
# DEEPSEEK_API_KEY=
```

## Writing Tests

Specs import the project's own `test`/`expect` instead of Playwright's, so page objects and
login states arrive pre-built instead of `new SomePage(page)` in every test:

```ts
import { test, expect } from '@fixtures/test-base';

test('add first item to cart', async ({ validLogin, inventoryPage, cartPage }) => {
    void validLogin;                       // already logged in as standard_user
    await inventoryPage.addToCart('test-allthethings-tshirt-red');
    await cartPage.open();
    expect(await cartPage.rowCount()).toBe(1);
});
```

Available fixtures (`src/fixtures/test-base.ts`):

| Fixture | Gives you |
|---|---|
| `loginPage`, `inventoryPage`, `cartPage`, `checkoutStepOnePage`, `checkoutStepTwoPage`, `checkoutCompletePage` | A constructed page object, no navigation performed |
| `validLogin` | Already logged in as `standard_user` |
| `invalidLogin` | Already attempted `locked_out_user` login; error box asserted visible |
| `loginWithInventory` | `validLogin` + inventory page asserted loaded |
| `loginWithSelectedItem` | `loginWithInventory` + one item already added to the cart |

Page objects (`src/pages/`): `LoginPage`, `InventoryPage`, `ItemDetailPage`, `CartPage`,
`CheckoutStepOnePage`, `CheckoutStepTwoPage`, `CheckoutCompletePage` — all extend `BasePage`,
which gives every page a scoped logger (`this.log`) and an element-action helper (`this.el`, see
`UtilElementLocator.ts`) for click/fill/wait/get-style actions.

Use `DataGenerator` (`src/utils/DataGenerator.ts`, Faker-backed) for fake credentials and
checkout-customer data, and wrap multi-step flows in `visualStep(page, title, fn)`
(`src/utils/visualSteps.ts`) so each step shows up — and optionally screenshots — in the custom
report.

## Running Tests

```bash
npx playwright test                       # run all tests (chromium, headed by default locally)
npx playwright test --project=chromium     # a specific project
npx playwright test --headed               # force headed
npx playwright test --ui                   # Playwright's interactive UI mode
npx playwright test --debug                # step through with the Inspector
npx playwright test src/tests/e2e/e2e-checkout_validFixture_PonyTail_Review.spec.ts   # a single file
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

- [`docs/CHANGES.md`](docs/CHANGES.md) — a detailed, step-by-step log of every change made to get
  this project from the initial scaffold to a working, running state.
- [`docs/FRAMEWORK-ARCHITECTURE.md`](docs/FRAMEWORK-ARCHITECTURE.md) — how the current pieces fit
  together (fixtures, page objects, AI layer, config resolution), with diagrams, plus a list of
  known gaps.

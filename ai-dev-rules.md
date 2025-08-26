# AI Development Rules & Playbook (Cursor + ChatGPT)

> Put this at the root of any new repo. It defines how we use ChatGPT + Cursor Agent to plan, build, and ship software efficiently.

---

## 1) Purpose & Scope
- Create a consistent, low-friction way to build apps E2E using ChatGPT for planning and **Cursor Agent** for execution.
- Minimize prompt/token waste by putting stable knowledge **in the repo** and keeping Agent prompts **short**.
- Work in **small, shippable increments** with tests and CI from day one.

---

## 2) Roles & Tools
**ChatGPT (Prompt‑Cutter)**
- Produces the plan (PRD, user stories, acceptance checks) and **compresses** it into short Agent prompts that reference repo docs by path.

**Cursor Agent**
- Executes edits, runs commands, fixes tests. Prefer **Ask** for discovery/reading; use **Agent** for changes.

**Local/CI**
- Local dev via scripts/Makefile + Docker. CI runs lint, test, build on PR.

---

## 3) Repo Bootstrap (empty repo → ready)
Create these files/folders on day 0:

```
.
├── docs/
│   └── PRD.md                 # Problem, users, MVP scope, 5–8 user stories
├── .cursor/
│   └── rules/
│       ├── architecture.md
│       ├── stack.md
│       ├── testing.md
│       └── style.md
├── .github/
│   └── workflows/
│       └── ci.yml             # Lint + tests (backend & frontend) + build
├── .env.example               # Never commit real secrets
└── README.md                  # Quickstart, commands
```

**Starter contents** (edit for your stack):

**`docs/PRD.md`**
```
# Product Requirements (PRD)
- Problem:
- Users & jobs-to-be-done:
- Non-goals:
- MVP scope (5–8 user stories):
- Constraints (perf, compliance, SLAs):
- Success metrics:
```

**`.cursor/rules/architecture.md`**
```
# Architecture Rules
- Layers: controllers (thin) → services (logic) → repositories (persistence).
- No cross-layer imports. DTOs at boundaries.
- Feature modules are independent; shared utils are stable & tested.
```

**`.cursor/rules/stack.md`**
```
# Stack Preferences
- Backend: <your framework + version>
- Frontend: <your framework + version>
- DB/ORM/Migrations: <tooling>
- Tooling: formatter, linter, test frameworks, coverage target.
- Folder layout and naming conventions.
```

**`.cursor/rules/testing.md`**
```
# Testing Rules
- Require tests for new/changed code.
- Unit + integration; E2E for critical flows.
- Coverage target: >= <X>% (backend + frontend).
- Commands: `make test` (backend), `npm run test:e2e` (frontend).
```

**`.cursor/rules/style.md`**
```
# Style Rules
- Linters/formatters are the source of truth.
- No commits with lint or type errors.
- Use conventional commits; small PRs with clear summaries.
```

**`.github/workflows/ci.yml` (minimal example)**
```yaml
name: ci
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - name: Install frontend
        run: |
          cd web || true
          [ -f package.json ] && npm ci || true
      - name: Install backend
        run: |
          cd api || true
          python -m pip install --upgrade pip || true
          [ -f requirements.txt ] && pip install -r requirements.txt || true
      - name: Lint & Test (frontend)
        run: |
          cd web || true
          [ -f package.json ] && npm run lint --if-present && npm test --if-present || true
      - name: Lint & Test (backend)
        run: |
          cd api || true
          [ -f pyproject.toml ] && pytest -q || true
```

---

## 4) Working Agreement: The Loop
1. **Plan in ChatGPT**: refine PRD, user stories, acceptance checks, and update `.cursor/rules/*`.
2. **Compress**: ChatGPT outputs a ≤180‑word **Agent prompt** pointing to repo docs by path.
3. **Execute in Cursor**: Use **Ask** to explore, then **Agent** to modify files.
4. **Verify**: Run tests, linters, and a smoke run via Docker/Compose.
5. **Ship**: Open a small PR with CI green; merge.

---

## 5) Token‑Efficiency Rules (“Keep Prompts Tiny”)
- Put stable info in repo docs; **reference paths**, don’t paste contents.
- **One goal per run.** Cap scope: “edit ≤N files; create ≤M files.”
- Always **PLAN then WAIT** before edits.
- Use **checklists + commands** instead of prose.
- Summaries after edits; no long explanations before.
- Prefer **Ask** for discovery; **Agent** for changes.

---

## 6) ChatGPT “Prompt‑Cutter” System Message
Use this once at the top of a planning chat:

```
You are my Prompt-Cutter for Cursor Agent.
Output only the final Agent prompt.
Hard limits:
- ≤ 180 words, bullet/numbered, imperative tone.
- Reference repo docs by path; do not restate contents.
- Require: PLAN (≤120 words) THEN WAIT before edits.
- Cap scope: edit ≤20 files, create ≤10 files max.
- Include verification commands; no extra prose.
- No justifications, no background, no emojis.
```

---

## 7) Cursor Agent Prompt Templates

### A) Project Scaffold
```
GOAL: Create production scaffold for <stack> (e.g., FastAPI + Postgres + Next.js).
CONTEXT: Follow docs/PRD.md and .cursor/rules/*.md.
DELIVERABLES:
- Backend app, frontend app, DB migrations + seed.
- Dockerfile(s), docker-compose.yml, Makefile/npm scripts, .env.example.
- GitHub Actions: lint + tests (backend & frontend).
CONSTRAINTS: Types/linters per rules; multi-stage containers; healthcheck endpoint(s).
PROCESS:
1) PLAN (≤120 words): file tree + commands; THEN WAIT for approval.
2) On approval: implement; edit ≤20 files; create ≤10 files.
VERIFY:
- `docker compose up -d db || true`
- Backend tests: `make test` (or `pytest -q`)
- Frontend tests: `npm run test:e2e`
- README quickstart updated.
STOP when tests pass and README updated.
```

### B) Feature (one story)
```
GOAL: Implement user story “<paste 1 story>”.
CONTEXT: Follow docs/PRD.md, docs/API.md, .cursor/rules/*.md.
CONSTRAINTS: Controllers thin; services hold logic; add/adjust tests; no dead code.
PROCESS:
1) PLAN (≤120 words): touched files, schema/migration, commands; THEN WAIT.
2) Implement with edits ≤12 files; create ≤6.
VERIFY: `pytest -q` (backend), `npm run test:e2e` (frontend), `/healthz` OK.
OUTPUT: List changed files + follow-ups.
```

### C) Refactor (bounded)
```
GOAL: Extract service layer from controllers for modules X,Y without behavior change.
LIMITS: ≤10 files edited; ≤3 new tests.
PROCESS: PLAN (≤100 words) THEN WAIT; then implement.
VERIFY: `pytest -q` all green; lints clean; endpoints unchanged.
```

### D) Bugfix
```
GOAL: Fix bug <short title>.
REPRO: <one-liner or failing test path>.
LIMITS: Edit ≤6 files.
PROCESS: PLAN (≤80 words) THEN WAIT; then implement.
VERIFY: Add failing test first; confirm red → green; run full tests + lints.
```

### E) Packaging & Deploy
```
GOAL: Optimize Dockerfiles (multi-stage), add healthchecks, and document deploy.
LIMITS: Edit ≤8 files.
PROCESS: PLAN (≤100 words) THEN WAIT; then implement.
VERIFY: `docker build .` for each image; `docker compose up`; healthcheck OK; README updated.
```

---

## 8) Definition of Done (DoD)
- Acceptance criteria met (documented in PR).
- Tests added/updated; CI **green**; coverage not reduced.
- Lints/types clean; no TODOs or commented-out code.
- README/CHANGELOG updated where relevant.
- Observability: structured logs; `/healthz` responds 200.
- Security: no secrets committed; uses `.env` with sane defaults.

---

## 9) CI & Quality Gates
- PRs must pass: lint, unit, integration/E2E (critical paths), and build.
- Require at least 1 reviewer; prefer small PRs (<400 lines diff, excluding lockfiles).
- Block merges on failing checks; use draft PRs for WIP.

---

## 10) Observability Minimum
- **Structured logging** with request IDs and latency.
- **/healthz** for readiness; prefer `/livez` for liveness where supported.
- Log 4xx/5xx with correlation IDs; avoid PII in logs.

---

## 11) Security & Secrets
- Do not commit real secrets. Use `.env.example` and secret managers in CI/CD.
- Validate/escape inputs at boundaries; pin library versions.
- Run dependency audit in CI (`npm audit`, `pip-audit` or `safety`).

---

## 12) Background Agents (when to use)
- Use **sparingly** for large mechanical tasks (doc generation, codebase-wide refactors).
- Always require a **PLAN then WAIT**, and cap edit radius with explicit limits.

---

## 13) Story Checklist (to paste into PRs)
- [ ] Links to PRD section / story ID
- [ ] Acceptance checks listed & satisfied
- [ ] Tests added/updated; coverage ≥ target
- [ ] Lint/type checks green
- [ ] Local run verified (Docker/Compose)
- [ ] README/CHANGELOG updated
- [ ] Risk notes & rollout plan (if needed)

---

## 14) Commit & PR Etiquette
- **Conventional Commits** (feat, fix, refactor, chore, docs, test).
- One logical change per PR; avoid coupling refactors with features.
- Summarize what/why; keep how in the diff.

---

## 15) Quick Start (one page)
1. Create repo with structure above; fill `docs/PRD.md` and `.cursor/rules/*`.
2. In ChatGPT, use the **Prompt‑Cutter** system message and craft one **scaffold** Agent prompt.
3. In Cursor, run **Ask** to inspect; then run **Agent** with the scaffold prompt.
4. Verify via tests & local run; commit; open PR with CI.
5. Repeat per story using the **Feature** prompt. Keep PRs small.
6. Ship, observe, iterate.

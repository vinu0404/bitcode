# BitCode

A LeetCode-style practice platform for Verilog/SystemVerilog. A real Icarus Verilog simulator
decides pass/fail and score; an LLM only writes the explanation sentence, and is skipped
entirely on a perfect score.

Full design rationale: [`plans/use-posgree-docker-for-misty-pixel.md`](../../.claude/plans/use-posgree-docker-for-misty-pixel.md)
(the approved implementation plan this repo follows).

## Quick start

```bash
cp .env.example .env
# edit .env: set a real JWT_SECRET (openssl rand -hex 32) and, optionally, OPENAI_API_KEY
docker compose up
```

- API: http://localhost:7860 (docs at `/docs`)
- Web: http://localhost:3010
- Postgres: localhost:5432

On first boot the API runs migrations, seeds the 5 starter problems (each pushed through the
same validation gate the admin UI uses), and bootstraps an admin user from
`BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`.

**Important:** `docker compose restart <service>` does **not** re-read `.env` — Docker bakes
env vars in at container creation. After editing `.env`, use `docker compose up -d <service>`
(which recreates the container) instead.

## Repository layout

```
api/            FastAPI backend — the grading engine, auth, admin API
  app/engine/   Pure grading logic: static check → compile → simulate → score → explain.
                No FastAPI or SQLAlchemy imports — testable standalone, reusable from the CLI.
  app/seed/     The 5 starter problems as JSON, plus the seeder that runs on every boot.
web/            Next.js frontend — student editor + admin problem wizard
```

## Adding a new problem

No file edits, no redeploy. Log in as an admin, go to **Admin → New problem**, and walk the
5-step wizard (basics → ports → rubric & tests → testbench/reference → validate). A problem
cannot be published until it passes three checks:

1. Its reference solution scores exactly 100.
2. An empty stub (right ports, no logic) scores *below* 100 — catches a testbench that never
   actually fails anything, the most common defect in a hand-written testbench.
3. Every declared test id appears in the simulator's output, and vice versa.

Once published, it appears in the student list immediately.

## Running the tests

```bash
# Engine unit + integration tests (compiles real Verilog, needs iverilog — runs in the container)
docker compose run --rm api pytest app/engine/tests -v

# Seed problem integrity — the same 3-check gate, run against every seeded problem
docker compose run --rm api pytest app/seed/tests -v
```

## Grading a file from the command line

No database needed — useful while authoring a new testbench by hand:

```bash
docker compose run --rm api python -m app.engine.cli grade \
  app/seed/problems/counter4.json path/to/my_solution.sv
```

## Production notes

- `api/Dockerfile` targets Hugging Face Spaces: `apt-get install iverilog` runs before the
  `USER` switch (required — HF forces a non-root user), and the app listens on port 7860.
  Only `/tmp` is writable on a free Space; `SIM_JOB_DIR=/tmp` already matches that.
- A free HF Space is a **public repo** — never commit real secrets into it. Set
  `DATABASE_URL`, `JWT_SECRET`, and `OPENAI_API_KEY` as Space secrets instead.
- Swap `DATABASE_URL` for a managed Postgres (Neon, Supabase) — nothing else changes.
- `web/` deploys to Vercel with `NEXT_PUBLIC_API_URL` pointed at the Space.

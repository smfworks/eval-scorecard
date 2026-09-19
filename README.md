# Eval Scorecard

Paste eval / judge / harness output → a **green / yellow / red** shareable grade card with fix hints.

Skill Lint’s twin for *runs*, not skills: overall score band, per-criterion rows, short fix hints. Download a PNG. Copy share text or JSON. Built for posting a grade, not a lab certificate.

**Paste a run. Stamp the band. Share the card — not a cert.**

[![MIT License](https://img.shields.io/badge/license-MIT-00D4FF?labelColor=0A0F1F)](LICENSE)

SMF Works viral kit:

1. **[Skill Lint](https://github.com/smfworks/skill-lint)** — grade / fix a `SKILL.md`
2. **Eval Scorecard (this)** — grade a run
3. **[Agent Receipt](https://github.com/smfworks/agent-receipt)** — what ran
4. **[Session Timeline](https://github.com/smfworks/session-timeline)** — the log
5. **[Context Budget](https://github.com/smfworks/context-budget)** — the tokens
6. **[Refuse Card](https://github.com/smfworks/refuse-card)** — the gate

Also nearby: [Agent Contract](https://github.com/smfworks/agent-contract) · [Paste → Skill](https://github.com/smfworks/paste-to-skill) · [Prompt Diff](https://github.com/smfworks/prompt-diff) · [Tool Permit](https://github.com/smfworks/tool-permit)

## Quickstart

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

```bash
npm run build
npm run preview
npm test
```

Node 20+ (22 recommended). Client-side only — no auth, no backend, no API keys, no secrets.

`?sample=agent-bench-pass` (or `tool-use-mixed`, `safety-fail`, `rubric-graded-essay`) loads a public sample.

## Use it

1. Paste eval JSON, a markdown report, or freeform judge notes. Optional title / suite / model / date.
2. The card renders immediately (heuristics, under a second): band stamp, overall %, criteria rows, up to five fix hints.
3. Tweak GREEN / YELLOW cutoffs if your harness uses different bands.
4. **Download PNG**, **Copy share text**, or **Copy JSON**. **Reset** clears the compositor.

The parser is approximate on purpose. Footer on every card: **Heuristic grade — not a lab cert.**

## Bands

Default cutoffs (editable in the UI):

| Band | When |
| --- | --- |
| **GREEN** | Score ≥ 80, **or** every criterion passed |
| **YELLOW** | Score 50–79 |
| **RED** | Score &lt; 50 |

## Samples

Shipped in [`public/samples/`](public/samples/):

| File | Expect |
| --- | --- |
| `agent-bench-pass.json` | GREEN |
| `tool-use-mixed.json` | YELLOW |
| `safety-fail.json` | RED |
| `rubric-graded-essay.json` | YELLOW (points / max → 0–100) |

## Schema

Canonical JSON Schema: [`public/schema/eval-scorecard.schema.json`](public/schema/eval-scorecard.schema.json)

```json
{
  "schemaVersion": "eval-scorecard/v1",
  "score": 92,
  "band": "GREEN",
  "title": "Agent bench · tool loop",
  "criteria": [
    { "name": "Task completion", "score": 100, "note": "All tasks finished." }
  ],
  "hints": ["Drop the redundant search on task 7."],
  "heuristic": true
}
```

Loose harness JSON is fine (`overall.score`, `checks`, `rubric`, `verdict`, `recommendations`, …). Markdown tables and “Score: 81” lines work too.

## Stack

Vite + React 19 + TypeScript. Grading is client-side heuristics (no model, no keys). PNG export via `html-to-image`. Fonts: Inter, Space Grotesk, JetBrains Mono. Palette: navy `#0A0F1F`, cyan `#00D4FF`, ember `#ea580c`, plus green / yellow / red bands.

Static files from `npm run build` (output: `dist/`). `vercel.json` rewrites unknown paths to `index.html` for SPA hosting.

## Built by SMF Works

[SMF Works](https://smfworks.com) is a human-AI research lab. We publish what we learn, ship open agent tools, and install stacks on hardware you own.

Intelligence is abundant. Judgment is the product.

- Lab: [smfworks.com](https://smfworks.com)
- GitHub: [github.com/smfworks](https://github.com/smfworks)
- X: [@MichaelGannotti](https://x.com/MichaelGannotti)

MIT licensed. No medical or legal claims. This is a shareable grade card, not a certification, not an audit, and not a hosted agent.

## License

[MIT](LICENSE) © 2026 SMF Works

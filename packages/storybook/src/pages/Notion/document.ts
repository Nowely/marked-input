/**
 * The probe's reference document: a Notion page exported in the OKF / Obsidian shape —
 * YAML frontmatter, headings, prose, a bullet list, tables, a fenced code block, a
 * blockquote, mentions and links.
 *
 * It is written as the exporter would write it, NOT as the parser would prefer it. Where the
 * two disagree the story is expected to look wrong, and the tracker gets a ticket
 * (`docs/scratch/notion-like/`): the point of the probe is to find those places, so the
 * fixture may not dodge them.
 *
 * Rows are separated by `'\n\n'` (the default), and a single `'\n'` is a soft break INSIDE a
 * row — which is what the table, the frontmatter and the tight list are made of.
 */
export const APOLLO_DOC = `---
type: Product Launch
title: Apollo — Q2 launch plan
status: in_progress
owner: sarah.chen@acme.com
timeline: 2026-03-03 → 2026-06-15
confidence: 0.82
---

# Apollo — Q2 launch plan

Apollo moves our collaboration layer from beta to general availability. Ownership sits with @[Platform](team-platform), with launch gating on the auth migration — everything downstream assumes it ships first.

## Launch tasks

24 items, 9 done. Individual tasks are separate concepts.

| Task | Status | Owner | Due |
| --- | --- | --- | --- |
| Auth service migration | blocked | @[Sarah Chen](sarah.chen) | 2026-04-02 |
| Realtime sync engine | in_progress | @[Marcus Kane](marcus.kane) | 2026-04-18 |
| Pricing page rewrite | done | @[Jia Lin](jia.lin) | 2026-03-27 |
| Load test at 5× peak | planned | @[Amara Reed](amara.reed) | 2026-05-06 |

## Metrics

| Metric | Value | As of |
| --- | --- | --- |
| Beta users | 4120 | 2026-04-03 |
| p95 latency | 184ms | 2026-04-03 |
| Crash-free sessions | 99.4% | 2026-04-03 |
| Open bugs | 37 | 2026-04-03 |

## Risks

- **Auth migration slipped two weeks.** GA holds only if cutover lands by 2026-04-09.
- Vendor SLA unsigned.
- EU region capacity unconfirmed — awaiting quota approval.
- Support headcount at 60%.

## Decision log

- 2026-04-02 — [Ship without offline mode](../decisions/2026-04-02-defer-offline-mode.md)
- 2026-03-21 — Single-region GA first
- 2026-03-12 — Adopt CRDT over OT

## Canary procedure

\`\`\`bash
apollo deploy --env=staging --canary=5%
# → rollout 5% · healthy · p95 184ms
\`\`\`

> If the cutover isn't boring, we're not ready to call it GA.

See the [Apollo architecture RFC](https://github.com/acme/apollo/rfcs/0042) for the conflict-resolution and presence protocols.`
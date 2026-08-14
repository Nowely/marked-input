# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in. Also check `packages/<pkg>/docs/adr/` for package-scoped decisions.
- **`packages/website/src/content/docs/development/`** — the current-state architecture docs. `docs/adr/` records why a decision was taken and what it cost; these describe how the system works today. When they disagree, the code decides and the stale one gets fixed.
- **`docs/records/`** — the long-form evidence an ADR was decided on: measurements, probe tables, traces, subsystem maps. Read one only when the ADR's summary is not enough; they are dated snapshots and are not maintained against the current tree.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

This repo is single-context: one root `CONTEXT.md`, no `CONTEXT-MAP.md`. Despite the pnpm workspace, the packages serve one product — a core runtime plus thin framework adapters — and share one domain language.

```
/
├── CONTEXT.md
├── docs/
│   ├── adr/          one decision per file, a paragraph each
│   │   ├── 0001-....md
│   │   └── 0002-....md
│   └── records/      the evidence those decisions were taken on
└── packages/
    ├── core/
    ├── react/
    ├── vue/
    ├── storybook/
    └── website/
```

An ADR is short by design — the shape is a title and one to three sentences saying what was decided and why, per the `/domain-modeling` skill's format. When a decision rests on measurements too large to inline, they go to `docs/records/` and the ADR links them.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_

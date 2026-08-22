# Stale premises sweep

Type: task
Status: open

## Question

Three comments still claim block mode filters empty text tokens —
`tree/types.ts:12`, `tree/types.ts:147`, `tree/anchors.ts:39-43` — while the
filter is gone (`groupRows` now *adds* edge text tokens;
`RowBuilder.ts:168-173`). Verify and fix the comments.

Backlog retriage on the same premise: `09-block-gap-caret.md` rests on the
dead filter; `15-block-row-whose-slot-starts-with-a-mark.md` reproduces with
`new Parser(['__slot__\n\n', ...])`, which post-ADR-0009 should throw at
registration (a leading-gap markup is invalid) — verify the hypothesis and
retriage both files.

This unblocks correct premises for 01–03. Code touched: comments only.

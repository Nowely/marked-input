# Stale premises sweep

Type: task
Status: resolved

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

## Answer

**Resolved 2026-08-22.** The filter is gone; the census undercounted the stale sites; both backlog
issues close as non-reproducing.

### 1. Verification

`parser/utils/filterEmptyText.ts` was deleted in `31fac6d1` (#291). `ls` of that directory shows
seven files, none of them it; a repo-wide grep finds 11 references, **all** in historical records
(`docs/records/*` — self-labelled "Historical record"), the frozen `token-born-edit` issue 08, and a
superseded profile in `incremental-parser/spec.md`. Zero in `packages/`. `valueBoundary.ts:71-73`
holds one layout fork and no filtering step:
`separator !== undefined ? parseRowsValue(...) : parseValue(...)`. **Proven.**

### 2. Stale sites: nine, not three

The census's three, plus six it did not find:

| Site | What it claimed | Disposition |
| --- | --- | --- |
| `tree/types.ts:10-13` | pairing is "post-filter on both sides" | reworded — one space because nothing sits between parse and tree |
| `tree/types.ts:146-147` | "a block row can be a text node" | **deleted** — dead twice: no filter, and block roots are `RowNode` only |
| `tree/anchors.ts:39-43` | block filters a leading mark's brackets | reworded to the measured reachability |
| `tree/tree.ts:209` | "empty-text filtering is top-level only" | filter clause dropped |
| `tokens/README.md:500` | "block mode then filters empty text tokens" | replaced with the real fork |
| `tree/anchors.spec.ts:63-65` | "block layout is exactly the mode that filters those away" | reworded |
| `keyboard/input.spec.ts:151-154` | fixture docblock, same claim | reworded; the fixture stays as a regression gate |
| `seam/TokenModel.parse.spec.ts:144` | test NAME implies a filter in some other layout | renamed; assertions untouched |
| `backlog/issues/28.md:21` | "a top-level empty text token is filtered away" | cause corrected to ADR-0004's 0px bare span |

Deliberately untouched: `docs/records/*`, `docs/scratch/token-born-edit/*` (frozen decision record —
its issue 08:24 link to `filterEmptyText.ts` is now a dead path, flagged not fixed), `docs/adr/0009:39`
(past tense, correct as history).

### 3. Backlog 09 — closed, does not reproduce

Block layout, `@[a](1)X@[b](2)`, separator `'\n\n'`, caret at 8, delete the `X`
(`applyRange({start:7,end:8,insertedLength:0}, '')`) → the repaired caret is `text[7,7]+0`, i.e.
offset 7, **the deletion site**. The row survives as
`row[0,14]{text[0,0], mark[0,7], text[7,7], mark[7,14], text[14,14]}`; inline layout on the same
value answers identically. No divergence to compare, no design table owed. Status `needs-info` →
`wontfix`, with the measurement recorded in the file. Not driven end-to-end through `blockEdit` +
real DOM — the alleged mechanism is disproven at the layer it lived in.

### 4. Backlog 15 — closed, moot in every form

The hypothesis holds: `new Parser(['__slot__\n\n', '@[__value__]'])` throws
`Invalid markup: "__slot__\n\n". A markup must not begin with a placeholder …`
(`MarkupDescriptor.validateMarkup`). And the defect does **not** survive in a legal shape, so it does
not get rewritten: `parseRows('@[x]\n\nplain', '\n\n')` opens the mark-first row
(`ROW "@[x]↲↲"[0-6]{TEXT ""[0-0], MARK "@[x]"[0-4], TEXT ""[4-4]}`), and a slot whose content starts
with a mark parses too (`#[@[x] tail]` → `mark[0,12]{text ""[2,2], mark "@[x]"[2,6], text " tail"[6,11]}`).
Its trailing note — that `anchors.spec.ts` could stop assembling its nested-first tree "once this is
fixed" — is **permanently** false: every legal markup begins with a literal segment, so a nested mark
can never be flush with its parent's start. Status `ready-for-human` → `wontfix`.

### 5. Found while sweeping — not applied

`anchorAt`'s `side` parameter is production-dead. Replacing `anchors.ts:44` with
`if (owner) return {after: owner}` leaves the core suite at 1005/1006 — the sole failure is
`anchors.spec.ts:68`, which builds `roots = [mark]` by hand — and 174 browser assertions in
`Base/keyboard.spec.ts` + `Drag.spec.ts` stay green. Cause: every parsed tree now covers offset 0
with a text node, so the `owner` fallback is unreachable at a mark's start. Deleting it drops one
signature arg, one branch, one test case, and the last argument for `selection.ts:97`'s second
argument. Needs its own yes — it is a signature change, not a comment.

### 6. Apply note

The two `types.ts` docblock edits shorten the file by 3 lines, so `pnpm run typecheck` regenerates
four checked-in typedoc files (`api/interfaces/MarkNode.md`, `TextNode.md`,
`api/type-aliases/NodeAnchor.md`, `TreeNode.md`) with pure `#LNN` shifts. Verified causal: revert
`types.ts` and those four stay clean. Run typecheck after applying and commit the regeneration with
the change.

### 7. Closure route (maintainer decision, 2026-08-22)

Both issues were closed the way `docs/scratch/backlog/README.md` prescribes — moved into
`issues/closed.md` under a `## Closed 2026-08-22` heading and their files deleted — rather than left
in place as `Status: wontfix` files.

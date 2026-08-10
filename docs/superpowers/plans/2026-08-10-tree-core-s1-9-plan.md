# Tree Core S1.9 (Directory regroup) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** give `features/tokens/` the shape the code already has. Four folders —
`parser/` (string → tokens), `tree/` (the source of truth), `dom/` (the
contenteditable adapter), `seam/` (`TokenModel`, the one object that owns both) —
and a root that holds `index.ts`, the README, the parser benchmark and
`__testing__/` and nothing else. `serializeRange` leaves the token layer for its
only consumer. Per spec `2026-08-08-markput-s1-tree-core-v2.md` (v2.2) §9, which
defers the regroup to this phase, and the S1.8 plan's decision D-d, which
confirmed the deferral with measurements.

**Architecture:** nothing here changes a symbol, a signature, a contract or a
test. Every production change in this phase is a file path or a comment that
named one. The adapters and the two published packages are **not touched at all**
(measured: zero files under `packages/{react,vue}/markput/src` or
`packages/storybook/src` change).

**Tech stack:** TypeScript, `git mv`, oxfmt's `sortImports` (which does the
import re-ordering for you and will not do it the way you wrote it), oxlint with
`import/no-cycle: 'error'`, Vitest (three Chromium browser projects — even the
`core` project runs in real Chromium, `vite.config.ts:39`), Astro/Starlight +
starlight-typedoc for the website.

**Prerequisites:** S1.1–S1.8 complete and committed on `b0` (`12ead317..5a0efc89`).

## Plan status / Verification status

**Written** 2026-08-10 against `5a0efc89`. **Verified by implementation**
2026-08-10: all four tasks were implemented in a throwaway worktree detached at
`5a0efc89`, every gate was run at every task boundary, all four commits were then
checked out clean and re-gated, and the two riskiest claims of the phase — "blame
survives" and "a barrel would create a cycle" — were tested directly rather than
asserted. Everything below is labelled: *measured* claims carry their command or
`file:line`.

**Baseline reproduced** at `5a0efc89`: `pnpm test` → **72 files, 1323 passed, 7
todo (1330)**; `typecheck` 0 errors, `lint:check` clean, `format:check` clean,
`pnpm run build` clean, `pnpm -F @markput/website run build` clean (49 pages),
and `git status` clean after every one of them.

**Final state with every correction folded in:** `pnpm test` → **72 files, 1323
passed, 7 todo (1330)** — byte-identical to the baseline, because this phase adds
and removes no test. `typecheck` 0, `lint:check` clean, `format:check` clean,
`build` clean, website build clean (49 pages). Diff against the baseline: **36
files changed, +90 / −79 — net +11 lines**, and the +11 is the README's new
`## Layout` table. 28 renames, 0 files added, 0 deleted.

**Green at every task boundary — verified, not asserted.** Each of the four
commits was checked out (`git checkout <sha> && git clean -qfd packages/core/src`)
and re-gated:

| commit | `pnpm test` | tsc errors | lint | format | diffstat |
| --- | --- | --- | --- | --- | --- |
| Task 1 | 72 files, 1323 passed, 7 todo | 0 | clean | clean | 2 files, +4/−4 |
| Task 2 | 72 files, 1323 passed, 7 todo | 0 | clean | clean | 10 files, +11/−14 |
| Task 3 | 72 files, 1323 passed, 7 todo | 0 | clean | clean | 17 files, +41/−41 |
| Task 4 | 72 files, 1323 passed, 7 todo | 0 | clean | clean | 19 files, +38/−24 |

**Blame survives — measured, not hoped.** All 28 renames are detected by git at
the default `-M50%` threshold, and `git log --follow` walks through every one of
them into pre-S1.9 history:

| file | similarity | `git log --follow` reaches |
| --- | --- | --- |
| `tokens/dom/TokenHandle.ts` (moved AND edited) | R095 | `6170e0b2`, `cae62e83`, `ad5838b0`, `39c721fe` |
| `tokens/tree/valueBoundary.ts` (renamed, 0 edits) | R100 | `e1b84447` … `28e47f58` (the S1.4 boundary series) |
| `clipboard/serializeRange.ts` (moved across features) | R082 | `39c721fe`, `647f7d73` |
| `tokens/seam/TokenModel.parse.spec.ts` (moved AND renamed AND edited) | R097 | `a401d72e`, `39c721fe`, `9dd769c7`, `60722739` |

`git blame` on `dom/domBoundary.ts` attributes its lines to `39c721fe`, the
commit that wrote them, not to the S1.9 move. **11 of the 28 renames are R100 —
literally zero content change**; the other 17 change 1–6 lines each; the
worst-case similarity in the whole phase is R082.

### Hard stops found (all fixed in place below, each marked `[HARD STOP]`)

1. **Two filename collisions the target layout does not mention, and one of them
   makes `git mv` fail.** The brief names `boundary.ts` as *the* collision. There
   are three. `TokenModel.spec.ts` exists at the tokens root **and** at
   `model/TokenModel.spec.ts`, and both are supposed to land in `seam/` —
   `git mv TokenModel.spec.ts seam/` aborts with *destination exists*.
   `TokenHandle.spec.ts` exists at the root **and** at `model/TokenHandle.spec.ts`;
   that pair only escapes because the two land in different folders (`seam/` and
   `dom/`). Resolution and reasoning in D-f.
2. **oxfmt's `sortImports` re-orders every import block whose paths you touch,
   and it will not match what you wrote.** Measured on two files. In
   `ClipboardController.ts`, `'./serializeRange'` sorts *after* `'./pasteMarkup'`,
   not where the replaced line was. In `seam/TokenModel.ts`, changing 4 paths
   moved 4 import lines out of the `./` block into the `../dom/` block: a
   4-line edit produced a 12-line diff. **Consequence for this plan:** the import
   blocks printed below are the *result*, not the input; every gate LEADS with
   `pnpm run format`, and you must not hand-place a rewritten import.
3. **`import/no-cycle` is on and works, but is blind to `import type` — so "lint
   will catch a bad barrel" is FALSE here.** A two-file value cycle planted under
   `packages/core/src/` is reported twice (*"error import(no-cycle): Dependency
   cycle detected"*). A barrel-mediated cycle
   `dom/index → dom/commit → seam/index → seam/commitInput → dom/index`, built
   for real in the worktree, produced **zero diagnostics** — because the
   `dom → seam` edge is `import type`. The no-barrel decision (D-c) therefore
   stands on design grounds, not on the linter.

### Predictions this plan made before the run that turned out FALSE

- **"`SelectionController` deep-imports `tokens/tree/anchors`, so deep
  cross-feature imports already exist."** **False, measured.**
  `SelectionController.ts:9-10` imports `anchorEquals` and four types from
  `'../tokens'` — the root barrel. At `5a0efc89` **six** files outside
  `features/tokens/` deep-import into it, and **three** of those reach past
  `parser/**`: `clipboard/ClipboardController.ts` (`utils/serializeRange`, which
  Task 1 removes) and `store/MarkputApi.ts` + `.spec.ts` (`model/commitInput`,
  plus `tree/types` in the spec). The other three —
  `shared/{constants,types}.ts` and `block/operations.spec.ts` — name only
  `parser/**`, which does not move. The premise that motivated sub-barrels does
  not exist.
- **"Two commits: one pure `git mv`, then one import rewrite, so blame
  survives."** **Dropped — the premise is wrong.** Git records no renames; it
  detects them at diff time by content similarity, so splitting the commit buys
  exactly nothing and costs a red tree. See D-b, and the similarity table above.
- **"typedoc will regenerate `content/docs/api/**` and dirty the repo."**
  **False, measured.** `pnpm run typecheck` does run starlight-typedoc in the
  website package (*"[starlight-typedoc-plugin] Found 0 errors"*), but every
  `Defined in:` link in `api/**` points at `tokens/tree/types.ts` or
  `tokens/parser/**`, and **neither moves in this phase**. `git status` was clean
  after every `typecheck` and after `pnpm -F @markput/website run build`.
- **"An adapter or storybook deep-imports a moved file."** **False for this
  phase, but the trap class is real.** `packages/storybook/src/pages/Base/Base.vue.spec.ts:9`
  imports `'../../../../core/src/store/Store'` — a relative reach straight into
  core's source tree. It happens to target `store/`, not `features/tokens/`.
  Grep for it anyway before any future move under `packages/core/src`.
- **"A red intermediate commit is unavoidable somewhere."** False. Every one of
  the four commits is green on a clean checkout.

### One non-finding, recorded so it is not re-reported

During the first re-gate loop the Task 1 commit reported *1 failed file, 1317
passed*. It is an artifact of the loop, not of the change: the loop used
`git checkout <sha> -- .` before switching commits, which leaves files from the
later tree in place. A clean `git checkout <sha> && git clean -qfd` of the same
commit is **72 files, 1323 passed** on three subsequent runs.

**Gates.** Every per-task gate LEADS with `pnpm run format` and includes
`pnpm run lint:check`: the pre-commit hook runs `lint-staged` → `pnpm run lint`
+ `pnpm run format`, and `oxlint` runs with `denyWarnings` and
`reportUnusedDisableDirectives: 'deny'` (`oxlint.config.ts:147-148`), so a
tests-only gate defers the failure to `git commit`. In this phase `format` is not
merely a gate, it is *part of the edit* (hard stop 2). All four tasks run the
FULL `pnpm test` — the token layer is what the three browser projects exercise,
and a wrong path is a module-resolution failure that a core-only run can still
miss when the miss is in a `.vue`/`.tsx` consumer. Task 4 adds the website build.

**Revert units.** Four tasks, four commits, four revert units. Tasks 1 and 2 are
independent of everything. Task 4 depends on Task 3 only in the trivial sense
that it rewrites a line Task 3 wrote (`dom/commit.ts`'s `commitInput` import);
reverting Task 3 alone leaves that import pointing at `../seam/commitInput`,
which is still correct after Task 4 landed. Reverting Task 4 alone is clean.

---

## Decisions taken before writing this plan (do not re-litigate)

### D-a. Variant B — four folders — is the maintainer's call, and there is no import-direction rule

Four folders (`tree/`, `dom/`, `seam/`, `parser/`), not three. The seam folder is
named `seam/`. The colliding `boundary.ts` pair becomes `dom/domBoundary.ts` and
`tree/valueBoundary.ts`. **No `no-restricted-imports` rule, no zone config, and
no "layering" test** — the variant that added one was considered and rejected.
The layering is documented in the README and enforced by review, which is the
same way every other ownership boundary in this repo is enforced (AGENTS.md,
"Keep ownership boundaries explicit").

Do not add one opportunistically while executing. If a future edge violates the
direction, that is a design conversation, not a lint failure.

### D-b. [HARD STOP] Moves and import rewrites land TOGETHER, per folder. The two-commit shape is dropped

The spec §9 promises "pure-move commits (no content edits), so it does not
destroy the git blame". The obvious reading — commit the `git mv`s alone, then
commit the import rewrites — is **based on a false model of git** and is not
taken.

**Measured:** git stores no rename. `git mv` is `mv` + `git add`/`git rm`;
renames are *detected at diff time* by content similarity (default `-M50%`), by
`git log --follow`, by `git blame`, and by every UI built on them. A file moved
*and* edited in one commit is detected exactly as well as one moved alone, as
long as similarity clears the threshold. In this phase the **worst similarity in
28 renames is R082** (`serializeRange`: 3 of 21 lines are imports) and
`git log --follow` reaches its pre-move history through two prior renames. There
is no blame to save by splitting.

Against that zero benefit, a pure-`git mv` commit costs:

- **A red tree.** At the instant of the move commit every importer of every moved
  file is broken — `tsc` fails, the suite cannot even load. AGENTS.md: "Keep
  every task and commit green: typecheck and tests pass at each boundary, with no
  caller left referencing a removed or renamed symbol."
- **A broken bisect and a useless revert.** The move commit is not independently
  revertible in either direction.
- **A worse diff, not a better one.** Split across two commits, a reviewer must
  hold the move in their head while reading the rewrites. Together, each commit
  is one folder's worth of "this file moved, and here is every line in the repo
  that said where it was" — which is exactly the unit a reviewer checks.

**Therefore:** one commit per folder, `git mv` and every import/comment/README
line it invalidates in the same commit. The spec's "no content edits" is honoured
in the only sense that is achievable and the only sense that matters: **no
behavior, no symbol, no signature and no test changes**, and the plan says so
plainly instead of promising something git does not need.

**What genuinely cannot be a pure move**, measured over the 28 renames:

| category | count | example |
| --- | --- | --- |
| pure move, zero content change (R100) | 11 | `model/bind.ts` → `dom/bind.ts`; `tree/boundary.ts` → `tree/valueBoundary.ts` |
| import paths only | 12 | `caret.ts` → `dom/caret.ts` (one `../../shared` → `../../../shared`) |
| import paths + a comment that named a moved file | 4 | `dom/TokenHandle.ts` (three comments named `tokens/boundary.ts`) |
| renamed because the destination name was taken | 1 | root `TokenModel.spec.ts` → `seam/TokenModel.parse.spec.ts` |

### D-c. No `tree/index.ts`, no `dom/index.ts`, no `seam/index.ts`

Importers reach in directly, which is what every file inside the feature already
does. Four reasons, in order of weight:

1. **No consumer wants one.** Measured at `5a0efc89`, the entire set of files
   outside `features/tokens/` that deep-import into it is six:
   `clipboard/ClipboardController.ts` (→ `utils/serializeRange`, which Task 1
   removes by moving the file out), `store/MarkputApi.ts` and
   `store/MarkputApi.spec.ts` (→ `model/commitInput`, and `tree/types` in the
   spec), `shared/constants.ts`, `shared/types.ts` and
   `block/operations.spec.ts` (→ `parser/**`, unmoved). Everything else — **23
   import sites across 20 files** — goes through `features/tokens/index.ts`.
   After Task 1 a sub-barrel would have exactly **one** cross-feature consumer
   pair, `store/MarkputApi.ts{,.spec.ts}` → `seam/commitInput`, for one type.
   AGENTS.md: "Don't add public surface … without a current caller."
2. **A barrel is how you build the cycle this repo lints for, and the linter will
   not save you.** `oxlint.config.ts:25` sets `import/no-cycle: 'error'`, and it
   fires on a planted value cycle. But the realistic barrel cycle here
   (`dom/index → dom/commit → seam/index → seam/commitInput → dom/index`) was
   built in the worktree and reported **nothing**, because the closing edge is
   `import type`. The risk is real and unpoliced: `seam/TokenModel.ts` imports
   `createCommitPipeline` — a *value* — from `dom/`, so one value import added to
   `dom/`'s side of the seam turns two barrels into a runtime cycle.
3. **A barrel silently changes what is exported.** `export * from './snapshot'`
   in a `tree/index.ts` publishes `stripIds`, a §7.1 test-only helper, as feature
   surface. `features/tokens/index.ts` is deliberately an explicit 14-line list,
   and its comment at `:7-10` records that even `NodeAnchor` was placed there by
   a plan decision rather than re-exported wholesale.
4. **`index.ts` at the tokens root keeps its meaning.** One export point for the
   package; four more would raise the question of which one a consumer should
   use, and the answer would still be "the root one".

### D-d. Folder order: `tree/` → `dom/` → `seam/`, and the order is measured, not aesthetic

The real dependency picture at `5a0efc89`, by target folder (production imports;
`shared/` and `features/state` omitted, they are outside the feature):

| from ↓ / to → | `parser/` | `tree/` | `dom/` | `seam/` |
| --- | --- | --- | --- | --- |
| `tree/` | yes (7 files) | — | **no** | **no** |
| `dom/` | yes (5 files) | **no** | — | **1 type import** (`commit.ts` → `commitInput`) |
| `seam/` | yes | yes (8 modules) | yes (4 modules) | — |
| `parser/` | — | **no** | **no** | **no** |

Read off it: `parser/` and `tree/` are leaves, `dom/` is almost a leaf, `seam/` is
the only folder that imports both sides. So:

- **`tree/` first** (Task 2) — it has zero inbound edges from `dom/` or `seam/`,
  so nothing else has to move for it to be finished.
- **`dom/` before `seam/`** (Tasks 3, 4) — measured cost of each order in
  *lines rewritten twice*: `dom` first rewrites **1** line twice
  (`dom/commit.ts`'s `commitInput` import goes `./` → `../model/` → `../seam/`);
  `seam` first rewrites **4** lines twice (`TokenModel.ts`'s `commit`,
  `editableState`, `TokenHandle` and `DomModel` imports). `dom` first also leaves
  the smaller broken window: after Task 3, `model/` contains only `TokenModel.ts`
  and its two seam modules, which is one `git mv model seam` away from done.
- **`git mv model seam` renames the whole directory in one command**, and every
  relative import *inside* those files survives untouched, because `model/` and
  `seam/` sit at the same depth. Measured: 4 of the 6 files in that directory are
  R100.
- **The one upward edge is real and is not "fixed" here.** `dom/commit.ts` takes
  `CommitInput`/`CommitChange`/`TokenDelta` from `seam/commitInput.ts`. The
  maintainer put `commitInput.ts` in `seam/`; that is settled. It is a type-only
  edge, it creates no cycle, and the README says so out loud rather than
  pretending the layering is strictly downward. If someone later wants it strict,
  the move is `commitInput.ts` → `dom/`, one line in three files — not this
  phase's business.

### D-e. `serializeRange` goes to `features/clipboard/`, and it really does have exactly one consumer

**Measured:** `grep -rn "serializeRange" packages/ docs/` → two production hits
outside the file itself, both `ClipboardController.ts` (`:7` import, `:43` call).
Nothing else in core, neither adapter, no storybook, no website doc.

**It belongs in `clipboard/`, not in `shared/` and not in `tokens/`.** What it
does is clipboard policy: it trims a token list to a range and re-serializes it
through the parser's `toString`, deliberately promoting a half-selected mark to
full markup so the `MARKPUT_MIME` payload round-trips. The token layer has no
opinion about that; the clipboard feature is the only thing that does, and
`ClipboardController.ts:43` is the one line that has it. Moving it also removes
the last deep cross-feature import into `features/tokens/` apart from
`parser/**` and `seam/commitInput` (D-c).

**Pre-existing, not fixed here:** `serializeRange` has no spec of its own. Its
behaviour is covered indirectly by the clipboard browser suites. Flagged, not
scoped in — this phase adds no test.

### D-f. [HARD STOP] Where the specs go, including the two collisions the target layout does not mention

Specs move with their subjects. Doing that mechanically hits three name
collisions, not the one the brief names:

| collision | resolution | why |
| --- | --- | --- |
| `boundary.ts` (root, DOM) vs `tree/boundary.ts` (string) | `dom/domBoundary.ts` / `tree/valueBoundary.ts` | settled by the maintainer (D-a) |
| `TokenModel.spec.ts` (root) vs `model/TokenModel.spec.ts` — **both target `seam/`** | `model/`'s keeps the plain name → `seam/TokenModel.spec.ts`; the root one → `seam/TokenModel.parse.spec.ts` | `model/TokenModel.spec.ts` is already `TokenModel.ts`'s sibling spec and stays one — a pure move. The root file is the odd one out: it pins the parse path (`auto-parse on value change`, `reactive parse`, `signal ordering guarantee`, `block layout empty text filtering`, `keyOf`) and it already had four `TokenModel.<aspect>.spec.ts` siblings at the root. It joins them. |
| `TokenHandle.spec.ts` (root) vs `model/TokenHandle.spec.ts` | **not a collision — left alone.** Root → `seam/TokenHandle.spec.ts`, `model/` → `dom/TokenHandle.spec.ts` | They land in different folders, so nothing is forced. Renaming either would be churn (AGENTS.md: "Don't rename without a concrete reason"). The split is also accurate: `dom/`'s constructs `new TokenHandle(…)` directly; `seam/`'s only ever goes through `store.tokens.handleAt/handle` — the published face. |

The rest, and the one that reads oddly:

- **The six Store-driven root specs go to `seam/`** (`TokenModel.parse`,
  `.changed`, `.facade`, `.index`, `.value`, and `TokenHandle.spec.ts`). Every
  one of them mounts a `Store` and drives `store.tokens.*`; `store.tokens` **is**
  `seam/TokenModel`. Leaving them at the root would keep six spec files beside
  `index.ts` and half-defeat the regroup.
- **`treePipeline.spec.ts` stays with `treeInput.ts` in `seam/` — recorded as
  the one odd read.** Its construct-under-test is `createCommitPipeline`, which
  lives in `dom/`, and it imports from `tree/` (4 modules), `dom/` (2) and
  `seam/` (2). It is the three-folder integration suite, and `seam/` is where the
  three folders meet; putting the integration suite in `dom/` would say the
  pipeline is a DOM-only concern, which is the opposite of what the suite proves.
  A reader opening `seam/treePipeline.spec.ts` and finding `import … from
  '../dom/commit'` at the top is the honest cost of that call.
- **`__testing__/tokenFactories.ts` stays at the tokens root.** After the
  regroup it is consumed from `dom/` (`bind.spec.ts`, `TokenHandle.spec.ts`) and
  `seam/` (`TokenModel.spec.ts`) — it is genuinely cross-folder, which is what
  the root is for.

### D-g. `index.ts`, `parser.bench.ts`, `parser.bench.result.json`, `README.md` and `__testing__/` stay at the root — checked, nothing forces them out

- `index.ts` — the package-facing barrel; it names files in all four folders.
- `parser.bench.ts` + `parser.bench.result.json` — the spec §8 tripwire. It
  imports only `./parser/Parser`, so `parser/` would work, but the tokens README
  names it by path in four places (`:338,356,365,370`) and
  `packages/core/package.json`'s `bench` script globs `packages/core/src/**`
  either way. Moving it is churn with no reader.
- `README.md` — documents all four folders; gains a `## Layout` table in Task 4.
- `__testing__/` — see D-f.

Nothing in the four had a reason it could not stay, so all five stay.

### D-h. Comment and README path references are fixed by the task that invalidates them — there is no trailing docs task

**Measured:** 22 places name a path this phase changes — 12 in `.ts` doc
comments, 10 in `features/tokens/README.md`. If they are batched into a fifth
commit, three of the four commits ship a README that lies about the directory it
describes. Each task therefore fixes exactly the references it breaks, and the
final grep in each task's gate proves none survive.

Three of the comments exist **only** to disambiguate the `boundary.ts` twin
(`model/TokenHandle.ts:36`, `model/treePipeline.spec.ts:6-7` and `:520-521`) —
Task 2 deletes the disambiguation rather than re-pointing it, which is the
rename's payoff.

`docs/superpowers/plans/*.md` are **not** rewritten. They are the record of what
the tree looked like when they were written; rewriting history to match the
present is how a plan archive becomes worthless. (They are also in oxfmt's
`ignorePatterns`, so nothing checks them.)

### D-i. What this phase does NOT do

Not the render-loop move (S1.10, per S1.8's D-a). Not undo/redo. Not the block
rows follow-up or the offset shim (spec D8). No file is deleted, no file is
created except a README section, no test is added or removed, and
`packages/{react,vue}/markput/src` and `packages/storybook/src` are not touched.

---

## File structure

**Move (28 renames, none deleted, none created):**

| from | to | change |
| --- | --- | --- |
| `tokens/utils/serializeRange.ts` | `clipboard/serializeRange.ts` | 3 import paths |
| `tokens/utils/findGap.ts` | `tokens/tree/findGap.ts` | none |
| `tokens/utils/findGap.spec.ts` | `tokens/tree/findGap.spec.ts` | none |
| `tokens/tree/boundary.ts` | `tokens/tree/valueBoundary.ts` | none |
| `tokens/tree/boundary.spec.ts` | `tokens/tree/valueBoundary.spec.ts` | 2 import paths |
| `tokens/DomModel.ts` | `tokens/dom/DomModel.ts` | 4 import paths |
| `tokens/boundary.ts` | `tokens/dom/domBoundary.ts` | 2 import paths |
| `tokens/caret.ts` | `tokens/dom/caret.ts` | 1 import path |
| `tokens/caret.spec.ts` | `tokens/dom/caret.spec.ts` | none |
| `tokens/textOffsets.ts` | `tokens/dom/textOffsets.ts` | 1 import path |
| `tokens/model/TokenHandle.ts` | `tokens/dom/TokenHandle.ts` | 2 import paths + 4 comments |
| `tokens/model/TokenHandle.spec.ts` | `tokens/dom/TokenHandle.spec.ts` | none |
| `tokens/model/bind.ts` | `tokens/dom/bind.ts` | none |
| `tokens/model/bind.spec.ts` | `tokens/dom/bind.spec.ts` | none |
| `tokens/model/commit.ts` | `tokens/dom/commit.ts` | 1 import path |
| `tokens/model/editableState.ts` | `tokens/dom/editableState.ts` | none |
| `tokens/model/TokenModel.ts` | `tokens/seam/TokenModel.ts` | (rewritten in Task 3) |
| `tokens/model/TokenModel.spec.ts` | `tokens/seam/TokenModel.spec.ts` | 1 `describe` string |
| `tokens/model/commitInput.ts` | `tokens/seam/commitInput.ts` | none |
| `tokens/model/treeInput.ts` | `tokens/seam/treeInput.ts` | none |
| `tokens/model/treeInput.spec.ts` | `tokens/seam/treeInput.spec.ts` | none |
| `tokens/model/treePipeline.spec.ts` | `tokens/seam/treePipeline.spec.ts` | (rewritten in Tasks 2–3) |
| `tokens/TokenModel.spec.ts` | `tokens/seam/TokenModel.parse.spec.ts` | **renamed** + 2 import paths |
| `tokens/TokenModel.changed.spec.ts` | `tokens/seam/TokenModel.changed.spec.ts` | 2 import paths |
| `tokens/TokenModel.facade.spec.ts` | `tokens/seam/TokenModel.facade.spec.ts` | 1 import path |
| `tokens/TokenModel.index.spec.ts` | `tokens/seam/TokenModel.index.spec.ts` | 3 import paths |
| `tokens/TokenModel.value.spec.ts` | `tokens/seam/TokenModel.value.spec.ts` | 1 import path |
| `tokens/TokenHandle.spec.ts` | `tokens/seam/TokenHandle.spec.ts` | 1 import path |

**Directories that disappear:** `tokens/utils/`, `tokens/model/`.
**Directories that appear:** `tokens/dom/`, `tokens/seam/`.

**Modify (not moved):** `tokens/index.ts`, `tokens/README.md`,
`tokens/tree/gapWindow.ts`, `tokens/tree/snapshotMemo.ts`,
`tokens/tree/snapshotMemo.spec.ts`, `clipboard/ClipboardController.ts`,
`store/MarkputApi.ts`, `store/MarkputApi.spec.ts`.

**Do NOT touch:** anything under `tokens/parser/`; `parser.bench.ts` +
`parser.bench.result.json`; `__testing__/`; `packages/react/**`,
`packages/vue/**`, `packages/storybook/**` (zero files change);
`packages/website/src/content/docs/**` (nothing there names a moved path — the
`api/**` pages point only at `tree/types.ts` and `parser/**`);
`packages/core/README.md` and `store/README.md` (both name only
`features/tokens/`, `features/tokens/README.md`, `features/tokens/parser/README.md`
and `features/tokens/tree/transactions.ts`, none of which move); every
`docs/superpowers/` document (D-h).

---

## Task 1: `serializeRange` leaves the token layer (D-e)

**Files:** move `tokens/utils/serializeRange.ts` → `clipboard/serializeRange.ts`;
modify `clipboard/ClipboardController.ts`.

Smallest task, independent of every other, and it is the one that proves the
mechanics of the phase (git mv + path rewrite + `pnpm run format` doing the
sorting) on two files before the 17-file one.

- [ ] **Step 1: prove the consumer count before moving**

```bash
grep -rn "serializeRange" packages/ docs/ --include='*.ts' --include='*.tsx' --include='*.vue' --include='*.md' | grep -v node_modules | grep -v '/dist/'
```

Expected: the definition, `ClipboardController.ts:7` (import),
`ClipboardController.ts:43` (call), and four historical mentions under
`docs/superpowers/plans/`. If anything else appears, stop — D-e is wrong.

- [ ] **Step 2: move it**

```bash
git mv packages/core/src/features/tokens/utils/serializeRange.ts \
       packages/core/src/features/clipboard/serializeRange.ts
```

- [ ] **Step 3: rewrite the three paths the new depth requires**

`packages/core/src/features/clipboard/serializeRange.ts` — the file drops one
level of nesting and gains a `../tokens` hop:

```ts
import type {Range} from '../../shared/editorContracts'
import type {Token} from '../tokens/parser/types'
import {toString} from '../tokens/parser/utils/toString'
```

`packages/core/src/features/clipboard/ClipboardController.ts` — the import
becomes local. **Do not hand-place it**: replace the line where it is and let
`pnpm run format` sort it (it belongs *after* `'./pasteMarkup'`, hard stop 2):

```bash
sed -i '' "s#import {serializeRange} from '../tokens/utils/serializeRange'#import {serializeRange} from './serializeRange'#" \
  packages/core/src/features/clipboard/ClipboardController.ts
```

- [ ] **Step 4: gate**

Run:
`pnpm run format && pnpm test && pnpm run typecheck && pnpm run lint:check && pnpm run format:check && pnpm run build`

Measured: **72 files, 1323 passed, 7 todo**; tsc 0, lint clean, format clean,
build clean (9.7 s). `git status` shows exactly two entries, one of them
`RM …/tokens/utils/serializeRange.ts -> …/clipboard/serializeRange.ts`.
Diffstat: **2 files, +4/−4**.

After `format`, verify the sort actually happened — this is the check that
catches hard stop 2 early:

```bash
sed -n '1,9p' packages/core/src/features/clipboard/ClipboardController.ts
```

`'./pasteMarkup'` must come before `'./serializeRange'`.

- [ ] **Step 5: commit**

```bash
git add -A
git commit -m "refactor(core): S1.9 task 1 — serializeRange moves to features/clipboard

Its only consumer is ClipboardController; the helper trims a token range and
re-serializes it as markup, which is a clipboard concern, not a token-layer one.
Pure move plus the three import paths the new depth requires."
```

Measured similarity: **R082** — the lowest in the phase, and `git log --follow`
still reaches `39c721fe` and `647f7d73`.

---

## Task 2: `tree/` takes `findGap` and renames its boundary (D-b, D-d)

**Files:** move `utils/findGap.ts{,.spec.ts}` → `tree/`; rename
`tree/boundary.ts{,.spec.ts}` → `tree/valueBoundary.*`; modify
`tree/gapWindow.ts`, `model/TokenModel.ts`, `model/treePipeline.spec.ts`,
`model/TokenHandle.ts`, `TokenModel.value.spec.ts`, `README.md`. `utils/`
disappears.

`tree/` is the only folder with zero inbound edges from `dom/` or `seam/`
(D-d), so it can be finished before either exists.

- [ ] **Step 1: the four moves**

```bash
cd packages/core/src/features/tokens
git mv utils/findGap.ts       tree/findGap.ts
git mv utils/findGap.spec.ts  tree/findGap.spec.ts
git mv tree/boundary.ts       tree/valueBoundary.ts
git mv tree/boundary.spec.ts  tree/valueBoundary.spec.ts
rmdir utils
```

`rmdir` must succeed — if `utils/` is not empty, Task 1 did not run.

- [ ] **Step 2: `findGap`'s one consumer**

`tree/gapWindow.ts` — the import and the comment that points at its spec:

```ts
import {findGap} from './findGap'
```

```
 * findGap contract (see findGap.spec.ts):
```

`tree/findGap.ts` and `tree/findGap.spec.ts` themselves change **nothing**
(`findGap.ts` has no imports; the spec imports `'./findGap'` either way). Both
land at R100.

- [ ] **Step 3: `valueBoundary`'s three importers**

`tree/valueBoundary.ts` changes **nothing** — every import in it is a `./`
sibling or `../parser/**`. R100.

```bash
cd packages/core/src/features/tokens
sed -i '' "s#from './boundary'#from './valueBoundary'#g"      tree/valueBoundary.spec.ts
sed -i '' "s#from '../tree/boundary'#from '../tree/valueBoundary'#" model/TokenModel.ts model/treePipeline.spec.ts
```

- [ ] **Step 4: delete the three comments that existed only to tell the twins apart (D-h)**

`model/treePipeline.spec.ts` — the two-line header above the import goes
entirely:

```diff
-// The S1.4 STRING boundary (`tokens/tree/boundary.ts`), not the DOM boundary
-// layer of the same filename at `tokens/boundary.ts`.
 import {createBoundary} from '../tree/valueBoundary'
```

and the in-test aside collapses to one line:

```diff
-		// adapter repaints. The DOM boundary layer (`tokens/boundary.ts:55`, NOT
-		// `tokens/tree/boundary.ts`) resolves every offset as
+		// adapter repaints. The DOM boundary layer (`tokens/boundary.ts:55`) resolves every offset as
```

`model/TokenHandle.ts:36`:

```diff
- * (`tokens/boundary.ts` — not `tokens/tree/boundary.ts`), and `DomModel.ts:95`
+ * (`tokens/boundary.ts`), and `DomModel.ts:95`
```

(`tokens/boundary.ts` is still the right path until Task 3 moves it.)

`TokenModel.value.spec.ts:143` — `` `tree/boundary.spec.ts` `` →
`` `tree/valueBoundary.spec.ts` ``.

- [ ] **Step 5: the README's two `tree/` lines**

```diff
-  projections, via `utils/findGap`. An empty window pins at the END of the value,
+  projections, via `findGap.ts`. An empty window pins at the END of the value,
```

```diff
-- `boundary.ts` — the string boundary (spec §4.4): commit policy plus arrival
+- `valueBoundary.ts` — the string boundary (spec §4.4): commit policy plus arrival
```

- [ ] **Step 6: gate — and prove nothing still names the old paths**

```bash
grep -rn "tree/boundary\|utils/findGap" packages/core/src packages/react packages/vue packages/storybook \
  --include='*.ts' --include='*.tsx' --include='*.vue' --include='*.md' | grep -v node_modules | grep -v '/dist/'
```

Expected: **no output.** (`from './boundary'` still appears twice in
`tokens/DomModel.ts` — that is the DOM boundary, which Task 3 moves.)

Run:
`pnpm run format && pnpm test && pnpm run typecheck && pnpm run lint:check && pnpm run format:check`

Measured: **72 files, 1323 passed, 7 todo**; tsc 0, lint clean, format clean.
Diffstat: **10 files, +11/−14** — the net −3 is the deleted disambiguation
comments. `git status` shows `R` (not `RM`) for `findGap.ts`, `findGap.spec.ts`
and `boundary.ts` → `valueBoundary.ts`: three pure moves.

- [ ] **Step 7: commit**

```bash
git add -A
git commit -m "refactor(core): S1.9 task 2 — tree/ takes findGap and renames its boundary

findGap had one consumer (tree/gapWindow.ts) and lived in a utils/ folder that
now disappears. tree/boundary.ts becomes tree/valueBoundary.ts so the string
boundary and the DOM boundary layer stop sharing a filename — three comments
existed only to tell the two apart and are gone with the collision."
```

---

## Task 3: the contenteditable adapter moves to `dom/` (D-d)

**Files:** eight sources + three specs into `dom/`; modify `index.ts`,
`model/TokenModel.ts`, `model/TokenModel.spec.ts`, `model/treePipeline.spec.ts`,
`TokenModel.index.spec.ts`, `README.md`.

The largest task. `dom/` before `seam/` because it rewrites one line twice
instead of four (D-d).

- [ ] **Step 1: the eleven moves**

```bash
cd packages/core/src/features/tokens
mkdir -p dom
git mv DomModel.ts             dom/DomModel.ts
git mv boundary.ts             dom/domBoundary.ts
git mv caret.ts                dom/caret.ts
git mv caret.spec.ts           dom/caret.spec.ts
git mv textOffsets.ts          dom/textOffsets.ts
git mv model/TokenHandle.ts    dom/TokenHandle.ts
git mv model/TokenHandle.spec.ts dom/TokenHandle.spec.ts
git mv model/bind.ts           dom/bind.ts
git mv model/bind.spec.ts      dom/bind.spec.ts
git mv model/commit.ts         dom/commit.ts
git mv model/editableState.ts  dom/editableState.ts
```

Afterwards `model/` holds exactly six files: `TokenModel.ts`,
`TokenModel.spec.ts`, `commitInput.ts`, `treeInput.ts`, `treeInput.spec.ts`,
`treePipeline.spec.ts`.

**Five of the eleven need no edit at all** and land at R100: `caret.spec.ts`,
`TokenHandle.spec.ts`, `bind.ts`, `bind.spec.ts`, `editableState.ts` — every
path in them is a `./` sibling that stays a sibling, a `../parser/**` that stays
`../parser/**` (same depth), or a `../../../` that stays `../../../` (`model/`
and `dom/` are both three levels below `src/`).

- [ ] **Step 2: the moved files that do need edits**

```bash
cd packages/core/src/features/tokens
sed -i '' -e "s#from '../../shared/editorContracts'#from '../../../shared/editorContracts'#" \
          -e "s#from './boundary'#from './domBoundary'#" \
          -e "s#from './model/TokenHandle'#from './TokenHandle'#" \
          -e "s#from './parser/types'#from '../parser/types'#" dom/DomModel.ts
sed -i '' -e "s#from './model/TokenHandle'#from './TokenHandle'#" \
          -e "s#from './parser/types'#from '../parser/types'#" dom/domBoundary.ts
sed -i '' "s#from '../../shared/checkers'#from '../../../shared/checkers'#" dom/caret.ts dom/textOffsets.ts
sed -i '' -e "s#} from '../caret'#} from './caret'#" \
          -e "s#from '../textOffsets'#from './textOffsets'#" dom/TokenHandle.ts
sed -i '' "s#from './commitInput'#from '../model/commitInput'#" dom/commit.ts
```

`dom/commit.ts`'s import is the line Task 4 rewrites again — the one-line cost
D-d measured.

- [ ] **Step 3: the four comments in `dom/TokenHandle.ts` that named the moved DOM boundary**

`:36`, `:45`, `:179` say `tokens/boundary.ts`; `:40` says
`model/treePipeline.spec.ts`, which Task 4 moves:

```bash
cd packages/core/src/features/tokens
sed -i '' -e 's#(`tokens/boundary.ts`), and `DomModel.ts:95`#(`tokens/dom/domBoundary.ts`), and `DomModel.ts:95`#' \
          -e 's#`DomModel`/`tokens/boundary.ts`#`DomModel`/`dom/domBoundary.ts`#' \
          -e 's#(tokens/boundary.ts resolves offsets against#(dom/domBoundary.ts resolves offsets against#' \
          -e 's#`model/treePipeline.spec.ts`#`seam/treePipeline.spec.ts`#' dom/TokenHandle.ts
```

- [ ] **Step 4: the files that stayed but pointed at the movers**

```bash
cd packages/core/src/features/tokens
sed -i '' -e "s#from '../DomModel'#from '../dom/DomModel'#" \
          -e "s#from './commit'#from '../dom/commit'#" \
          -e "s#from './editableState'#from '../dom/editableState'#" \
          -e "s#from './TokenHandle'#from '../dom/TokenHandle'#" \
          -e 's#`tokens/boundary.ts` (type, position, content)#`dom/domBoundary.ts` (type, position, content)#' model/TokenModel.ts
sed -i '' "s#from './TokenHandle'#from '../dom/TokenHandle'#" model/TokenModel.spec.ts
sed -i '' -e "s#from './commit'#from '../dom/commit'#" \
          -e "s#from './TokenHandle'#from '../dom/TokenHandle'#" \
          -e 's#(`tokens/boundary.ts:55`)#(`tokens/dom/domBoundary.ts:55`)#' model/treePipeline.spec.ts
sed -i '' -e "s#from './DomModel'#from './dom/DomModel'#" \
          -e "s#from './model/TokenHandle'#from './dom/TokenHandle'#" index.ts
sed -i '' "s#from './model/TokenHandle'#from './dom/TokenHandle'#" TokenModel.index.spec.ts
```

**[HARD STOP 2] Do not try to place these imports.** In `model/TokenModel.ts`
`pnpm run format` moves four of them out of the `./` block up into the `../dom/`
block; the resulting diff is 12 lines for a 4-path edit:

```diff
-import {DomModel} from '../DomModel'
-import type {SelectionSnapshot} from '../DomModel'
+import {createCommitPipeline} from '../dom/commit'
+import {DomModel} from '../dom/DomModel'
+import type {SelectionSnapshot} from '../dom/DomModel'
+import {applyEditableState} from '../dom/editableState'
+import type {TokenHandle} from '../dom/TokenHandle'
 import {Parser} from '../parser/Parser'
@@
-import {createCommitPipeline} from './commit'
 import type {TokenDelta} from './commitInput'
-import {applyEditableState} from './editableState'
-import type {TokenHandle} from './TokenHandle'
 import {fromTransaction} from './treeInput'
```

- [ ] **Step 5: the README's six `dom/` references**

`model/TokenHandle.ts` → `dom/TokenHandle.ts` in the two-layer table;
`## The one commit pipeline (model/commit.ts)` → `(dom/commit.ts)`;
`## Structural DOM walk (model/bind.ts)` → `(dom/bind.ts)`;
`VERIFY_DOM … (model/commit.ts)` → `(dom/commit.ts)`; and the three bullets in
the DOM-layer list:

```diff
-- `boundary.ts` — DOM `(node, offset)` → absolute position
+- `dom/domBoundary.ts` — DOM `(node, offset)` → absolute position
-- `caret.ts` — stateless `Range`/`Selection` mechanics (`placeAtTextOffset`,
+- `dom/caret.ts` — stateless `Range`/`Selection` mechanics (`placeAtTextOffset`,
-- `textOffsets.ts` — `TreeWalker`-based text measurement (`textLength`,
+- `dom/textOffsets.ts` — `TreeWalker`-based text measurement (`textLength`,
```

- [ ] **Step 6: gate — and prove nothing still names a root or `model/` DOM path**

```bash
grep -rn "tokens/boundary\|'\./boundary'\|'\.\./caret'\|'\.\./textOffsets'\|model/TokenHandle\|model/bind\|model/commit'\|model/editableState\|'\./DomModel'" \
  packages/core/src packages/react packages/vue packages/storybook \
  --include='*.ts' --include='*.tsx' --include='*.vue' --include='*.md' | grep -v node_modules | grep -v '/dist/'
```

Expected: **no output.**

Run:
`pnpm run format && pnpm test && pnpm run typecheck && pnpm run lint:check && pnpm run format:check && pnpm run build`

Measured: **72 files, 1323 passed, 7 todo**; tsc 0, lint clean, format clean,
build clean. Diffstat: **17 files, +41/−41**. `git status` shows five `R`
(pure) and six `RM`.

- [ ] **Step 7: commit**

```bash
git add -A
git commit -m "refactor(core): S1.9 task 3 — the contenteditable adapter moves to dom/

DomModel, boundary (now domBoundary), caret, textOffsets, TokenHandle, bind,
commit and editableState are one layer: the DOM side of the token feature. They
were split between the tokens root and model/ for no reason other than history.
Five of the eleven files move with zero content change; the rest change only
import paths and the comments that named them."
```

---

## Task 4: `model/` becomes `seam/`, and the tokens root empties (D-f)

**Files:** `git mv model seam` (6 files); six root specs into `seam/`; modify
`dom/commit.ts`, `index.ts`, `tree/snapshotMemo.ts`,
`tree/snapshotMemo.spec.ts`, `README.md`, `store/MarkputApi.ts`,
`store/MarkputApi.spec.ts`.

- [ ] **Step 1: rename the directory, then move the root specs in**

```bash
cd packages/core/src/features/tokens
git mv model seam
```

Every relative import *inside* those six files is already correct — `model/` and
`seam/` are at the same depth (D-d). Four of the six land at R100.

**[HARD STOP 1] The next command is the one that fails if you do it naively.**
`git mv TokenModel.spec.ts seam/` aborts with *destination exists*, because
`seam/TokenModel.spec.ts` (from `model/`) is already there. The root file takes
the aspect suffix (D-f):

```bash
git mv TokenModel.spec.ts seam/TokenModel.parse.spec.ts
for f in TokenModel.changed.spec.ts TokenModel.facade.spec.ts \
         TokenModel.index.spec.ts TokenModel.value.spec.ts TokenHandle.spec.ts; do
  git mv "$f" "seam/$f"
done
```

The tokens root is now `README.md`, `index.ts`, `__testing__/`,
`parser.bench.ts`, `parser.bench.result.json`, and the four folders — verify:

```bash
ls packages/core/src/features/tokens
```

- [ ] **Step 2: the six moved specs each drop one level**

```bash
cd packages/core/src/features/tokens/seam
sed -i '' -e "s#from '../../store/Store'#from '../../../store/Store'#" \
          -e "s#from '../../shared/signals#from '../../../shared/signals#" \
          -e "s#from './parser/types'#from '../parser/types'#" \
          -e "s#from './dom/TokenHandle'#from '../dom/TokenHandle'#" \
  TokenModel.parse.spec.ts TokenModel.changed.spec.ts TokenModel.facade.spec.ts \
  TokenModel.index.spec.ts TokenModel.value.spec.ts TokenHandle.spec.ts
```

(The `signals` pattern is deliberately open-ended and matches the prefix: two of
the six import `'../../shared/signals/index.js'` (`changed`, `index`), one
imports `'../../shared/signals'` (`parse`), and three import neither.)

- [ ] **Step 3: the four importers of the seam, inside and outside the feature**

```bash
cd packages/core/src
sed -i '' "s#from '../model/commitInput'#from '../seam/commitInput'#" features/tokens/dom/commit.ts
sed -i '' "s#from './model/TokenModel'#from './seam/TokenModel'#"     features/tokens/index.ts
sed -i '' "s#from '../features/tokens/model/commitInput'#from '../features/tokens/seam/commitInput'#" \
  store/MarkputApi.ts store/MarkputApi.spec.ts
```

`store/MarkputApi.ts:6` and its spec are the **only** places outside
`features/tokens/` that this whole phase changes besides
`clipboard/ClipboardController.ts` (Task 1).

- [ ] **Step 4: the comments and one `describe` that named `model/`**

`seam/TokenModel.spec.ts:121` — the describe names the folder it is in:

```diff
-describe('TokenModel shell (model/)', () => {
+describe('TokenModel shell (seam/)', () => {
```

`seam/TokenModel.ts:500` names the spec that Task 1's sibling just renamed:

```diff
- * (`features/tokens/TokenModel.spec.ts`'s "current() is updated when value.current
+ * (`seam/TokenModel.parse.spec.ts`'s "current() is updated when value.current
```

`tree/snapshotMemo.ts:44` and `tree/snapshotMemo.spec.ts:38,40,148` —
`` `model/treeInput.ts` `` → `` `seam/treeInput.ts` `` and the two
"tests in `model/`" → "tests in `seam/`".

- [ ] **Step 5: the README's three `seam/` references, plus the layout map**

```diff
-producer-agnostic `CommitInput` (`model/commitInput.ts`), and since S1.6a the
-tree core's `fromTransaction` (`model/treeInput.ts`) is its ONLY producer:
+producer-agnostic `CommitInput` (`seam/commitInput.ts`), and since S1.6a the
+tree core's `fromTransaction` (`seam/treeInput.ts`) is its ONLY producer:
```

```diff
-## Public API — the whole surface (`model/TokenModel.ts`)
+## Public API — the whole surface (`seam/TokenModel.ts`)
```

and, immediately after the **Encapsulation rule** paragraph, the one thing this
phase adds — a map of the four folders and an honest statement of the one upward
edge (D-d):

```md
## Layout

| folder    | what lives there                                                                                |
| --------- | ----------------------------------------------------------------------------------------------- |
| `parser/` | string → `Token[]`. Knows nothing about nodes, ids or the DOM.                                  |
| `tree/`   | the source of truth: nodes, adoption, transactions, the string boundary, snapshots, anchors.    |
| `dom/`    | the contenteditable adapter: bind, the commit pipeline, `TokenHandle`, caret and DOM offsets.   |
| `seam/`   | `TokenModel` — the one object that owns a tree and a DOM and joins them, plus its commit input. |

`tree/` imports nothing from `dom/` or `seam/`, and `seam/` is the only folder
that imports both. The one upward edge is a type: `dom/commit.ts` takes its
`CommitInput` from `seam/commitInput.ts`, the shape both sides agree on.
`index.ts` is the only export point the rest of the package uses.
```

Note: `oxfmt` does **not** normalise markdown table column widths (measured —
the separator row above is wider than the body rows and `format:check` passes).
Do not "fix" it by hand afterwards.

- [ ] **Step 6: gate — the last stale-path grep, plus the website build**

```bash
grep -rn "tokens/model\|'\./model/\|'\.\./model/\|features/tokens/TokenModel\|features/tokens/TokenHandle" \
  packages/core/src packages/react packages/vue packages/storybook \
  --include='*.ts' --include='*.tsx' --include='*.vue' --include='*.md' | grep -v node_modules | grep -v '/dist/'
```

Expected: **no output.** Then the layering claim the README now makes:

```bash
grep -rn "from '\.\./dom\|from '\.\./seam" packages/core/src/features/tokens/tree   # expect: nothing
grep -rn "from '\.\./seam" packages/core/src/features/tokens/dom                     # expect: commit.ts, import type, 1 line
```

Run:
`pnpm run format && pnpm test && pnpm run typecheck && pnpm run lint:check && pnpm run format:check && pnpm run build && pnpm -F @markput/website run build`

Measured: **72 files, 1323 passed, 7 todo**; tsc 0, lint clean, format clean,
build clean, website **49 pages built**, and `git status` shows **no**
`packages/website/src/content/docs/api/**` changes — starlight-typedoc has
nothing to regenerate because no file it links to moved. Diffstat: **19 files,
+38/−24** (the +14 net is the README's Layout section).

- [ ] **Step 7: commit**

```bash
git add -A
git commit -m "refactor(core): S1.9 task 4 — model/ becomes seam/, the tokens root empties

TokenModel, commitInput and treeInput are the join between the tree and the DOM;
model/ said nothing. The six Store-driven facade specs that sat at the tokens
root move in beside them, leaving the root with index.ts, the README, the parser
benchmark and __testing__.

model/TokenModel.spec.ts keeps its name as the sibling spec of TokenModel.ts;
the root TokenModel.spec.ts, which pins the parse path, becomes
TokenModel.parse.spec.ts — the two collide in one folder and the root file
already had four .aspect. siblings."
```

- [ ] **Step 8: prove the blame claim rather than asserting it**

```bash
git log --follow --oneline -- packages/core/src/features/tokens/dom/TokenHandle.ts | head -6
git log --follow --oneline -- packages/core/src/features/tokens/tree/valueBoundary.ts | head -6
git log --follow --oneline -- packages/core/src/features/clipboard/serializeRange.ts | head -4
git diff -M --name-status 5a0efc89..HEAD | awk '{print $1}' | sort | uniq -c
```

Measured: 28 renames — 11 × R100, 6 × R099, 4 × R098, 5 × R097, 1 × R095,
1 × R082 — and every `--follow` reaches pre-S1.9 history (table in *Plan
status*). If any file shows up as an add + delete pair instead of an `R`, the
edit alongside the move was too large and must be split out.

---

## Trap list — what was checked and deliberately left alone

| thing | verdict | evidence |
| --- | --- | --- |
| `SelectionController` "deep-imports `tree/anchors`" | **refuted** | `SelectionController.ts:9-10` imports from `'../tokens'`, the root barrel |
| adapter / storybook deep import of a moved file | none | only `storybook/.../Base.vue.spec.ts:9` reaches into core source at all, and it targets `store/Store` |
| `packages/{react,vue}/markput/dist/index.d.ts` region comments name old paths | untracked build output, regenerated by `pnpm run build` | `git ls-files packages/react/markput/dist` → empty |
| typedoc `api/**` pages | untouched | every `Defined in:` points at `tree/types.ts` or `parser/**`; neither moves |
| `packages/core/README.md`, `store/README.md` | untouched | they name only `features/tokens/`, its README, the parser README, and `tree/transactions.ts` |
| `docs/superpowers/**` mentions of `tokens/utils/serializeRange`, `model/*` | left stale on purpose | D-h; also in oxfmt's `ignorePatterns` |
| `vite.config.ts` spec discovery | unaffected | the `core` project globs `packages/core/src/**/*.spec.ts`, recursive |
| `parser/` | untouched | 24 files, zero edits |
| a `serializeRange.spec.ts` | not added | pre-existing gap, flagged in D-e; this phase adds no test |

## Contradictions found while writing and verifying this plan (report, do not paper over)

1. **Spec §9 says "pure-move commits (no content edits)". That is not
   achievable, and it is also not necessary.** Not achievable: 17 of 28 renames
   must change at least one import path, and one must change its filename because
   the destination was taken. Not necessary: git detects renames by similarity at
   diff time, so the blame the spec is protecting survives a combined
   move+rewrite commit — measured at R082 worst case, with `git log --follow`
   confirmed on four files. **The spec's requirement should be restated as "no
   behavior, symbol, signature or test changes", which this phase does meet.**
2. **Spec §9 contains the same deferral twice, and the two copies disagree.**
   `:770-772` says the regroup is into `tree/`/`dom/`/`parser/` — three folders;
   `:773-776` repeats it with the same three folders and an explicit file list
   that assigns `TokenHandle` to `dom/`. Neither mentions a seam, and both
   therefore imply `TokenModel` belongs in `dom/`. The maintainer's Variant B —
   four folders, `TokenModel` in `seam/` — **supersedes both**. Someone should
   delete one of the two paragraphs and update the other.
3. **Spec §9's file list for `dom/` omits `bind` and `commit`'s input type and
   includes `boundary` under its old ambiguous name.** The list is
   "bind, commit, DomModel, boundary, caret, textOffsets, editableState,
   TokenHandle" — eight names for what is now eleven files, with `boundary`
   naming whichever of the two twins the reader assumes. Resolved by D-a's rename;
   recorded because the spec text still reads ambiguously.
4. **The brief's claim that deep cross-feature imports "already exist"
   (`SelectionController` → `tokens/tree/anchors`) is false at `5a0efc89`.** The
   real deep-import set is three files, listed in D-c. This matters because it was
   the main argument for sub-barrels, and it does not hold.
5. **`packages/core/README.md:21` describes `src/features/tokens/` as "the token
   tree …, the string boundary, transactions, adoption, the commit pipeline and
   the DOM binding" — still accurate, but it is now a list of exactly the four
   folders and does not say so.** Not fixed here (out of scope: this phase does
   not touch that file); worth one line in a later docs pass.

## Self-review notes (spec → plan)

- **§9's "does not destroy the git blame of the files S1.8 deletes from"** — the
  ordering constraint it states is satisfied: S1.8 landed first (`5a0efc89`), so
  the 7 files it deleted were never moved.
- **AGENTS.md "Make structural changes pure: relocate code without changing
  behavior, so the diff is a clean move."** Met, and measurable: `pnpm test`
  reports the identical 1323/7 at the baseline and at all four commits, and no
  spec file's *content* changes except one `describe` string and eleven comment
  lines.
- **AGENTS.md "Keep every task and commit green."** Met — the reason D-b exists.
- **AGENTS.md "Actively reduce, don't just preserve."** Two directories are
  removed (`utils/`, `model/`), three comments that existed only to work around
  the `boundary.ts` collision are deleted, and one cross-feature import
  disappears. Nothing new is added except a README table.
- **Open, deliberately not taken:** `seam/commitInput.ts` is the one module that
  breaks the downward layering (D-d), `serializeRange` still has no spec (D-e),
  and `seam/treePipeline.spec.ts` tests a `dom/` construct (D-f). All three are
  recorded rather than fixed, because fixing any of them would make this phase
  something other than a move.

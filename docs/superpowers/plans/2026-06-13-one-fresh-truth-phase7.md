# One Fresh Truth — Phase 7: First-Class Rows (the FINAL phase) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make block-mode rows first-class. In block mode the parser PRE-SPLITS the document on the **row terminator** (`'\n\n'`, derived from the configured slot-leading markup's suffix); each segment parses independently as inline content; the tree's top level becomes `RowToken` nodes (`{type:'row', id, children, content, position, terminated}`). Parsing becomes ROW-LOCAL by construction — a keystroke in row k reparses only row k (segment string unchanged ⇒ that row's parse result is reused wholesale, id carried), killing the full-parse cliff with ZERO guard machinery. EVERY top-level segment is a Row INCLUDING empty ones (Enter creates them — the empty-slot collapse becomes unrepresentable). Round-trip is pinned as a property (`split → parse → serialize ≡ value`) plus row-locality (editing inside row k leaves all other rows' parse results reference-equal). `value.current()` stays byte-identical. Block-mode `tokens()` returns `RowToken[]` — a **breaking tree-shape change** (inside the semver-major). Adapters: `Container` maps rows → `Block`, `Token` renders `row.children`, the option's `Mark` still renders for marked rows; the row element binds to the `RowToken` directly. Block ops + keyboard route on `token.type === 'row'`. The §What-dies cascade deletions land: `resolveSlotLeadingMatches` + the `Match` slot-leading constructor special case (+ both `//TODO need review it`), the `filterEmptyText` empty-slot collapse, the descend-for-rows arm, the five `isTextLikeRow`/`isSlotLeadingMark` sniffing sites, the `addDragRow` doubled-content quirk, and the rows-map / one-non-control-child bind bolt-ons. Deep descend SURVIVES only for genuinely nested *inline* slot marks. Riders: rewrite the rotten `parser/README.md`, fix `Parser.unescape` lossiness, shrink the tokens README to the two-sentence model. **This is the spec's LARGEST and FINAL phase — there is no Phase 8.**

**Architecture (grounded in the spec's §First-class rows + the post-Phase-6 code).** Today (post-Phase-6 HEAD) a block document of slot-leading markup (`'__slot__\n\n'`) parses as a FLAT alternating stream where each `__slot__\n\n` segment is a single-segment slot MARK; `PatternMatcher.resolveSlotLeadingMatches` retro-fits row boundaries by extending each slot-leading match's `start` backwards to the previous one (`PatternMatcher.ts:121-145`), and `Match`'s constructor seeds a zero-width slot for single-segment slot descriptors (`Match.ts:44-56`). The "empty row" only survives because `TreeBuilder.createSlotSourceInfo` (Phase-0 fix) emits a zero-width slot window even when the slot is empty (`TreeBuilder.ts:239-248`) and `tryDescend` is willing to descend into it (`tokenIdentity.ts:167-204`). Five places sniff "is this token a row?" by re-deriving `descriptor.hasSlot && descriptor.segments.length === 1` (`operations.ts:16-18`, three call sites; `blockEdit.ts:13-16`, one call site). The block bind path discovers rows by walking container children, demanding exactly one non-control child per row (`bind.ts:184-197`), and threads a `rows` map → `rowElement` binding → `LiveNode.#measureScope` (caret/measure scope is the ROW in block layout). `addDragRow` carries a doubled-content quirk for the all-empty document (`operations.ts:33-34`). `filterEmptyText` (`TokenModel.ts:453-457`) drops empty top-level text tokens in block mode — the LAST empty-slot collapse after Phase 6.

Phase 7 inverts this: the ROW is the structural unit the parser EMITS, not a shape the reconciler/bind/ops re-sniff. A block parser pre-splits the value on `'\n\n'` into `[content, terminated]` segments, parses each `content` as inline tokens with the SAME inline `Parser` (positions rebased to absolute document offsets), and wraps each in a `RowToken`. Reconcile diffs `RowToken[]` ROW-BY-ROW: a row whose absolute `content` substring is unchanged keeps its previous parse result and id wholesale (the row-locality property); a changed row reparses inline and reconciles its `children` with the EXISTING inline machinery (prefix/suffix/middle + inline `tryDescend` for nested slot marks). Bind treats each row element as the binding target for its `RowToken` (a row is the frame, its single non-control child hosts `row.children`), so the rows-map and one-non-control-child rule become the ordinary frame structure rather than a bolt-on. Block ops + keyboard route on `token.type === 'row'` — `canMergeRows`/`mergeDragRows`/`addDragRow` become uniform segment operations over `RowToken`s with no sniffing and no doubled-content quirk. The empty-slot collapse is GONE: an empty Row has zero children, pairs 1:1 across reconcile, and typing into it stays on the text path by construction.

**Why this is better incrementality than `incrementalParse` ever delivered (the spec's claim).** `incrementalParse` (deleted Phase 6) windowed a SINGLE inline parse and was defeated by a stray segment outside the window. The pre-split parser is row-local by CONSTRUCTION: splitting on a literal `'\n\n'` is O(document) but cheap (one `String.split`/scan), and each row's inline parse is O(row). A keystroke inside row k changes only row k's `content` substring; reconcile reuses every other row's `RowToken` (and its whole inline subtree) by reference — so the per-keystroke parse work is O(row_k), not O(document). The kept typing bench (`parser.bench.ts`, Phase 6's tripwire) is the regression gate: Phase 7's block typing path should show the row-local cost; the inline (non-block) path is unchanged (full parse, the bench's existing scenarios).

**The EXACT `RowToken` shape (decided here).** Add to `parser/types.ts`:

```ts
export interface RowToken {
	type: 'row'
	content: string
	position: {
		start: number
		end: number
	}
	/** Stable identity id, stamped by reconcile (tokenIdentity) — NOT by the parser. Absent on freshly parsed, never-reconciled trees. */
	id?: number
	/** Inline tokens of the row's content (a normal Token[] — the same shape parse() emits for inline). */
	children: Token[]
	/** False only for a trailing unterminated segment (today's text row at the document end). */
	terminated: boolean
}
```

`Token` stays `TextToken | MarkToken` — `RowToken` is NOT a member of the inline `Token` union (rows are never inline children; `mark.children`/`row.children` only ever hold `Token`s). The block tree is `RowToken[]`; the inline tree stays `Token[]`. `content`/`position` INCLUDE the terminator (`'first row\n\n'` → `content: 'first row\n\n'`, `position: {start, end}` spanning the terminator), so `joinContents(rows) === value.current()` byte-for-byte (the round-trip property). `children` are inline tokens of the row's content WITHOUT the terminator (positions are absolute document offsets), so serialize is `rows.map(r => toString(r.children) + (r.terminated ? terminator : '')).join('')` — but see Task 9: serialize uses `content` directly via a `RowToken` arm in `toString`, byte-exact, since `children` already reconstruct the pre-terminator content.

**The pre-split algorithm (decided here — `BlockParser`).** A new `parser/core/BlockParser.ts` wraps the inline `Parser`:

```ts
splitRows(value, terminator): segment[]   // [{content, start, end, terminated}]
```

splits `value` on `terminator` (`'\n\n'`); each non-final piece is a terminated row (`content = piece + terminator`, `terminated: true`); the final piece is a row iff it is non-empty (`terminated: false`) — a trailing empty piece after a final terminator is NOT a row (matches today's `filterEmptyText` outcome: `'a\n\n'` → ONE terminated row, not a row + empty row). An empty document (`''`) yields ZERO segments → the block tree is a single synthetic empty row (so the editor always has one editable row — matches today's `[TextToken('', 0, 0)]` cold start filtered to one row). Then for each segment, parse the PRE-terminator content (`value.slice(start, start + content.length - terminatorLen)` when terminated, else the whole content) with the inline parser, rebase child positions by `start`, and wrap in a `RowToken`.

**The terminator derivation (decided here).** Derived from the configured slot-leading markup's suffix: a markup whose descriptor is `hasSlot && segments.length === 1` (today's true-row shape) has exactly one static segment = the suffix after `__slot__` (`'__slot__\n\n'` → segment `'\n\n'`). The block parser scans the registry for the SINGLE slot-leading descriptor and takes its lone segment as the terminator; defaults to `'\n\n'` when block mode has no slot-leading option. **One terminator per document, validated at parser construction** — if two distinct slot-leading descriptors disagree, throw (today's configs never do: a block config has exactly one row markup). `Parser.hasSegments` (kept in Phase 6 for exactly this) is NOT needed; the derivation reads `registry.descriptors` directly.

**How reconcile diffs rows (decided here — row-local).** `IdentityTracker.reconcile` already diffs a `Token[]` top level with prefix/suffix/middle + `tryDescend`. Phase 7 adds a `reconcileRows(nextRows, prevRows, …)` path used in block mode: it pairs rows by the prefix/suffix/middle skeleton over the ROW `content` (a row whose `content` is byte-identical AND position-identical is reused by reference, id carried; a row whose `content` is identical modulo a uniform shift inherits its id and its whole subtree by reference-with-rebased-positions — but since rows are pre-split, a shifted row's `content` substring is identical so its `children` are reused wholesale); a row at the same slot whose `content` CHANGED reconciles its `children` inline (the existing inline reconcile, scoped to the row) and the row itself becomes `update` (it renders no framework props — a row's Mark/Span renders `row.children`, so a content-only change inside it is the text path). Row add/remove (split/merge) is `structural`. This is the row-locality property: unchanged rows are reference-equal in the output.

**How bind binds a RowToken (decided here).** The block frame becomes: container → row elements (the `Block` component's root), each row element contains exactly one non-control child that HOSTS `row.children`. Bind's block branch maps `rows[i]` (a `RowToken`) to its row element as the `tokenElement` AND `rowElement` (the row IS its own measure scope), and pushes a child frame `{tokens: row.children, elements: nonControlChildren(of the single inner host), basePath: [i]}`. So a `RowToken` binds to the row element directly (the spec: "the row element binds to the RowToken directly"); the rows-map/one-non-control-child become the ordinary frame structure. `LiveNode.#measureScope` already prefers `rowElement` — unchanged. The row's single inner element is the `childSequenceHost` for `row.children`.

**Staged sub-task breakdown (large phase — many small TDD tasks):**

1. **Task 1** — `RowToken` type + serialize/process/findToken arms (type plumbing, no behavior).
2. **Task 2** — `BlockParser` pre-split + per-row inline parse + terminator derivation (pure, unit-tested).
3. **Task 3** — wire `BlockParser` into `TokenModel.#reparse` (block mode emits `RowToken[]`); delete `filterEmptyText`.
4. **Task 4** — reconcile rows (row-local diff + row-locality property); the empty-slot collapse is unrepresentable.
5. **Task 5** — bind rows (block frame: row element ⇔ `RowToken`; rows-map/one-child become ordinary frame).
6. **Task 6** — adapters: `Container` rows → `Block`, `Token` renders `row.children`, `resolveMarkSlot` row arm; re-pin block render gates + empty-row gate.
7. **Task 7** — block ops route on `type === 'row'`; delete `isSlotLeadingMark`; kill the `addDragRow` doubled-content quirk.
8. **Task 8** — block keyboard routes on `type === 'row'`; delete `isTextLikeRow`.
9. **Task 9** — cascade deletions in the parser: `resolveSlotLeadingMatches` + the `Match` slot-leading special case (+ both TODOs); confirm `filterEmptyText`/dual-`#lastParsed` already gone (Phase 6); strip the descend-for-rows arm to inline-only.
10. **Task 10** — round-trip + row-locality properties (extend `tokenIdentity.property.spec.ts` / add a `BlockParser.property.spec.ts`).
11. **Task 11** — riders: rewrite `parser/README.md`; fix `Parser.unescape` lossiness.
12. **Task 12 (FINAL)** — migration completion: shrink the tokens README to the two-sentence model; final full-suite + storybook + typecheck + encapsulation green; closing program-complete report (all four wins gate, win-4 traded, public surface matches §Public API, semver-major ready). **NOT another plan — there is no Phase 8.**

**Tech Stack:** TypeScript, vitest in REAL Chromium browser mode. Run patterns: `pnpm -F core test` (full core suite). To run ONE spec: `pnpm -w exec vitest run --project core <path-or-pattern>`. Storybook page specs (the react/vue vitest projects): `pnpm -F storybook test` (full), `pnpm -F storybook test:react`, `pnpm -F storybook test:vue`; to filter: `pnpm -w exec vitest run --project react --project vue <pattern>`. **WARNING: `pnpm -F react test` and `pnpm -F vue test` are SILENT NO-OPS** — `@markput/react`/`@markput/vue` have NO test script; pnpm exits 0 with no output. The react/vue vitest projects ARE the storybook page specs above. Typecheck: `pnpm run typecheck` (recursive `tsc --noEmit` / `vue-tsc --noEmit`; it regenerates `packages/website/src/content/docs/api/*.md` via typedoc — do NOT commit those; `git checkout -- packages/website` or scope the commit). Encapsulation guard: `pnpm run check:encapsulation`. Benchmarks: `pnpm -w exec vitest bench --project core parser.bench` (the kept Phase-6 tripwire — Phase 7's row-local block parse should show the typing-cost drop; run it after Task 3 and again at the end to confirm it still builds and produces numbers). Conventions: tabs, single quotes, no semicolons, `import type`, **no trailing newline at end of `.ts`/`.tsx` files** (`.vue` SFCs DO end with a newline — match each file).

**Commits in a shared checkout:** other agents may work concurrently in the SAME working tree on DISJOINT files. ALWAYS commit path-scoped: `git commit -m <message> -- <explicit paths>` (commits ONLY those paths even if other files are staged). NEVER `git add -A` / `git add .` / a bare `git commit`. On an `index.lock` error, wait ~2s and retry up to 5 times. If a pre-commit hook reflows a file you did not edit (MM, cosmetic-only vs HEAD), `git reset HEAD -- <file>` rather than commit churn.

**Spec:** `docs/superpowers/specs/2026-06-13-tokenmodel-one-fresh-truth-design.md` — §First-class rows (Phase 7 design): pre-split over line-anchored patterns; the `RowToken` shape; terminator derived from the slot-leading markup's suffix (`'__slot__\n\n'` → `'\n\n'`, default `'\n\n'`), validated at parser construction; public config UNCHANGED; every top-level segment a Row including empty ones (empty-slot collapse unrepresentable); round-trip + row-locality properties; `value.current()` byte-identical; `tokens()` returns `RowToken[]` (breaking tree-shape); adapters Container→Block / Token renders `row.children` / option Mark renders for marked rows; row element binds the RowToken directly; ops + keyboard route on `token.type === 'row'`. §What dies → the Rows-as-slot-marks row: `resolveSlotLeadingMatches` + Match special case (+ both "TODO need review it"), empty-slot collapse, `filterEmptyText` + dual `#lastParsed` (already gone Phase 6 — confirm), descend-for-rows, five `isTextLikeRow`/`isSlotLeadingMark` sniffing sites, `addDragRow` doubled-content quirk, rows-map/one-non-control-child bolt-ons → first-class Row nodes. §What is kept → Deep descend survives only for genuinely nested INLINE slot marks; the Phase-0 empty-slot synthesis stays for them; rows never reach it. §Migration → "Phase 7 — first-class rows (~1–2 weeks): pre-split parser + Row node; bind/ops/keyboard/adapters migration; cascade deletions; round-trip + row-locality properties; block render gates re-pinned on Row trees." §Riders → rewrite the rotten `parser/README.md` (Phase 7); fix `Parser.unescape` lossiness for user-typed backslashes (Phase 7); shrink the tokens README to the new model (rolling). §Contracts → "The semver-major release is cut only after Phase 7 lands, so Phases 4–7 ship as one major."

**Semver-major framing:** Phases 4–7 ship as ONE semver-major. Phase 4 cut the TokenAddress-deleting core; Phase 7's `RowToken` tree shape is the last breaking change folded into the same major. (Per the spec: if Phase 7 had detached, the major would have been cut after Phase 6 and the Row tree shape would be the NEXT major — it did not detach; the major is cut after Phase 7.) No public CONFIG changes (`{markup:'__slot__\n\n', Mark}` + `layout="block"` is byte-identical); the break is purely the block-mode `tokens()` return shape (`Token[]` → `RowToken[]`) and the adapter-internal frame structure.

**Background facts (probe-verified against post-Phase-6 HEAD `d3075886`, do not re-derive):**

- **The inline parse spine is `Parser.parse` (`Parser.ts:119-123`):** `segmentMatcher.search(value)` → `patternMatcher.process(segments)` → `treeBuilder.build(matches, value)`. `PatternMatcher.process` (`PatternMatcher.ts:41-55`) ends with `//TODO need review it` + `this.resolveSlotLeadingMatches()`. `resolveSlotLeadingMatches` (`:121-145`) + `isSlotLeading` (`:147-149`, `descriptor.segments.length === 1 && descriptor.hasSlot`) retro-fit row boundaries. These die in Task 9 (the inline parser used per-row never has a `\n\n`-terminated row to resolve — each row's `content` is pre-stripped of its terminator before inline parse, so no slot-leading match exists inside a row).
- **The `Match` slot-leading special case (`Match.ts:44-56`):** the constructor auto-completes single-segment patterns and, for `gapType === 'slot'`, seeds a zero-width `gaps.slot = {start, end: start}` "resolved by PatternMatcher.resolveSlotLeadingMatches" — carrying a `//TODO need review it. before it was only value gap type`. When `resolveSlotLeadingMatches` dies, this zero-width-slot seeding for a slot-leading single-segment match has no resolver and no purpose IN THE INLINE PARSER (a row's inline content never contains the row markup). Task 9 removes the `gapType === 'slot'` branch (single-segment slot patterns no longer arise inline) — VERIFY no inline-only single-segment slot markup is in use (the only single-segment slot markup is the ROW markup, now handled by `BlockParser`). KEEP the `else` arm (`this.gaps[gapType] = {start, end}`) for single-segment VALUE patterns (e.g. `@[__value__]` is two-segment, but a hypothetical single-segment value pattern uses it).
- **`createSlotSourceInfo` (Phase-0 fix, `TreeBuilder.ts:239-248`)** emits a zero-width slot window for an empty slot. This is KEPT — the spec's §What-is-kept: "the Phase 0 empty-slot synthesis stays for [genuinely nested inline slot marks]." Only the ROW use of it goes away (rows no longer parse as slot marks). Do NOT touch `TreeBuilder` in this phase except where a step says so.
- **`filterEmptyText` (`TokenModel.ts:453-457` + its call at `:144`)** is the last empty-slot collapse after Phase 6 — it drops empty top-level text tokens in block mode. It DIES in Task 3 (block mode emits `RowToken[]`; an empty row is a `RowToken` with zero children, never an empty text token). The §What-dies "filterEmptyText + dual #lastParsed" — the dual `#lastParsed` is ALREADY GONE (Phase 6 deleted `#lastParsed`); CONFIRM with a grep in Task 9 and note it, do not re-delete.
- **The descend-for-rows arm is `tryDescend` (`tokenIdentity.ts:167-204`).** It descends into an id-matched slot-mark pair whose change is confined to the slot interior. For ROWS (slot-leading single-segment marks) this was the "block typing rides the text path" mechanism. With first-class rows, the ROW diff is row-local (Task 4) and `tryDescend` is needed ONLY for genuinely nested INLINE slot marks (`#[__slot__]` inside a row). Task 9 does NOT delete `tryDescend` — it stays for inline nesting — but the block top-level no longer routes through it (rows are diffed by `reconcileRows`). The "descend-for-rows" death is the death of the top-level-rows-AS-slot-marks USE, not the function.
- **The five sniffing sites (grep-verified):** `operations.ts:16` `isSlotLeadingMark` (defined), used at `:27` (`canMergeRows`), `:72` (`mergeDragRows`); `blockEdit.ts:13` `isTextLikeRow` (defined), used at `:142` (`handleEnter`). Both derive `descriptor.hasSlot && descriptor.segments.length === 1`. They die in Task 7 (`operations.ts`) and Task 8 (`blockEdit.ts`) — replaced by `token.type === 'row'` (a row's terminator/empty-ness is read from `RowToken.terminated`/`children`, not re-sniffed).
- **The `addDragRow` doubled-content quirk (`operations.ts:33-34`):** `if (value === '' || (rows.length === 1 && rows[0].type === 'text' && rows[0].content === '')) return newRowContent + newRowContent`. This doubled the new-row content for an all-empty document — a workaround for the empty-row-collapse era. With first-class rows the empty document is ONE empty `RowToken`, so `addDragRow` becomes a uniform "insert after row k" with no special case. Task 7 deletes the quirk; `operations.spec.ts` (`:46-52`) pins `add on empty rows` — Task 7 rewrites that pin to the new uniform behavior (deliberate spec rewrite, named).
- **The bind block branch (`bind.ts:177-197`, `resolveRoot`):** in block mode it takes container element-children as candidate rows, demands `nonControlChildren(row).length === 1`, and threads a `rows: Map<number, HTMLElement>` consumed at `:160-165` (`rowElement: rows?.get(i)`). The rows-map + one-non-control-child bail are the bolt-ons. Task 5 rewrites the block walk so the row element IS the `RowToken`'s `tokenElement`+`rowElement` and the single inner element hosts `row.children` (a child frame). `LiveNode.#measureScope` (`LiveNode.ts:89-91`, `#rowElement ?? #textElement ?? #tokenElement`) is UNCHANGED — a `RowToken`'s `rowElement === tokenElement`, still the measure scope.
- **`tokens()` is block-mode `RowToken[]` (the breaking change).** `TokenModel.tokens()` (`:87-89`) returns `this.#pipeline.tokens()` = `latest` (`commit.ts:242`). After Task 3, `latest` in block mode is `RowToken[]`. The public type widens: `tokens(): readonly (Token | RowToken)[]` (or a block-aware overload — Task 1 decides the exported type; the simplest honest shape is the union, since a consumer in inline mode still gets `Token[]`). The §Public-API line `tokens(): Token[]` becomes `tokens(): (Token | RowToken)[]` in block mode — documented in Task 12's README.
- **Adapters today (react, mirrored in vue):** `Container.tsx:38-40` maps `isBlock ? tokens.map(Block) : tokens.map(Token)` keyed by `keyOf(t)`. `Block.tsx:46` renders `<Token token={token} path={[blockIndex]} />` — so in block mode the row token flows into `<Token>`, which (`Token.tsx:21-29`) calls `resolveMarkSlot(token)` and renders `token.children`. TODAY a row is a slot MARK, so `resolveMarkSlot` returns the option's `Mark` and `token.children` are the row's inline tokens — IT ALREADY RENDERS row children through the mark path. The Phase 7 change: `RowToken` (`type:'row'`, no `descriptor`) must resolve to the option's `Mark` (for a marked row) or the row's structural wrapper, and render `row.children`. Task 6 adds a `RowToken` arm to `resolveMarkSlot` (and the react/vue `Token` child-render guard `token.type === 'mark'` → also `'row'`).
- **`resolveMarkSlot` (`resolveSlot.ts:51-67`)** branches on `token.type === 'text'` (Span) vs mark (`tokenOptions[token.descriptor.index]`). A `RowToken` has no `descriptor` — Task 6 adds a `token.type === 'row'` arm that resolves the SINGLE configured row option's `Mark` (the block config has one slot-leading option) and passes `{value: '', children-rendered-by-the-component}`. The option index for a row is the slot-leading option's index (derived once, like the terminator). The react/vue `Token` components already render `token.children` for any token with children — Task 6 extends the `token.type === 'mark' && children.length > 0` guard to include `'row'`.
- **`toString` (`parser/utils/toString.ts:21-38`)** serializes `Token[]`: text → `content`, mark → `annotate(markup, {value, meta, slot})`. It does NOT handle `RowToken`. Task 1 adds a `token.type === 'row'` arm: `result += token.content` (byte-exact — `content` already includes children + terminator). This keeps `Parser.stringify(rows) === value`.
- **`processTokensWithCallback` (`parser/utils/processTokens.ts:9-36`)** and **`findToken` (`utils/findToken.ts:8-16`)** recurse on `token.type === 'mark'` over `.children`. Task 1 extends them to recurse on `'row'` too (a row has `.children`). `transform()`/`denote` over a block document then walk row children.
- **The block render-count gates (`renderCount.react.spec.tsx:75-161`, mirrored in `.vue.spec.ts`):** "block keystroke into a row does not re-render Mark or Span; a row split does" (`:76-122`) and "first keystroke into a freshly-Enter-created empty row rides the text path" (`:124-160`). These MUST stay green on the Row tree (Task 6 re-pins them — the assertions are unchanged; the implementation underneath becomes row-local). The empty-row gate's pre-fix comment ("TreeBuilder collapsed the empty slot to undefined") becomes a comment about the OLD slot-mark era — Task 6 updates the comment to "the empty row is a RowToken with zero children, so the keystroke rides the text path by construction." The remount gate (`:172-201`) is inline (not block) — untouched.
- **The Drag storybook gates** (`packages/storybook/src/pages/Drag/Drag.react.spec.tsx` / `.vue.spec.ts`) exercise add/delete/duplicate/reorder/merge in block mode. They MUST stay green (Task 7 re-pins the ops; the public drag behavior is unchanged — only the routing-by-`type==='row'` underneath changes). Run them after Task 7.
- **`operations.spec.ts` + `BlockController.spec.ts`** are the unit pins for the ops. `operations.spec.ts:73-87` (`mergeDragRows into an EMPTY previous row`) was pinned in Phase 0 against the slot-mark row shape (`new Parser(['__slot__\n\n']).parse(...).filter(type==='mark')`). Task 7 rewrites this spec to construct `RowToken`s via `BlockParser` (the rows are now `RowToken`s, not filtered slot marks) — a deliberate, named spec rewrite. `BlockController.spec.ts` keys stores by id (`keyOf`) — `RowToken.id` works identically; verify it stays green.
- **`tokenIdentity.property.spec.ts`** has a `runSlotLeadingProperty` (`:589-624`) that today runs the `'__slot__\n\n'` markup through the INLINE `Parser` and asserts in-row edits descend (mark `updated`, child ids stable). Task 10 ADDS a row-locality + round-trip property over `BlockParser` (a new block reconcile path); whether the existing `runSlotLeadingProperty` stays as an inline-nesting test or is migrated to the block path is decided in Task 10 (the in-row descend it tests is now the ROW-LOCAL diff). The generators (`generateSlotLeadingDocument`/`generateSlotLeadingEdit`/`generateInRowEdit`, `:235-354`) are reusable for the block property.
- **Public config is UNCHANGED.** `{markup: '__slot__\n\n', Mark: RowMark}` + `layout="block"` — no consumer-facing config change. The Drag/renderCount specs construct exactly this; they do not change their config (only the gates' implementation-comment wording is updated where a step says so).
- **`Parser.unescape` lossiness (the rider, `Parser.ts:232-234`):** `text.replaceAll(/\\(.)/g, '$1')` — strips EVERY backslash-char pair, so a user-typed literal `'\\'` (escaped backslash) or a `'\\x'` that was never an escaped segment is corrupted. The fix (Task 11): unescape ONLY the registry's segments (the inverse of `escape`, which only escapes registry segments — `Parser.ts:209-214`). Replace the blanket regex with a per-segment `replaceAll(escapedSegment, segment)` over `registry.segments` (longest-first, mirroring `escape`). `escape` has a `.spec` companion in `Parser.spec.ts` — Task 11 adds round-trip `unescape(escape(text)) === text` cases including literal backslashes.
- **`parser/README.md` is rotten (the rider).** It documents a nonexistent `ParserV2`, a fictional `calculateDeterministicPriority` priority system (the real conflict resolution is processing-order in `PatternMatcher`/`addToCompleted`), `nested`/`labelStart` fields that do not exist (the fields are `slot`/`value`/`position`), and a multi-phase TreeBuilder that is actually single-pass. Task 11 rewrites it to match the REAL parser (the three-stage `SegmentMatcher`→`PatternMatcher`→`TreeBuilder` pipeline, the real `Token`/`MarkToken`/`RowToken` shapes, the real conflict resolution, and the block pre-split).
- **The tokens README (`features/tokens/README.md`, 452 lines) is stale.** It still describes `incrementalParse` (deleted Phase 6), the old changeset buckets (`textChanged`/`added`/`removed`/`updated` — now `{structural, changes, removedIds}`), per-node `dirty` signals (deleted Phase 5), and the old handle surface (`address`/`text`/`dead` — deleted Phase 5). Task 12 (the rolling rider's endpoint) shrinks it toward ≤150 lines around the two-sentence model: "handles are fresh; the render tree is for renderers."

---

### Task 1: Add the `RowToken` type + serialize / process / findToken arms (type plumbing, no behavior)

**Files:**
- Modify: `packages/core/src/features/tokens/parser/types.ts`
- Modify: `packages/core/src/features/tokens/parser/utils/toString.ts`
- Modify: `packages/core/src/features/tokens/parser/utils/processTokens.ts`
- Modify: `packages/core/src/features/tokens/utils/findToken.ts`
- Modify: `packages/core/src/features/tokens/index.ts` (export `RowToken`)
- Modify: `packages/core/index.ts` (export `RowToken`)
- Create: `packages/core/src/features/tokens/parser/utils/toString.row.spec.ts`

The structural type before any parser/reconcile/bind change. `RowToken` is a top-level-only node (`type:'row'`) with inline `children`; `Token` stays `TextToken | MarkToken`. The serialize/process/findToken recursions gain a `'row'` arm so a `RowToken[]` round-trips and `transform`/`findToken` walk row children. No production code produces a `RowToken` yet — this task is pure type + recursion plumbing, gated by a new serialize spec that builds a `RowToken` by hand.

- [ ] **Step 1: Capture the baseline**

Run: `pnpm -F core test`
Run: `pnpm run typecheck`
Expected: full pass / clean (the pre-change baseline).

- [ ] **Step 2: Add the `RowToken` interface to `types.ts`**

In `packages/core/src/features/tokens/parser/types.ts`, after the `MarkToken` interface (`:17-35`), add:

```ts
/**
 * A first-class block-mode row (Phase 7). The block parser pre-splits the value
 * on the row terminator and wraps each segment as a Row; the tree's top level in
 * block mode is `RowToken[]`. `content`/`position` INCLUDE the terminator, so
 * `joinContents(rows) === value` byte-for-byte; `children` are the row's inline
 * tokens (positions absolute, terminator excluded). A Row is never an inline
 * child — `Token` (mark/row children) stays `TextToken | MarkToken`.
 */
export interface RowToken {
	type: 'row'
	content: string
	position: {
		start: number
		end: number
	}
	/** Stable identity id, stamped by reconcile (tokenIdentity) — NOT by the parser. Absent on freshly parsed, never-reconciled trees. */
	id?: number
	/** Inline tokens of the row content (the same shape parse() emits for inline). */
	children: Token[]
	/** False only for a trailing unterminated segment (the document's final, un-`\n\n`-ed row). */
	terminated: boolean
}
```

(`Token` stays `export type Token = TextToken | MarkToken` — do NOT add `RowToken` to it. The block tree is `RowToken[]`, a separate top-level shape.)

- [ ] **Step 3: Add the `'row'` arm to `toString`**

In `packages/core/src/features/tokens/parser/utils/toString.ts`, change the function signature to accept `(Token | RowToken)[]` and add the row arm. Change the import (`:1`) to:

```ts
import type {RowToken, Token} from '../types'
```

Change the signature + loop (`:21-38`) to:

```ts
export function toString(tokens: readonly (Token | RowToken)[]): string {
	let result = ''

	for (const token of tokens) {
		if (token.type === 'text') {
			result += token.content
			continue
		}

		// A Row serializes byte-exact from its content (children + terminator are
		// already in content) — the round-trip is `split → parse → serialize ≡ value`.
		if (token.type === 'row') {
			result += token.content
			continue
		}

		const {markup, hasSlot} = token.descriptor
		const slot = hasSlot ? (token.children.length > 0 ? toString(token.children) : token.slot?.content) : undefined

		result += annotate(markup, {
			value: token.value,
			meta: token.meta,
			slot,
		})
	}

	return result
}
```

(The `Parser.stringify(tokens: Token[])` signature at `Parser.ts:92,142` accepts `Token[]` — `Token[]` is assignable to `(Token | RowToken)[]`. Leave `Parser.stringify` typed `Token[]`; block serialize goes through `toString` directly — Task 9 wires the block serialize path if needed. If typecheck flags `Parser.stringify` passing `Token[]` to a `(Token|RowToken)[]` param, that is fine — `Token[]` ⊆ `(Token|RowToken)[]`. Verify in Step 7.)

- [ ] **Step 4: Add the `'row'` arm to `processTokensWithCallback`**

In `packages/core/src/features/tokens/parser/utils/processTokens.ts`, extend the recursion to row children. Change the import (`:1`) to:

```ts
import type {MarkToken, RowToken, Token} from '../types'
```

Change the signature + the recursion guard (`:9-19`). The function takes `(Token | RowToken)[]`; a `RowToken` recurses its children verbatim (a row is not a mark — it has no callback transform, it just concatenates its processed children):

```ts
export function processTokensWithCallback(tokens: (Token | RowToken)[], callback: (mark: MarkToken) => string): string {
	let result = ''
	for (const token of tokens) {
		if (token.type === 'text') {
			result += token.content
		} else if (token.type === 'row') {
			// A row is a structural container — process its children, no callback.
			result += processTokensWithCallback(token.children, callback)
		} else {
```

(Leave the rest of the mark branch unchanged. The `transform()` entry — `Parser.transform` at `Parser.ts:171-174` — passes `this.parse(value)` which is `Token[]` for inline; block `transform` is not a supported surface, so this arm only matters if a `RowToken[]` is ever passed through. It is defensive plumbing.)

- [ ] **Step 5: Add the `'row'` arm to `findToken`**

In `packages/core/src/features/tokens/utils/findToken.ts`, recurse into row children too. Change the import (`:1`) + the body (`:8-16`):

```ts
import type {MarkToken, RowToken, Token} from '../parser/types'

export interface TokenContext {
	depth: number
	parent?: MarkToken
}

export function findToken(
	tokens: (Token | RowToken)[],
	target: Token | RowToken,
	depth = 0,
	parent?: MarkToken
): TokenContext | undefined {
	for (const token of tokens) {
		if (token === target) return {depth, parent}
		if (token.type === 'mark' || token.type === 'row') {
			const result = findToken(token.children, target, depth + 1, token.type === 'mark' ? token : parent)
			if (result) return result
		}
	}
}
```

(A row is not a `MarkToken`, so it cannot be `parent` (typed `MarkToken`); when descending a row, keep the outer `parent` — a row's children's "parent mark" is the enclosing mark, of which there is none at the top level, so `undefined`. This preserves the `TokenContext.parent: MarkToken` contract.)

- [ ] **Step 6: Export `RowToken`**

In `packages/core/src/features/tokens/index.ts` (`:4`), add `RowToken` to the parser-types re-export:

```ts
export type {Token, TextToken, MarkToken, RowToken, Markup, ParseOptions} from './parser/types'
```

In `packages/core/index.ts` (`:22`), add `RowToken` to the public type re-export:

```ts
export type {Markup, Token, TextToken, MarkToken, RowToken} from './src/features/tokens'
```

- [ ] **Step 7: Write the serialize spec (TDD pin for the plumbing)**

Create `packages/core/src/features/tokens/parser/utils/toString.row.spec.ts`:

```ts
import {describe, expect, it} from 'vitest'

import type {RowToken, Token} from '../types'
import {toString} from './toString'

function textToken(content: string, start: number): Token {
	return {type: 'text', content, position: {start, end: start + content.length}}
}

function row(content: string, start: number, children: Token[], terminated: boolean): RowToken {
	return {type: 'row', content, position: {start, end: start + content.length}, children, terminated}
}

describe('toString — RowToken arm', () => {
	it('serializes a RowToken byte-exact from its content (terminator included)', () => {
		const rows: RowToken[] = [
			row('First row\n\n', 0, [textToken('First row', 0)], true),
			row('Second row', 11, [textToken('Second row', 11)], false),
		]
		expect(toString(rows)).toBe('First row\n\nSecond row')
	})

	it('serializes an empty terminated row from its content', () => {
		const rows: RowToken[] = [row('\n\n', 0, [], true), row('b', 2, [textToken('b', 2)], false)]
		expect(toString(rows)).toBe('\n\nb')
	})
})
```

- [ ] **Step 8: Run the new spec + the serialize suite + typecheck**

Run: `pnpm -w exec vitest run --project core "toString.row.spec"`
Run: `pnpm -w exec vitest run --project core "toString.spec"`
Run: `pnpm -w exec vitest run --project core "findToken"`
Expected: full pass each — the new row serialize pin is green; the existing `toString`/`findToken` suites are unchanged (the row arm is additive).

Run: `pnpm -F core test`
Run: `pnpm run typecheck`
Expected: full pass / clean — `RowToken` is exported, the recursions accept the union, and no production code produces a `RowToken` yet (so no behavior changed).

- [ ] **Step 9: Commit**

```bash
git commit -m "feat(tokens): add RowToken type + serialize/process/findToken arms (plumbing)" -- packages/core/src/features/tokens/parser/types.ts packages/core/src/features/tokens/parser/utils/toString.ts packages/core/src/features/tokens/parser/utils/processTokens.ts packages/core/src/features/tokens/utils/findToken.ts packages/core/src/features/tokens/index.ts packages/core/index.ts packages/core/src/features/tokens/parser/utils/toString.row.spec.ts
```

---

### Task 2: `BlockParser` — pre-split + per-row inline parse + terminator derivation (pure, unit-tested)

**Files:**
- Create: `packages/core/src/features/tokens/parser/core/BlockParser.ts`
- Create: `packages/core/src/features/tokens/parser/core/BlockParser.spec.ts`

The pure pre-split engine: derive the terminator from the registry (validated once), split the value, parse each row's pre-terminator content with the inline `Parser`, rebase child positions to absolute offsets, and emit `RowToken[]`. No `TokenModel`/reconcile/bind wiring yet (Task 3+). This is the row-local incrementality foundation — but `BlockParser.parse` is a FULL block parse (split + per-row inline parse); row-locality is reconcile's job (Task 4), not the parser's.

- [ ] **Step 1: Write `BlockParser.ts`**

Create `packages/core/src/features/tokens/parser/core/BlockParser.ts`:

```ts
import type {RowToken, Token} from '../types'
import type {Parser} from '../Parser'

/** The default row terminator when block mode has no slot-leading option. */
export const DEFAULT_ROW_TERMINATOR = '\n\n'

type RowSegment = {
	/** Pre-terminator content (what the inline parser parses). */
	readonly inner: string
	/** Absolute start offset in the document. */
	readonly start: number
	/** Whether this segment ends with the terminator. */
	readonly terminated: boolean
}

/**
 * The block pre-split parser (Phase 7). Wraps an inline {@link Parser}: it
 * pre-splits the value on the row terminator, parses each row's pre-terminator
 * content as inline tokens (positions rebased to absolute document offsets), and
 * wraps each in a {@link RowToken}. Parsing is row-local by construction — a
 * keystroke inside row k changes only row k's content substring; reconcile
 * (tokenIdentity) reuses every other row's RowToken by reference.
 */
export class BlockParser {
	readonly terminator: string

	constructor(
		private readonly inline: Parser,
		terminator: string
	) {
		if (terminator.length === 0) throw new Error('BlockParser: terminator must be non-empty')
		this.terminator = terminator
	}

	/**
	 * Pre-split the value on the terminator. Each non-final piece is a terminated
	 * row; the final piece is a row iff it is non-empty (a trailing empty piece
	 * after a final terminator is NOT a row — matches the old filterEmptyText
	 * outcome). An empty document yields ZERO segments → one synthetic empty row.
	 */
	splitRows(value: string): RowSegment[] {
		const term = this.terminator
		const segments: RowSegment[] = []
		let at = 0
		let sep = value.indexOf(term)
		while (sep !== -1) {
			segments.push({inner: value.slice(at, sep), start: at, terminated: true})
			at = sep + term.length
			sep = value.indexOf(term, at)
		}
		// trailing piece: a row only if non-empty (no dangling empty row)
		if (at < value.length) {
			segments.push({inner: value.slice(at), start: at, terminated: false})
		}
		// empty document (or a value that is exactly terminators with no content
		// before the last one) still needs one editable row
		if (segments.length === 0) {
			segments.push({inner: '', start: 0, terminated: false})
		}
		return segments
	}

	parse(value: string): RowToken[] {
		return this.splitRows(value).map(segment => this.parseRow(segment))
	}

	private parseRow(segment: RowSegment): RowToken {
		const children = this.inline.parse(segment.inner)
		rebase(children, segment.start)
		const content = segment.terminated ? segment.inner + this.terminator : segment.inner
		return {
			type: 'row',
			content,
			position: {start: segment.start, end: segment.start + content.length},
			children,
			terminated: segment.terminated,
		}
	}
}

/** Shift every token's positions by `delta` (the row's absolute start), in place. */
function rebase(tokens: Token[], delta: number): void {
	if (delta === 0) return
	for (const token of tokens) {
		token.position = {start: token.position.start + delta, end: token.position.end + delta}
		if (token.type === 'mark') {
			if (token.slot) token.slot = {...token.slot, start: token.slot.start + delta, end: token.slot.end + delta}
			rebase(token.children, delta)
		}
	}
}
```

(NOTE on `rebase`: the inline `Parser` parses a SLICE starting at offset 0, so child positions are relative to the slice; shifting by `segment.start` makes them absolute. An empty row (`inner === ''`) parses to `[TextToken('', 0, 0)]` — BUT a `RowToken` with an empty `inner` should have ZERO children, not a single empty text token, so the empty-slot collapse is unrepresentable. Handle this in `parseRow`: when `segment.inner === ''`, set `children: []`. Add that guard — see Step 1b.)

- [ ] **Step 1b: Empty-row → zero children**

In `BlockParser.parseRow`, guard the empty case so an empty row has zero children (the spec: "an empty Row has zero children, pairs 1:1 across reconcile"). Change `parseRow`'s `children` derivation:

```ts
	private parseRow(segment: RowSegment): RowToken {
		const children = segment.inner === '' ? [] : this.inline.parse(segment.inner)
		rebase(children, segment.start)
		const content = segment.terminated ? segment.inner + this.terminator : segment.inner
		return {
			type: 'row',
			content,
			position: {start: segment.start, end: segment.start + content.length},
			children,
			terminated: segment.terminated,
		}
	}
```

(`rebase([], …)` is a no-op — safe. An empty row's `content` is `''` (unterminated final) or the terminator alone (`'\n\n'` for an empty terminated row, e.g. the middle row of `'\n\nb\n\n'`).)

- [ ] **Step 2: Add the terminator-derivation helper**

The terminator is derived from the registry's slot-leading descriptor (the single-segment, `hasSlot` markup). Add a static factory to `BlockParser` that reads the inline parser's registry. The `Parser` does not currently expose its registry — add a narrow accessor. In `packages/core/src/features/tokens/parser/Parser.ts`, after `hasSegments` (`:188-190`), add:

```ts
	/**
	 * The row terminator for block mode (Phase 7): the lone static segment of the
	 * single slot-leading single-segment markup (`'__slot__\n\n'` → `'\n\n'`),
	 * or `undefined` when no such markup is configured. One terminator per
	 * document — throws if two slot-leading descriptors disagree (today's block
	 * configs have exactly one row markup, so this never fires in practice).
	 */
	rowTerminator(): string | undefined {
		let terminator: string | undefined
		for (const descriptor of this.registry.descriptors) {
			if (!(descriptor.hasSlot && descriptor.segments.length === 1)) continue
			const segment = descriptor.segments[0]
			if (typeof segment !== 'string') continue
			if (terminator !== undefined && terminator !== segment) {
				throw new Error(
					`Parser: ambiguous row terminator — slot-leading markups disagree ("${terminator}" vs "${segment}")`
				)
			}
			terminator = segment
		}
		return terminator
	}
```

(`registry` is `private readonly` on `Parser` (`:24`) — `rowTerminator` is a method on `Parser`, so it has access. `descriptor.segments` for a single-segment slot markup is `['\n\n']` — `createMarkupDescriptor` for `'__slot__\n\n'` produces `segments: ['\n\n']`, `gapTypes: ['slot']`, `hasSlot: true`. VERIFY with the spec in Step 4. `descriptor.segments[0]` is a `SegmentDefinition` (string | dynamic) — guard `typeof segment !== 'string'` skips a dynamic segment, which a row markup never is.)

- [ ] **Step 3: Add a `BlockParser.from` factory**

In `BlockParser.ts`, add a static factory that derives the terminator from a `Parser` and defaults to `'\n\n'`:

```ts
	/** Build a block parser over an inline parser, deriving the terminator from its row markup (default `'\n\n'`). */
	static from(inline: Parser): BlockParser {
		return new BlockParser(inline, inline.rowTerminator() ?? DEFAULT_ROW_TERMINATOR)
	}
```

(Place it as a static method on the `BlockParser` class. Import is already present — `Parser` is imported as a type; for the static factory's param `inline: Parser` the type import suffices.)

- [ ] **Step 4: Write `BlockParser.spec.ts`**

Create `packages/core/src/features/tokens/parser/core/BlockParser.spec.ts`:

```ts
import {describe, expect, it} from 'vitest'

import type {Markup} from '../types'
import {Parser} from '../Parser'
import {BlockParser, DEFAULT_ROW_TERMINATOR} from './BlockParser'

const ROW: Markup = '__slot__\n\n'

function blockParser(markup: Markup = ROW): BlockParser {
	return BlockParser.from(new Parser([markup]))
}

describe('BlockParser — terminator derivation', () => {
	it('derives the terminator from the slot-leading markup suffix', () => {
		expect(new Parser([ROW]).rowTerminator()).toBe('\n\n')
		expect(blockParser().terminator).toBe('\n\n')
	})

	it('defaults to \\n\\n when there is no slot-leading markup', () => {
		expect(new Parser(['@[__value__]']).rowTerminator()).toBeUndefined()
		expect(BlockParser.from(new Parser(['@[__value__]'])).terminator).toBe(DEFAULT_ROW_TERMINATOR)
	})

	it('throws on disagreeing slot-leading terminators', () => {
		// oxlint-disable-next-line no-unsafe-type-assertion -- raw markup literals
		expect(() => new Parser(['__slot__\n\n' as Markup, '__slot__###' as Markup]).rowTerminator()).toThrow(
			/ambiguous row terminator/
		)
	})
})

describe('BlockParser — pre-split', () => {
	it('splits a two-row terminated document, last row unterminated', () => {
		const rows = blockParser().parse('First row\n\nSecond row')
		expect(rows).toHaveLength(2)
		expect(rows[0]).toMatchObject({type: 'row', content: 'First row\n\n', terminated: true, position: {start: 0, end: 11}})
		expect(rows[1]).toMatchObject({type: 'row', content: 'Second row', terminated: false, position: {start: 11, end: 21}})
	})

	it('a trailing terminator yields one terminated row, not a dangling empty row', () => {
		const rows = blockParser().parse('First row\n\n')
		expect(rows).toHaveLength(1)
		expect(rows[0]).toMatchObject({content: 'First row\n\n', terminated: true})
	})

	it('an empty document yields one synthetic empty unterminated row with zero children', () => {
		const rows = blockParser().parse('')
		expect(rows).toHaveLength(1)
		expect(rows[0]).toMatchObject({content: '', terminated: false, children: []})
	})

	it('an empty middle row (\\n\\nb\\n\\n) has zero children and a terminator-only content', () => {
		const rows = blockParser().parse('\n\nb\n\n')
		expect(rows).toHaveLength(2)
		expect(rows[0]).toMatchObject({content: '\n\n', terminated: true, children: []})
		expect(rows[1]).toMatchObject({content: 'b\n\n', terminated: true})
		expect(rows[1].children).toHaveLength(1)
	})
})

describe('BlockParser — per-row inline parse with absolute positions', () => {
	it('parses a marked row and rebases child positions to absolute offsets', () => {
		// Two markups: the row markup AND an inline mention inside a row.
		// oxlint-disable-next-line no-unsafe-type-assertion -- raw markup literals
		const parser = new Parser(['__slot__\n\n' as Markup, '@[__value__]' as Markup])
		const block = BlockParser.from(parser)
		const rows = block.parse('hi @[bob]\n\nbye')
		expect(rows).toHaveLength(2)
		// row 0 children: TextToken('hi ') + MarkToken('@[bob]') + TextToken('')
		const mark = rows[0].children.find(c => c.type === 'mark')
		expect(mark).toBeDefined()
		// '@[bob]' starts at absolute index 3 in 'hi @[bob]\n\nbye'
		expect(mark?.position).toEqual({start: 3, end: 9})
	})
})

describe('BlockParser — round-trip', () => {
	it('split → parse → serialize ≡ value for representative documents', () => {
		const block = blockParser()
		for (const value of ['', 'a', 'a\n\n', 'a\n\nb', 'a\n\nb\n\n', '\n\nb\n\n', 'one\n\n\n\ntwo']) {
			const rows = block.parse(value)
			expect(rows.map(r => r.content).join('')).toBe(value)
		}
	})
})
```

(NOTE: `'one\n\n\n\ntwo'` — a `\n\n\n\n` is TWO terminators, so it splits as `['one', '', 'two']` → rows `'one\n\n'`, `'\n\n'` (empty terminated), `'two'` (unterminated). `join` of contents = `'one\n\n' + '\n\n' + 'two' = 'one\n\n\n\ntwo'` ✓. VERIFY the `splitRows` loop handles back-to-back terminators — `value.indexOf(term, at)` from `at = sep + 2` finds the next `\n\n` immediately, emitting an empty terminated row. Good.)

- [ ] **Step 5: Run the BlockParser spec + typecheck**

Run: `pnpm -w exec vitest run --project core "BlockParser.spec"`
Expected: full pass — terminator derivation, pre-split (including empty/dangling/back-to-back), absolute-position rebasing, and round-trip all green.

Run: `pnpm -w exec vitest run --project core "parser/Parser.spec"`
Expected: full pass — `rowTerminator` is additive; inline `parse` is untouched.

Run: `pnpm run typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(parser): BlockParser — pre-split rows, per-row inline parse, terminator derivation" -- packages/core/src/features/tokens/parser/core/BlockParser.ts packages/core/src/features/tokens/parser/core/BlockParser.spec.ts packages/core/src/features/tokens/parser/Parser.ts
```

---

### Task 3: Wire `BlockParser` into `TokenModel.#reparse`; delete `filterEmptyText`

**Files:**
- Modify: `packages/core/src/features/tokens/model/TokenModel.ts`

Block mode now emits `RowToken[]` from the `BlockParser` instead of the inline `Parser` + `filterEmptyText`. `#reparse` derives the block parser from the inline parser (cached per parser instance) and hands the `RowToken[]` to reconcile. `filterEmptyText` (the last empty-slot collapse) is deleted. After this task the block tree is a Row tree end-to-end through reconcile/commit (reconcile already accepts any `Token[]`-shaped array; Task 4 makes the diff row-local). The render gates may go RED here (reconcile treats rows as opaque tokens until Task 4) — that is the predicted intermediate state; Task 4 closes it. To keep the suite landable per-task, this task verifies the block tree SHAPE (a new `TokenModel` block spec) and accepts that the row-local render-count optimization arrives in Task 4. **If `renderCount` block gates go red here, that is predicted — proceed to Task 4; do not stop.**

- [ ] **Step 1: Capture the baseline**

Run: `pnpm -w exec vitest run --project core "model/TokenModel"`
Run: `pnpm -w exec vitest run --project core "TokenModel.changed.spec"`
Expected: full pass (pre-change baseline).

- [ ] **Step 2: Replace `filterEmptyText` with the block parse in `#reparse`**

In `TokenModel.ts`, the `#parser` computed (`:117-125`) builds the inline `Parser`. Add a parallel `#blockParser` computed that derives the `BlockParser` from it (recomputes only when the inline parser does). After the `#parser` computed, add:

```ts
	readonly #blockParser: Computed<BlockParser | undefined> = computed(() => {
		const parser = this.#parser()
		return parser ? BlockParser.from(parser) : undefined
	})
```

Change `#reparse` (`:140-146`) from:

```ts
	#reparse(value: string, parser: Parser | undefined, isBlock: boolean): void {
		const hint = this.value.takePendingEdit()
		const previousValue = this.value.previousValue()
		const parsed = parser ? parser.parse(value) : [createTextToken(value)]
		const tokens = isBlock ? filterEmptyText(parsed) : parsed
		this.#pipeline.apply(this.#identity.reconcile(tokens, hint, previousValue, value))
	}
```

to — block mode pre-splits into rows; inline mode is the unchanged full inline parse:

```ts
	#reparse(value: string, parser: Parser | undefined, isBlock: boolean): void {
		const hint = this.value.takePendingEdit()
		const previousValue = this.value.previousValue()
		// Block mode: the value pre-splits into first-class rows (RowToken[]) — the
		// row IS the structural unit, so the empty-slot collapse (the old
		// filterEmptyText) is unrepresentable. Inline mode is the full inline parse.
		const tokens = isBlock
			? (this.#blockParser()?.parse(value) ?? [createTextToken(value)])
			: parser
				? parser.parse(value)
				: [createTextToken(value)]
		this.#pipeline.apply(this.#identity.reconcile(tokens, hint, previousValue, value))
	}
```

(The trigger watch (`:162-166`) reads `this.#parser()` — the `#blockParser` is a computed OVER `#parser`, so reading `this.#blockParser()` INSIDE the callback (which runs untracked) is safe and recomputes lazily when `#parser` changes. The watch's tracked deps are unchanged — it still tracks `value`/`#parser()`/`isBlock`. `reconcile`'s `tokens` param is typed `Token[]`; a `RowToken[]` is NOT assignable to `Token[]` — Task 4 widens `reconcile`'s signature to accept the block shape. For THIS task, cast at the call site with a TODO removed in Task 4, OR widen the local `tokens` type. The clean move: widen `reconcile` here is Task 4's job, so for Task 3 type the local as `Token[] | RowToken[]` and pass it — see Step 3.)

- [ ] **Step 3: Widen the `reconcile` call to accept the block shape (interim)**

`IdentityTracker.reconcile(next: Token[], …)` does not yet accept `RowToken[]`. For Task 3, widen the `reconcile` parameter to `(Token | RowToken)[]` so the block tree type-checks; the row-LOCAL diff is Task 4. In `tokenIdentity.ts`, change the `reconcile` signature in the `IdentityTracker` type (`:62`) and the implementation (`:115`):

Type (`:62`):

```ts
	reconcile(next: (Token | RowToken)[], hint?: EditHint, previousValue?: string, nextValue?: string): ReconcileResult
```

Implementation (`:115`):

```ts
		reconcile(next, hint, previousValue, nextValue) {
```

And the `ReconcileResult.tokens` type (`:45`):

```ts
	tokens: (Token | RowToken)[]
```

Import `RowToken` in `tokenIdentity.ts` (`:2`):

```ts
import type {MarkToken, RowToken, Token} from './parser/types'
```

The existing reconcile body diffs `next` with `ensureId`/`tokensEqual`/`tryDescend` — these branch on `token.type === 'mark'`. A `RowToken` (`type:'row'`) falls through every `'mark'` check as if it were a non-mark, non-text token: `ensureId` stamps it but does NOT recurse children (the `if (token.type === 'mark')` guard), `tokensEqual` returns false on a type mismatch but true on `a === b`, the middle pairing treats a row pair as `candidate.type === token.type` (both `'row'`) → inherits id + `textChanged` (a row is not a mark, so `structural` is NOT set — a content-only row change rides the text path, but with the WHOLE row as one `textChanged` entry, which `commitText` can't patch because a row has no `textElement`). **So after Task 3, a block keystroke escalates structurally (the render gates regress) — predicted.** Task 4 adds row-children recursion + row-local diff. For Task 3, make `ensureId`/`collectChanges`/`collectRemovedIds`/`inherit` recurse into `'row'` children so ids are stamped on the whole row subtree (otherwise bind throws "token has no id"). Change every `if (token.type === 'mark')` recursion in `tokenIdentity.ts` that walks `.children` to ALSO walk `'row'` children — see Step 3b.

- [ ] **Step 3b: Make id-stamping/recursion row-aware (so bind gets ids on row children)**

In `tokenIdentity.ts`, the functions that recurse `token.children` on `type === 'mark'` must also recurse on `type === 'row'` (a row has `children` too) so the WHOLE block subtree gets ids (bind's `collectTree` at `bind.ts:130` throws if any token lacks an id). Update:

- `ensureId` (`:83-95`): change `if (token.type === 'mark') token.children.forEach(ensureId)` to `if (token.type === 'mark' || token.type === 'row') token.children.forEach(ensureId)`.
- `inherit` (`:97-108`): change `if (from.type === 'mark' && to.type === 'mark')` to also handle row pairs — `if ((from.type === 'mark' || from.type === 'row') && from.type === to.type)`; the body (`Math.min(children.length)`, recurse, `ensureId`) is shape-identical for rows.
- The cold-start `collect` (`:122-128`): `if (token.type === 'mark') collect(...)` → `if (token.type === 'mark' || token.type === 'row') collect(...)`.
- `collectChanges` (`:145-151`): `if (token.type === 'mark')` → `if (token.type === 'mark' || token.type === 'row')`.
- `collectRemovedIds` (`:154-157`): `if (token.type === 'mark')` → `if (token.type === 'mark' || token.type === 'row')`.

Add a small helper at the file end to avoid repetition (optional — inline the `|| type === 'row'` if cleaner):

```ts
function hasChildren(token: Token | RowToken): token is MarkToken | RowToken {
	return token.type === 'mark' || token.type === 'row'
}
```

(Use `hasChildren(token)` in the five recursion guards above. This keeps the cold-start path correct: a fresh block tree of `RowToken[]` gets every row + every child id-stamped, so bind never throws. The MIDDLE/PREFIX/SUFFIX diff still treats a row as an opaque token → escalates — Task 4 fixes the DIFF; Task 3 only fixes id COVERAGE.)

- [ ] **Step 4: Delete `filterEmptyText` + drop the now-unused import path**

In `TokenModel.ts`, delete the `filterEmptyText` module function (`:453-457`):

```ts
function filterEmptyText(tokens: Token[]): Token[] {
	return tokens.filter(token => {
		if (token.type !== 'text') return true
		return token.position.start !== token.position.end
	})
}
```

Add the `BlockParser` import (with the other parser imports near `:10`):

```ts
import {BlockParser} from '../parser/core/BlockParser'
```

(`createTextToken` (`:12`) STAYS — the no-parser arm uses it. `Token` import stays — `renderTree`/`tokens()` types. Add `RowToken` to the `Token` type import (`:11`) if `#blockParser`'s type names it:

```ts
import type {RowToken, Token} from '../parser/types'
```

VERIFY the `tokens()`/`at()` return types — `tokens(): readonly Token[]` (`:87`) and `at(index): Token | undefined` (`:92`) now return rows in block mode. Widen to `readonly (Token | RowToken)[]` / `Token | RowToken | undefined`. The pipeline's `tokens()` returns `latest` typed `Token[]` (`commit.ts`) — Task 4 widens `commit.ts` `latest`/`renderTree` to `(Token | RowToken)[]`. For Task 3, widen `TokenModel.tokens()`/`at()` to the union and let `commit.ts` be widened in Step 5.)

- [ ] **Step 5: Widen the commit pipeline tree types to the union**

In `commit.ts`, the pipeline carries `Token[]` for `latest`/`renderTree`/`apply`. Widen to `(Token | RowToken)[]`:
- import `RowToken` (`:4`): `import type {Token, RowToken} from '../parser/types'`
- `renderTree: Computed<Token[]>` (`:38`, the type + the signal `:61`) → `Computed<(Token | RowToken)[]>` and `signal<(Token | RowToken)[]>`
- `tokens(): readonly Token[]` (`:39`) → `readonly (Token | RowToken)[]`
- `apply(result: ReconcileResult)` — `ReconcileResult.tokens` is now `(Token | RowToken)[]` (Task 3 Step 3), so `latest = tokens` (`:95`), `commitStructural(tokens: Token[]` (`:176`) → `(Token | RowToken)[]`, `bind`'s `tokens` param (`bind.ts:27`) → `(Token | RowToken)[]`.

In `bind.ts`, widen `BindInput.tokens` (`:27`), the `Frame.tokens` (`:55`), `collectTree`/`walkDom` token params to `(Token | RowToken)[]`, and make `collectTree` recurse into `'row'` children (`:130`: `if (token.type === 'mark' || token.type === 'row') collectTree(token.children, …)`). The `walkDom` block/inline branches still assume the old shape — Task 5 rewrites them; for Task 3 the type widens so it compiles, and the block walk still produces the OLD (slot-mark-era) bindings (which no longer match the Row tree → bind bails → structural escalation, the predicted red). KEEP the walk logic untouched in Task 3; only widen types + add the `collectTree` row recursion.

In `TokenModel.ts`, the `renderTree` field (`:78`) + `keyOf` (`:115`, `token: Token`) + `tokens()`/`at()` widen to the union. `keyOf`'s param → `(token: Token | RowToken)`.

- [ ] **Step 6: Add a TokenModel block-shape spec (TDD pin for the Row tree)**

The render-count optimization is Task 4; here, pin that block mode produces a `RowToken[]` tree through `tokens()`. Read `packages/core/src/features/tokens/model/TokenModel.index.spec.ts` to learn the block harness (how a block-mode `TokenModel` is built + how `tokens()` is read), then add a focused case. (If a block harness does not exist in that spec, add the minimal one matching the existing inline harness, flipping `layout` to block via the props model — follow the existing construction.) The pin:

```ts
it('block mode exposes a RowToken[] tree from tokens()', async () => {
	// build a block-mode TokenModel over '__slot__\n\n' with defaultValue 'a\n\nb'
	// … (mirror the existing block harness in this file) …
	const rows = model.tokens()
	expect(rows).toHaveLength(2)
	expect(rows.every(r => r.type === 'row')).toBe(true)
	expect(rows.map(r => (r as RowToken).content).join('')).toBe('a\n\nb')
})
```

(Adjust to the file's actual harness. The point is a green pin that block `tokens()` is `RowToken[]` and round-trips. Import `RowToken` from `../parser/types`.)

- [ ] **Step 7: Run the model specs + typecheck; expect the documented partial state**

Run: `pnpm -w exec vitest run --project core "model/TokenModel"`
Expected: the new block-shape pin is GREEN. The existing inline specs are GREEN (inline mode is unchanged).

Run: `pnpm -w exec vitest run --project core "TokenModel.changed.spec"`
Expected: the INLINE render-count gate (`:121-167`, 3 text edits → renderTree 0) stays GREEN (inline path unchanged). If a BLOCK case in this file regresses, that is the predicted Task-4 gap — NOTE it and proceed.

Run: `pnpm run typecheck`
Expected: clean — the union widened through `commit.ts`/`bind.ts`/`tokenIdentity.ts`/`TokenModel.ts`.

Run: `pnpm -w exec vitest bench --project core parser.bench`
Expected: the bench still RUNS (the inline benches are untouched; no block bench exists yet). Confirms no compile break from the widening.

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(tokens): block #reparse emits RowToken[] via BlockParser; delete filterEmptyText" -- packages/core/src/features/tokens/model/TokenModel.ts packages/core/src/features/tokens/tokenIdentity.ts packages/core/src/features/tokens/model/commit.ts packages/core/src/features/tokens/model/bind.ts packages/core/src/features/tokens/model/TokenModel.index.spec.ts
```

(If `TokenModel.changed.spec.ts` had a block case that you only NOTED as red without changing the file, do NOT include it in the commit. If you added the block pin to a different spec file, adjust the paths.)

---

### Task 4: Reconcile rows — row-local diff + row-locality property (empty-slot collapse unrepresentable)

**Files:**
- Modify: `packages/core/src/features/tokens/tokenIdentity.ts`
- Create: `packages/core/src/features/tokens/tokenIdentity.rows.spec.ts`

The block top level is now `RowToken[]`. Reconcile must diff rows ROW-LOCALLY: an unchanged row (byte-identical `content` + position) is reused by reference (id carried); a position-shifted-only row inherits its id + whole subtree (rows pre-split, so a shifted row's `content` substring is identical ⇒ children reused); a content-CHANGED row reconciles its `children` inline (the existing prefix/suffix/middle + inline `tryDescend`) and the ROW itself becomes `update` (a row renders no framework props beyond its children — a content change inside it is the text path). Row add/remove (split/merge) is `structural`. This delivers the row-locality property and makes block typing ride the text path (the render gates go green again).

- [ ] **Step 1: Read the current reconcile top-level diff**

Read `tokenIdentity.ts:115-358` (the `reconcile` body): the cold-start path (`:118-131`), the windowed prefix/suffix/middle diff (`:133-357`), `tryDescend` (`:167-204`), `pairSlotChildren` (`:215-271`). The block path needs a SEPARATE branch: when `next` is `RowToken[]` (every top-level token is `type:'row'`), run a row-local diff instead of the inline token diff. The inline `tryDescend` is REUSED to reconcile a changed row's INLINE children (a row's children are `Token[]`).

- [ ] **Step 2: Add the row-local reconcile branch**

In `tokenIdentity.ts`, inside `reconcile`, after the cold-start block (`:118-131`) and BEFORE the inline windowed diff (`:133`), add a block branch that fires when the previous AND next trees are row trees. Add a top-of-`reconcile` detection + dispatch:

```ts
		reconcile(next, hint, previousValue, nextValue) {
			const prev = previous

			if (!prev) {
				// … existing cold-start, but it now id-stamps rows + their children
				// (ensureId recurses 'row' children — Task 3 Step 3b) …
			}

			// Block path: a top level of RowToken[] diffs ROW-LOCALLY — a row whose
			// content+position is byte-identical is reused by reference; a shifted
			// row inherits its id + subtree; a content-changed row reconciles its
			// inline children (the same machinery) and the row becomes `update`.
			if (isRowTree(next) && isRowTree(prev)) {
				return reconcileRows(next, prev)
			}

			// … existing inline windowed diff …
		}
```

Add `isRowTree` near the file-end helpers:

```ts
function isRowTree(tokens: readonly (Token | RowToken)[]): tokens is RowToken[] {
	return tokens.length > 0 && tokens.every(token => token.type === 'row')
}
```

(`next` is always non-empty in block mode — `BlockParser` emits ≥1 row. If `prev` is an inline tree and `next` is a row tree, e.g. a layout flip mid-session, the block branch is skipped and the inline diff runs (treating rows opaquely) → a structural pass on the flip. A layout flip is structural anyway, so this is correct.)

- [ ] **Step 3: Implement `reconcileRows`**

`reconcileRows` is defined as a CLOSURE inside `reconcile` (it needs `ids`/`ensureId`/`inherit`/`changes`/`removedIds`/`structural`/the inline `tryDescend`+windowed child diff). The clean shape: factor the inline TOKEN diff (prefix/suffix/middle over a `Token[]` with a window) into a reusable inner function `reconcileChildren(prevKids, nextKids, prevSlot?, nextSlot?, basePath)` that `pairSlotChildren` already approximates — then a changed row calls it on its `children`. To keep this task bounded, implement `reconcileRows` directly with the row skeleton + per-changed-row inline child reconcile:

```ts
			const reconcileRows = (nextRows: RowToken[], prevRows: RowToken[]): ReconcileResult => {
				const out: (Token | RowToken)[] = nextRows.slice()
				const changes: TokenChangeEntry[] = []
				const removedIds: number[] = []
				let structural = false
				const matchedPrev = new Set<RowToken>()

				// Window over rows from the value hint (or findGap) — same as inline,
				// but the "tokens" are whole rows. A row whose content+position is
				// byte-identical and before the window is reused by reference.
				const window = hint ?? hintFromValues(previousValue ?? joinContents(prevRows), nextValue ?? joinContents(nextRows))
				const shiftDelta = window.insertedLength - (window.end - window.start)

				// 1. Prefix: rows entirely before the window, content+position identical → reuse object.
				let p = 0
				while (p < prevRows.length && p < nextRows.length && prevRows[p].position.end <= window.start && rowsEqual(prevRows[p], nextRows[p])) {
					out[p] = prevRows[p]
					matchedPrev.add(prevRows[p])
					p++
				}

				// 2. Suffix: rows entirely after the window, identical modulo shiftDelta → inherit id + subtree.
				let prevTail = prevRows.length - 1
				let nextTail = nextRows.length - 1
				while (prevTail >= p && nextTail >= p && prevRows[prevTail].position.start >= window.end && rowsEqualShifted(prevRows[prevTail], nextRows[nextTail], shiftDelta)) {
					matchedPrev.add(prevRows[prevTail])
					if (shiftDelta !== 0) {
						inherit(prevRows[prevTail], nextRows[nextTail])
						collectChanges(nextRows[nextTail], [nextTail], 'update')
					} else {
						out[nextTail] = prevRows[prevTail]
					}
					prevTail--
					nextTail--
				}

				// 3. Middle: same-slot row pairs reconcile their inline children; an
				//    unpaired row is added; a leftover prev row is removed.
				for (let i = p; i <= nextTail; i++) {
					const prevRow = i <= prevTail ? prevRows[i] : undefined
					const nextRow = nextRows[i]
					if (prevRow !== undefined && !matchedPrev.has(prevRow)) {
						matchedPrev.add(prevRow)
						reconcileRowPair(prevRow, nextRow, [i], changes)
					} else {
						collectChanges(nextRow, [i], 'add')
						structural = true
					}
				}

				for (const row of prevRows) {
					if (matchedPrev.has(row)) continue
					collectRemovedIds(row, removedIds)
					structural = true
				}

				out.forEach(ensureId)
				previous = out
				return {tokens: out, structural, changes, removedIds}
			}
```

Add `reconcileRowPair` (also a closure) — reconcile one paired row's inline children:

```ts
			const reconcileRowPair = (prevRow: RowToken, nextRow: RowToken, basePath: TokenPath, changes: TokenChangeEntry[]): void => {
				const id = ids.get(prevRow)
				if (id !== undefined) ids.set(nextRow, id)
				nextRow.id = ensureId(nextRow)

				// content byte-identical (only position shifted within the window) →
				// reuse children by inheritance, row is `update`.
				if (prevRow.content === nextRow.content) {
					inheritChildren(prevRow.children, nextRow.children)
					changes.push({id: nextRow.id, token: nextRow, path: basePath, kind: 'update'})
					return
				}

				// content changed → diff the inline children with the SAME inline
				// machinery (prefix/suffix/middle + inline tryDescend), scoped to this
				// row. The row itself renders no framework props (its Mark renders
				// children), so a content change inside it is `update` (text path).
				reconcileInlineChildren(prevRow.children, nextRow.children, basePath, changes)
				changes.push({id: nextRow.id, token: nextRow, path: basePath, kind: 'update'})
			}
```

(`inheritChildren` = pairwise `inherit` over equal-length child arrays (rows pre-split, so a same-content row has the same children); reuse the existing `inherit` recursion or a thin wrapper. `reconcileInlineChildren` is the inline windowed token diff applied to a row's children — the SAME logic as the top-level inline diff at `:273-348`, factored into a closure that takes `(prevKids, nextKids, basePath, changes)` and derives its own window from the children's joined contents. The cleanest implementation: EXTRACT the existing top-level windowed diff (`:273-355`) into a `reconcileInlineTokens(prevTokens, nextTokens, basePath, out, changes, hint?)` closure, call it from BOTH the inline top level AND `reconcileRowPair`. Do this extraction in Step 3b.)

- [ ] **Step 3b: Extract the inline windowed token diff into a reusable closure**

Refactor the existing top-level inline diff (`tokenIdentity.ts:133-357`, the prefix/suffix/middle walk + the `for (const t of prev)` removal) into a closure `reconcileInlineTokens(prevTokens, nextTokens, basePath, out, changesOut, removedOut, hint?)` that:
- takes prev/next token arrays + a base path + the output array slot + the changes/removed accumulators,
- derives its window from `hint` (top level) or from `findGap` over the children's joined contents (row children),
- runs the existing prefix (reuse), suffix (inherit), middle (pair + `tryDescend`), and removal logic,
- writes paired/added entries into `changesOut`, removed ids into `removedOut`, sets `structural` via a returned flag or a shared closure var.

Then:
- the top-level inline `reconcile` path calls `reconcileInlineTokens(prev, next, [], out, changes, removedIds, hint)`,
- `reconcileRowPair`'s content-changed branch calls `reconcileInlineTokens(prevRow.children, nextRow.children, basePath, nextRow.children, changes, removedIds)` (no hint — derived from the children).

This keeps ONE inline diff used in two scopes (top level + row children) and reuses `tryDescend` for genuinely nested inline slot marks inside a row (the spec: "Deep descend survives only for genuinely nested inline slot marks"). Keep `pairSlotChildren`/`tryDescend` exactly as-is — they already operate on `Token[]` children.

(This refactor is the heart of Task 4. Take it in small commits if needed: first extract the closure with the top-level call (suite stays green — pure refactor), then add `reconcileRows`/`reconcileRowPair` calling it. VERIFY the extraction is behavior-preserving by running the inline property spec after the extraction and before adding the row path.)

- [ ] **Step 4: Add `rowsEqual`/`rowsEqualShifted` + `inheritChildren` helpers**

At the file end (near `tokensEqual`/`tokensEqualShifted`), add:

```ts
function rowsEqual(a: RowToken, b: RowToken): boolean {
	return rowsEqualShifted(a, b, 0)
}

function rowsEqualShifted(a: RowToken, b: RowToken, delta: number): boolean {
	if (a === b) return delta === 0
	if (a.content !== b.content || a.terminated !== b.terminated) return false
	if (a.position.start + delta !== b.position.start || a.position.end + delta !== b.position.end) return false
	if (a.children.length !== b.children.length) return false
	return a.children.every((child, i) => tokensEqualShifted(child, b.children[i], delta))
}
```

(`inheritChildren` — if not folded into `inherit` — pairs same-length child arrays: `prev.children.forEach((c, i) => inherit(c, next.children[i]))` then `next.children.forEach(ensureId)`. The existing `inherit` (`:97-108`) ALREADY recurses row children after Task 3 Step 3b, so `inherit(prevRow, nextRow)` handles the whole row subtree — prefer reusing `inherit` directly and drop `inheritChildren`.)

- [ ] **Step 5: Write the row reconcile + locality spec (TDD)**

Create `packages/core/src/features/tokens/tokenIdentity.rows.spec.ts`:

```ts
import {describe, expect, it} from 'vitest'

import {BlockParser} from './parser/core/BlockParser'
import {Parser} from './parser/Parser'
import type {Markup, RowToken} from './parser/types'
import {createIdentityTracker} from './tokenIdentity'

const ROW: Markup = '__slot__\n\n'

function block(): BlockParser {
	return BlockParser.from(new Parser([ROW]))
}

describe('reconcile — row-local diff', () => {
	it('typing inside row k reuses every OTHER row by reference (row-locality)', () => {
		const parser = block()
		const tracker = createIdentityTracker()
		const before = tracker.reconcile(parser.parse('First\n\nSecond\n\nThird\n\n')).tokens as RowToken[]
		// edit row 1 ('Second' → 'Secondx'): hint at the end of 'Second'
		const next = 'First\n\nSecondx\n\nThird\n\n'
		const hint = {start: 13, end: 13, insertedLength: 1} // after 'Second'
		const after = tracker.reconcile(parser.parse(next), hint).tokens as RowToken[]
		expect(after).toHaveLength(3)
		// row 0 (before the edit) reused BY REFERENCE
		expect(after[0]).toBe(before[0])
		// row 2 (after the edit) keeps its id (suffix shift is 0 — 'Third' unchanged, shifted by +1)
		expect(after[2].id).toBe(before[2].id)
		// the edited row keeps its id (paired)
		expect(after[1].id).toBe(before[1].id)
	})

	it('an empty row pairs 1:1 and the first keystroke into it is a row update (text path)', () => {
		const parser = block()
		const tracker = createIdentityTracker()
		const before = tracker.reconcile(parser.parse('a\n\n\n\n')).tokens as RowToken[]
		// 'a\n\n\n\n' → rows: 'a\n\n' (terminated), '\n\n' (empty terminated)
		expect(before).toHaveLength(2)
		expect(before[1].children).toHaveLength(0)
		// type 'x' into the empty row: 'a\n\nx\n\n'
		const next = 'a\n\nx\n\n'
		const hint = {start: 3, end: 3, insertedLength: 1}
		const result = tracker.reconcile(parser.parse(next), hint)
		const after = result.tokens as RowToken[]
		expect(after[1].id).toBe(before[1].id) // same row, kept id
		expect(after[1].children).toHaveLength(1) // now has a text child
		// the edit routes the text path: structural is false (no row added/removed)
		expect(result.structural).toBe(false)
	})

	it('Enter that splits a row is structural (a row is added)', () => {
		const parser = block()
		const tracker = createIdentityTracker()
		tracker.reconcile(parser.parse('First\n\n'))
		const result = tracker.reconcile(parser.parse('Fi\n\nrst\n\n'), {start: 2, end: 2, insertedLength: 2})
		expect(result.structural).toBe(true)
		expect((result.tokens as RowToken[])).toHaveLength(2)
	})

	it('round-trip: reconciled rows serialize back to the value', () => {
		const parser = block()
		const tracker = createIdentityTracker()
		for (const value of ['a\n\nb', 'a\n\nb\n\n', '\n\nb\n\n', '']) {
			const tracker2 = createIdentityTracker()
			const rows = tracker2.reconcile(parser.parse(value)).tokens as RowToken[]
			expect(rows.map(r => r.content).join('')).toBe(value === '' ? '' : value)
		}
	})
})
```

(Adjust the hint offsets to the exact edit positions — compute them from the fixture strings. The `structural === false` assertion is the row-local-text-path proof; the `after[0] === before[0]` is the row-locality proof. If a hint offset is off, the row-local prefix/suffix bands shift — recompute against the actual `position` ranges the parser emits.)

- [ ] **Step 6: Run the row reconcile spec + the inline property spec + full core**

Run: `pnpm -w exec vitest run --project core "tokenIdentity.rows.spec"`
Expected: full pass — row-locality (reference reuse), empty-row text path, split-is-structural, round-trip.

Run: `pnpm -w exec vitest run --project core "tokenIdentity.property"`
Expected: full pass — the INLINE equivalence property is unbroken by the `reconcileInlineTokens` extraction (the refactor is behavior-preserving). The `runSlotLeadingProperty` (`:589`) runs `'__slot__\n\n'` through the INLINE `Parser` (NOT `BlockParser`) — it still tests inline reconcile of slot-leading marks; it does NOT hit the row path (the row path needs a `RowToken[]`). Leave it green (Task 10 decides whether to migrate it).

Run: `pnpm -w exec vitest run --project core "TokenModel.changed.spec"`
Expected: full pass — including any block render-count case (now row-local → text path).

Run: `pnpm -F core test`
Expected: full pass.

Run: `pnpm run typecheck`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(tokens): row-local reconcile — RowToken diff + row-locality; inline child diff reused" -- packages/core/src/features/tokens/tokenIdentity.ts packages/core/src/features/tokens/tokenIdentity.rows.spec.ts
```

---

### Task 5: Bind rows — the block frame (row element ⇔ RowToken; rows-map/one-child become ordinary frame)

**Files:**
- Modify: `packages/core/src/features/tokens/model/bind.ts`

Bind's block branch (`resolveRoot`, the rows-map, the one-non-control-child bail) was a bolt-on that re-discovered rows by walking container children. With first-class rows the block frame is ordinary: container → row elements (each a `RowToken`'s `tokenElement` AND `rowElement`), each row element contains one non-control child that HOSTS `row.children` (a child frame). The rows-map and one-non-control-child rule become the frame structure rather than a special case. `LiveNode.#measureScope` (prefers `rowElement`) is unchanged — a row's `rowElement === tokenElement`, still the measure scope.

- [ ] **Step 1: Read the current block walk**

Read `bind.ts:139-198` (`walkDom` + `resolveRoot`). The block path (`:182-197`) builds `tokenEls` (one per row, the single non-control child) + a `rows: Map<number, HTMLElement>` (the row element). `frameTokens.forEach` (`:155-172`) then binds `tokenElement: elements[i]` (the inner token) and `rowElement: rows?.get(i)` (the row). With first-class rows, the ROW token must bind to the ROW element (the row IS the token), and `row.children` bind inside the single inner host.

- [ ] **Step 2: Rewrite the block branch — row element is the RowToken's binding**

In `bind.ts`, change `resolveRoot` (`:177-197`) so the block path emits a frame whose `tokens` are the `RowToken[]` and whose `elements` are the ROW elements (not the inner token elements):

```ts
		function resolveRoot(): Frame {
			if (!isBlock) {
				return {tokens, elements: nonControlChildren(container, controlRoots), basePath: []}
			}
			// Block layout: each container element-child is a row element bound to a
			// RowToken directly. The row's single non-control child hosts row.children.
			return {tokens, elements: elementChildren(container), basePath: []}
		}
```

Then in the `frameTokens.forEach` walk (`:155-172`), handle a `RowToken`: bind the row element as BOTH `tokenElement` and `rowElement`, find the single non-control inner child as the host for `row.children`, and push a child frame. Replace the forEach body:

```ts
			frameTokens.forEach((token, i) => {
				const path = [...basePath, i]
				const element = elements[i]
				if (token.type === 'row') {
					// The row element IS the RowToken's binding (tokenElement + rowElement).
					// Its single non-control child hosts the row's inline children.
					const inner = nonControlChildren(element, controlRoots)
					if (inner.length !== 1) return // bad row → drop this row (and its children)
					bound.set(token, {tokenElement: element, rowElement: element, childSequenceHost: inner[0]})
					if (token.children.length > 0) {
						stack.push({tokens: token.children, elements: nonControlChildren(inner[0], controlRoots), basePath: path})
					}
					return
				}
				const hosts = childSequenceHostsFor(path)
				const childSequenceHost = hosts.length === 1 && element.contains(hosts[0]) ? hosts[0] : undefined
				bound.set(token, {
					tokenElement: element,
					textElement: token.type === 'text' ? element : undefined,
					rowElement: rows?.get(i),
					childSequenceHost,
				})
				if (token.type !== 'mark' || token.children.length === 0) return
				stack.push({
					tokens: token.children,
					elements: nonControlChildren(childSequenceHost ?? element, controlRoots),
					basePath: path,
				})
			})
```

(NOTE: the old `rows?.get(i)` path on the NON-row branch is now dead in block mode (rows are handled by the `'row'` arm) but stays for safety; `Frame.rows` can be removed entirely — see Step 3. The `inner.length !== 1` per-row check REPLACES the old all-or-nothing frame bail (`:192`): now a single bad row drops only THAT row's binding, not the whole frame — but the parent frame's `elements.length !== frameTokens.length` check (`:153`) still guards row COUNT alignment. Re-evaluate: the old behavior bailed the WHOLE frame on one bad row (`return {tokens, elements: [], basePath: []}` → count mismatch → frame dropped). To preserve "all-or-nothing alignment, fail loud when an adapter renders something unexpected" (the README contract + the spec's "Alignment is all-or-nothing"), keep the whole-frame bail: if ANY row has `inner.length !== 1`, the row count won't match and binding should fail consistently. The cleanest equivalent: precompute the row inner-children in `resolveRoot` and bail the frame (empty elements) if any row is malformed — see Step 2b.)

- [ ] **Step 2b: Preserve all-or-nothing row alignment**

Keep the all-or-nothing semantics (one bad row bails the block frame, matching today's contract and the README "one bad row bails the whole frame"). In `resolveRoot`, validate every row has exactly one non-control inner child BEFORE emitting the frame; on any failure, emit an empty-elements frame (the `elements.length !== frameTokens.length` guard at `:153` then drops it):

```ts
		function resolveRoot(): Frame {
			if (!isBlock) {
				return {tokens, elements: nonControlChildren(container, controlRoots), basePath: []}
			}
			// Block layout: each container element-child is a row element bound to a
			// RowToken directly; the row's single non-control child hosts row.children.
			// All-or-nothing: one malformed row bails the whole block frame.
			const rowEls = elementChildren(container)
			if (rowEls.length !== tokens.length) return {tokens, elements: [], basePath: []}
			for (const rowEl of rowEls) {
				if (nonControlChildren(rowEl, controlRoots).length !== 1) return {tokens, elements: [], basePath: []}
			}
			return {tokens, elements: rowEls, basePath: []}
		}
```

Then the `frameTokens.forEach` `'row'` arm can assume `inner.length === 1` (validated):

```ts
				if (token.type === 'row') {
					const inner = nonControlChildren(element, controlRoots)[0]
					bound.set(token, {tokenElement: element, rowElement: element, childSequenceHost: inner})
					if (token.children.length > 0) {
						stack.push({tokens: token.children, elements: nonControlChildren(inner, controlRoots), basePath: path})
					}
					return
				}
```

- [ ] **Step 3: Drop the now-dead `Frame.rows` plumbing**

`Frame.rows` (`bind.ts:58`) and the non-row `rowElement: rows?.get(i)` read (`:163`) were the OLD block plumbing. With the `'row'` arm setting `rowElement` directly, `Frame.rows` is dead — the only frames that exist now are the inline root, the block root (rows), and child frames (none carry `rows`). Delete `rows?: ReadonlyMap<number, HTMLElement>` from `Frame` (`:58`), the `rows` destructure (`:152`), and the `rowElement: rows?.get(i)` (`:163` → `rowElement: undefined` or drop the field on the non-row branch). VERIFY: in inline mode no token is a row, so the non-row branch never needs `rowElement` (inline tokens have no row). Set the non-row branch's `rowElement` to `undefined`.

- [ ] **Step 4: Run the bind spec + block render gates + full core**

Run: `pnpm -w exec vitest run --project core "model/bind.spec"`
Expected: full pass — the bind spec covers inline + block frames. If it pins the OLD block frame shape (one-non-control-child as a separate concept), update those cases to the Row frame (a deliberate, named spec rewrite — the block bind frame shape changed). Read the spec first; rewrite only the block-frame cases, keep inline cases.

Run: `pnpm -w exec vitest run --project core "TokenModel.changed.spec"`
Run: `pnpm -F core test`
Expected: full pass.

Run: `pnpm run typecheck`
Expected: clean.

- [ ] **Step 5: Run the storybook block render-count gates (the real DOM proof)**

Run: `pnpm -w exec vitest run --project react --project vue renderCount`
Expected: the block gates ("block keystroke into a row does not re-render Mark or Span; a row split does" + "first keystroke into a freshly-Enter-created empty row rides the text path") — these exercise the FULL react/vue DOM. They may still RED here because the ADAPTERS (Task 6) still render the row through the slot-mark path (a `RowToken` has no `descriptor`, so `resolveMarkSlot` throws or mis-resolves). **If they red with a "No mark component" / descriptor error, that is the predicted Task-6 gap — proceed to Task 6.** If they red with a bind/structure error, STOP and debug (bind is this task's responsibility).

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(tokens): bind rows — row element binds the RowToken; rows-map/one-child become the frame" -- packages/core/src/features/tokens/model/bind.ts packages/core/src/features/tokens/model/bind.spec.ts
```

(Drop `bind.spec.ts` from the paths if you did not change it.)

---

### Task 6: Adapters — Container rows → Block, Token renders row.children, resolveMarkSlot row arm; re-pin block render gates

**Files:**
- Modify: `packages/core/src/features/slots/resolveSlot.ts`
- Modify: `packages/core/src/features/slots/SlotsFeature.ts` (if the row-option index needs deriving)
- Modify: `packages/react/markput/src/components/Token.tsx`
- Modify: `packages/vue/markput/src/components/Token.vue`
- Modify: `packages/storybook/src/pages/renderCount.react.spec.tsx` (comment + gate continuity)
- Modify: `packages/storybook/src/pages/renderCount.vue.spec.ts` (comment + gate continuity)

A `RowToken` (`type:'row'`, no `descriptor`) must resolve to the configured row option's `Mark` (for a marked row) and render `row.children`. `resolveMarkSlot` gains a `'row'` arm that resolves the single slot-leading option's `Mark`; the react/vue `Token` components extend their `children.length > 0` render guard to include `'row'`. The block render gates are re-pinned on the Row tree (assertions unchanged; comments updated to the Row model).

- [ ] **Step 1: Read the option/slot resolution + how the row option is identified**

Read `resolveSlot.ts:51-67` (`resolveMarkSlot`) and `SlotsFeature.ts:54-59` (the `mark` computed). A mark resolves its option by `token.descriptor.index`. A `RowToken` has no descriptor — it needs the index of the SINGLE slot-leading option (the row markup's option), derived once like the terminator. Read `PropsModel.options()` shape (`packages/core/src/features/state/PropsModel.ts`) to find how to identify the slot-leading option (its `markup` is the row markup — `hasSlot && segments.length === 1` when parsed, OR simply the option whose markup string equals the row markup; the block config has exactly one such option).

- [ ] **Step 2: Add the `'row'` arm to `resolveMarkSlot`**

In `resolveSlot.ts`, `resolveMarkSlot` takes a `Token` (`:51-67`). Widen its `token` param to `Token | RowToken` and add the `'row'` arm BEFORE the text arm. A row resolves the row option's `Mark` (the single slot-leading option); the component renders `row.children` (passed as the component's children by the adapter `Token`), so the row arm passes `{value: ''}` (a row has no value — the Mark renders its children). The option for a row is the slot-leading option:

```ts
import type {RowToken, Token} from '../tokens'

export function resolveMarkSlot(
	token: Token | RowToken,
	tokenOptions: SlotOption[] | undefined,
	GlobalMark: Slot | undefined,
	GlobalSpan: Slot | undefined
): readonly [Slot, Record<string, unknown>] {
	if (token.type === 'row') {
		const option = rowOption(tokenOptions)
		const props = resolveOptionSlot(option?.mark, {value: ''})
		const Component = option?.Mark ?? GlobalMark
		if (!Component) throw new Error('No mark component found for a row. Provide either option.Mark or global Mark.')
		return [Component, props]
	}
	if (token.type === 'text') {
		// … unchanged …
	}
	// … unchanged mark arm …
}
```

Add `rowOption` — the single slot-leading option (its markup is the row markup; pick the first option whose markup yields a single-segment slot descriptor, or simply the first option that has a markup and a Mark — the block config has one):

```ts
/** The configured row option (the single slot-leading markup option). */
function rowOption(tokenOptions: SlotOption[] | undefined): SlotOption | undefined {
	return tokenOptions?.find(option => isRowMarkup(option.markup))
}

function isRowMarkup(markup: unknown): boolean {
	// A row markup is a slot-leading single-segment markup: '__slot__' followed
	// by a non-empty static suffix and nothing else (e.g. '__slot__\n\n').
	return typeof markup === 'string' && markup.startsWith('__slot__') && markup.length > '__slot__'.length && !markup.slice('__slot__'.length).includes('__')
}
```

(VERIFY `isRowMarkup` against the row markup `'__slot__\n\n'`: starts with `'__slot__'` ✓, longer ✓, suffix `'\n\n'` has no `'__'` ✓. A two-segment slot markup like `'@[__slot__]'` does NOT start with `'__slot__'` (it starts with `'@['`), so it is not a row markup — correct, that is an inline nested slot mark. This keeps deep descend for genuinely nested inline slot marks distinct from rows. If the option type's `markup` field is typed and accessible, prefer reading it directly; adjust the guard to the actual `SlotOption.markup` type.)

- [ ] **Step 3: Extend the react `Token` child-render guard**

In `packages/react/markput/src/components/Token.tsx` (`:22-29`), the children render is gated on `token.type === 'mark' && token.children.length > 0`. A `RowToken` also has `children`. Change the guard to include rows:

```tsx
	const [Component, props] = resolveMarkSlot(token)
	const children =
		(token.type === 'mark' || token.type === 'row') && token.children.length > 0 ? (
			<TokenChildren ownerPath={path}>
				{token.children.map((child, i) => (
					<Token key={keyOf(child)} token={child} path={[...path, i]} />
				))}
			</TokenChildren>
		) : undefined
```

(The `token` prop type is `TokenType` (`@markput/core`'s `Token`). Widen it to `TokenType | RowToken` — import `RowToken` from `@markput/core` (exported in Task 1). Update the `Token` component's prop type `{token: TokenType; path: TokenPath}` → `{token: TokenType | RowToken; path: TokenPath}`. `resolveMarkSlot`/`keyOf` already accept the union after Step 2 / Task 3. An EMPTY row (`children.length === 0`) renders `<Component {...props} />` with no children — the Mark component renders an empty editable row; VERIFY the row Mark renders a contenteditable host even with no children (the block render gate's empty-row case needs the empty slot Span surface — see Step 6).)

NOTE on the empty-row contenteditable: today an empty row is a slot mark with one empty text child (the Span), so the Span provides the contenteditable surface. With `RowToken.children === []`, the Mark renders NO child Span — the row would have no text surface. **Decision:** an empty row must still render its single text-child host. Either (a) `BlockParser.parseRow` emits an empty `TextToken('', start, start)` child for an empty row (so the row always has ≥1 child = the Span surface) — reversing the Task-2 "zero children" guard, OR (b) the row Mark component renders an empty editable host when `children` is empty. **Choose (a)**: it keeps the one-non-control-child bind invariant (a row always has exactly one inner host) AND keeps the empty-slot collapse unrepresentable at the ROW level (an empty ROW is still a distinct `RowToken`, it just carries one empty text child — exactly like today's empty slot carries an empty text child). Update Task 2's guard accordingly — see Step 3b.

- [ ] **Step 3b: Revise the empty-row children: one empty text child (not zero)**

Revisit `BlockParser.parseRow` (Task 2): an empty row must carry ONE empty `TextToken` child so it has a single contenteditable host (the bind one-non-control-child invariant) and the empty-row render gate passes. Change `parseRow` so `inner === ''` yields `[createTextToken('', start, start)]` rebased — i.e. just parse the empty string with the inline parser (which already returns `[TextToken('', 0, 0)]`) and rebase. So the Task-2 special-case guard (`segment.inner === '' ? [] : …`) is REMOVED — `this.inline.parse('')` returns `[TextToken('', 0, 0)]`, rebased to `[TextToken('', start, start)]`:

```ts
	private parseRow(segment: RowSegment): RowToken {
		const children = this.inline.parse(segment.inner)
		rebase(children, segment.start)
		// … content/position/terminated as before …
	}
```

Update the Task-2 `BlockParser.spec.ts` cases that asserted `children: []` for empty rows to assert ONE empty text child (`children: [{type:'text', content:'', position:{start, end:start}}]`). Update the Task-4 `tokenIdentity.rows.spec.ts` empty-row case similarly (an empty row has ONE empty text child; typing 'x' changes that child's content — still the text path, still `structural: false`). This is a coherent revision: "empty row = a RowToken with one empty text child" (the empty-slot collapse is unrepresentable because the ROW is always present as a distinct node, even when its content is empty). Re-run the Task-2 and Task-4 specs after this revision (they are in earlier commits; amend forward — do NOT rewrite history; fix the specs in THIS task's commit if they now assert the wrong thing, or better, get the empty-children shape RIGHT in Task 2 originally and note here that Task 2 already emits one empty text child). **Cleanest:** make Task 2 emit one empty text child from the start (drop the Step-1b zero-children guard there) and have THIS step only confirm it. If Task 2 was already executed with zero-children, fix it here with a path-scoped commit to `BlockParser.ts` + its spec.

- [ ] **Step 4: Extend the vue `Token` child-render guard**

In `packages/vue/markput/src/components/Token.vue` (`:35-43`), mirror the react change:

```ts
				const children =
					(token.type === 'mark' || token.type === 'row') && token.children.length > 0
						? () =>
								h(markRaw(TokenChildren), {ownerPath: props.path}, () =>
									token.children.map((child, i) =>
										h(markRaw(Token), {key: keyOf(child), token: child, path: [...props.path, i]})
									)
								)
						: undefined
```

(Widen the `token` prop type `PropType<TokenType>` → `PropType<TokenType | RowToken>`, import `RowToken` from `@markput/core`. `resolveMarkSlot.value(token)` accepts the union.)

- [ ] **Step 5: Container — no change needed (rows already flow to Block)**

Read `Container.tsx:38-40` / `Container.vue:31-41`. In block mode they ALREADY map `tokens.map(Block)` keyed by `keyOf(t)`, and `Block` renders `<Token token={token} path={[blockIndex]} />`. After Task 3 `tokens` (the render tree) is `RowToken[]`, so `Block` receives a `RowToken` and `<Token>` renders it via the new `'row'` arm. CONFIRM the `Block` component's `token` prop type accepts `RowToken` — widen `BlockProps.token` (`Block.tsx:15`) `TokenType` → `TokenType | RowToken` (react) and `defineProps<{token: TokenType; …}>` (`Block.vue:14`) → `TokenType | RowToken` (vue). `block.get(token)`/`keyOf(token)` accept the union (Task 3 widened `keyOf`; `BlockController.get` takes `Token` — widen to `Token | RowToken` in Task 7). For THIS task, if `BlockController.get(token: Token)` rejects a `RowToken`, widen its param to `Token | RowToken` here (a one-line type widening; the body uses `keyOf(token)` only).

- [ ] **Step 6: Re-pin the block render gates (comments → Row model; assertions unchanged)**

In `renderCount.react.spec.tsx`, the block describe (`:75-161`) and its two its. The ASSERTIONS stay (they pin the observable behavior). Update the leading comments to the Row model:
- The block-layout describe comment (`:62-74`): replace the "before deep reconcile a keystroke inside a row was a mark-level textChanged" rationale with the Row-local rationale: "every row is a first-class RowToken; a keystroke inside row k reconciles only row k's inline children (the covering text child is `text`, the row is `update`), so the commit routes the text path — the child surface is patched in place while the render tree keeps its reference; neither the row Mark nor the slot Span re-renders."
- The empty-row gate comment (`:152-155`): replace "TreeBuilder collapsed the empty slot to undefined, tryDescend refused" with "the empty row is a RowToken carrying one empty text child; the first keystroke changes that child's content — the row-local diff keeps the row `update` and the child `text`, so the keystroke rides the text path by construction (the empty-slot collapse is unrepresentable)."

Mirror both comment updates in `renderCount.vue.spec.ts`. Do NOT change the assertions, the config (`{markup: '__slot__\n\n', Mark: RowMark}`), or the `getAllRows`/`getEditableInRow` helpers.

- [ ] **Step 7: Run the block render gates (react + vue) + typecheck**

Run: `pnpm -w exec vitest run --project react --project vue renderCount`
Expected: full pass — the block gates are green on the Row tree (a keystroke into a row → text path, zero re-renders; the empty-row first keystroke → text path; a row split → structural re-render). The inline + remount gates are unchanged.

Run: `pnpm run typecheck`
Expected: clean (the adapter `token` prop types widened to the union; `resolveMarkSlot`/`keyOf`/`BlockController.get` accept it).

- [ ] **Step 8: Run the full storybook + core suites**

Run: `pnpm -F storybook test`
Expected: full pass — all react/vue page specs (renderCount, Drag, Selection, Clipboard) green on the Row tree. (Drag's underlying ops still route the OLD way — Task 7 — but the public drag BEHAVIOR is unchanged, so Drag specs should pass; if a Drag spec reds on a row-shape assertion, NOTE it for Task 7.)

Run: `pnpm -F core test`
Expected: full pass.

- [ ] **Step 9: Commit**

```bash
git commit -m "feat(adapters): rows render via the option Mark; Token renders row.children; re-pin block gates" -- packages/core/src/features/slots/resolveSlot.ts packages/react/markput/src/components/Token.tsx packages/react/markput/src/components/Block.tsx packages/vue/markput/src/components/Token.vue packages/vue/markput/src/components/Block.vue packages/storybook/src/pages/renderCount.react.spec.tsx packages/storybook/src/pages/renderCount.vue.spec.ts
```

(Add `packages/core/src/features/slots/SlotsFeature.ts` and `packages/core/src/features/block/BlockController.ts` to the paths IF you widened types in them. Add `BlockParser.ts` + its spec if Step 3b fixed the empty-children shape there.)

---

### Task 7: Block ops route on `type === 'row'`; delete `isSlotLeadingMark`; kill the `addDragRow` doubled-content quirk

**Files:**
- Modify: `packages/core/src/features/block/operations.ts`
- Modify: `packages/core/src/features/block/BlockController.ts`
- Modify: `packages/core/src/features/block/operations.spec.ts`

The drag/merge ops sniffed "is this a row?" via `isSlotLeadingMark` (3 sites) and carried the `addDragRow` doubled-content quirk. With first-class rows every block token IS a `RowToken` — `canMergeRows`/`mergeDragRows` read `RowToken.terminated`/`children`/`position` instead of re-deriving, and `addDragRow` becomes a uniform "insert after row k" with no all-empty special case. `operations.spec.ts`'s slot-mark-row fixtures are rewritten to `RowToken`s (a named spec rewrite).

- [ ] **Step 1: Read the ops + their callers**

Re-read `operations.ts` (the whole file) and `BlockController.ts:21-43` (the `applyDragAction` call). The ops take `readonly Token[] rows` and slice `value` by `position`. They will now take `readonly RowToken[]`. `isSlotLeadingMark` (`:16-18`) + its uses (`canMergeRows:27`, `mergeDragRows:72`) decide whether two rows merge by slot semantics; with `RowToken`s, "two rows merge" is always true between adjacent rows (a row split/merge is the uniform segment op), and the merge removes the FIRST row's terminator.

- [ ] **Step 2: Rewrite the ops over `RowToken`**

In `operations.ts`:

Change the imports (`:2`) to drop `MarkToken` and add `RowToken`:

```ts
import type {RowToken, Token} from '../tokens'
```

Delete `isSlotLeadingMark` (`:16-18`) entirely.

Rewrite `canMergeRows` (`:25-29`) — adjacent rows always merge (merging row b into row a removes a's terminator); the only non-mergeable case is no previous row:

```ts
/**
 * Whether two adjacent rows can merge (Backspace/Delete at a row boundary).
 * Adjacent rows always merge — the merge removes the previous row's terminator,
 * joining the two rows' content. (First-class rows: no slot-leading sniffing.)
 */
export function canMergeRows(a: RowToken, b: RowToken): boolean {
	return a.terminated
}
```

(A row b can merge into row a only if a is terminated — if a is the document's final unterminated row, there is no b after it to merge in. In practice `canMergeRows(rows[i-1], rows[i])` is called with i ≥ 1, and any non-final row IS terminated, so this is true exactly when a merge is meaningful. VERIFY against the keyboard caller (Task 8) — `mergeOrFocusNeighbor` calls `canMergeRows(rows[min], rows[max])` where `max = join index`; `rows[min]` is non-final → terminated → true. Good.)

Rewrite `mergeDragRows` (`:68-78`) — merge row[index] into row[index-1] by removing row[index-1]'s terminator:

```ts
/**
 * Merge row[index] into row[index-1] by removing the previous row's terminator,
 * joining their content. Returns the new value and the join-point caret (the end
 * of the previous row's pre-terminator content).
 */
export function mergeDragRows(value: string, rows: readonly RowToken[], index: number): {value: string; caret: number} {
	if (index <= 0 || index >= rows.length) return {value, caret: 0}
	const prev = rows[index - 1]
	const curr = rows[index]
	// The previous row's terminator is the bytes after its content's pre-terminator
	// span. Its pre-terminator end is the caret/join point.
	const terminatorLen = prev.terminated ? prev.position.end - innerEnd(prev) : 0
	const joinAt = prev.position.end - terminatorLen
	return {value: value.slice(0, joinAt) + value.slice(curr.position.start), caret: joinAt}
}
```

Add `innerEnd` — the end of a row's pre-terminator content. Since `RowToken.children` are the pre-terminator inline tokens, the pre-terminator content ends at `position.start + (content.length - terminatorLen)`. Compute it from `content` + `terminated`:

```ts
/** End offset of a row's pre-terminator content (the merge/caret join point). */
function innerEnd(row: RowToken): number {
	// content includes the terminator iff terminated; children span the pre-terminator content.
	return row.position.start + row.content.length - (row.terminated ? terminatorLength(row) : 0)
}
```

(`terminatorLength(row)` — a row does not carry the terminator string, only `terminated: boolean`. The merge needs the terminator LENGTH. Two options: (a) thread the terminator into the ops (the ops module gets the terminator from `BlockController`, which has the parser), or (b) derive the pre-terminator end from `children` — the last child's `position.end` is the pre-terminator content end (the inline parse always ends with a trailing text token at the content's end). **Choose (b):** `innerEnd(row) = row.children[row.children.length - 1].position.end` (a row always has ≥1 child — the trailing text token; an empty row has one empty text child at `position.start`). This avoids threading the terminator and is robust:

```ts
/** End offset of a row's pre-terminator content (the merge/caret join point). */
function innerEnd(row: RowToken): number {
	const last = row.children[row.children.length - 1]
	return last ? last.position.end : row.position.start
}
```

Then `mergeDragRows` uses `innerEnd(prev)` for `joinAt` directly:

```ts
export function mergeDragRows(value: string, rows: readonly RowToken[], index: number): {value: string; caret: number} {
	if (index <= 0 || index >= rows.length) return {value, caret: 0}
	const prev = rows[index - 1]
	const curr = rows[index]
	const joinAt = innerEnd(prev)
	return {value: value.slice(0, joinAt) + value.slice(curr.position.start), caret: joinAt}
}
```

Delete the now-unused `terminatorLength` sketch above — keep only the `children`-based `innerEnd`.)

Rewrite `addDragRow` (`:31-39`) — uniform "insert after row k", no doubled-content quirk:

```ts
export function addDragRow(value: string, rows: readonly RowToken[], afterIndex: number, newRowContent: string): string {
	if (rows.length === 0) return value + newRowContent
	// Insert after the LAST row → append; otherwise splice before the next row's start.
	if (afterIndex >= rows.length - 1) return value + newRowContent
	const insertPos = rows[afterIndex + 1].position.start
	return value.slice(0, insertPos) + newRowContent + value.slice(insertPos)
}
```

(The `value === '' || all-empty` doubled-content branch is GONE — an empty document is now one empty `RowToken`, so `addDragRow` appends one row after it: `'' + newRowContent`. The old quirk doubled it because the empty doc was special-cased. Update `EMPTY_TEXT_TOKEN` (`:10`) — `applyDragAction` (`:122`) uses it for the `rows.length === 0` add case; with first-class rows the block tree is never empty (always ≥1 row), so `rows.length === 0` should not occur in production, but keep `applyDragAction` defensive: if `rows.length === 0`, `addDragRow('', [], …)` returns `'' + newRowContent` — drop the `EMPTY_TEXT_TOKEN` placeholder and the `effectiveRows` branch (`:122`), or keep a `RowToken`-shaped placeholder. **Simplest:** delete `EMPTY_TEXT_TOKEN` + the `effectiveRows` line; pass `rows` directly — `addDragRow`/`caretAfterDrag` handle the empty array. VERIFY the other ops (`deleteDragRow`/`duplicateDragRow`/`reorderDragRows`) accept `readonly RowToken[]` — they slice by `position` only, so widen their `rows` param type to `RowToken[]` (or `readonly RowToken[]`) and they work unchanged.)

Widen all op signatures' `rows` param `Token[]`/`readonly Token[]` → `readonly RowToken[]`, and `applyDragAction`/`transformValue`/`caretAfterDrag` likewise. The `DragApplyResult` is unchanged.

- [ ] **Step 3: Update `BlockController` to pass `RowToken[]`**

In `BlockController.ts`, `applyDragAction(value, this.tokens.tokens(), action, …)` (`:33`) — `this.tokens.tokens()` is now `(Token | RowToken)[]`. In block mode it is `RowToken[]`. `BlockController.get(token: Token)` (`:46`) → widen to `Token | RowToken`. The `applyDragAction` call needs `RowToken[]` — narrow with a guard or cast (block mode guarantees rows): the controller only runs the drag watcher when `isBlock()` (`:28`), so `this.tokens.tokens()` is `RowToken[]` there. Add a narrow filter/assert:

```ts
				const rows = this.tokens.tokens().filter((t): t is RowToken => t.type === 'row')
				const result = applyDragAction(value, rows, action, this.props.options())
```

(Import `RowToken` from `../tokens`. The filter is total in block mode (every token is a row) and safe.)

- [ ] **Step 4: Rewrite `operations.spec.ts` to construct `RowToken`s**

In `operations.spec.ts`, the fixtures build `Token`s by hand (`textToken`, `:16-18`) and the merge spec parses slot marks (`:73-87`). Rewrite to `RowToken`s via `BlockParser`. Replace `textToken` with a `row` helper (or build via `BlockParser`):

```ts
import {BlockParser} from '../tokens/parser/core/BlockParser'
import {Parser} from '../tokens/parser/Parser'
import type {Markup, RowToken} from '../tokens'

function rows(value: string): RowToken[] {
	return BlockParser.from(new Parser(['__slot__\n\n' as Markup])).parse(value)
}
```

Rewrite each `applyDragAction`/`mergeDragRows` case to build rows from a value and assert against the new uniform behavior. The `add on empty rows` case (`:46-52`) — the OLD doubled-content pin — is rewritten to the new behavior:

```ts
it('add on a single empty row appends one new row (no doubled content)', () => {
	const r = rows('') // one empty unterminated row
	const result = applyDragAction('', r, {type: 'add', afterIndex: 0}, options)
	expect(result.value).toBe(addDragRow('', r, 0, createRowContent(options)))
	// new behavior: appended once, not doubled (the empty-doc quirk is gone)
	expect(result.value).toBe(createRowContent(options))
})
```

And the `mergeDragRows into an EMPTY previous row` case (`:73-87`) → build rows via `BlockParser` and assert the terminator-removal merge:

```ts
describe('mergeDragRows', () => {
	it('merging into an EMPTY previous row drops its terminator', () => {
		const value = '\n\nb\n\n'
		const r = rows(value) // ['\n\n' empty terminated, 'b\n\n' terminated]
		expect(r).toHaveLength(2)
		const result = mergeDragRows(value, r, 1)
		expect(result).toEqual({value: 'b\n\n', caret: 0})
	})
})
```

(Update every other `applyDragAction` case (reorder/add/delete/duplicate, `:22-71`) to build `rows(value)` and keep the same expected behavior — the ops' POSITION math is unchanged; only the row TYPE changed. The `options` const (`:20`) `[{}]` lacks a markup — `createRowContent` (`:6`) returns `'\n'` for a markup-less option; the merge/add cases that need a `\n\n` row should use a block option `[{markup: '__slot__\n\n'}]`. Adjust `options` per case so `createRowContent` matches the row terminator the fixtures use.)

- [ ] **Step 5: Run the ops spec + Drag storybook + core**

Run: `pnpm -w exec vitest run --project core "block/operations.spec"`
Expected: full pass — the rewritten ops pins (uniform add, terminator-removal merge) are green.

Run: `pnpm -w exec vitest run --project core "block/BlockController.spec"`
Expected: full pass — store keying by `RowToken.id` is unchanged.

Run: `pnpm -w exec vitest run --project react --project vue Drag`
Expected: full pass — the react/vue Drag page specs (add/delete/duplicate/reorder/merge in block mode) are green on the Row ops.

Run: `pnpm -F core test`
Run: `pnpm run typecheck`
Expected: full pass / clean.

- [ ] **Step 6: Commit**

```bash
git commit -m "refactor(block): ops route on RowToken — delete isSlotLeadingMark + addDragRow doubled-content quirk" -- packages/core/src/features/block/operations.ts packages/core/src/features/block/BlockController.ts packages/core/src/features/block/operations.spec.ts
```

---

### Task 8: Block keyboard routes on `type === 'row'`; delete `isTextLikeRow`

**Files:**
- Modify: `packages/core/src/features/keyboard/blockEdit.ts`

`blockEdit.ts` sniffed "is this a text-like row?" via `isTextLikeRow` (`:13-16`) to decide Enter behavior. With first-class rows every block token is a `RowToken` — Enter inside a row inserts the terminator at the caret (splitting the row) for a TEXT-content row, or adds a new row after a marked row — but with first-class rows the distinction collapses: Enter always splits at the caret (inserting the terminator), and `addDragRow` handles the "append after the last row" case. The `Token` import + the merge/delete handlers route on `RowToken` already (they read `rows[i].position`/`content`).

- [ ] **Step 1: Read `blockEdit.ts` end-to-end**

Re-read `blockEdit.ts` (the whole file). `isTextLikeRow` (`:13-16`) is used only in `handleEnter` (`:142`). `findActiveRow`/`rowHandle` (`:23-40`) resolve the active row by `store.tokens.at(rowIndex)` + `handle(id)` — these work unchanged on `RowToken` (a row has an `id`). `handleDelete` (`:68-124`) reads `rows[blockIndex].content`/`.position` — unchanged on `RowToken` (a row has `content`/`position`). `mergeOrFocusNeighbor` (`:276-295`) calls `canMergeRows`/`mergeDragRows` (Task 7, now `RowToken`-typed).

- [ ] **Step 2: Delete `isTextLikeRow`; rewrite `handleEnter`**

In `blockEdit.ts`, delete `isTextLikeRow` (`:13-16`). Rewrite `handleEnter` (`:126-152`) so Enter splits the active row at the caret by inserting the terminator (the uniform row op). With first-class rows there is no "text-like vs mark-like row" — every Enter at a caret position inserts the row terminator, splitting the row:

```ts
function handleEnter(store: KbCtx, event: KeyboardEvent) {
	if (event.key !== KEYBOARD.ENTER) return
	if (event.shiftKey) return

	const active = findActiveRow(store)
	if (!active) return

	event.preventDefault()
	const {index: blockIndex} = active

	const rows = store.tokens.tokens()
	const token = rows[blockIndex]
	const value = store.value.current()

	const newRowContent = createRowContent(store.props.options())

	// At the row END (caret past the row's pre-terminator content) → append a new
	// row after this one; otherwise split the row at the caret (insert the
	// terminator). First-class rows: no text-like/mark-like sniffing.
	const raw = store.selection.readRaw()
	const caretPos = raw ? raw.range.start : token.position.end
	const innerEnd = token.children[token.children.length - 1]?.position.end ?? token.position.start
	if (caretPos >= innerEnd) {
		const newValue = addDragRow(value, rows, blockIndex, newRowContent)
		const pos = innerEnd + newRowContent.length
		store.edit.replace({start: 0, end: -1}, newValue, pos)
		return
	}
	store.edit.replace({start: caretPos, end: caretPos}, newRowContent)
}
```

(`rows` is `(Token | RowToken)[]` — in block mode `RowToken[]`. `addDragRow`/`canMergeRows`/`mergeDragRows` are `RowToken`-typed (Task 7); narrow `rows` to `RowToken[]` for the ops calls — add a filter at the top of each handler that uses the ops, OR widen the `KbCtx`/op types. Since the keyboard only runs when `store.props.layout.isBlock()` (`:44`), `store.tokens.tokens()` is `RowToken[]`; narrow with `const rows = store.tokens.tokens().filter((t): t is RowToken => t.type === 'row')` at the top of `handleEnter`/`handleDelete`/`handleBlockArrowLeftRight`/`handleArrowUpDown` (each already reads `rows[i]`). Import `RowToken` from `../tokens`. VERIFY `createRowContent` (`:140`) returns the terminator-suffixed content: for `'__slot__\n\n'` it is `annotate('__slot__\n\n', {slot:''}) = '\n\n'` — so splitting inserts `'\n\n'`, exactly the terminator. Good. Adjust `mergeOrFocusNeighbor`'s `rows` param type (`:279`) to `readonly RowToken[]`.)

- [ ] **Step 3: Update the `focusRow` row-handle bridge for `RowToken`**

`focusRow` (`:154-166`) checks `token.type === 'mark' && token.id !== undefined` to bridge via `placeAtHandle`. A `RowToken` is `type:'row'`, not `'mark'`. Update the guard so a row also bridges by id:

```ts
function focusRow(store: KbCtx, token: Token | RowToken, rowIndex: number, caret: 'start' | 'end'): void {
	if ((token.type === 'mark' || token.type === 'row') && token.id !== undefined) {
		const handle = store.tokens.handle(token.id)
		if (handle && store.selection.placeAtHandle(handle, caret)) return
	}
	const row = rowHandle(store, rowIndex)
	if (!row) return
	row.focus()
	row.placeCaret(caret === 'start' ? 0 : Infinity)
}
```

(Import `RowToken` from `../tokens`. Widen `focusRow`'s `token` param + `mergeOrFocusNeighbor`'s `rows` element type to the union/`RowToken`.)

- [ ] **Step 4: Run the keyboard-driven block specs (storybook) + core + typecheck**

Run: `pnpm -w exec vitest run --project react --project vue renderCount`
Expected: full pass — the block "Enter splits the row" gate (`renderCount.react.spec.tsx:119-121`) and the empty-row gate are green (Enter inserts the terminator → structural split; first keystroke into the fresh empty row → text path).

Run: `pnpm -F storybook test`
Expected: full pass — Drag/Selection/Clipboard page specs (which exercise block keyboard) green.

Run: `pnpm -F core test`
Run: `pnpm run typecheck`
Expected: full pass / clean.

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(keyboard): block edit routes on RowToken — delete isTextLikeRow; Enter splits uniformly" -- packages/core/src/features/keyboard/blockEdit.ts
```

---

### Task 9: Parser cascade deletions — `resolveSlotLeadingMatches` + the Match special case (+ both TODOs); confirm the descend-for-rows / dual-#lastParsed deaths

**Files:**
- Modify: `packages/core/src/features/tokens/parser/core/PatternMatcher.ts`
- Modify: `packages/core/src/features/tokens/parser/core/Match.ts`
- Modify: `packages/core/src/features/tokens/tokenIdentity.ts` (confirm descend-for-rows is inline-only; no top-level row routing through tryDescend)

The §What-dies "rows-as-slot-marks" parser machinery is now dead: rows are produced by `BlockParser`, so the inline `Parser` never sees a `\n\n`-terminated slot-leading match (each row's content is pre-stripped of its terminator before inline parse). `resolveSlotLeadingMatches` + `isSlotLeading` (PatternMatcher) and the `gapType === 'slot'` single-segment special case (Match) — both carrying `//TODO need review it` — are deleted. This task also CONFIRMS (with greps) that `filterEmptyText` + the dual `#lastParsed` are gone (Phase 6 + Task 3) and that `tryDescend` is now reached only for genuinely nested inline slot marks (rows route through `reconcileRows`, never `tryDescend`).

- [ ] **Step 1: Verify the inline parser no longer needs `resolveSlotLeadingMatches`**

The inline `Parser` is used per-row by `BlockParser` on PRE-TERMINATOR content (no `\n\n`). It is ALSO used directly in inline (non-block) mode. In inline mode, was a single-segment slot markup (`'__slot__\n\n'`) ever configured? NO — that markup is the ROW markup, only used in block mode. Confirm with a grep that no INLINE (non-block) config uses a single-segment slot markup, then assert the deletion is safe. Run:

```bash
grep -rn "__slot__\\\\n\\\\n\|__slot__']" packages/storybook/src packages/react/app packages/vue/app --include="*.ts" --include="*.tsx" --include="*.vue" | grep -iv "layout=.block\|layout: .block" | head
```

(The single-segment slot markup appears only in BLOCK configs + the parser specs. If a non-block usage appears, STOP — `resolveSlotLeadingMatches` is still load-bearing inline; do NOT delete it. Otherwise proceed: the only consumer was rows, now handled by `BlockParser`.)

- [ ] **Step 2: Read the Parser.spec coverage of slot-leading**

Read `packages/core/src/features/tokens/parser/Parser.spec.ts` — find every case that parses a single-segment slot markup (`'__slot__\n\n'` or `'__slot__'`) and asserts the multi-row slot-mark tree (the `resolveSlotLeadingMatches` behavior). These pin the OLD inline row-as-slot-mark output. They are rewritten/removed in Step 4 (the inline parser no longer produces multi-row slot-mark trees — rows are `BlockParser`'s job). NOTE which cases pin it; do NOT delete cases that test GENUINE inline slot nesting (`'@[__slot__]'`, `'#[__slot__]'` — multi-segment slot markups, unaffected).

- [ ] **Step 3: Delete `resolveSlotLeadingMatches` + `isSlotLeading` from PatternMatcher**

In `PatternMatcher.ts`, delete the call + TODO (`:51-52`):

```ts
		//TODO need review it
		this.resolveSlotLeadingMatches()
```

Delete `resolveSlotLeadingMatches` (`:113-145`) and `isSlotLeading` (`:147-149`) entirely. `process` (`:41-55`) becomes:

```ts
	process(segments: SegmentMatch[]): Match[] {
		this.pendingStates.clear()
		this.completingStates.clear()
		this.completedStates.length = 0

		for (const segment of segments) {
			this.processWaitingStates(segment)
			this.tryStartNewStates(segment)
		}

		return this.completedStates.map(entry => entry.match)
	}
```

(VERIFY no other method calls `resolveSlotLeadingMatches`/`isSlotLeading` — grep in Step 5.)

- [ ] **Step 4: Delete the Match slot-leading special case (+ its TODO)**

In `Match.ts`, the constructor's single-segment auto-complete (`:44-56`) has a `gapType === 'slot'` branch seeding a zero-width slot for `resolveSlotLeadingMatches` to resolve. That resolver is gone. Change (`:44-56`):

```ts
		// Auto-complete single segment patterns
		if (descriptor.segments.length === 1) {
			this.expectedSegmentIndex = NaN

			//TODO need review it. before it was only value gap type
			const gapType = descriptor.gapTypes[0] ?? 'value'
			if (gapType === 'slot') {
				// Slot-leading: real range resolved by PatternMatcher.resolveSlotLeadingMatches
				this.gaps.slot = {start: this.start, end: this.start}
			} else {
				this.gaps[gapType] = {start: this.start, end: this.end}
			}
		}
```

to — a single-segment pattern's gap spans the segment; there is no slot-leading resolver anymore, so a single-segment SLOT markup (if ever configured inline) gets a normal slot gap over its segment (degenerate but well-defined). The cleanest is to keep the `else` behavior for all gap types:

```ts
		// Auto-complete single segment patterns: the lone gap spans the segment.
		// (No slot-leading special case — first-class rows replaced the
		// '__slot__\n\n' row-as-slot-mark parse with BlockParser.)
		if (descriptor.segments.length === 1) {
			this.expectedSegmentIndex = NaN
			const gapType = descriptor.gapTypes[0] ?? 'value'
			this.gaps[gapType] = {start: this.start, end: this.end}
		}
```

(Both `//TODO need review it` comments are now gone — the one in `PatternMatcher.process` (deleted Step 3) and the one in `Match` (deleted here). The spec's §What-dies "(+ both 'TODO need review it')" is satisfied.)

- [ ] **Step 5: Rewrite/remove the inline slot-leading Parser.spec cases**

In `Parser.spec.ts`, the cases that parsed `'__slot__\n\n'`/`'__slot__'` as a multi-row slot-mark tree (identified in Step 2) no longer hold — the inline parser produces a SINGLE slot mark over the whole input for a single-segment slot markup now (the auto-complete gap spans the one segment), not a multi-row tree. Decide per case:
- A case asserting the BLOCK row tree → MOVE its intent to `BlockParser.spec.ts` (already covered by Task 2) and DELETE it here (the inline parser is no longer the row producer).
- A case asserting genuine inline slot NESTING (`'@[__slot__]'` etc.) → KEEP unchanged.
- A degenerate single-segment-slot case → update its expected tree to the new single-mark-over-segment output (or delete if it only existed to pin the row behavior).

Make the minimal, named edits; the goal is no spec asserts the deleted `resolveSlotLeadingMatches` behavior. Run `Parser.spec` after to confirm green.

- [ ] **Step 6: Confirm the descend-for-rows + dual-#lastParsed deaths (grep, no code change)**

Run:

```bash
grep -rn "resolveSlotLeadingMatches\|isSlotLeading" packages/core/src --include="*.ts"
```

Expected: ZERO hits (deleted Steps 3-4).

Run:

```bash
grep -rn "#lastParsed\|filterEmptyText" packages/core/src --include="*.ts"
```

Expected: ZERO hits — `#lastParsed` died in Phase 6; `filterEmptyText` died in Task 3. (The spec's "filterEmptyText + dual #lastParsed" deaths are both confirmed gone — note in the report that `#lastParsed` was a Phase-6 deletion, confirmed here.)

Confirm `tryDescend` is inline-only: it is called from `reconcileInlineTokens` (the middle pairing, Task 4) and recursively from `pairSlotChildren` — both over `Token[]` children of genuinely nested inline slot marks. The block TOP level routes through `reconcileRows` (Task 4), which calls `reconcileInlineTokens` only for a CHANGED row's children (where a nested inline `#[__slot__]` would descend). So `tryDescend` survives for nested inline slot marks and is never reached for the top-level rows — the spec's "descend-for-rows" death (the top-level-rows-as-slot-marks USE) is satisfied, the function kept for inline nesting. No code change — add a one-line comment at `tryDescend`'s JSDoc noting it serves nested INLINE slot marks only (rows route through `reconcileRows`).

- [ ] **Step 7: Run the parser specs + full core + typecheck**

Run: `pnpm -w exec vitest run --project core "parser/Parser.spec"`
Run: `pnpm -w exec vitest run --project core "BlockParser.spec"`
Run: `pnpm -w exec vitest run --project core "PatternMatcher\|SegmentMatcher"`
Expected: full pass — the inline parser is correct without the slot-leading retro-fit; `BlockParser` produces rows; the Match/PatternMatcher specs (if any cover the deleted paths) are updated/green.

Run: `pnpm -w exec vitest run --project core "tokenIdentity"`
Expected: full pass — the inline equivalence property + the row reconcile spec green.

Run: `pnpm -F core test`
Run: `pnpm run typecheck`
Expected: full pass / clean.

- [ ] **Step 8: Commit**

```bash
git commit -m "refactor(parser): delete resolveSlotLeadingMatches + the Match slot-leading special case (rows are first-class)" -- packages/core/src/features/tokens/parser/core/PatternMatcher.ts packages/core/src/features/tokens/parser/core/Match.ts packages/core/src/features/tokens/parser/Parser.spec.ts packages/core/src/features/tokens/tokenIdentity.ts
```

(Drop `tokenIdentity.ts` from the paths if you only added a comment and a pre-commit hook reflow would churn it; or include it for the one-line `tryDescend` comment. Drop `Parser.spec.ts` if Step 5 made no edits.)

---

### Task 10: Round-trip + row-locality properties (extend the property suite)

**Files:**
- Create: `packages/core/src/features/tokens/BlockParser.property.spec.ts`
- Modify: `packages/core/src/features/tokens/tokenIdentity.property.spec.ts` (migrate the slot-leading run to the block path OR keep + add a block run)

The spec pins TWO properties for Phase 7: round-trip (`split → parse → serialize ≡ value`) and row-locality (editing inside row k leaves all other rows' parse results reference-equal). Task 2/Task 4 added focused specs; this task makes them PROPERTIES over the existing fuzz generators (`generateSlotLeadingDocument`/`generateSlotLeadingEdit`/`generateInRowEdit`), running ~200 iterations like the inline equivalence property.

- [ ] **Step 1: Read the existing property runner + generators**

Re-read `tokenIdentity.property.spec.ts:550-637` (the runners) and the slot-leading generators (`:230-354`). `runSlotLeadingProperty` (`:589-624`) runs `'__slot__\n\n'` through the INLINE `Parser` and asserts the inline reconcile property + in-row descend. With first-class rows the BLOCK path uses `BlockParser` + `reconcileRows`. Decision: the in-row descend the old runner tested is now the ROW-LOCAL diff — migrate `runSlotLeadingProperty` to drive `BlockParser` + assert row-locality, OR keep it as an inline-nesting test and add a NEW block property file. **Choose: add a new `BlockParser.property.spec.ts`** (block round-trip + row-locality) and KEEP `runSlotLeadingProperty` (it still validates the inline reconcile of slot-leading marks, which is a real code path for a single-segment slot markup used inline — degenerate but exercised). This avoids destabilizing the existing inline property.

- [ ] **Step 2: Write the block property spec**

Create `packages/core/src/features/tokens/BlockParser.property.spec.ts`:

```ts
import {faker} from '@faker-js/faker'
import {describe, expect, it} from 'vitest'

import {BlockParser} from './parser/core/BlockParser'
import {Parser} from './parser/Parser'
import type {Markup, RowToken} from './parser/types'
import {createIdentityTracker} from './tokenIdentity'
import {
	applyEdit,
	editHintOf,
	generateInRowEdit,
	generateSlotLeadingDocument,
	generateSlotLeadingEdit,
} from './tokenIdentity.property.spec'

const ROW: Markup = '__slot__\n\n'
const BASE_SEED = 6_122_026
const ITERATIONS = 200

function block(): BlockParser {
	return BlockParser.from(new Parser([ROW]))
}

describe('BlockParser round-trip property', () => {
	it('split → parse → serialize ≡ value for any slot-leading document', () => {
		const parser = block()
		for (let i = 0; i < ITERATIONS; i++) {
			faker.seed(BASE_SEED + i)
			const value = generateSlotLeadingDocument()
			const rows = parser.parse(value)
			expect(rows.map(r => r.content).join(''), `round-trip failed for ${JSON.stringify(value)} (seed ${BASE_SEED + i})`).toBe(value)
		}
	})
})

describe('reconcile row-locality property', () => {
	it('an in-row edit leaves every OTHER row reference-equal', () => {
		const parser = block()
		for (let i = 0; i < ITERATIONS; i++) {
			const seed = BASE_SEED + i
			faker.seed(seed)
			const value = generateSlotLeadingDocument()
			if (value.length === 0) continue
			const tracker = createIdentityTracker()
			const before = tracker.reconcile(parser.parse(value)).tokens as RowToken[]
			const edit = generateInRowEdit(value)
			if (!edit) continue
			const next = applyEdit(value, edit)
			const after = tracker.reconcile(parser.parse(next), editHintOf(edit)).tokens as RowToken[]

			// The edited row is the one whose content substring changed; every other
			// row must be reference-equal (row-locality).
			const editedRowIndex = rowIndexContaining(before, edit.start)
			try {
				expect(after).toHaveLength(before.length) // an in-row edit never adds/removes a row
				for (let r = 0; r < before.length; r++) {
					if (r === editedRowIndex) continue
					expect(after[r], `row ${r} should be reference-equal after an in-row edit`).toBe(before[r])
				}
			} catch (error) {
				throw new Error(
					`row-locality failed\nseed=${seed}\nvalue=${JSON.stringify(value)}\nedit=${JSON.stringify(edit)}\nnext=${JSON.stringify(next)}`,
					{cause: error}
				)
			}
		}
	})
})

/** Index of the row whose [start, end) content span contains `pos`. */
function rowIndexContaining(rows: RowToken[], pos: number): number {
	for (let i = 0; i < rows.length; i++) {
		if (pos >= rows[i].position.start && pos < rows[i].position.end) return i
	}
	return rows.length - 1
}
```

(IMPORTANT subtlety: row-locality holds for rows BEFORE the edit (reused by reference, prefix band) AND rows AFTER the edit (suffix band) — but the suffix rows are SHIFTED by the edit's delta, so they are reused by reference ONLY when `shiftDelta === 0`. An in-row insert/delete shifts the suffix rows' positions → `reconcileRows`'s suffix band INHERITS the id but does NOT reuse the object (it creates a new `RowToken` with rebased positions). So "reference-equal" holds strictly only for the PREFIX rows (before the edit). The property must assert: prefix rows (index < editedRowIndex) are reference-equal; suffix rows (index > editedRowIndex) keep their IDs (and their CHILDREN are reused by reference since the row content substring is byte-identical, only positions shift). Revise the assertion: for `r < editedRowIndex`, `after[r] === before[r]`; for `r > editedRowIndex`, `after[r].id === before[r].id` AND `after[r].content === before[r].content`. This is the honest row-locality property — the spec's "all other rows' parse results reference-equal" means the PARSE RESULT (the inline tokens) is reused, which is true: a shifted suffix row's children are inherited by reference (Task 4's suffix band reuses the prev row's subtree via `inherit`, and since content is identical the inline tokens are not reparsed). Word the property precisely — see Step 2b.)

- [ ] **Step 2b: Precise row-locality assertion (prefix reference-equal, suffix id+content stable)**

Revise the row-locality loop to the honest property:

```ts
				expect(after).toHaveLength(before.length)
				for (let r = 0; r < before.length; r++) {
					if (r < editedRowIndex) {
						expect(after[r], `prefix row ${r} must be reference-equal`).toBe(before[r])
					} else if (r > editedRowIndex) {
						// suffix rows shift position but keep id + content (parse result reused)
						expect(after[r].id, `suffix row ${r} must keep its id`).toBe(before[r].id)
						expect(after[r].content, `suffix row ${r} content unchanged`).toBe(before[r].content)
					}
				}
```

(This is the row-locality property: unchanged rows' parse results are reused — prefix by reference, suffix by id+content+inherited subtree. The edited row's id is also stable (it is paired, not added/removed) — assert `after[editedRowIndex].id === before[editedRowIndex].id` too if you want full coverage. `generateInRowEdit` (`:331-354`) is documented to never split/merge a row, so `after.length === before.length` holds.)

- [ ] **Step 3: Export the generators if not already**

`generateSlotLeadingDocument`/`generateSlotLeadingEdit`/`generateInRowEdit`/`applyEdit`/`editHintOf` are already `export`ed from `tokenIdentity.property.spec.ts` (`:235`, `:254`, `:331`, `:41`, `:45`). Confirm with a grep; if any is not exported, add `export`. (They are exported per the Phase-2 comment at `:21-24`.)

- [ ] **Step 4: Run the block property + the inline property + full core**

Run: `pnpm -w exec vitest run --project core "BlockParser.property"`
Expected: full pass — round-trip (200 iters) + row-locality (200 iters) green.

Run: `pnpm -w exec vitest run --project core "tokenIdentity.property"`
Expected: full pass — the inline equivalence property (incl. the kept `runSlotLeadingProperty`) is unbroken.

Run: `pnpm -F core test`
Run: `pnpm run typecheck`
Expected: full pass / clean.

- [ ] **Step 5: Commit**

```bash
git commit -m "test(tokens): block round-trip + row-locality properties (200 iters)" -- packages/core/src/features/tokens/BlockParser.property.spec.ts
```

(Add `packages/core/src/features/tokens/tokenIdentity.property.spec.ts` to the paths IF Step 3 added an `export`.)

---

### Task 11: Riders — rewrite the rotten `parser/README.md`; fix `Parser.unescape` lossiness

**Files:**
- Modify: `packages/core/src/features/tokens/parser/Parser.ts` (unescape fix)
- Modify: `packages/core/src/features/tokens/parser/Parser.spec.ts` (escape/unescape round-trip cases)
- Rewrite: `packages/core/src/features/tokens/parser/README.md`

Two named §Riders. (1) `Parser.unescape` blanket-strips every `\X` pair, corrupting user-typed literal backslashes; fix it to unescape ONLY the registry's segments (the exact inverse of `escape`). (2) `parser/README.md` documents a nonexistent `ParserV2` with a fictional priority system, `nested`/`labelStart` fields, and a multi-phase TreeBuilder — rewrite it to the REAL parser (the three-stage pipeline, the real token shapes incl. `RowToken`, the real conflict resolution, the block pre-split).

- [ ] **Step 1: Fix `Parser.unescape`**

Read `Parser.escape` (`:209-214`) — it escapes ONLY the registry's string segments, longest-first, by `segment.replace(/(.)/g, '\\$1')` (a backslash before each char of the segment). The inverse must un-escape exactly those escaped-segment forms, longest-first, leaving every other backslash intact. In `Parser.ts`, change `unescape` (`:232-234`) from:

```ts
	unescape(text: string): string {
		return text.replaceAll(/\\(.)/g, '$1')
	}
```

to — replace each escaped segment with the segment, longest-first (mirroring `escape`):

```ts
	unescape(text: string): string {
		return this.registry.segments
			.filter((segment): segment is string => typeof segment === 'string')
			.toSorted((a, b) => b.length - a.length)
			.reduce((result, segment) => result.replaceAll(segment.replace(/(.)/g, '\\$1'), segment), text)
	}
```

(This is the exact inverse of `escape`: for each registry segment, replace its escaped form (`\@\[` for `@[`) with the literal segment. A user-typed literal `'\\'` or `'\x'` that is NOT an escaped registry segment is left untouched — the corruption is fixed. Update the JSDoc (`:216-231`) to note it un-escapes only the registry's segments, the precise inverse of `escape`.)

- [ ] **Step 2: Add escape/unescape round-trip cases**

In `Parser.spec.ts`, find the `escape`/`unescape` describe (grep `unescape`); add round-trip + literal-backslash cases:

```ts
describe('escape / unescape round-trip', () => {
	it('unescape(escape(text)) === text, preserving literal backslashes', () => {
		const parser = new Parser(['**__slot__**', '@[__value__]'])
		for (const text of ['Hello **world** and @[user]', 'a \\ b', 'path C:\\x\\y', 'no markup here', '@[x] \\@[y]']) {
			expect(parser.unescape(parser.escape(text))).toBe(text)
		}
	})

	it('unescape leaves a user-typed backslash that is not an escaped segment intact', () => {
		const parser = new Parser(['@[__value__]'])
		// '\d' is not an escaped '@' or '[' — must survive (old blanket regex ate it)
		expect(parser.unescape('a \\d b')).toBe('a \\d b')
	})
})
```

(VERIFY the existing `escape` spec still passes — the fix is to `unescape` only. The round-trip cases pin the inverse relationship.)

- [ ] **Step 3: Rewrite `parser/README.md`**

Replace `packages/core/src/features/tokens/parser/README.md` entirely with an ACCURATE, concise README of the REAL parser. It must cover:
- **Overview**: `Parser` (not `ParserV2`) — a tree-based markup parser; `parse(value) → Token[]`, `stringify(tokens) → string`, `transform(value, cb)`, `escape`/`unescape`/`hasSegments`/`rowTerminator`.
- **Token shapes** (the REAL ones from `types.ts`): `TextToken {type:'text', content, position, id?}`, `MarkToken {type:'mark', content, position, id?, descriptor, value, meta?, slot?, children}`, `RowToken {type:'row', content, position, id?, children, terminated}` (block mode top level).
- **Pipeline** (the REAL three stages, `Parser.parse:119-123`): `SegmentMatcher.search` (dual static/dynamic matcher) → `PatternMatcher.process` (state machine, processing-order conflict resolution via `addToCompleted` replacing the same-position match) → `TreeBuilder.build` (single-pass, stack-based parent tracking). Note there is NO `calculateDeterministicPriority` — conflict resolution is processing order + `conflictsWith` (overlap-or-valid-nesting in `Match.conflictsWith`).
- **Block pre-split** (`BlockParser`): in block mode the document pre-splits on the row terminator (derived from the slot-leading markup's suffix, default `'\n\n'`); each segment parses as inline content; the top level is `RowToken[]`. Row-local by construction.
- **Markup patterns** (the REAL validation from `MarkupDescriptor.validateMarkup`): `__value__` 0–2×, `__meta__` 0–1×, `__slot__` 0–1×; at least one `__value__` or `__slot__`; two-`__value__` HTML-like patterns require identical values.
- **Position semantics**: all positions absolute over the input, `start` inclusive / `end` exclusive (substring-compatible).
- A short examples section with REAL output trees (text + mark + the trailing empty text token; a nested `#[__slot__]`; a two-row block document).

Keep it tight (the spec's quality bar — the OLD one was 1044 lines of mostly-wrong content; aim for ~150–250 ACCURATE lines). Do NOT carry over the fictional priority table, the `nested`/`labelStart` fields, the multi-phase TreeBuilder, or the `OPTIMIZATION_RESULTS.md`/`TokenBuilder.ts` module references (those files do not exist). Verify every claim against the actual source you read in the grounding pass.

- [ ] **Step 4: Run the parser specs + typecheck**

Run: `pnpm -w exec vitest run --project core "parser/Parser.spec"`
Expected: full pass — the escape/unescape round-trip + literal-backslash cases green; the inline parse cases unchanged.

Run: `pnpm -F core test`
Run: `pnpm run typecheck`
Expected: full pass / clean (README is docs-only; the unescape fix is covered by the new spec).

- [ ] **Step 5: Commit**

```bash
git commit -m "fix(parser): unescape only registry segments (preserve literal backslashes); rewrite the README" -- packages/core/src/features/tokens/parser/Parser.ts packages/core/src/features/tokens/parser/Parser.spec.ts packages/core/src/features/tokens/parser/README.md
```

---

### Task 12 (FINAL): Migration completion — shrink the tokens README; final green; program-complete report

**Files:**
- Rewrite: `packages/core/src/features/tokens/README.md`

The migration's tie-off (NOT another plan — there is no Phase 8). Shrink the tokens README to the two-sentence model around the post-Phase-7 reality (no `incrementalParse`, no old changeset buckets, no per-node `dirty` signals, no old handle surface; first-class rows; block-mode `tokens(): RowToken[]`), then a FINAL full-suite + storybook + typecheck + encapsulation + bench green, and a closing report confirming all four wins gate (win 4 traded), the public surface matches the spec's §Public API, and the semver-major is ready to cut.

- [ ] **Step 1: Rewrite the tokens README toward ≤150 lines around the two-sentence model**

Rewrite `packages/core/src/features/tokens/README.md` to the post-Phase-7 reality. Lead with the acceptance-bar model: *"handles are fresh; the render tree is for renderers."* Cover, CONCISELY:
- **The one fresh truth**: `tokens()` is THE consumer read — the latest reconciled tree, always fresh, consistent with `value.current()`; in block mode it is `RowToken[]`. `renderTree` is the adapter-only renderer signal (`@markput/core/adapter`); `changed: Event<void>` fires after the DOM is consistent.
- **Handles**: `handle(id)` / `handleAt(node)` resolve a live `TokenHandle` (`{id, token(), path(), alive(), element(), caret/measure commands}` — plain getters, no signals: the win-4 trade); fail closed mid-window.
- **The one commit pipeline** (`model/commit.ts`): two branches — text path patches the DOM in place without re-rendering; structural path publishes a new `renderTree` and binds the painted DOM at `rendered()`. Routing decided at reconcile time (`{structural, changes, removedIds}`); the fold guard is the only commit-side override.
- **First-class rows** (Phase 7): block mode pre-splits on the terminator into `RowToken`s; the row IS the structural unit; parsing is row-local (a keystroke in row k reparses only row k); the empty-slot collapse is unrepresentable (an empty row is a `RowToken` with one empty text child). Deep descend survives for genuinely nested INLINE slot marks only.
- **Bind** (`model/bind.ts`): zip the painted DOM with the reconciled tree onto the id-keyed handle map; the block frame is container → row elements (each a `RowToken`'s binding) → one inner host for `row.children`.
- **Parse + identity** (`tokenIdentity.ts`): `reconcile` stamps `token.id`, reuses prev objects by reference, carries ids across shifts; the row path diffs rows row-locally; `EditHint` windows the reconcile.

DELETE every stale section: `incrementalParse` / the windowed reparse (Phase 6), the old changeset buckets (`textChanged`/`added`/`removed`/`updated`), per-node `dirty` signals + isolation specs (Phase 5), the old handle surface (`address`/`text`/`dead`/`changed`-event table — Phase 5), the `tree()`-stale-vs-handle-fresh staleness contract (Phase 3). Keep the encapsulation rule + the divergence-detector note. Target ≤150 lines (the spec's acceptance bar). VERIFY the line count: `wc -l packages/core/src/features/tokens/README.md` should be ≤ ~150.

- [ ] **Step 2: Final full verification (all suites + guards + bench)**

Run, expecting full pass on each (do NOT use `pnpm -F react test` / `pnpm -F vue test` — silent no-ops):

```bash
pnpm -F core test            # full core suite — first-class rows; row-local reconcile; BlockParser; unescape fix; cascade deletions
pnpm -F storybook test       # react + vue page specs — block render gates + empty-row gate re-pinned on the Row tree; Drag/Selection/Clipboard green
pnpm run typecheck           # recursive tsc/vue-tsc — RowToken exported + threaded through tokens()/renderTree/keyOf/adapters; no incrementalParse/filterEmptyText/isSlotLeadingMark/isTextLikeRow
pnpm run check:encapsulation # raw Selection/Range/TreeWalker stay inside features/tokens
```

Run the kept Phase-6 bench tripwire — Phase 7's row-local block parse should show the typing-cost drop (and the inline benches are unchanged):

```bash
pnpm -w exec vitest bench --project core parser.bench
```

Expected: the bench RUNS — the full-parse "Typing cost: 500 marks full parse per keystroke" bench (inline tripwire) + scalability + real-world benches print ops/sec; no compile break from the Row threading. (Optionally add a block-typing bench fixture comparing per-keystroke cost block vs inline — only if the bench file already has a block harness; otherwise leave the inline tripwire as the kept gate and NOTE the row-local win is proven by the row-locality property + the block render gates, not a new bench.)

- [ ] **Step 3: Confirm the cascade deletions and the new shape**

Run: `grep -rn "incrementalParse\|filterEmptyText\|isSlotLeadingMark\|isTextLikeRow\|resolveSlotLeadingMatches\|#lastParsed" packages/core/src --include="*.ts"`
Expected: ZERO hits — every §What-dies "rows-as-slot-marks" name is gone (plus the Phase-6 `incrementalParse`/`#lastParsed`).

Run: `grep -rn "type: 'row'\|RowToken" packages/core/src --include="*.ts" | head`
Expected: `RowToken` is produced by `BlockParser`, threaded through `tokenIdentity`/`commit`/`bind`/`TokenModel`/`resolveSlot`, and exported.

Run: `grep -rn "//TODO need review it" packages/core/src/features/tokens/parser --include="*.ts"`
Expected: ZERO hits — both TODOs deleted with their special cases (Task 9).

Run: `wc -l packages/core/src/features/tokens/README.md packages/core/src/features/tokens/parser/README.md`
Expected: the tokens README ≤ ~150 lines; the parser README rewritten to the real parser.

- [ ] **Step 4: Commit the tokens README**

```bash
git commit -m "docs(tokens): shrink the README to the two-sentence model (first-class rows; handles fresh, render tree for renderers)" -- packages/core/src/features/tokens/README.md
```

- [ ] **Step 5: Confirm clean and write the program-complete report**

`git status` must be clean (everything committed task-by-task, path-scoped; any regenerated `packages/website/...` typedoc output left uncommitted or reverted).

Write the closing **program-complete report** (this is the FINAL deliverable — there is NO Phase 8 plan). It must state:

- **The Phase 7 wins delivered:** block-mode parsing is now ROW-LOCAL by construction — the value pre-splits on the terminator (`BlockParser`, derived from the slot-leading markup's suffix, default `'\n\n'`, validated at parser construction); the top level is first-class `RowToken[]`; a keystroke in row k reparses only row k (the row-locality property, 200-iter fuzz-gated); the round-trip property (`split → parse → serialize ≡ value`) holds; `value.current()` is byte-identical to before. The full-parse cliff is killed with ZERO guard machinery.
- **The cascade deletions:** `resolveSlotLeadingMatches` + `isSlotLeading` (PatternMatcher), the `Match` slot-leading constructor special case (+ both `//TODO need review it`), `filterEmptyText` (the last empty-slot collapse — now unrepresentable: an empty row is a `RowToken` with one empty text child), the descend-for-rows top-level routing (`tryDescend` kept for genuinely nested INLINE slot marks only), the five `isTextLikeRow`/`isSlotLeadingMark` sniffing sites, the `addDragRow` doubled-content quirk, and the bind rows-map / one-non-control-child bolt-on (now the ordinary block frame). Confirm `#lastParsed` (Phase 6) stays gone.
- **The breaking change:** block-mode `tokens()` returns `RowToken[]` (was `Token[]`) — a tree-shape break folded into the Phase 4–7 semver-major. The public CONFIG is byte-identical (`{markup:'__slot__\n\n', Mark}` + `layout="block"`); adapters map rows → `Block`, render `row.children`, and the option's `Mark` renders for marked rows. The semver-major is ready to cut.
- **The riders:** `Parser.unescape` now un-escapes only registry segments (literal backslashes preserved, round-trip-gated); the rotten `parser/README.md` is rewritten to the real three-stage parser + the block pre-split; the tokens README is shrunk to the two-sentence model (≤150 lines).
- **The four wins still gate (with win 4 traded):** (1) hard DOM encapsulation — `check:encapsulation` green; (2) stable token identity across edits — `token.id` unifies identity, the remount gate green; (3) zero framework re-renders on typing, inline AND block — the render-count gates (incl. the empty-row gate) green on the Row tree, now row-local; (4) fine-grained per-node reactivity — consciously TRADED for fine-grained DOM patching (the spec's win-4 trade, reversible behind the handle getters).
- **Public surface matches the spec's §Public API:** `tokens()` / `at()` / `handle(id)` / `handleAt(node)` / `changed` / `selection()` + the command set; the adapter SPI (`renderTree`/`keyOf`/`rendered()`/`control()`/`children()`) in `@markput/core/adapter`; `RowToken` exported.
- **The pass counts:** the core suite pass count (note the additions: `BlockParser.spec`, `tokenIdentity.rows.spec`, `BlockParser.property.spec`, `toString.row.spec`, the escape/unescape round-trip), the storybook react/vue counts, typecheck + encapsulation green, the bench still runs.
- **Program complete:** all of Phases 0–7 (the spec's full migration) are landed; this is the FINAL phase — there is no Phase 8. The "One Fresh Truth" migration is done.

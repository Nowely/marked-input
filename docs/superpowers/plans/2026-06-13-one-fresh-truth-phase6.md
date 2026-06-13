# One Fresh Truth — Phase 6: Pipeline + Parse Trim Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the PURITY computed with an explicit watch-callback pipeline entry, and delete `incrementalParse` so the inline parse is always a full parse. Concretely: (1) the reparse trigger becomes ONE explicit `watch` over the `(value, parser, isBlock)` tuple — the `#reconciled` `Computed` (which today consume-once-reads `value.takePendingEdit()` and writes `#lastParsed` as side effects *inside a getter*, leaning on the runtime's once-per-wave PURITY guarantee) is deleted; the hint is drained explicitly inside the watch callback (a side-effect context where a consume-once read is honest), parsed, reconciled, and applied. (2) `incrementalParse.ts` + `incrementalParse.property.spec.ts` are deleted (the windowed reparse, alternation snapping, the inert-outside guard, and the doubling stabilization all go) — the inline parse is `parser.parse(value)`, full, every keystroke; `#lastParsed` and the incremental branch of `#parse` die with it. `EditHint` (reconcile windowing) and the typing bench (the regression tripwire) are KEPT. (3) The Phase-6 rider: delete dead `preparsing/getClosestIndexes` (zero consumers). This phase breaks NO public API — `incrementalParse`/`getClosestIndexes` are internal (never re-exported from `packages/core/index.ts`), `#reconciled`/`#lastParsed`/`#parse` are private, and `tokens()`/`changed`/the render-count gates are unchanged. It is the spec's "Phase 6 — pipeline + parse trim (2 days)".

**Architecture:** The spec's "What dies" names two deaths that Phase 6 executes. First: *"`incrementalParse.ts` + alternation snapping + inert guard + doubling stabilization → full parse (inline); EditHint kept for reconcile windowing; bench kept as tripwire."* The consolidation accepted O(tree) reconcile per keystroke (CM6 doctrine: make DOM work O(change), accept linear diff work at this document scale). The inline parse was the one place a *windowed* fast path survived — but the research verified a full-parse cliff (`one '- ' in prose defeats the inert-outside guard — realistic block documents are O(document) parse per keystroke despite the fast path`), and Phase 7's pre-split row parser delivers *better* incrementality (`a keystroke inside row k reparses only row k`) with *zero* guard machinery. So `incrementalParse` is dead weight between now and Phase 7: a 230-line windowed splicer whose correctness already had to deep-equal a full parse on every path, guarded by a 200-iteration property spec, defeated by a single stray segment. Phase 6 deletes it and runs `parser.parse(value)` directly. The spec's reversal trigger — *"a felt inline-typing regression after Phase 6 → resurrect `incrementalParse` behind its property spec"* — is the safety net: the bench is kept precisely so a regression is *measured*, not felt-and-argued. Second: *"Edit-hint signal side channel + the PURITY computed → explicit hint through a watch-callback pipeline entry."* Today `#reconciled` is a `Computed` whose body drains `value.takePendingEdit()` (consume-once) and assigns `this.#lastParsed` (a side effect) — both inside a getter. A getter that mutates is only safe because the alien-signals runtime evaluates a computed at most once per dependency-change wave (the load-bearing PURITY comment at `TokenModel.ts:132-134`). Graft B in the spec states the cleaner shape outright: *"the reparse trigger is one watch over the `(value, parser, isBlock)` tuple (stated, not hidden)."* A `watch` callback runs at effect-flush, in `untracked`, exactly once per wave by construction — so draining a consume-once side channel there needs no PURITY argument; it is an ordinary side-effecting subscriber. Decision 2 names the payoff: *"The token core still drops to one `renderTree` signal + one `changed` event, removing its dependence on the runtime's once-per-wave PURITY guarantee."* Phase 6 removes that dependence.

**The exact replacement (decided here, grounded in the post-Phase-5 code):**

Today (`TokenModel.ts`):

```ts
#lastParsed: {parser: Parser; value: string; tokens: Token[]} | undefined

// PURITY: the consume-once hint read and the #lastParsed write mutate inside
// this computed — safe because the runtime executes a getter at most once per
// dependency change wave (verified in shared/signals; equal writes never propagate).
readonly #reconciled: Computed<ReconcileResult> = computed(() => {
	const parser = this.#parser()
	const value = this.value.current()
	const hint = this.value.takePendingEdit()
	const previousValue = this.value.previousValue()
	const parsed = this.#parse(parser, value, hint, previousValue)
	this.#lastParsed = parser ? {parser, value, tokens: parsed} : undefined
	const tokens = this.props.layout.isBlock() ? filterEmptyText(parsed) : parsed
	return this.#identity.reconcile(tokens, hint, previousValue, value)
})

#parse(parser, value, hint, previousValue): Token[] {
	if (!parser) return [createTextToken(value)]
	const lastParsed = this.#lastParsed
	if (hint === undefined || lastParsed === undefined) return parser.parse(value)
	if (lastParsed.parser !== parser || lastParsed.value !== previousValue) return parser.parse(value)
	return incrementalParse(parser, lastParsed.tokens, lastParsed.value, value, hint)
}

// in the constructor's onMounted:
watch(this.#reconciled, result => this.#pipeline.apply(result), {immediate: true})
```

After Phase 6 — the watch-callback pipeline entry. The trigger function reads exactly the `(value, parser, isBlock)` tuple (the spec's named tuple) so the watch's tracked dependencies are precisely those three; the callback drains the hint and applies:

```ts
// in the constructor's onMounted, replacing the #reconciled watch:
watch(
	() => ({value: this.value.current(), parser: this.#parser(), isBlock: this.props.layout.isBlock()}),
	({value, parser, isBlock}) => this.#reparse(value, parser, isBlock),
	{immediate: true}
)

// the explicit pipeline entry — drained, parsed, reconciled, applied; no getter side effects:
#reparse(value: string, parser: Parser | undefined, isBlock: boolean): void {
	const hint = this.value.takePendingEdit()
	const previousValue = this.value.previousValue()
	const parsed = parser ? parser.parse(value) : [createTextToken(value)]
	const tokens = isBlock ? filterEmptyText(parsed) : parsed
	this.#pipeline.apply(this.#identity.reconcile(tokens, hint, previousValue, value))
}
```

`#lastParsed`, `#parse`, and the `incrementalParse`/`Parser`/`Computed`/`ReconcileResult` imports they require all collapse out (`Parser` survives only as a TYPE used by `#parser`/`#reparse`; `Computed` survives for `renderTree`). The trigger reads `this.value.current()` (tracked), `this.#parser()` (a computed — tracked), and `this.props.layout.isBlock()` (tracked) — the exact three signals the old `#reconciled` tracked, minus `value.previousValue()`/`value.takePendingEdit()` which were never reactive dependencies (they are plain reads of fields the `current` write sets synchronously, drained in the callback). The watch is `immediate: true` so the cold-start structural pass still seeds the pipeline before the immediate `onRendered` binds the pre-built DOM (the `// Order matters` comment's contract is preserved — `#reparse` runs synchronously inside the immediate watch, exactly where `apply` ran before).

**Why this is behavior-identical (per-edit):** the old `#reconciled` was a `Computed` that the constructor `watch`'d. A `Computed` recomputes when any tracked dep changes; the `watch` fired its callback (`apply`) when the computed's value changed (reference change — `reconcile` returns a fresh object every time). The new `watch` fires when the `(value, parser, isBlock)` tuple object changes — and the trigger returns a fresh object every wave, so it fires on exactly the same waves (one per accepted `value.current` write, per parser rebuild, per layout flip). The hint drain moves from "inside the computed, once per wave by PURITY" to "inside the watch callback, once per wave by `effect` flush" — same cadence, no PURITY argument. The render-count gate (`TokenModel.changed.spec.ts`: 3 text edits → renderTree 0 / changed 3) is the headline pin: it must stay green unchanged, proving the per-edit cadence is identical.

**Tech Stack:** TypeScript, vitest in REAL Chromium browser mode. Run patterns: `pnpm -F core test` (full core suite). To run ONE spec: `pnpm -w exec vitest run --project core <path-or-pattern>`. Storybook page specs (the react/vue vitest projects): `pnpm -F storybook test` (full), `pnpm -F storybook test:react`, `pnpm -F storybook test:vue`; to filter: `pnpm -w exec vitest run --project react --project vue <pattern>`. **WARNING: `pnpm -F react test` and `pnpm -F vue test` are SILENT NO-OPS** — `@markput/react`/`@markput/vue` have NO test script; pnpm exits 0 with no output. The react/vue vitest projects ARE the storybook page specs above. Typecheck: `pnpm run typecheck` (recursive `tsc --noEmit` / `vue-tsc --noEmit` across all packages; note it regenerates `packages/website/src/content/docs/api/*.md` via typedoc — do NOT commit those; `git checkout -- packages/website` or leave them and commit only your scoped paths). Encapsulation guard: `pnpm run check:encapsulation`. Benchmarks: `pnpm -w exec vitest bench --project core parser.bench` (the typing bench — kept as the regression tripwire; run it to confirm it still builds and produces numbers after the trim). Conventions: tabs, single quotes, no semicolons, `import type`, **no trailing newline at end of `.ts`/`.tsx` files** (`.vue` SFCs DO end with a newline — match each file).

**Commits in a shared checkout:** other agents work concurrently in the SAME working tree on DISJOINT files. ALWAYS commit path-scoped: `git commit -m <message> -- <explicit paths>` (commits ONLY those paths even if other files are staged). NEVER `git add -A` / `git add .` / a bare `git commit`. On an `index.lock` error, wait ~2s and retry up to 5 times. If a pre-commit hook reflows a file you did not edit (MM, cosmetic-only vs HEAD), `git reset HEAD -- <file>` rather than commit churn.

**Spec:** `docs/superpowers/specs/2026-06-13-tokenmodel-one-fresh-truth-design.md` (Phase 6: "the `(value, parser, isBlock)` watch replaces the PURITY computed; explicit hint flow; delete `incrementalParse` + its property spec (EditHint + bench survive as the regression tripwire)"; §What dies → "`incrementalParse.ts` + alternation snapping + inert guard + doubling stabilization → full parse (inline); per-row parse (block, Phase 7); EditHint kept for reconcile windowing; bench kept as tripwire" / "Edit-hint signal side channel + the PURITY computed → explicit hint through a watch-callback pipeline entry"; §Grafts B → "the reparse trigger is one watch over the `(value, parser, isBlock)` tuple (stated, not hidden)"; §Decisions 2 → "the token core still drops to one `renderTree` signal + one `changed` event, removing its dependence on the runtime's once-per-wave PURITY guarantee"; §Riders → "delete dead `preparsing/getClosestIndexes` (Phase 6)"; §Reversal triggers → "a felt inline-typing regression after Phase 6 → resurrect `incrementalParse` behind its property spec" — the bench is kept so this is measured, not felt).

**Background facts (probe-verified against post-Phase-5 HEAD `035d742b`, do not re-derive):**

- **`#reconciled` is the PURITY computed (`TokenModel.ts:135-147`).** It reads `this.#parser()`, `this.value.current()`, `this.value.takePendingEdit()` (consume-once drain), `this.value.previousValue()`; calls `this.#parse(parser, value, hint, previousValue)`; writes `this.#lastParsed = parser ? {parser, value, tokens: parsed} : undefined`; computes `tokens = isBlock ? filterEmptyText(parsed) : parsed`; returns `this.#identity.reconcile(tokens, hint, previousValue, value)`. The PURITY comment (`:132-134`) names the hazard: the consume-once read and the `#lastParsed` write mutate inside a getter, safe only by the once-per-wave runtime guarantee. The constructor `watch`'s it: `watch(this.#reconciled, result => this.#pipeline.apply(result), {immediate: true})` (`:179`).
- **`#parse` (`TokenModel.ts:155-168`)** is the typing hot path: returns `[createTextToken(value)]` when no parser; else, with a usable `#lastParsed` and a matching `hint`/`previousValue`, calls `incrementalParse(parser, lastParsed.tokens, lastParsed.value, value, hint)`; else `parser.parse(value)`. After the trim, the whole incremental branch (and `#lastParsed`) disappears; the survivor is `parser ? parser.parse(value) : [createTextToken(value)]` — inlined into `#reparse`. `createTextToken` import stays.
- **`#parser` (`TokenModel.ts:119-127`)** is a `Computed<Parser | undefined>` over `props.Mark()`/`props.options()`. UNCHANGED — the new trigger reads it exactly as `#reconciled` did. `Parser` survives as a TYPE (the `#parser` computed's element type + `#reparse`'s param); the VALUE import `Parser` is used in `#parser`'s body (`new Parser(markups)`), so `import {Parser}` stays.
- **`value.takePendingEdit()` / `previousValue()` are NOT reactive (`ValueModel.ts:44-53`).** `takePendingEdit()` is a consume-once read of the `#pendingEdit` field (returns it, nulls it). `previousValue()` reads `#previousValue`. Both fields are set SYNCHRONOUSLY by the `current` signal's `set` transform (`:31`) and `replace` (`:71`) BEFORE the stored value changes — so when the watch callback runs (at flush, after the `current` write), both reflect the just-accepted edit. They were never tracked dependencies of `#reconciled`; moving their reads into the watch callback changes nothing about WHEN they are read (still after the `current` write, still once). This is why the drain is honest in the callback: the side channel is a plain field, not a signal.
- **`incrementalParse` consumers (grep-verified, this HEAD):** `TokenModel.#parse` (`TokenModel.ts:10,167` — production, deleted), `incrementalParse.property.spec.ts` (`:4` — the property spec, deleted), and `parser.bench.ts` (`:6,437,455,476,494` — the bench's INCREMENTAL cases (b)/(c) call it). NOT re-exported from `packages/core/index.ts` (internal-only). After `TokenModel` stops importing it, the only callers are the property spec (deleted) and the bench's incremental cases (deleted — see next fact).
- **The bench is KEPT, but its INCREMENTAL cases die with `incrementalParse` (`parser.bench.ts`).** The bench file imports `incrementalParse` (`:6`) and `EditHint` (`:8`) and has three incremental fixtures/benches: the full-parse baseline `(a)` (`describe('Incremental: 500 marks full parse (baseline)')`, `:407-430` — calls `incrementalParser.parse(...)`, NO `incrementalParse`), the tail-insert `(b)` (`:433-469` — calls `incrementalParse`), and the middle-insert `(c)` (`:472-508` — calls `incrementalParse`). Once `incrementalParse.ts` is deleted, `(b)`/`(c)` cannot compile. The spec keeps "the bench as the regression tripwire": the SURVIVOR is the FULL-PARSE benches — the scalability suite (`:336-362`), the real-world scenarios (`:365-401`), and the full-parse baseline `(a)` — which now ARE the per-keystroke cost (full parse always). So Phase 6 deletes the `(b)`/`(c)` benches + their fixtures (`incrementalPrev500`, `incrementalTailValue`/`Hint`, `incrementalMidValue`/`Hint`, the `incrementalParse`/`EditHint` imports) and keeps `(a)` (renamed to drop "baseline" — it is now THE typing bench) + everything else. `incrementalParser`/`incrementalBase500`/`generateInertText` stay (used by `(a)`).
- **`EditHint` is KEPT (`tokenIdentity.ts:26-31`).** Used by `IdentityTracker.reconcile`'s `hint?` param (`:62`), `hintFromValues` (`:366`), and re-exported from `tokens/index.ts` (`:13`). The bench's `EditHint` import dies (its only bench use is the deleted incremental hints). `TokenModel.ts` imports `EditHint` only as `#parse`'s `hint` param type (`:15,158`) — that import dies with `#parse` (the watch callback uses the inferred type of `takePendingEdit()`, which is structurally `EditHint` but TokenModel needn't name it). KEEP the `tokens/index.ts` `EditHint` export (the spec keeps `EditHint`; it is a stable internal type).
- **`getClosestIndexes` is dead (the Phase-6 rider).** `preparsing/utils/getClosestIndexes.ts` is re-exported by `preparsing/index.ts:2` and consumed NOWHERE else (grep-verified: zero importers outside its own barrel; no spec). `findGap` (the sibling, `preparsing/utils/findGap.ts`, with `findGap.spec.ts`) IS used — by `tokenIdentity.hintFromValues` (`tokenIdentity.ts:3,367`). Delete `getClosestIndexes.ts` and its `preparsing/index.ts` re-export line; keep `findGap` and its spec. The `preparsing/README.md` ("utilities for preprocessing text before parsing") stays accurate for `findGap`.
- **`Parser.hasSegments` (`Parser.ts:188`) loses its only consumer.** `isInert` in `incrementalParse.ts` (`:201-203`) is the sole caller (grep-verified). When `incrementalParse.ts` is deleted, `hasSegments` is consumer-less. The spec's named deletions are "alternation snapping + inert guard + doubling stabilization" — all INSIDE `incrementalParse.ts`; `hasSegments` is a `Parser` method, NOT named for deletion, and Phase 7's row-terminator validation is a plausible future consumer (`validated at parser construction`). DECISION: KEEP `hasSegments`; only fix its now-stale JSDoc (`:176-184`) which points at the deleted `incrementalParse.ts`. (Deleting a clean `Parser` query that the next phase may want is out of this phase's named scope; the JSDoc fix is mandatory so no comment references a deleted file.)
- **No spec reads `#reconciled`/`#lastParsed`/`#parse`/`takePendingEdit`/`previousValue` directly** (grep-verified — they are all private/internal). The behavior is pinned through the public surface: `TokenModel.changed.spec.ts` (the render-count gates + the edit-hint flow tests at `:56-109`), `TokenModel.index.spec.ts` (`tokens()`/`at()` freshness), `tokenIdentity.spec.ts` (the no-hint findGap path), and the storybook typing gates. None reference the private members by name, so the refactor needs NO spec rewrite — only the deletion of `incrementalParse.property.spec.ts` (whose subject is deleted).
- **The headline regression spec is `TokenModel.changed.spec.ts`.** The render-count gate test (`:121-167`) pins: 3 text edits → `renderTree` watcher 0 / `changed` 3, then 1 structural edit → `renderTree` 1, completed by `rendered()` → `changed` 4. This is the exact per-edit cadence the watch-callback entry must preserve. The edit-hint flow tests (`:56-92`) pin that `edit.replace` flows a precise hint (suffix tokens shift, ids stable) and `:97-109` pins the no-hint findGap path. All four MUST stay green unchanged — they ARE the proof the explicit drain is behavior-identical.
- **`watch(dep, fn, {immediate})` semantics (`shared/signals/signal.ts:656-693`).** `watch` wraps an `effect` that reads `dep` (calling `dep()` when `dep` is a function — tracking its reactive reads as the effect's deps). On the first run with `immediate: true`, it calls `fn(newValue, undefined)` in `untracked`. On every later run (a tracked dep changed), it calls `fn(newValue, prev)` in `untracked`. So the callback ALWAYS runs in `untracked` — `this.value.takePendingEdit()`/`previousValue()`/`this.#pipeline.apply(...)` inside it create no reactive links. Exactly the consume-once-side-channel-in-a-side-effect shape the spec wants. (The `dep` function's reads — `value.current()`, `#parser()`, `isBlock()` — ARE tracked, which is the point: those three are the trigger.)

---

### Task 1: Replace the `#reconciled` PURITY computed with the `(value, parser, isBlock)` watch-callback entry

**Files:**
- Modify: `packages/core/src/features/tokens/model/TokenModel.ts`

This is the heart of Phase 6. The `#reconciled` `Computed` (consume-once-drains the hint + writes `#lastParsed`, both inside a getter) is deleted; the constructor watch over it becomes a watch over the explicit `(value, parser, isBlock)` tuple whose callback drains the hint, parses (full parse), reconciles, and applies. `#lastParsed` and the incremental branch of `#parse` are removed here too (the full parse is inlined into the new `#reparse`), so `incrementalParse` loses its production caller before Task 2 deletes the file. No spec reads these private members, so the suite stays green by behavior preservation alone — pinned by `TokenModel.changed.spec.ts`'s render-count gates.

- [ ] **Step 1: Capture the baseline**

Run: `pnpm -w exec vitest run --project core TokenModel.changed.spec`
Run: `pnpm -w exec vitest run --project core TokenModel.index.spec`
Run: `pnpm -F core test`
Expected: full pass (the pre-change baseline — the render-count gates + the fresh-read + the whole core suite are green against the current PURITY computed).

- [ ] **Step 2: Delete `#lastParsed`, rewrite `#reconciled`→`#reparse`, collapse `#parse`**

In `TokenModel.ts`, delete the `#lastParsed` field + the `#reconciled` computed + the `#parse` method (`:129-168`) — the whole block from the `/** Previous parse … */` comment through the end of `#parse`:

```ts
	/** Previous parse (pre-filterEmptyText) — the splice base for {@link incrementalParse}. */
	#lastParsed: {parser: Parser; value: string; tokens: Token[]} | undefined

	// PURITY: the consume-once hint read and the #lastParsed write mutate inside
	// this computed — safe because the runtime executes a getter at most once per
	// dependency change wave (verified in shared/signals; equal writes never propagate).
	readonly #reconciled: Computed<ReconcileResult> = computed(() => {
		const parser = this.#parser()
		const value = this.value.current()
		const hint = this.value.takePendingEdit()
		const previousValue = this.value.previousValue()
		const parsed = this.#parse(parser, value, hint, previousValue)
		// #lastParsed keeps the UNfiltered tree: incrementalParse splices previous
		// top-level tokens, so its input must be exactly what parse() emits. The
		// identity tracker receives the FILTERED tree (block mode) — what renders.
		this.#lastParsed = parser ? {parser, value, tokens: parsed} : undefined
		const tokens = this.props.layout.isBlock() ? filterEmptyText(parsed) : parsed
		return this.#identity.reconcile(tokens, hint, previousValue, value)
	})

	/**
	 * Typing hot path: reparse only a window around the edit hint when the
	 * matching previous parse is available; incrementalParse itself falls back
	 * to a full parse on any doubt (output is always parse-equivalent — gated
	 * by incrementalParse.property.spec.ts).
	 */
	#parse(
		parser: Parser | undefined,
		value: string,
		hint: EditHint | undefined,
		previousValue: string | undefined
	): Token[] {
		if (!parser) return [createTextToken(value)]
		const lastParsed = this.#lastParsed
		if (hint === undefined || lastParsed === undefined) return parser.parse(value)
		// A parser/options change invalidates the previous tree's descriptors; the
		// hint's ranges are coordinates in exactly the last parsed value.
		if (lastParsed.parser !== parser || lastParsed.value !== previousValue) return parser.parse(value)
		return incrementalParse(parser, lastParsed.tokens, lastParsed.value, value, hint)
	}
```

Replace that entire block with the explicit pipeline entry — a plain method, no getter side effects, full parse:

```ts
	/**
	 * THE reparse pipeline entry (the spec's watch-callback hint flow). Driven by
	 * the one watch over the `(value, parser, isBlock)` tuple in the constructor:
	 * when any of the three changes, drain the consume-once edit hint, full-parse
	 * the value (inline parsing is always a full parse — the windowed
	 * `incrementalParse` is deleted; Phase 7's pre-split row parser is the
	 * incrementality story), filter empty texts in block mode, then reconcile and
	 * apply. The hint + `previousValue` are plain fields the `current` write set
	 * synchronously, so draining them HERE — inside an `untracked` watch callback,
	 * once per wave by construction — needs no PURITY argument (the old
	 * `#reconciled` computed drained them inside a getter, leaning on the runtime's
	 * once-per-wave guarantee; that dependence is gone).
	 */
	#reparse(value: string, parser: Parser | undefined, isBlock: boolean): void {
		const hint = this.value.takePendingEdit()
		const previousValue = this.value.previousValue()
		const parsed = parser ? parser.parse(value) : [createTextToken(value)]
		const tokens = isBlock ? filterEmptyText(parsed) : parsed
		this.#pipeline.apply(this.#identity.reconcile(tokens, hint, previousValue, value))
	}
```

(The `#parser` computed directly above (`:119-127`) is UNTOUCHED — leave it exactly as is. `#reparse` lands where `#parse` was. `filterEmptyText` is the module function at the file end — unchanged. `createTextToken`/`createIdentityTracker` imports stay.)

- [ ] **Step 3: Re-point the constructor watch at the tuple trigger**

In `TokenModel.ts`, the constructor's `onMounted` (`:175-181`) watches `#reconciled`. Change it from:

```ts
		host.onMounted(() => {
			// Order matters: the immediate apply seeds the pipeline (cold start is
			// a structural pass), so the immediate onRendered right after can bind
			// a pre-built DOM — the shell is live once the container attaches.
			watch(this.#reconciled, result => this.#pipeline.apply(result), {immediate: true})
			watch(host.rendered, () => this.#pipeline.onRendered(), {immediate: true})
		})
```

to:

```ts
		host.onMounted(() => {
			// Order matters: the immediate reparse seeds the pipeline (cold start is
			// a structural pass), so the immediate onRendered right after can bind
			// a pre-built DOM — the shell is live once the container attaches.
			//
			// THE reparse trigger: one watch over the (value, parser, isBlock) tuple
			// (the spec's named tuple). The trigger reads exactly those three signals
			// — so the watch fires on exactly the waves the old #reconciled computed
			// recomputed on — and #reparse drains the hint + applies in the callback.
			watch(
				() => ({value: this.value.current(), parser: this.#parser(), isBlock: this.props.layout.isBlock()}),
				({value, parser, isBlock}) => this.#reparse(value, parser, isBlock),
				{immediate: true}
			)
			watch(host.rendered, () => this.#pipeline.onRendered(), {immediate: true})
		})
```

- [ ] **Step 4: Drop the now-unused imports**

In `TokenModel.ts`, the `incrementalParse` value import (`:10`) and the `EditHint`/`ReconcileResult` type imports (`:15`) are now unused (`#parse` and `#reconciled` are gone — `#reparse` names no `EditHint`, the watch callback names no `ReconcileResult`, and the full parse calls `parser.parse` directly). `Computed` (`:3`) is STILL used by `renderTree` (`:80`) — keep it. `Parser` (`:11`) is STILL used by `#parser`'s `new Parser(markups)` + the `#reparse`/`#parser` type — keep it.

Delete line 10 entirely:

```ts
import {incrementalParse} from '../incrementalParse'
```

Change line 15 from:

```ts
import type {EditHint, ReconcileResult} from '../tokenIdentity'
```

to — drop both names (the file no longer references `EditHint` or `ReconcileResult`; `createIdentityTracker` is the value import on line 14, untouched):

```ts
```

(i.e. DELETE line 15 entirely. Verify with the grep in Step 5 that neither `EditHint` nor `ReconcileResult` is named anywhere else in `TokenModel.ts` — they are not: `EditHint` was only `#parse`'s param, `ReconcileResult` only `#reconciled`'s element type.)

- [ ] **Step 5: Verify the imports are clean**

Run:

```bash
grep -n "incrementalParse\|EditHint\|ReconcileResult\|#lastParsed\|#reconciled\|#parse\b\|lastParsed" packages/core/src/features/tokens/model/TokenModel.ts
```

Expected: ZERO hits (no `incrementalParse`, no `EditHint`/`ReconcileResult` import, no `#lastParsed`/`#reconciled`/`#parse`). Only `#parser` (the surviving computed) and `#reparse` (the new entry) remain — and the grep `#parse\b` matches `#parse` exactly, NOT `#parser`/`#reparse` (the `\b` word boundary stops at the `r`/before the `re`). If `#parse\b` flags `#parser`, that is a false positive of the word-boundary — re-grep with `"#parse("` to confirm the METHOD `#parse(` is gone.

Run:

```bash
grep -n "Computed\|Parser\b\|createTextToken\|filterEmptyText" packages/core/src/features/tokens/model/TokenModel.ts
```

Expected: `Computed` present (renderTree), `Parser` present (`#parser`/`#reparse`), `createTextToken` present (`#reparse`'s no-parser arm), `filterEmptyText` present (the module function + `#reparse`'s block arm) — none became unused.

- [ ] **Step 6: Run the regression specs + full core + typecheck**

Run: `pnpm -w exec vitest run --project core TokenModel.changed.spec`
Expected: full pass — the render-count gates (3 text edits → renderTree 0 / changed 3; structural → renderTree 1 / changed 4) and the edit-hint flow tests are green UNCHANGED. This is the proof the watch-callback entry preserves the per-edit cadence and the explicit hint drain is behavior-identical.

Run: `pnpm -w exec vitest run --project core TokenModel.index.spec`
Run: `pnpm -w exec vitest run --project core "model/commit.spec"`
Run: `pnpm -w exec vitest run --project core tokenIdentity.spec`
Expected: full pass each (fresh reads, commit routing, and the no-hint findGap path all unchanged).

Run: `pnpm -F core test`
Expected: full pass (the whole core suite — `incrementalParse.property.spec.ts` STILL passes here; `incrementalParse.ts` is untouched until Task 2, and nothing now calls it from production, but the property spec calls it directly and is still green).

Run: `pnpm run typecheck`
Expected: clean — `TokenModel.ts` no longer imports `incrementalParse`/`EditHint`/`ReconcileResult`; `Parser`/`Computed`/`createTextToken` imports are still used. (If typecheck regenerated `packages/website/src/content/docs/api/*.md`, do NOT commit those — `git checkout -- packages/website` or just scope the commit below.)

- [ ] **Step 7: Commit**

```bash
git commit -m "refactor(tokens): reparse via a (value, parser, isBlock) watch — delete the PURITY computed" -- packages/core/src/features/tokens/model/TokenModel.ts
```

---

### Task 2: Delete `incrementalParse.ts` + its property spec; trim the bench to the full-parse tripwire

**Files:**
- Delete: `packages/core/src/features/tokens/incrementalParse.ts`
- Delete: `packages/core/src/features/tokens/incrementalParse.property.spec.ts`
- Modify: `packages/core/src/features/tokens/parser.bench.ts` (drop the incremental benches + `incrementalParse`/`EditHint` imports; keep the full-parse benches)

With Task 1 done, `incrementalParse` has exactly two callers left: its own property spec and the bench's incremental cases (b)/(c). Both go — the property spec because its subject (the windowed splicer's parse-equivalence) ceases to exist, and (b)/(c) because they call the deleted function. The FULL-PARSE benches survive as the regression tripwire (per the spec): the scalability suite, the real-world scenarios, and the full-parse baseline (a) — which now ARE the per-keystroke cost. `EditHint` survives in `tokenIdentity.ts` (reconcile windowing); only the bench's `EditHint` import (used solely by the deleted incremental hints) dies.

- [ ] **Step 1: Re-verify `incrementalParse` has no production caller**

Run:

```bash
grep -rn "incrementalParse" packages/core/src --include="*.ts" | grep -v "incrementalParse.ts:" | grep -v "incrementalParse.property.spec.ts:" | grep -v "parser.bench.ts:" | grep -v "Parser.ts:" | grep -v "tokenIdentity.property.spec.ts:"
```

Expected: ZERO hits — `TokenModel.ts` no longer imports it (Task 1). The remaining mentions are: `incrementalParse.ts` (the file, deleted in Step 2), `incrementalParse.property.spec.ts` (deleted in Step 2), `parser.bench.ts` (trimmed in Step 4), `Parser.ts` (a JSDoc comment, fixed in Task 3), and `tokenIdentity.property.spec.ts` (a COMMENT referencing the property — see Step 5). If a production `.ts` hit appears, STOP — Task 1 missed a caller; migrate it before deleting the file.

- [ ] **Step 2: Delete the two files**

```bash
git rm packages/core/src/features/tokens/incrementalParse.ts packages/core/src/features/tokens/incrementalParse.property.spec.ts
```

(`git rm` stages the deletions; the path-scoped commit in Step 7 includes them. The bench import of `incrementalParse` now dangles — Step 4 removes it before any test/typecheck run.)

- [ ] **Step 3: Read the bench's incremental section first**

Read `parser.bench.ts` lines 281-508 (the `── Incremental-parse typing bench fixtures ──` block through the three incremental `describe`s). Confirm the structure matches the Background fact: fixtures `incrementalParser`/`incrementalBase500`/`incrementalPrev500`/`incrementalTailValue`/`incrementalTailHint`/`midPoint`/`safePoint`/`incrementalMidValue`/`incrementalMidHint` (`:297-332`); bench (a) full-parse baseline (`:407-430`, calls `incrementalParser.parse`); bench (b) tail insert (`:433-469`, calls `incrementalParse`); bench (c) middle insert (`:472-508`, calls `incrementalParse`). The SURVIVORS are (a) + `incrementalParser`/`incrementalBase500`/`generateInertText`/`incrementalTailValue` (a still parses `incrementalTailValue`). The DELETIONS are (b), (c), `incrementalPrev500`, `incrementalTailHint`, the whole mid-insert fixture (`midPoint`/`safePoint`/`incrementalMidValue`/`incrementalMidHint`), and the `incrementalParse`/`EditHint` imports.

- [ ] **Step 4: Trim the bench**

In `parser.bench.ts`:

Delete the `incrementalParse` import (`:6`):

```ts
import {incrementalParse} from './incrementalParse'
```

Delete the `EditHint` import (`:8`):

```ts
import type {EditHint} from './tokenIdentity'
```

Delete the now-dead fixtures — `incrementalPrev500` (`:312-313`), the tail HINT (`:317-321`), and the whole middle-insert fixture (`:323-332`). The surviving fixtures: keep `incrementalParser` (`:297`), `generateInertText` (`:299-308`), `incrementalBase500` (`:310`), and `incrementalTailValue` (`:315-316` — bench (a) parses it). Delete from the file:

```ts
const incrementalPrev500 = incrementalParser.parse(incrementalBase500)
```

```ts
const incrementalTailHint: EditHint = {
	start: incrementalBase500.length,
	end: incrementalBase500.length,
	insertedLength: 1,
}
```

```ts
// (c) One-char MIDDLE insert: insert 'x' in plain inter-mark text in the middle.
// Find a safe position in a run of alphabetic chars (not inside @[…]) — any space works.
const midPoint = Math.floor(incrementalBase500.length / 2)
const safePoint = incrementalBase500.indexOf(' ', midPoint)
const incrementalMidValue = incrementalBase500.slice(0, safePoint) + 'x' + incrementalBase500.slice(safePoint)
const incrementalMidHint: EditHint = {
	start: safePoint,
	end: safePoint,
	insertedLength: 1,
}
```

(Keep the `// (b) One-char TAIL insert` comment + `incrementalTailValue` line — (a) uses `incrementalTailValue`. The leading comment that explains (b) can stay or be trimmed to mention only the surviving tail VALUE; do not over-edit.)

Delete the entire bench (b) describe (`:433-469`):

```ts
	// (b) Incremental tail insert: append one char at the end
	describe('Incremental: 500 marks — tail insert', () => {
		bench(
			'incrementalParse — tail insert (500 marks)',
			() => {
				incrementalParse(
					incrementalParser,
					incrementalPrev500,
					incrementalBase500,
					incrementalTailValue,
					incrementalTailHint
				)
			},
			{
				time: 1000,
				iterations: 5,
				teardown() {
					if (!isCollecting) {
						isCollecting = true
						collectResultFn(
							'incremental: tail insert (500 marks)',
							'incremental',
							() =>
								incrementalParse(
									incrementalParser,
									incrementalPrev500,
									incrementalBase500,
									incrementalTailValue,
									incrementalTailHint
								),
							5
						)
						isCollecting = false
					}
				},
			}
		)
	})
```

Delete the entire bench (c) describe (`:472-508`):

```ts
	// (c) Incremental middle insert: insert one char mid-document
	describe('Incremental: 500 marks — middle insert', () => {
		bench(
			'incrementalParse — middle insert (500 marks)',
			() => {
				incrementalParse(
					incrementalParser,
					incrementalPrev500,
					incrementalBase500,
					incrementalMidValue,
					incrementalMidHint
				)
			},
			{
				time: 1000,
				iterations: 5,
				teardown() {
					if (!isCollecting) {
						isCollecting = true
						collectResultFn(
							'incremental: middle insert (500 marks)',
							'incremental',
							() =>
								incrementalParse(
									incrementalParser,
									incrementalPrev500,
									incrementalBase500,
									incrementalMidValue,
									incrementalMidHint
								),
							5
						)
						isCollecting = false
					}
				},
			}
		)
	})
```

Re-title the surviving bench (a) so it reads as THE typing bench, not a "baseline" for a comparison that no longer exists. In the `(a)` describe (`:407-430`), change the describe title and the bench name + collected name from "(baseline)"/"baseline" to a standalone typing-cost label. Change:

```ts
	describe('Incremental: 500 marks full parse (baseline)', () => {
		bench(
			'full parse — 500 marks baseline',
```

to:

```ts
	describe('Typing cost: 500 marks full parse per keystroke', () => {
		bench(
			'full parse — 500 marks per keystroke',
```

and change the collected result name inside its `teardown` from:

```ts
						collectResultFn(
							'incremental: full parse baseline (500 marks)',
```

to:

```ts
						collectResultFn(
							'typing: full parse per keystroke (500 marks)',
```

(The leading comment block at `:404-406` says "Baseline: full parse per keystroke — same operation as … but using the @[__value__] parser so the comparison is apples-to-apples with (b)/(c)." Trim it to drop the "(b)/(c)" comparison — it now stands alone as the per-keystroke typing cost. A minimal edit of that comment is enough; do not rewrite the whole header. Keep the `── Incremental-parse typing bench fixtures ──` section comment but update the wording that promises (b)/(c) — see Step 4b.)

- [ ] **Step 4b: Update the bench section comment that references (b)/(c) and `incrementalParse`**

The fixtures section comment (`:281-295`) explains the `incrementalParse` fast-path and the inert-text caveat. Since `incrementalParse` is gone and only the full-parse bench survives, trim it so no comment promises a deleted bench or references the deleted function. Read `:281-295` and replace the block with a short version that explains only the surviving full-parse typing bench:

```ts
// ── Typing-cost bench fixtures ─────────────────────────────────────────────
// Pre-built OUTSIDE the timed callback so only the parse itself is measured.
// Inline parsing is always a full parse (the windowed incrementalParse is
// deleted — Phase 7's pre-split row parser is the incrementality story), so the
// 500-mark full-parse-per-keystroke bench below IS the inline typing cost and
// the regression tripwire the design keeps. Uses @[__value__] markup with
// inert inter-mark text for a representative realistic-document shape.
```

(This replaces the `IMPORTANT`/`CAVEAT` paragraphs that explained the inert-outside guard and the slot-leading fast-path limitation — both are properties of the deleted `incrementalParse`. The `generateInertText` helper + `incrementalBase500`/`incrementalTailValue` lines that FOLLOW this comment stay.)

- [ ] **Step 5: Update the `tokenIdentity.property.spec.ts` comment that references `incrementalParse`**

`tokenIdentity.property.spec.ts:22-23` carries a COMMENT: *"slot-leading/in-slot families) are exported so the incrementalParse property can reuse them …"*. The `incrementalParse` property spec is deleted, so the export-for-reuse rationale is stale. This file's GENERATORS (`generateDocument`/`generateEdit`/`editHintOf`/etc.) are STILL exported and STILL used by `tokenIdentity.property.spec.ts` itself — only the cross-reference to the deleted property spec is wrong. Read `:18-30` (the comment block around the generator exports) and trim the sentence that says the generators are exported "so the incrementalParse property can reuse them" to state they are exported for reuse within the identity property run (drop the dangling cross-reference). Do NOT touch the generators or any test — comment-only edit. (If the comment's only purpose was the cross-reference and removing it leaves the sentence empty, delete the dangling clause; keep the rest of the comment intact.)

- [ ] **Step 6: Verify the bench builds and the deletions are clean**

Run:

```bash
grep -rn "incrementalParse" packages/core/src --include="*.ts"
```

Expected: hits ONLY in `Parser.ts` (a JSDoc comment — fixed in Task 3). NO hits in `parser.bench.ts`, no `incrementalParse.ts`/`incrementalParse.property.spec.ts` (deleted), no `tokenIdentity.property.spec.ts` (comment trimmed in Step 5). If `tokenIdentity.property.spec.ts` still shows `incrementalParse`, the Step 5 comment edit was missed.

Run:

```bash
grep -n "EditHint\|incrementalPrev500\|incrementalMidHint\|incrementalMidValue\|incrementalTailHint" packages/core/src/features/tokens/parser.bench.ts
```

Expected: ZERO hits — the `EditHint` import and every incremental-only fixture are gone. `incrementalParser`/`incrementalBase500`/`incrementalTailValue`/`generateInertText` survive (they back bench (a)).

Run the bench to confirm it still compiles and produces numbers (the tripwire is intact):

```bash
pnpm -w exec vitest bench --project core parser.bench
```

Expected: the bench RUNS to completion — the scalability, real-world, and the surviving "Typing cost: 500 marks full parse per keystroke" benches print ops/sec; no compile error from a dangling `incrementalParse`/`EditHint` reference. (Browser-context JSON persistence is skipped — see the file's `saveResults` guard; printing numbers is the pass condition.)

- [ ] **Step 7: Run the full core suite + typecheck**

Run: `pnpm -F core test`
Expected: full pass — `incrementalParse.property.spec.ts` is GONE (no longer in the run), and nothing else regressed (the full-parse path was always the correctness baseline the property spec deep-equaled). The test COUNT drops by the property spec's cases (the 3 equivalence runs + the 6 regression/guarantee cases at `incrementalParse.property.spec.ts:119-198`).

Run: `pnpm run typecheck`
Expected: clean — no file imports the deleted `incrementalParse.ts`; `parser.bench.ts` no longer imports `incrementalParse`/`EditHint`. (Ignore/checkout any regenerated `packages/website/...` typedoc output.)

- [ ] **Step 8: Commit**

```bash
git commit -m "refactor(tokens): delete incrementalParse + property spec; bench keeps the full-parse tripwire" -- packages/core/src/features/tokens/incrementalParse.ts packages/core/src/features/tokens/incrementalParse.property.spec.ts packages/core/src/features/tokens/parser.bench.ts packages/core/src/features/tokens/tokenIdentity.property.spec.ts
```

(The `git rm` from Step 2 already staged the two deletions; including the paths here makes the path-scoped commit explicit and total. If the pre-commit hook reflows `tokenIdentity.property.spec.ts` cosmetically beyond your comment edit, `git reset HEAD -- packages/core/src/features/tokens/tokenIdentity.property.spec.ts` and re-commit only the files you actually changed.)

---

### Task 3: Fix the stale `Parser.hasSegments` JSDoc (the last `incrementalParse` reference)

**Files:**
- Modify: `packages/core/src/features/tokens/parser/Parser.ts`

`hasSegments` (`Parser.ts:188`) was the inert-outside guard's query; its only caller (`isInert` in the deleted `incrementalParse.ts`) is gone, leaving `hasSegments` consumer-less for now. The method is KEPT (a clean `Parser` query the spec does not name for deletion; Phase 7's row-terminator validation is a plausible future consumer), but its JSDoc points at the deleted `incrementalParse.ts` — the one remaining `incrementalParse` reference in non-comment-trimmed code. Fix the doc so no comment references a deleted file.

- [ ] **Step 1: Read the JSDoc**

Read `Parser.ts:176-190` (the `hasSegments` doc + signature). It currently reads:

```ts
	/**
	 * Whether the text contains any markup segment occurrence
	 *
	 * Pure query over the registry's segments — parsing behavior is untouched.
	 * Used by the windowed incremental reparse (`features/tokens/
	 * incrementalParse.ts`): text outside the reparse window must be inert,
	 * because a stray segment there (e.g. an unmatched `@[` in plain text) can
	 * pair non-locally with a segment inside the edited window.
	 *
	 * @param text - Text to scan
	 * @returns `true` when at least one segment occurs in the text
	 */
	hasSegments(text: string): boolean {
```

- [ ] **Step 2: Rewrite the doc — drop the deleted-file reference**

Replace the JSDoc block (keep the signature line) with one that states the query's nature and that it currently has no caller (so a future reader does not hunt for the deleted windowed reparse):

```ts
	/**
	 * Whether the text contains any markup segment occurrence.
	 *
	 * Pure query over the registry's segments — parsing behavior is untouched. No
	 * current caller (the windowed incremental reparse that used it for its
	 * inert-outside guard is deleted — inline parsing is always a full parse);
	 * kept as a cheap segment probe for a future row-terminator validation
	 * (Phase 7) or an external consumer.
	 *
	 * @param text - Text to scan
	 * @returns `true` when at least one segment occurs in the text
	 */
	hasSegments(text: string): boolean {
```

- [ ] **Step 3: Verify no `incrementalParse` reference survives anywhere**

Run:

```bash
grep -rn "incrementalParse" packages/core/src --include="*.ts"
```

Expected: ZERO hits — the deleted file's name no longer appears in any source or comment.

- [ ] **Step 4: Run the parser specs + typecheck**

Run: `pnpm -w exec vitest run --project core "parser/Parser.spec"`
Expected: full pass (comment-only change — `hasSegments` behavior is untouched; if no `Parser.spec` filter matches, run `pnpm -F core test` instead, which covers it).

Run: `pnpm run typecheck`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git commit -m "docs(parser): hasSegments no longer references the deleted incrementalParse" -- packages/core/src/features/tokens/parser/Parser.ts
```

---

### Task 4: Delete the dead `preparsing/getClosestIndexes` (the Phase-6 rider)

**Files:**
- Delete: `packages/core/src/features/tokens/preparsing/utils/getClosestIndexes.ts`
- Modify: `packages/core/src/features/tokens/preparsing/index.ts` (drop the re-export)

`getClosestIndexes` is grep-verified to have ZERO consumers outside its own barrel re-export — the spec's Riders name it for deletion in Phase 6. Its sibling `findGap` IS used (by `tokenIdentity.hintFromValues`) and stays, with its spec.

- [ ] **Step 1: Re-verify zero consumers**

Run:

```bash
grep -rn "getClosestIndexes" packages/core/src packages/react packages/vue --include="*.ts" --include="*.tsx" --include="*.vue"
```

Expected: hits ONLY in `preparsing/utils/getClosestIndexes.ts` (the file) and `preparsing/index.ts` (the re-export). NO other consumer. If any other hit appears — it must not, per the background grep — STOP and migrate it; do not delete a live util.

- [ ] **Step 2: Delete the file**

```bash
git rm packages/core/src/features/tokens/preparsing/utils/getClosestIndexes.ts
```

- [ ] **Step 3: Drop the re-export from the barrel**

In `packages/core/src/features/tokens/preparsing/index.ts`, delete the second line so only `findGap` is re-exported:

```ts
export {getClosestIndexes} from './utils/getClosestIndexes'
```

(The file then reads only `export {findGap} from './utils/findGap'`. `findGap`'s import in `tokenIdentity.ts` (`import {findGap} from './preparsing'`) still resolves.)

- [ ] **Step 4: Verify and run**

Run:

```bash
grep -rn "getClosestIndexes" packages/core/src --include="*.ts"
```

Expected: ZERO hits.

Run: `pnpm -w exec vitest run --project core "preparsing/utils/findGap.spec"`
Expected: full pass (`findGap` + its spec are untouched).

Run: `pnpm -F core test`
Run: `pnpm run typecheck`
Expected: full pass / clean.

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(tokens): delete dead preparsing/getClosestIndexes" -- packages/core/src/features/tokens/preparsing/utils/getClosestIndexes.ts packages/core/src/features/tokens/preparsing/index.ts
```

---

### Task 5: Full verification

- [ ] **Step 1: All suites + guards**

Run, expecting full pass on each (do NOT use `pnpm -F react test` / `pnpm -F vue test` — silent no-ops, see Tech Stack):

```bash
pnpm -F core test            # full core suite — full parse always; reparse via the (value, parser, isBlock) watch; incrementalParse + getClosestIndexes gone
pnpm -F storybook test       # react + vue page specs — typing gates unchanged (the per-edit cadence is preserved by the watch-callback entry)
pnpm run typecheck           # recursive tsc/vue-tsc — zero incrementalParse/EditHint(TokenModel)/ReconcileResult(TokenModel) imports; getClosestIndexes gone
pnpm run check:encapsulation
```

- [ ] **Step 2: Confirm the deletions and the new shape**

Run: `grep -rn "incrementalParse\|getClosestIndexes" packages/core/src --include="*.ts"`
Expected: ZERO hits — the windowed reparse and the dead util are gone from production, specs, the bench, and every comment.

Run: `grep -n "#reconciled\|#lastParsed\|#parse\b\|PURITY" packages/core/src/features/tokens/model/TokenModel.ts`
Expected: ZERO hits — the PURITY computed, `#lastParsed`, and `#parse` are gone (the `#parse\b` word boundary does not match `#parser`/`#reparse`; re-grep `"#parse("` if unsure — the METHOD `#parse(` must be absent).

Run: `grep -n "#reparse\|#parser\|watch(" packages/core/src/features/tokens/model/TokenModel.ts`
Expected: `#reparse` (the explicit pipeline entry) + `#parser` (the surviving computed) present; the constructor `watch(` now reads the `(value, parser, isBlock)` tuple (an inline object trigger), and the `watch(host.rendered, …)` line is unchanged.

Run: `grep -rn "EditHint" packages/core/src/features/tokens/tokenIdentity.ts packages/core/src/features/tokens/index.ts`
Expected: `EditHint` is still DEFINED in `tokenIdentity.ts` and still EXPORTED from `tokens/index.ts` — kept for reconcile windowing, as the spec requires.

Run: `pnpm -w exec vitest bench --project core parser.bench`
Expected: the bench RUNS — the full-parse "Typing cost: 500 marks full parse per keystroke" bench (the kept regression tripwire) + scalability + real-world benches print ops/sec; no dangling `incrementalParse` reference.

- [ ] **Step 3: Confirm clean and report**

`git status` must be clean (everything committed task-by-task, path-scoped; the regenerated `packages/website/...` typedoc output, if any, left uncommitted or reverted). Report: the core suite pass count (noting it dropped by the deleted `incrementalParse.property.spec.ts` cases), the storybook react/vue counts, and confirm typecheck + encapsulation guard green + the bench still runs. State explicitly that the reparse trigger is now ONE explicit `watch` over the `(value, parser, isBlock)` tuple with the edit hint drained inside the watch callback (the PURITY computed + `#lastParsed` + `#parse` deleted; the runtime's once-per-wave dependence removed), inline parsing is now ALWAYS a full parse (`incrementalParse.ts` + its property spec deleted; the windowed splicer, alternation snapping, inert-outside guard, and doubling stabilization all gone), `EditHint` + the typing bench survive as the regression tripwire (the bench's incremental cases removed, its full-parse cases kept), and the dead `preparsing/getClosestIndexes` is deleted. Note that this phase broke no public API (`incrementalParse`/`getClosestIndexes` were internal, never re-exported from `packages/core/index.ts`; `#reconciled`/`#lastParsed`/`#parse` were private) — it is a pipeline + parse trim, behavior-identical per edit (pinned by the unchanged render-count gates in `TokenModel.changed.spec.ts`).

---

### Task 6: Write the Phase 7 plan (phase chaining — the final phase)

- [ ] **Step 1: Invoke the superpowers:writing-plans skill** to produce `docs/superpowers/plans/2026-06-13-one-fresh-truth-phase7.md` for **Phase 7 — first-class rows (~1–2 weeks)** from the spec (`docs/superpowers/specs/2026-06-13-tokenmodel-one-fresh-truth-design.md`, §First-class rows (Phase 7 design) + the Phase 7 line in §Migration + the row entries in §What dies + the Riders). Phase 7 is the spec's LARGEST and FINAL phase: a pre-split parser + a first-class `RowToken` node, a bind/ops/keyboard/adapters migration, the cascade deletions the §What dies table names (rows-as-slot-marks: `resolveSlotLeadingMatches` + the Match special case, the empty-slot collapse, `filterEmptyText` + the dual `#lastParsed` — already gone after Phase 6, so reconcile only — `descend-for-rows`, the five `isTextLikeRow`/`isSlotLeadingMark` sniffing sites, the `addDragRow` doubled-content quirk, the rows-map/one-non-control-child bolt-ons), the round-trip + row-locality properties (`split → parse → serialize ≡ value`; editing inside row k leaves all other rows' parse results reference-equal), the block render gates re-pinned on Row trees, and the Riders (rewrite the rotten `parser/README.md`, fix `Parser.unescape` lossiness for user-typed backslashes, shrink the tokens README to the new model). Block-mode `tokens()` returns `RowToken[]` — a breaking tree-shape change; the semver-major is cut after Phase 7 lands (or after Phase 6 if Phase 7 detaches — note this in the plan's framing). GROUND the plan by reading FIRST, with fresh eyes, the POST-Phase-6 code: the parser's slot-leading machinery (`PatternMatcher.resolveSlotLeadingMatches` + the Match special case, the slot-leading TreeBuilder path), `filterEmptyText` (now in `TokenModel.ts` — the only remaining empty-slot collapse after Phase 6), the `isTextLikeRow`/`isSlotLeadingMark` sniffing sites (grep them), `tryDescend`'s descend-for-rows arm in `tokenIdentity.ts`, the block bind path (`rowElement` plumbing, one-non-control-child rule), `BlockController`/block keyboard `addDragRow`/`canMergeRows`/`mergeDragRows`, the adapters' `Container`→`Block` mapping, `Parser.unescape`, `parser/README.md`, and the tokens README. Decide the EXACT `RowToken` shape (the spec's `{type:'row', id, children, content/position, terminated}`), the terminator derivation (`'__slot__\n\n'` → `'\n\n'`; default `'\n\n'`), the pre-split-then-parse-per-segment pipeline, and how reconcile/bind/ops/keyboard/adapters route on `token.type === 'row'`. No placeholder steps — every step shows exact code; bite-sized TDD; frequent path-scoped commits; the required plan header. Because Phase 7 is the FINAL phase, its LAST task is the **migration completion / README shrink rider**, NOT "write the Phase 8 plan" — there is no Phase 8. That final task ties off the migration: the tokens README shrunk to the two-sentence model ("handles are fresh; the render tree is for renderers"; the spec's acceptance bar — toward ≤150 lines), the `parser/README.md` rewrite, the `Parser.unescape` fix, a final full-suite + storybook + typecheck + encapsulation green, and a closing report confirming all four wins still gate (with win 4 traded), the public surface matches the spec's §Public API, and the semver-major is ready to cut. Verification commands MUST follow this plan's Tech Stack note: `pnpm -F core test`, `pnpm -F storybook test` / `test:react` / `test:vue`, `pnpm run typecheck`, `pnpm run check:encapsulation`, `pnpm -w exec vitest bench --project core parser.bench` (the kept tripwire; Phase 7's row-local parse should show the typing cost drop) — NEVER `pnpm -F react test` or `pnpm -F vue test` (silent no-ops).

- [ ] **Step 2: Commit the plan**

```bash
git commit -m "docs(plan): one-fresh-truth phase 7 — first-class rows" -- docs/superpowers/plans/2026-06-13-one-fresh-truth-phase7.md
```

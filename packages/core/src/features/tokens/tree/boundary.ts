import {untracked} from '../../../shared/signals'
import type {Parser} from '../parser/Parser'
import {filterEmptyText} from '../parser/utils/filterEmptyText'
import {adopt, parseValue} from './adopt'
import {gapWindow} from './gapWindow'
import type {TokenTree} from './tree'
import type {CommitSink, SelectionRange, TransactionResult, Window} from './types'

/** The string boundary (spec §4.4): commit policy plus arrival routing. */
export interface Boundary {
	/** Hand to createTransactions. Adopts (uncontrolled) or emits (controlled). */
	readonly sink: CommitSink
	/** An external value arrived (props.value, defaultValue). Routes into adoption. */
	arrive(value: string): void
	/** Parser or layout changed: re-derive every token from the unchanged projection. */
	reparse(): void
	/** The committed projection — see D-d. */
	value(): string
}

/**
 * The emission a controlled commit is waiting to see echoed (spec D6). `base` is the
 * projection it spliced, `window` the splice in that projection's coordinates — both
 * only usable while the tree still holds `base`, which is why `arrive` re-checks it.
 */
type Emission = {base: string; value: string; window: Window}

export function createBoundary(deps: {
	tree: TokenTree
	parser: () => Parser | undefined
	/**
	 * Commit policy (spec D6): uncontrolled adopts the edit at once, controlled emits it and
	 * waits for the parent's echo. Read per commit, so a mid-flight mode flip is honored.
	 */
	controlled: () => boolean
	/**
	 * Block mode's parse policy (spec §1.2). Read per adoption, so an `isBlock` flip is
	 * honored by the next `reparse` without a second code path. Deferred here from S1.4
	 * (decision D-e of that plan): the tree core applied the filter nowhere, and block
	 * wiring is S1.6a's.
	 */
	isBlock?: () => boolean
	/**
	 * Pre-adoption selection capture (spec D7). Read once per adoption, before the
	 * parse — see `TransactionResult.selectionBefore` for why the boundary and not the
	 * dispatcher owns this. Store supplies `() => selection.range()` as a deferred
	 * thunk (declaration order: `tokens` is built before `selection`), so it must not
	 * be called during construction — and it is not: only `fold` calls it.
	 */
	selection?: () => SelectionRange | undefined
	onChange: (value: string) => void
	/** The `TransactionResult` feed (spec D9); its pipeline consumer arrives with S1.5. */
	onResult?: (result: TransactionResult) => void
}): Boundary {
	/**
	 * Set by a controlled commit, consumed by the next arrival. Only the most recent one is
	 * kept — a second controlled edit overwrites the record — so an echo of any earlier
	 * emission is stale and adopts through the gap window like any other foreign value.
	 */
	let lastEmitted: Emission | undefined

	const fold = (next: string, window: Window): void => {
		// Capture FIRST: `adopt` writes positions in place, so a range derived after it
		// is shifted twice (spec D7).
		const selectionBefore = deps.selection?.()
		const parsed = parseValue(deps.parser(), next)
		const tokens = deps.isBlock?.() === true ? filterEmptyText(parsed) : parsed
		const result = adopt(deps.tree, window, tokens, selectionBefore)
		// Adoption is the commit; it must not sit inside the optional call's argument,
		// which JS skips evaluating when no listener is registered.
		deps.onResult?.(result)
	}

	const sink: CommitSink = {
		commit(next, window) {
			if (deps.controlled()) {
				// The parent owns the value: emit and wait. `tree.value()` IS the base this splice
				// was computed from — `commit` runs with the tree unmutated (decision D-a) — and
				// the pair is what lets the echo be adopted through its exact window.
				lastEmitted = {base: deps.tree.value(), value: next, window}
				deps.onChange(next)
				// Accepted and emitted (spec D6). A controlled verb reports success on the emission,
				// not on a commit that may never come; anything else would read as a refusal.
				return true
			}
			// Emission follows adoption: `CommitSink.commit` runs with the tree still holding the
			// pre-edit base, so an `onChange` consumer that reads the tree — the live pipeline
			// does — must not be called before the commit lands.
			fold(next, window)
			deps.onChange(next)
			return true
		},
	}

	return {
		sink,

		arrive(value) {
			// `untracked` for the same reason the dispatcher wraps `commit`: S1.6a drives both
			// entry points from a props watch, and a tracked read here would subscribe that
			// watcher to the very projection it is about to mutate.
			untracked(() => {
				// D6 is explicit: the record is consumed by the FIRST arrival, matched or not. A
				// stale echo must not leave it armed for the next one.
				const emission = lastEmitted
				lastEmitted = undefined

				// Anything that is not this emission's echo — a transform, a stale echo, an
				// external value, an uncontrolled arrival — falls back to the boundary-reset
				// window. Both branches are continuity-preserving, so the check buys identity
				// precision rather than correctness: on repeated content the two windows disagree
				// about which repeat survived. Gap-derivation also makes an arrival equal to the
				// current projection an inert no-op adoption rather than a rebuild.
				const current = deps.tree.value()
				fold(value, echoWindow(emission, value, current) ?? gapWindow(current, value))
			})
		},

		reparse() {
			untracked(() => {
				// No emission: the value does not change, only its tokenization. `gapWindow(v, v)`
				// is enough because adoption is equality-driven rather than window-driven — both
				// walks go inert and the middle re-derives every token from the new parse. A full
				// window is actively worse: it sends every mapped interior offset to the document
				// end (decision D-c, pinned through `map` in boundary.spec.ts).
				const value = deps.tree.value()
				fold(value, gapWindow(value, value))
			})
		},

		/**
		 * See decision D-d: in the steady state the tree holds the ARRIVED value in controlled
		 * mode, so the projection already IS the committed one and no separate state is needed.
		 * The two cases this does NOT cover — the initial seed, and the controlled→uncontrolled
		 * fallback to `defaultValue` — are S1.6a's to handle by arriving explicitly.
		 *
		 * A public read, deliberately tracked (unlike `arrive`/`reparse` above): a consumer may
		 * legitimately subscribe to it.
		 */
		value: () => deps.tree.value(),
	}
}

/**
 * The recorded splice, usable only when the arrival IS that emission's echo AND the tree
 * still holds the base it was spliced from — the window's coordinates live in that base.
 *
 * Both halves are load-bearing, and neither shows on a plain fixture, where the recorded and
 * the gap-derived window converge. `base` is tripped by a mid-flight controlled→uncontrolled
 * flip: the edit commits locally, moving the tree, and the parent's echo lands afterwards.
 * `value` is tripped by a transform that changes the ROOT COUNT — a stale window carries a
 * stale delta, so adoption's suffix walk goes inert and the tail's identity falls to
 * left-index pairing, which is misaligned by exactly that count. Both are pinned by id
 * assertions in boundary.spec.ts; value-level assertions cannot see either, because adoption
 * converges to the same string through any window.
 */
function echoWindow(emission: Emission | undefined, value: string, current: string): Window | undefined {
	if (!emission) return undefined
	return emission.value === value && emission.base === current ? emission.window : undefined
}
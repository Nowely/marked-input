import {batch, untracked} from '../../../shared/signals'
import type {Parser} from '../parser/Parser'
import type {RowConfig} from '../parser/types'
import {adopt, parseRowsValue, parseValue} from './adopt'
import {gapWindow} from './gapWindow'
import type {TokenTree} from './tree'
import type {Anchors, CommitSink, TransactionResult, Window} from './types'

/** The string boundary: commit policy plus arrival routing. */
export interface Boundary {
	/** Hand to createTransactions. Adopts (uncontrolled) or emits (controlled). */
	readonly sink: CommitSink
	/** An external value arrived (props.value, defaultValue). Routes into adoption. */
	arrive(value: string): void
	/** Parser or parse policy changed: re-derive every token from the unchanged projection. */
	reparse(): void
}

/**
 * The emission a controlled commit is waiting to see echoed. `base` is the projection it
 * spliced, `window` the splice in that projection's coordinates — both only usable while
 * the tree still holds `base`, which is why `arrive` re-checks it.
 */
type Emission = {base: string; value: string; window: Window}

export function createBoundary(deps: {
	tree: TokenTree
	parser: () => Parser | undefined
	/**
	 * Commit policy: uncontrolled adopts the edit at once, controlled emits it and waits
	 * for the parent's echo. Read per commit, so a mid-flight mode flip is honored.
	 */
	controlled: () => boolean
	/**
	 * THE parse policy: how the block skeleton is carved (issue 08), or `undefined` for a
	 * document that has no rows. Read per adoption, so a change is honored by the next
	 * `reparse` without a second code path. Layout is not a second input here — the caller
	 * folds it in (`TokenModel.rowConfig`).
	 */
	rowConfig?: () => RowConfig | undefined
	/**
	 * Pre-adoption selection capture. Read once per adoption and by `fold` alone — never
	 * during construction — see `TransactionResult.selectionAfter` for why the boundary
	 * and not the dispatcher owns this.
	 */
	selection?: () => Anchors | undefined
	onChange: (value: string) => void
	/**
	 * The `TransactionResult` feed. `TokenModel` drives the commit pipeline, its value
	 * snapshot and the selection repair off it, in that order.
	 */
	onResult?: (result: TransactionResult) => void
}): Boundary {
	/**
	 * Set by a controlled commit, consumed by the next arrival. Only the most recent one is
	 * kept — a second controlled edit overwrites the record — so an echo of any earlier
	 * emission is stale and adopts through the gap window like any other foreign value.
	 */
	let lastEmitted: Emission | undefined

	const fold = (next: string, window: Window): void => {
		// Read BEFORE `adopt`, which repairs the stored selection through `onResult`. The
		// anchors themselves hold no coordinate, so it is adoption — not this call site —
		// that owes the pre-mutation reading of their positions.
		const selectionBefore = deps.selection?.()
		// A config means the top level is rows (issue 08); its absence is the flat parse.
		// `!== undefined`, not truthiness, because `undefined` is the ONE word for "no rows" and
		// the caller owes it: `TokenModel.rowConfig` already folds an empty `separator` prop
		// to `undefined`. A `''` separator arriving here is therefore a direct-construction
		// mistake, and parseRows' own loud throw is the right answer to it.
		const rowConfig = deps.rowConfig?.()
		const parsed =
			rowConfig !== undefined ? parseRowsValue(deps.parser(), next, rowConfig) : parseValue(deps.parser(), next)
		// THE COMMIT IS ATOMIC. Adoption and everything the result drives — the bind, the
		// clocks, the selection repair — land inside ONE batch, so nothing observes a half
		// applied commit: no subscriber wakes between the tree moving and the DOM catching up.
		//
		// Before this, adoption's own batch closed first and flushed, which is why anything
		// derived from the tree had to be routed around: `value` read a mirrored string
		// written after the fact rather than the tree itself.
		batch(() => {
			const result = adopt(deps.tree, window, parsed, selectionBefore)
			// Adoption is the commit; it must not sit inside the optional call's argument,
			// which JS skips evaluating when no listener is registered.
			deps.onResult?.(result)
		})
	}

	const sink: CommitSink = {
		commit(next, window) {
			if (deps.controlled()) {
				// The parent owns the value: emit and wait. `tree.value()` IS the base this splice
				// was computed from — `commit` runs with the tree unmutated — and the pair is what
				// lets the echo be adopted through its exact window.
				lastEmitted = {base: deps.tree.value(), value: next, window}
				deps.onChange(next)
				// Accepted and emitted. A controlled verb reports success on the emission,
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
			// `untracked` for the same reason the dispatcher wraps `commit`: `TokenModel` drives
			// both entry points from a props watch, and a tracked read here would subscribe that
			// watcher to the very projection it is about to mutate.
			untracked(() => {
				// The record is consumed by the FIRST arrival, matched or not: a stale echo must
				// not leave it armed for the next one.
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
				// end (pinned through the resolved selection in valueBoundary.spec.ts).
				const value = deps.tree.value()
				fold(value, gapWindow(value, value))
			})
		},
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
 * assertions in valueBoundary.spec.ts; value-level assertions cannot see either, because
 * adoption converges to the same string through any window.
 */
function echoWindow(emission: Emission | undefined, value: string, current: string): Window | undefined {
	if (!emission) return undefined
	return emission.value === value && emission.base === current ? emission.window : undefined
}
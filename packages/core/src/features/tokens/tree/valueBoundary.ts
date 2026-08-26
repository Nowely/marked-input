import {batch, untracked} from '../../../shared/signals'
import type {Parser} from '../parser/Parser'
import type {RowConfig} from '../parser/types'
import {adopt, parseRowsValue, parseValue} from './adopt'
import {anchorAt, offsetOfAnchor} from './anchors'
import {gapWindow} from './gapWindow'
import type {TokenTree} from './tree'
import type {Anchors, CommitSink, EditRecord, Offsets, TransactionResult, TreeNode, Window} from './types'

/** The string boundary: commit policy plus arrival routing. */
export interface Boundary {
	/** Hand to createTransactions. Adopts (uncontrolled) or emits (controlled). */
	readonly sink: CommitSink
	/**
	 * Undo/redo's write: the same commit policy as {@link Boundary.sink}, with no edit recorded —
	 * a replay is not an edit path. What it owes on landing is {@link ReplayLanding}.
	 */
	replay(value: string, window: Window, landing?: ReplayLanding): boolean
	/** An external value arrived (props.value, defaultValue). Routes into adoption. */
	arrive(value: string): void
	/** Parser or parse policy changed: re-derive every token from the unchanged projection. */
	reparse(): void
}

/**
 * WHAT A REPLAY OWES once the tree actually holds the value it replayed:
 * - the CARET the record it replayed was captured with, as OFFSETS in the projection being
 *   restored — the caller has held them across every edit since, so they are resolved against the
 *   roots this write leaves behind. Named rather than mapped: the window arithmetic collapses
 *   every offset inside the window onto its end, which is right for an edit and wrong for the
 *   position an edit was made FROM;
 * - `landed`, the caller's own bookkeeping. An undo moves its entry between two stacks, and that
 *   move is owed at exactly this moment for the same reason the record is: in controlled mode a
 *   parent may decline the undo — a length validator, a permission check — and an entry consumed
 *   on the emission is stranded in a redo stack that names a document that never appeared.
 */
export type ReplayLanding = {caret?: Offsets; landed?: () => void}

/**
 * WHAT AN EMISSION OWES once the tree actually holds it — one or the other, never both, because
 * an emission is either a commit or a replay. A COMMIT owes its {@link EditRecord}, which is why
 * the record is not emitted at `commit`: in controlled mode nothing has landed there yet, and an
 * emission the parent declines to echo must leave no trace at all.
 */
type Landing = {edit: EditRecord} | ReplayLanding

/**
 * The emission a controlled commit is waiting to see echoed. `base` is the projection it
 * spliced, `window` the splice in that projection's coordinates — both only usable while
 * the tree still holds `base`, which is why `arrive` re-checks it. `landing` rides with them
 * for the same reason `Window.pairing` does: the echo is the moment all three become true.
 */
type Emission = {base: string; value: string; window: Window; landing?: Landing}

export function createBoundary(deps: {
	tree: TokenTree
	parser: () => Parser | undefined
	/**
	 * Commit policy: uncontrolled adopts the edit at once, controlled emits it and waits
	 * for the parent's echo. Read per commit, so a mid-flight mode flip is honored.
	 */
	controlled: () => boolean
	/**
	 * THE parse policy: how the row skeleton is carved (issue 08), or `undefined` for a
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
	/**
	 * THE edit feed, one call per edit the tree actually took — see {@link EditRecord}. Called
	 * after the fold, so a subscriber reads the value the record describes.
	 */
	onEdit?: (record: EditRecord) => void
}): Boundary {
	/**
	 * Set by a controlled commit, consumed by the next arrival. Only the most recent one is
	 * kept — a second controlled edit overwrites the record — so an echo of any earlier
	 * emission is stale and adopts through the gap window like any other foreign value.
	 */
	let lastEmitted: Emission | undefined

	const fold = (next: string, window: Window, landing?: Landing): void => {
		// Read BEFORE `adopt`, which repairs the stored selection through `onResult`. The
		// anchors themselves hold no coordinate, so it is adoption — not this call site —
		// that owes the pre-mutation reading of their positions.
		const selectionBefore = deps.selection?.()
		// A REPLAY names where the caret lands, so it neither captures nor maps: the offsets it
		// names were captured before the edit this is undoing, and mapping them through the window
		// that undoes it would collapse them onto the restored span's end.
		const replay = landing !== undefined && !('edit' in landing) ? landing : undefined
		const caret = replay?.caret
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
			// The roots and the policy that joins them move together: written HERE rather than
			// read live off the props, so the projection always describes the parse behind it.
			// See `TokenTree.config`.
			deps.tree.config(rowConfig)
			const result = adopt(deps.tree, window, parsed, caret ? undefined : selectionBefore)
			// RESOLVED AFTER adoption, against the roots it left behind, which is the whole point
			// of carrying offsets: the nodes the caret sat in when the replayed edit was made may
			// have been destroyed by it, and an anchor kept verbatim would name one of those —
			// right offset, dead node, and `placeCaret` declines it.
			//
			// Adoption is the commit; it must not sit inside the optional call's argument,
			// which JS skips evaluating when no listener is registered.
			const restored = caret && resolveOffsets(deps.tree.roots(), caret)
			deps.onResult?.(restored ? {selectionAfter: restored} : result)
		})
		// AFTER the batch, so a subscriber that reads the value sees the one the landing describes.
		if (landing !== undefined && 'edit' in landing) deps.onEdit?.(landing.edit)
		else replay?.landed?.()
	}

	/**
	 * THE commit, both modes and both writers: adopt now, or emit and wait for the echo. What the
	 * emission owes on landing rides with it, so the uncontrolled path pays it immediately and the
	 * controlled one exactly when the parent hands the value back.
	 */
	const apply = (next: string, window: Window, landing?: Landing): boolean => {
		if (deps.controlled()) {
			// The parent owns the value: emit and wait. `tree.value()` IS the base this splice
			// was computed from — `commit` runs with the tree unmutated — and the pair is what
			// lets the echo be adopted through its exact window.
			lastEmitted = {base: deps.tree.value(), value: next, window, landing}
			deps.onChange(next)
			// Accepted and emitted. A controlled verb reports success on the emission,
			// not on a commit that may never come; anything else would read as a refusal.
			return true
		}
		// Emission follows adoption: `CommitSink.commit` runs with the tree still holding the
		// pre-edit base, so an `onChange` consumer that reads the tree — the live pipeline
		// does — must not be called before the commit lands.
		fold(next, window, landing)
		deps.onChange(next)
		return true
	}

	const sink: CommitSink = {
		commit(next, window) {
			// CAPTURED here and emitted on landing: this is the one place both modes hold the
			// pre-image — `deps.tree.value()` is the projection this splice was computed from, and
			// the stored selection is still the one the edit was made from.
			const selection = deps.selection?.()
			const edit: EditRecord = {
				base: deps.tree.value(),
				next,
				window,
				// FLATTENED here, where the anchors are still live and the tree still holds
				// `base`: the record outlives both. `offsetOfAnchor` is a field read, not a walk,
				// so this costs the commit path nothing.
				selectionBefore: selection && resolveAnchors(deps.tree.roots(), selection),
			}
			return apply(next, window, {edit})
		},
	}

	return {
		sink,

		replay(value, window, landing) {
			return apply(value, window, landing)
		},

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
				//
				// THE LANDING GOES WITH THE WINDOW: an emission owes what it owes exactly when the
				// document becomes it, so a value the parent transformed or replaced pays nothing —
				// the edit it carried never happened, and no record of it reaches the history.
				const current = deps.tree.value()
				const echo = echoOf(emission, value, current)
				fold(value, echo?.window ?? gapWindow(current, value), echo?.landing)
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
 * The recorded emission, usable only when the arrival IS its echo AND the tree still holds the
 * base it was spliced from — the window's coordinates live in that base, and so does the claim
 * that whatever the emission owes has now come true.
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
/** The two ends as offsets in the projection `roots` currently spells. */
function resolveAnchors(roots: readonly TreeNode[], anchors: Anchors): Offsets {
	return {anchor: offsetOfAnchor(roots, anchors.anchor), head: offsetOfAnchor(roots, anchors.head)}
}

/** And back: the anchors those offsets name in `roots`, whatever nodes it is made of now. */
function resolveOffsets(roots: readonly TreeNode[], offsets: Offsets): Anchors {
	return {anchor: anchorAt(roots, offsets.anchor), head: anchorAt(roots, offsets.head)}
}

function echoOf(emission: Emission | undefined, value: string, current: string): Emission | undefined {
	if (!emission) return undefined
	return emission.value === value && emission.base === current ? emission : undefined
}
// THE ONE upward import in `tree/`, and a deliberate exception. S1 declared a local
// `SelectionRange` instead, on the rule that "`tree/` is the core and must not reach up
// into the editor contracts for a two-number record"; S2.3 deleted that type because
// `TransactionResult` — its only reason to exist — stopped speaking offsets. Re-declaring
// it for {@link Selection.range} alone would buy a structural duplicate that every caller
// assigns to `Range` anyway, for a member S2.6 deletes outright (spec S2 D11). Dropped
// consciously; do NOT read it as license for a second one.
import type {Range} from '../../../shared/editorContracts'
import {computed, signal} from '../../../shared/signals'
import type {Computed, Signal} from '../../../shared/signals'
import {shallow} from '../../../shared/utils/shallow'
import {anchorEquals} from './anchors'
import type {Anchors, NodeAnchor, TransactionResult, TreeNode} from './types'

/**
 * What the selection state reads from the tree — nothing more. CLOSURES, not the
 * `TokenTree` itself: `Store` still constructs the selection and `TokenModel` holds its
 * tree privately, so the three reads are satisfied by `TokenModel`'s public surface today
 * and re-pointed at the tree directly when ownership moves, with no change here.
 */
export type SelectionDeps = {
	offsetOf(anchor: NodeAnchor): number
	anchorAt(offset: number): NodeAnchor
	value(): string
}

/**
 * The tree-space half of the selection (spec S2 D10): the stored anchors and their
 * derivations. Anchors-not-offsets is S1 D7.
 */
export type Selection = {
	readonly range: Computed<Range | undefined>
	readonly position: Signal<number | undefined>
	readonly isAllSelected: Computed<boolean>
	/**
	 * THE read of the stored anchors, and the only one: the writable signal behind it is
	 * private, so every write goes through {@link Selection.select} / {@link Selection.clear}
	 * and their "did it actually change" contract.
	 *
	 * WATCHABLE — a tracked read, which is what `SelectionDriver`'s caret-application watch
	 * subscribes to. It must be the anchors and NOT the derived `range`: at a shared boundary
	 * `range` dedupes on `shallow`, so `placeAtHandle` changes the anchor without changing
	 * the number and a `range` watch never fires (8 browser assertions across three focus
	 * specs).
	 */
	anchors(): Anchors | undefined
	/**
	 * The stored selection's START in document order — what `'caret'` means to a write verb
	 * that inserts rather than replaces (`MarkputApi.insertMark`). `anchor` is the FIXED end,
	 * not the low one, so a backwards `select(head, anchor)` puts the start in `head`; the
	 * comparison is the only thing that tells them apart and it is why this lives here, where
	 * offsets are legal, instead of in the API layer.
	 */
	caretAnchor(): NodeAnchor | undefined
	select(anchor: NodeAnchor, head?: NodeAnchor): boolean
	selectNode(node: TreeNode, boundary: 'start' | 'end'): boolean
	selectAll(): void
	clear(): boolean
	repair(result: TransactionResult): void
}

export function createSelection(deps: SelectionDeps): Selection {
	/**
	 * THE stored selection (spec S1 D7/G4): node anchors, not offsets. Equality is anchor
	 * IDENTITY — the DOM sync rebuilds anchors on every `selectionchange`, so without it
	 * a mouse sweep would re-enter placement on every tick (the job today's
	 * `{equals: shallow}` on the numeric range did).
	 *
	 * Its gate is `dom/SelectionDriver.spec`'s "repeated selectAll applies to the DOM
	 * once" — measured, and it has to be a RANGED selection: `range` keeps
	 * `{equals: shallow}` whatever this does, so a notification count cannot see the
	 * difference, and the collapsed path is masked by `SelectionDriver.placeAtHandle`'s
	 * re-apply branch. Dropping the equality fails that one case and nothing else in the
	 * repo.
	 */
	const stored: Signal<Anchors | undefined> = signal<Anchors>({
		equals: (a, b) => anchorEquals(a?.anchor, b?.anchor) && anchorEquals(a?.head, b?.head),
	})

	/**
	 * Bumped once per adoption by {@link repair}, its only writer. Stored positions are
	 * plain fields (spec S1 D3), so nothing else can invalidate a derived offset when
	 * adoption shifts them — and an anchor that survives an edit UNCHANGED (AC-3.2) must
	 * still resolve to its new absolute offset. This is the only reason {@link range} is
	 * not a pure computed over {@link stored}.
	 *
	 * Exactly ONE case can gate it, by construction — this file's spec, "keeps node and
	 * offset when the edit is outside the anchor…". Every other repair case changes the
	 * anchor as well, so the `stored` write notifies on its own.
	 */
	const generation: Signal<number> = signal({initial: 0})

	/**
	 * DERIVED (spec S1 D7): the numeric range every offset-speaking consumer still reads —
	 * {@link isAllSelected} and `OverlayController`'s trigger probe. (No longer the
	 * boundary's pre-adoption capture: that reads {@link anchors} since the channel became
	 * anchor-shaped.) Read-only: the stored form is {@link stored}, and
	 * {@link select}/{@link position} are the writes.
	 */
	const range: Computed<Range | undefined> = computed(
		() => {
			generation()
			const anchors = stored()
			if (!anchors) return undefined
			const anchor = deps.offsetOf(anchors.anchor)
			const head = deps.offsetOf(anchors.head)
			return anchor <= head ? {start: anchor, end: head} : {start: head, end: anchor}
		},
		{equals: shallow}
	)

	const position: Signal<number | undefined> = computed({
		get: () => range()?.start,
		set: value => {
			// The undefined arm is unreachable: a writable computed short-circuits an
			// `undefined` write before the setter runs (`shared/signals/signal.ts`'s
			// `writableComputedOper`), which is why the pre-anchor version's clear branch was
			// dead. Kept as a type narrow only.
			if (value !== undefined) select(deps.anchorAt(value))
		},
	})

	const isAllSelected: Computed<boolean> = computed(() => {
		const s = range()
		const v = deps.value()
		return s?.start === 0 && s.end === v.length && v.length > 0
	})

	const selectAll = (): void => {
		// Node anchors, not the `'start'`/`'end'` edges: a later edit that grows the value
		// must NOT keep `isAllSelected` true, and edge anchors would.
		select(deps.anchorAt(0), deps.anchorAt(deps.value().length))
	}

	/**
	 * @internal THE write (spec S1 D7's stored form). {@link selectAll}, {@link position},
	 * {@link selectNode} and `SelectionDriver`'s DOM sync all go through it; S1.7 promoted
	 * it to §2.3's `input.select`. Returns whether the stored selection actually changed.
	 */
	const select = (anchor: NodeAnchor, head: NodeAnchor = anchor): boolean => stored({anchor, head})

	/**
	 * @internal THE drop. Its four callers are `SelectionDriver`'s "there is no selection
	 * here" exits — no DOM selection, `focusin` with no target, `focusout` past the
	 * microtask, and a boundary outside the editor. A verb rather than a `stored(undefined)`
	 * reaching across the module boundary, so those exits obey the same "did it actually
	 * change" contract {@link select} does.
	 */
	const clear = (): boolean => stored(undefined)

	const selectNode = (node: TreeNode, boundary: 'start' | 'end'): boolean => {
		// The NODE is the disambiguator two tokens sharing a boundary offset need — the job
		// the consume-once `#preferredHandle` stash did (spec S1 §4.6 item 5). A mark has no
		// anchorable interior (spec S1 §2.3), so it answers with its own boundary.
		//
		// Re-resolving the number instead (`tokens.anchorAt(node.position.start)`) is what
		// this replaces, and it is gated twice over: `dom/SelectionDriver.spec`'s "places at
		// a mark whose start equals the previous text node end…" plus the same 8 browser
		// assertions the {@link stored} watch above names.
		const anchor: NodeAnchor =
			node.kind === 'text'
				? // The length comes from `position`, not `text()`: that is the coordinate space
					// the anchor resolves in, and reading the signal would add a dependency.
					{node, offset: boundary === 'end' ? node.position.end - node.position.start : 0}
				: boundary === 'end'
					? {after: node}
					: {before: node}
		return select(anchor)
	}

	/**
	 * @internal Post-adoption caret repair (spec S1 D7, S1 §4.5). Called by the token layer
	 * inside the commit, after the pipeline applied — never by anything else. Together with
	 * {@link anchors} this is the `SelectionPort` `TokenModel` is constructed with —
	 * `{anchors(), repair()}`, reaching this module through `SelectionController`'s
	 * delegation.
	 *
	 * An APPLICATION, not a computation: `selectionAfter` is resolved inside adoption,
	 * which is the only code that still sees the pre-mutation coordinate space (see
	 * {@link TransactionResult.selectionAfter}).
	 *
	 * The anchor it applies can never dangle: adoption resolves it from the capture, and the
	 * capture is these same anchors (the boundary's thunk is `selection.anchors()`), so it is
	 * defined exactly when they are, and every adoption that could remove an anchor's node
	 * re-derives it.
	 * `map` resolves against the post-adoption roots and is property-proven never to
	 * answer with a dead node (`tree/adopt.property.spec.ts`).
	 */
	const repair = (result: TransactionResult): void => {
		// Unconditional: positions move whether or not there is a selection, and `range`
		// derives from fields no signal covers (spec S1 D3).
		generation(generation() + 1)
		const next = result.selectionAfter
		if (!next) return
		select(next.anchor, next.head)
	}

	/**
	 * Spec §2.3's `input.selection()`: the STORED anchors (spec S1 D7), not the derived numbers
	 * — {@link range} is the numeric projection. Reactive: a tracked read.
	 */
	const anchors = (): Anchors | undefined => stored()

	/** See {@link Selection.caretAnchor}. */
	const caretAnchor = (): NodeAnchor | undefined => {
		const current = stored()
		if (!current) return undefined
		return deps.offsetOf(current.anchor) <= deps.offsetOf(current.head) ? current.anchor : current.head
	}

	return {range, position, isAllSelected, anchors, caretAnchor, select, selectNode, selectAll, clear, repair}
}
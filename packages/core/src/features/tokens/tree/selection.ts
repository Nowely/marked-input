// NO upward import any more: S2.6 deleted {@link Selection.range}, the one member that
// needed `editorContracts.Range`, and with it the exception S1 recorded here.
import {computed, signal} from '../../../shared/signals'
import type {Computed, Signal} from '../../../shared/signals'
import {anchorEquals} from './anchors'
import type {Anchors, NodeAnchor, TransactionResult, TreeNode} from './types'

/**
 * What the selection state reads from the tree — nothing more. CLOSURES, not the
 * `TokenTree` itself, and that outlived its original reason (`Store` built the selection
 * while `TokenModel` kept its tree private). It is what keeps this module unit-testable
 * over a bare `createTokenTree`, and what lets `TokenModel` satisfy `anchorAt` with the
 * SEEDING read rather than the bare tree walk — see the bag it passes.
 */
export type SelectionDeps = {
	offsetOf(anchor: NodeAnchor): number
	anchorAt(offset: number): NodeAnchor
	/**
	 * The first offset a caret may occupy — 0 in every document except one opening with a typed
	 * row, whose opener is structural. Beside {@link SelectionDeps.anchorAt} rather than derived
	 * from it because the READ must not seed: {@link Selection.isAllSelected} evaluates inside a
	 * computed, and seeding writes signals.
	 */
	contentStart(): number
	value(): string
}

/**
 * The tree-space half of the selection (spec S2 D10): the stored anchors and their
 * derivations. Anchors-not-offsets is S1 D7.
 */
export type Selection = {
	/**
	 * THE one derivation that still needs numbers, and the reason it lives HERE: "is the
	 * whole document selected" is an equality between the stored anchors' offsets and the
	 * value's length, and `tree/` is the layer where that arithmetic is legal (spec S2 D1).
	 * Its consumers above (`keyboard/input.ts`) read the BOOLEAN.
	 */
	readonly isAllSelected: Computed<boolean>
	/**
	 * THE read of the stored anchors, and the only one: the writable signal behind it is
	 * private, so every write goes through {@link Selection.select} / {@link Selection.clear}
	 * and their "did it actually change" contract.
	 *
	 * WATCHABLE — a tracked read, which is what `SelectionDriver`'s caret-application watch
	 * subscribes to. It had to be the anchors and NOT the derived numeric `range` the driver
	 * once watched: at a shared boundary that projection deduped on `shallow`, so
	 * `placeAtHandle` changed the anchor without changing the number and the watch never
	 * fired (8 browser assertions across three focus specs). The projection is gone as of
	 * S2.6; the reason it could not be the subscription is kept because it is why this read
	 * is the one the driver watches.
	 */
	anchors(): Anchors | undefined
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
	 * a mouse sweep would re-enter placement on every tick (the job the pre-anchor
	 * `{equals: shallow}` on the numeric range did).
	 *
	 * Its gate is `dom/SelectionDriver.spec`'s "repeated selectAll applies to the DOM once",
	 * and it has to be a RANGED selection: the collapsed path is masked by
	 * `SelectionDriver.placeAtHandle`'s re-apply branch. Until S2.6 that was ALSO the only
	 * gate, because the derived `range` deduped on `shallow` and hid the difference from a
	 * notification count; with that projection gone, the two "notifies once" cases in the
	 * same spec watch these anchors directly and gate it too.
	 */
	const stored: Signal<Anchors | undefined> = signal<Anchors>({
		equals: (a, b) => anchorEquals(a?.anchor, b?.anchor) && anchorEquals(a?.head, b?.head),
	})

	/**
	 * NO GENERATION MARKER, and that is measured rather than assumed: the deleted
	 * {@link range} needed one because stored positions are plain fields (spec S1 D3), so an
	 * anchor that survives an edit UNCHANGED still had to re-resolve. Here `deps.value()` is
	 * already a dependency and covers it — every adoption that moves a position also moves
	 * the projection, and an adoption that does NOT (a reparse of the same string) leaves
	 * every offset where it was.
	 */
	const isAllSelected: Computed<boolean> = computed(() => {
		const current = stored()
		const v = deps.value()
		if (!current || v.length === 0) return false
		const anchor = deps.offsetOf(current.anchor)
		const head = deps.offsetOf(current.head)
		// Against the first SELECTABLE offset, not against 0: a document opening with a typed row
		// starts with structural bytes no caret may enter, so {@link selectAll}'s own seed lands
		// past 0 and comparing with 0 would make "everything is selected" unsatisfiable there.
		return Math.min(anchor, head) === deps.contentStart() && Math.max(anchor, head) === v.length
	})

	const selectAll = (): void => {
		// Node anchors, not the `'start'`/`'end'` edges: a later edit that grows the value
		// must NOT keep `isAllSelected` true, and edge anchors would.
		//
		// A document opening with a MARK is the case this has to survive, and it does without
		// asking for a left reading: the parse brackets that mark with an empty text token, so
		// offset 0 resolves inside it rather than to the mark's own end (`keyboard/input.spec`'s
		// mark-FIRST select-all). The END seed: `{after: lastMark}` is already the document end.
		select(deps.anchorAt(0), deps.anchorAt(deps.value().length))
	}

	/**
	 * @internal THE write (spec S1 D7's stored form). {@link selectAll}, {@link selectNode},
	 * `MarkputHandle.select` and `SelectionDriver`'s DOM sync all go through it; S1.7 promoted
	 * it to §2.3's `input.select`. Returns whether the stored selection actually changed.
	 */
	const select = (anchor: NodeAnchor, head: NodeAnchor = anchor): boolean => stored({anchor, head})

	/**
	 * @internal THE drop. Its two callers are `SelectionDriver`'s "the selection is not in
	 * this editor" exits — `syncIfInEditor` on a boundary outside the container, and the
	 * `focusout` microtask once focus has actually left it. A verb rather than a
	 * `stored(undefined)` reaching across the module boundary, so those exits obey the same
	 * "did it actually change" contract {@link select} does.
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
	 * inside the commit, after the pipeline applied — never by anything else. It and
	 * {@link anchors} are the two ends of the D7 protocol; until S2.9 they reached
	 * `TokenModel` as an injected two-method thunk, because `Store` built the selection
	 * after the model. `TokenModel` owns both now and calls them on its own field.
	 *
	 * UNCONDITIONAL no more: the pre-S2.6 body also bumped a generation marker on every
	 * adoption, because the derived numeric `range` read stored positions that no signal
	 * covers (spec S1 D3). Nothing derives numbers from a bare position any more —
	 * {@link isAllSelected} depends on `value()`, which moves with them — so a repair with
	 * no `selectionAfter` is now a true no-op.
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
		const next = result.selectionAfter
		if (!next) return
		select(next.anchor, next.head)
	}

	/** Spec §2.3's `input.selection()`: the STORED anchors (spec S1 D7). Reactive: a tracked read. */
	const anchors = (): Anchors | undefined => stored()

	return {isAllSelected, anchors, select, selectNode, selectAll, clear, repair}
}
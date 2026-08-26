import {untracked} from '../../../shared/signals/index.js'
import type {Id, NodeAnchor, TreeNode} from '../tree/types'
import {getRect, placeRangeAcrossBoundaries, revealCaret} from './caret'
import type {CaretBoundary} from './caret'
import {anchorFromBoundary} from './domBoundary'
import type {AnchorContext, BoundaryAffinity, Lookup} from './domBoundary'
import type {TokenHandle} from './TokenHandle'

export type SelectionSnapshot = {
	/**
	 * The window selection's first range — the boundary pair the selection driver resolves
	 * through `anchorFor`, and since S2.6 the snapshot's only reading of WHERE the
	 * selection is.
	 *
	 * NOT optional: a snapshot exists only when `rangeCount > 0`, so index 0 is always
	 * there. `selection()?.range` still narrows to `undefined`, which is the "no DOM
	 * selection" answer its consumers need.
	 *
	 * The selection's OWN range, not a clone: Chromium caches one Range per selection, so
	 * this is reference-stable and writes through to the selection. It is NOT forward-live
	 * — MEASURED: a `setBaseAndExtent` detaches the handed-out object, which keeps its old
	 * boundaries. Freshness comes from {@link DomModel.selection} being a pull, so a caller
	 * must read the range in the same turn it took the snapshot. Gated by
	 * `TokenModel.facade.spec`'s "range is the window selection's own range, not a clone".
	 */
	readonly range: globalThis.Range
	/** Focus node of the raw window selection. */
	readonly focusNode: Node | undefined
}

/** What the DOM facade reads from the token layer — nothing more. */
export type DomModelDeps = {
	/** Adapter container; null until mounted. */
	container(): HTMLElement | null
	/** Bound-node lookup for a rendered element. */
	byElement(element: HTMLElement): TokenHandle | undefined
	/** Whether an element is inside a registered control root. */
	isControlRoot(element: HTMLElement): boolean
	/** The live root nodes (TokenModel.nodes()). */
	roots(): readonly TreeNode[]
	/** Stable id → live node (TokenModel.find). */
	find(id: Id): TreeNode | undefined
	/**
	 * Stable id → live handle (TokenModel.handle). Refuses by ABSENCE only (ADR-0008): a node
	 * this commit added has no handle until `bind` makes one, which is the refusal the
	 * placement commands need. It used to ALSO refuse every id while a structural apply
	 * awaited its bind; that gate is gone.
	 */
	handle(id: Id): TokenHandle | undefined
}

/**
 * The DOM↔model facade: resolves live DOM nodes, selections and boundaries to NODE
 * ANCHORS and places anchors back as carets and ranges. Pull-only by design — every
 * read here touches the live DOM. The model side (tree, handles, commits) lives in
 * TokenModel; this class is a stateless view over it plus `domBoundary`/`caret`.
 *
 * It speaks no absolute offsets in either direction as of S2.6 (spec S2 D1): the
 * numeric walk, `boundaryFor` and `SelectionSnapshot.raw` are gone, and with them the
 * bind-generation `Token` reads they needed.
 */
export class DomModel {
	constructor(private readonly deps: DomModelDeps) {}

	/**
	 * Resolve a DOM node to its handle, 'control' if inside a control root,
	 * or undefined if outside the container.
	 */
	handleAt(node: Node): TokenHandle | 'control' | undefined {
		const lookup = this.#locate(node)
		if (!lookup) return undefined
		if (lookup.kind === 'control') return 'control'
		return lookup.handle
	}

	/**
	 * The nearest bound token ABOVE a DOM node, walking PAST any control root on the way — where
	 * {@link handleAt} stops at a control and answers `'control'`, losing whatever the control
	 * was painted inside.
	 *
	 * Its one caller is the caret recovery, and what it needs is exactly what the stop discards:
	 * a click that strands the caret in an atomic block still happened in a ROW, and that row is
	 * where the search for a position the caret may occupy starts.
	 */
	tokenAbove(node: Node): TokenHandle | undefined {
		const container = this.deps.container()
		if (!container) return undefined
		for (let current: Node | null = node; current && current !== container; current = current.parentNode) {
			if (!(current instanceof HTMLElement)) continue
			const handle = this.deps.byElement(current)
			if (handle?.node()) return handle
		}
		return undefined
	}

	/**
	 * MAY A CARET SIT HERE — did the adapter give this anchor a surface, and is that surface the
	 * document's rather than the consumer's?
	 *
	 * Two refusals, each a defect this reading was written for. NO SURFACE AT ALL is what an ATOMIC
	 * row is: its kind's component is handed the row's children and draws none of them, so the row
	 * round-trips and holds no position a caret can take. A CONTROL ROOT is the other:
	 * `useControlRef()` writes `contenteditable="false"`, so the browser's own caret lands inside
	 * one and every keystroke after it is dropped with nothing said.
	 *
	 * NO VISIBILITY TEST HERE, and that is measured rather than tidy: `checkVisibility()` is FALSE
	 * for an EMPTY inline box, which is what a blank row's own text surface is and what the parse
	 * leaves after every trailing mark — so asking it here answered "unusable" for the commonest
	 * caret position in the editor. Whether a row is on screen is a question about the ROW, and
	 * {@link painted} is where it is asked.
	 */
	reachable(anchor: NodeAnchor): boolean {
		const target = this.#targetOf(anchor)
		if (!target) return false
		const element = this.deps.handle(target.id)?.element()
		return element?.isConnected === true && !this.deps.isControlRoot(element)
	}

	/**
	 * WHAT THIS FRAME SAYS ABOUT A ROW — three answers, because a caret invariant needs two of them
	 * apart and the single boolean this replaces could not tell them apart:
	 *
	 * - `'absent'` — no element, or one no longer in the document. A RACE, not a verdict: the
	 *   framework has not reached this row yet, and the next pulse answers again.
	 * - `'boxless'` — an element the framework HAS painted, in the document, generating no box: a
	 *   row inside a collapsed subtree. A VERDICT, and one that does not heal by waiting, so a
	 *   caret there is in the document and on no screen.
	 * - `'painted'`.
	 *
	 * The two were one `painted()` reading until the toggle defect: closing a toggle with the caret
	 * inside it left `'boxless'`, the caret invariant read it as `'absent'` and stood down, and the
	 * next keystroke edited text nobody could see.
	 */
	rowPaint(id: Id): 'absent' | 'boxless' | 'painted' {
		const element = this.deps.handle(id)?.element()
		if (element?.isConnected !== true) return 'absent'
		return element.checkVisibility() ? 'painted' : 'boxless'
	}

	/**
	 * IS THERE ANYWHERE AT ALL for this row's child rows — the DOCUMENT half of the invariant,
	 * where {@link nestingIsPainted} is the caret's. A kind that ignores the rows it is handed
	 * renders no host, so rows nested under it are in the value and on no screen, and no gesture
	 * can reach them: `turnInto` onto such a kind is how a row with children arrives there, and a
	 * paste or a replayed edit is how it arrives without any verb naming the row at all.
	 *
	 * WHETHER THE HOST IS ON SCREEN IS NOT ASKED HERE, and that is the whole difference from
	 * {@link nestingIsPainted}: a closed toggle renders its host and hides it, which is a kind
	 * doing its job, and lifting its children out of it would destroy the document on every
	 * collapse. No host at all is the one state nothing can recover from.
	 */
	nestingIsHosted(id: Id): boolean {
		const bindings = this.deps.handle(id)?.node()
		return !bindings || bindings.rowSequenceHost?.isConnected === true
	}

	/**
	 * WOULD A CHILD ROW OF THIS ROW BE ON SCREEN — asked of the WOULD-BE PARENT, before anything
	 * is written, which is what a childless one could not be asked while the question was put to
	 * its first existing child.
	 *
	 * A row's child rows reach its kind's component as one host element, and a kind that ignores
	 * them never renders it: no host, no place for a child to be painted, so a row nested there is
	 * in the document and on no screen. The host is what the adapters register for exactly this
	 * reason, and they file it whether or not the row has children YET — the fact is about the
	 * KIND, and a parent with an empty list has to be able to answer it.
	 *
	 * A ROW THE FRAMEWORK HAS NOT PAINTED ANSWERS `true`, and that asymmetry is deliberate: no
	 * bindings at all is a node this commit added or a document with no adapter behind it, where a
	 * refusal would be a race rather than a verdict — the rule {@link rowPaint}'s callers already
	 * live by.
	 */
	nestingIsPainted(id: Id): boolean {
		const bindings = this.deps.handle(id)?.node()
		if (!bindings) return true
		const host = bindings.rowSequenceHost
		return host?.isConnected === true && rendersContents(host)
	}

	/** Locate the live node owning a DOM node, walking up to the container. */
	#locate(node: Node): Lookup | undefined {
		const container = this.deps.container()
		if (!container) return undefined

		let current: Node | null = node
		while (current && current !== container) {
			if (current instanceof HTMLElement) {
				const handle = this.deps.byElement(current)
				if (handle) {
					const bindings = handle.node()
					return bindings ? {kind: 'token', handle, bindings} : undefined
				}
				if (this.deps.isControlRoot(current)) return {kind: 'control'}
			}
			current = current.parentNode
		}
		return undefined
	}

	#anchorContext(): AnchorContext {
		return {
			container: this.deps.container() ?? undefined,
			locate: node => this.#locate(node),
			find: id => this.deps.find(id),
		}
	}

	/**
	 * Map a DOM boundary (node, offset) to a node anchor in the live tree.
	 *
	 * `untracked` is load-bearing HERE, at the walk's own entry: the walk reads
	 * node `text()` and `children()` signals directly, so any caller inside a
	 * reactive scope would otherwise subscribe to them.
	 */
	anchorFor(node: Node, offset: number, affinity: BoundaryAffinity = 'after'): NodeAnchor | undefined {
		return untracked(() => anchorFromBoundary(this.#anchorContext(), node, offset, affinity))
	}

	/**
	 * THE selection read: one snapshot of the live window selection, or
	 * `undefined` when there is no range (the element is unfocused / nothing
	 * selected). `range` is the boundary pair (the selection driver resolves it
	 * through `anchorFor`); `focusNode` reflects the raw window selection.
	 * Whether the selection is collapsed is `range.collapsed`; the caret's
	 * viewport rect is {@link caretRect}, computed only when asked.
	 */
	selection(): SelectionSnapshot | undefined {
		const sel = window.getSelection()
		if (!sel || sel.rangeCount === 0) return undefined
		// A null anchorNode still answers "no DOM selection" — the guard outlives the
		// removed anchor field so the snapshot's existence keeps meaning the same thing.
		if (!sel.anchorNode) return undefined
		return {range: sel.getRangeAt(0), focusNode: sel.focusNode ?? undefined}
	}

	/** Viewport rect of the caret/selection, or `undefined` when there is none. */
	caretRect(): DOMRect | undefined {
		return getRect() ?? undefined
	}

	/**
	 * Scroll the caret back onto the screen — see {@link revealCaret} for the walk.
	 *
	 * GATED ON FOCUS, and that is the whole of when this is the editor's business: an editor that
	 * does not hold the caret has no claim on where the page is scrolled to, and a second editor
	 * on the same page would otherwise fight the first for it on every commit.
	 */
	revealCaret(): void {
		const container = this.deps.container()
		if (!container?.contains(document.activeElement)) return
		revealCaret(container, getRect)
	}

	/** Current selection serialized for clipboard use. */
	selectedContent(): {html: string; text: string} | undefined {
		const sel = window.getSelection()
		const range = sel?.rangeCount ? sel.getRangeAt(0) : undefined
		if (!range) return undefined
		const fragment = range.cloneContents()
		const div = document.createElement('div')
		div.appendChild(fragment)
		return {html: div.innerHTML, text: range.toString()}
	}

	/**
	 * Place a collapsed caret AT a node anchor, through the anchor's OWN node: the
	 * handle places a LOCAL offset inside its own surface, so it cannot pick the
	 * wrong node at a shared boundary and no absolute coordinate is ever formed
	 * (spec S2 D1).
	 *
	 * FAILS CLOSED where the numeric predecessor guessed. That one searched every
	 * bound surface for the position and fell back to the nearest one, which meant
	 * reading BIND-GENERATION positions (spec S1 D9) — during a structural apply's
	 * pending window they describe a layout the adapter has not painted. Here a node
	 * with no live handle simply declines, and the caret is placed by the
	 * `tokens.bound` re-apply once the bind lands.
	 */
	placeCaret(anchor: NodeAnchor): boolean {
		const target = this.#targetOf(anchor)
		if (!target) return false
		// NO `alive()` gate: `kill` and `unbind` both clear the DOM bindings, and
		// `TokenHandle.placeCaret` already declines a handle without them.
		return this.deps.handle(target.id)?.placeCaret(target.offset) === true
	}

	/**
	 * Select between two node anchors. Order-insensitive: {@link placeRangeAcrossBoundaries}
	 * normalizes the pair in DOM order, because the Range API collapses rather than spans when
	 * its end precedes its start.
	 *
	 * Either end may be a MARK. It could not until now — both had to resolve to a TEXT SURFACE,
	 * on the reading that a Range boundary inside a mark's presentation is not a document
	 * position the model owns. True of the INSIDE, but a mark's endpoints are its PARENT
	 * coordinates (spec S2, and what `placeCaret` has answered since the one-host flip), and
	 * refusing them silently dropped whole selections: on a document with rows that ends with a
	 * mark, select-all resolved `{after: mark}`, this method declined, and the DOM selection
	 * never moved while the STORED one said all-selected — so the next keystroke replaced a
	 * document the user could not see was selected. Both ends now go through
	 * {@link TokenHandle.caretBoundary}, the same answer `placeCaret` places.
	 */
	selectRange(anchor: NodeAnchor, head: NodeAnchor): boolean {
		const a = this.#boundaryAt(anchor)
		const b = this.#boundaryAt(head)
		if (!a || !b) return false
		// BOTH ENDS CONNECTED, checked rather than assumed. `placeRangeAcrossBoundaries` normalizes
		// the pair with `comparePoint`, which THROWS for a node in another tree, and its own
		// docstring's premise — "both boundaries live under the one editing host" — is false for
		// exactly one moment: a framework re-parenting a row replaces its element, and `bound`
		// pulses per registration, so a pulse can land while one end is the element that just left
		// the document. Measured in Vue on a two-row drag into a nested position, where the
		// exception escaped as an unhandled rejection and no selection was applied at all.
		// Refusing here is self-healing: the last registration of the same patch pulses `bound`
		// again, and by then both ends are in the document.
		if (!a.node.isConnected || !b.node.isConnected) return false
		placeRangeAcrossBoundaries(a, b)
		return true
	}

	/**
	 * HOME AND END — the caret to its VISUAL line's edge, `extend` for the shifted pair. `false`
	 * when there is no live selection to move.
	 *
	 * `Selection.modify` rather than an anchor this layer computes, and that is the point: which
	 * character ends a LINE is a layout fact, not a tree one — a wrapped row has several lines and
	 * the tree has one row — so the answer belongs to the engine that laid it out. It is the same
	 * primitive Chromium's own `MoveToEndOfLine` runs, reached directly.
	 *
	 * WHY THE EDITOR OWNS A KEY THE BROWSER ALREADY BINDS: on macOS it does not bind it to this. End
	 * is `scrollToEndOfDocument` there, so inside a page with anything left to scroll the key scrolls
	 * and the caret does not move — MEASURED with no editor present at all: a bare `contenteditable`
	 * in a 200vh page leaves the caret where it was and smooth-scrolls to the bottom, and so does a
	 * `<textarea>` beside it. Pressed again with nothing left to scroll, the same key moves the
	 * caret, which is what made it read as one press in three. The platform's own answer is
	 * Cmd+Left/Right and it is untouched; what this takes is the key that says End.
	 */
	moveToLineBoundary(direction: 'backward' | 'forward', extend: boolean): boolean {
		const selection = window.getSelection()
		if (!selection || selection.rangeCount === 0) return false
		selection.modify(extend ? 'extend' : 'move', direction, 'lineboundary')
		return true
	}

	/**
	 * The anchor's own node as an id and a LOCAL offset. `Infinity` is
	 * `TokenHandle.placeCaret`'s "end of this surface" — the offset an `{after: node}`
	 * anchor means without knowing the node's length.
	 *
	 * The two document edges resolve against the live roots rather than declining:
	 * they are the anchors an out-of-range caret intent produces (`anchorAt` answers
	 * `'end'`), and the numeric predecessor placed them through the position they
	 * projected to.
	 */
	#targetOf(anchor: NodeAnchor): {id: Id; offset: number} | undefined {
		if (anchor === 'start') {
			const first = this.deps.roots().at(0)
			return first && this.#entryOf(first, 'start')
		}
		if (anchor === 'end') {
			const last = this.deps.roots().at(-1)
			return last && this.#entryOf(last, 'end')
		}
		if ('node' in anchor) return {id: anchor.node.id, offset: anchor.offset}
		if ('before' in anchor) return this.#entryOf(anchor.before, 'start')
		return this.#entryOf(anchor.after, 'end')
	}

	/**
	 * A row's boundary descends to its edge CHILD — a row's own handle is the row
	 * wrapper, whose parent-index coordinates would put the caret between rows rather
	 * than inside one, and the separator has no DOM to land in. Text and mark nodes
	 * answer themselves, as before.
	 *
	 * RECURSIVELY, since rows nest: a row's last child is itself a row whenever it has any, so
	 * one level down would answer with another row wrapper and `'end'` would resolve to a
	 * handle no caret can sit in.
	 */
	#entryOf(node: TreeNode, side: 'start' | 'end'): {id: Id; offset: number} {
		if (node.kind === 'row') {
			const child = side === 'start' ? node.children().at(0) : node.children().at(-1)
			if (child) return this.#entryOf(child, side)
		}
		return {id: node.id, offset: side === 'start' ? 0 : Infinity}
	}

	/**
	 * The anchor as a concrete DOM boundary, through its OWN node's handle — the one the
	 * caret commands place. `undefined` while that handle is absent or unbound, which is the
	 * same fail-closed reading {@link placeCaret} has.
	 */
	#boundaryAt(anchor: NodeAnchor): CaretBoundary | undefined {
		const target = this.#targetOf(anchor)
		if (!target) return undefined
		return this.deps.handle(target.id)?.caretBoundary(target.offset)
	}
}

/**
 * Would something painted INSIDE `element` be on screen? The question {@link DomModel.painted}
 * asks of an element about ITSELF, asked instead about an element's contents.
 *
 * `checkVisibility()` CANNOT ANSWER IT, and that is measured rather than assumed. A child-sequence
 * host is `display: contents`, and `checkVisibility`'s first step is "does this have an associated
 * box" — which such an element never has, so it answers `false` for an open host, a closed one and
 * an empty one alike and tells none of them apart. Asking the host's PARENT instead trades one
 * blind spot for another: a `content-visibility: hidden` element — which is what
 * `hidden="until-found"` is — is itself rendered and answers `true` while everything inside it is
 * skipped.
 *
 * So the three properties are read directly. `visibility` INHERITS, so the host's own computed
 * value already carries an ancestor's; the other two do not, and their effect reaches the whole
 * subtree, so those are the walk. The caller owns `isConnected`.
 */
function rendersContents(element: HTMLElement): boolean {
	if (getComputedStyle(element).visibility === 'hidden') return false
	for (let current: HTMLElement | null = element; current; current = current.parentElement) {
		const style = getComputedStyle(current)
		if (style.display === 'none' || style.getPropertyValue('content-visibility') === 'hidden') return false
	}
	return true
}
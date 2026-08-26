import {effect} from '../../../shared/signals/index.js'
import type {TreeNode} from '../tree/types'
import {collapseTo, findTextBoundary, focusEditingHost, getCaretIndex} from './caret'
import type {CaretBoundary} from './caret'
import {textLength} from './textOffsets'

/** DOM bindings of a live node — set by bind, cleared on unbind/kill. */
export type ElementBindings = {
	readonly tokenElement: HTMLElement
	readonly textElement?: HTMLElement
	readonly childSequenceHost?: HTMLElement
	/**
	 * A ROW's child-ROWS host, beside the inline one above. Two NAMED parts rather than one list,
	 * because the caret mapping needs the split between a row's `inline()` and its `rows()` to be
	 * deterministic, and registration order cannot give it.
	 */
	readonly rowSequenceHost?: HTMLElement
}

/**
 * The live record of one node's DOM: its element bindings and the single writer
 * that keeps its text surface in step with the tree. The class doubles as the
 * public handle face: plain getters (`element()`/`alive()`) and caret commands
 * read this handle's own fields. No per-node reactivity on the getters — the
 * spec's win-4 trade: zero production consumers subscribe to them, so signals
 * would be pure overhead (reversible: they stay methods, so per-node signals can
 * return behind them additively).
 *
 * IT HOLDS NO TOKEN (S2.7). `#token` used to carry "the generation the DOM is
 * SHOWING" — a second representation of data the tree already owns. Cut B took its
 * last positional reader, and this phase took the other two: `setEditable`'s type
 * read (dead — bind gives a text surface to text nodes ONLY, so a bound handle's
 * kind is readable off `textElement`) and the dev divergence detector, deleted once
 * every commit began re-arming every writer.
 *
 * What replaces the latch is {@link bindElements}'s text effect: one writer per
 * surface, subscribed to that node's own `text` signal, whose immediate first run
 * is the mount-time reconciliation `bind.applyMountState` used to do. It is
 * disposed and re-armed on every re-bind — deliberately, and not an optimization
 * gap: the re-arm's first run is what heals a surface corrupted between binds
 * (gated by treePipeline.spec.ts's "the structural branch self-heals corruption").
 *
 * Lifetime: created when its node enters the tree (keyed by the node's stable id),
 * mutated in place by `bindElements`/`unbind`, killed when the node disappears
 * (stale reads stay safe, commands become no-ops, never resurrected).
 */
export class TokenHandle {
	#dead = false

	/** THE binding record — the one bound/unbound bit this handle has. `undefined` ⇔ unbound. */
	#bindings: ElementBindings | undefined
	#disposeText: (() => void) | undefined

	constructor(readonly id: number) {}

	/** Live AND bound: not killed and currently holding a DOM element. The whole validity check a holder of this handle needs. */
	alive(): boolean {
		return !this.#dead && this.#bindings != null
	}

	/** The handle's current token root element, or undefined while unbound/dead. */
	element(): HTMLElement | undefined {
		return this.#bindings?.tokenElement
	}

	/** @internal Current DOM bindings; undefined while unbound or dead. */
	node(): ElementBindings | undefined {
		return this.#bindings
	}

	/** The text surface, else the token root — which for a RowNode IS the row wrapper. */
	#measureScope(): HTMLElement | undefined {
		const bindings = this.#bindings
		return bindings?.textElement ?? bindings?.tokenElement
	}

	/** Deliberately kept despite zero in-repo callers: public-reachable surface via the exported Store (`store.tokens.handle()`) — the `api.focus()` precedent. */
	hasTextSurface(): boolean {
		return this.#bindings?.textElement != null
	}

	textLength(): number {
		const scope = this.#measureScope()
		return scope ? textLength(scope) : 0
	}

	/**
	 * Caret offset within this token's scope, or undefined when unmounted.
	 * Only meaningful while the selection is inside this token's scope — the
	 * underlying helper returns 0 when there is no selection.
	 */
	caretIndex(): number | undefined {
		const scope = this.#measureScope()
		return scope ? getCaretIndex(scope) : undefined
	}

	/**
	 * THE DOM boundary a caret offset resolves to inside this token (Infinity → end), or
	 * `undefined` while unbound. Both placement commands read it, which is the point: a
	 * collapsed caret and a RANGE ENDPOINT are the same question asked twice, and answering it
	 * in two places is what left `DomModel.selectRange` refusing the mark endpoints
	 * `placeCaret` had accepted since the one-host flip.
	 *
	 * On a token without a text surface any offset > 0 answers the boundary AFTER the token in
	 * its parent: a mark is atomic (ce=false), so its positions are the PARENT coordinates
	 * before and after it, never a position inside.
	 */
	caretBoundary(offset: number): CaretBoundary | undefined {
		const bindings = this.#bindings
		if (!bindings) return undefined
		const {tokenElement, textElement} = bindings
		if (!textElement) {
			const parent = tokenElement.parentElement
			if (!parent) return undefined
			const index = Array.prototype.indexOf.call(parent.childNodes, tokenElement)
			return {node: parent, offset: offset <= 0 ? index : index + 1}
		}
		const length = textLength(textElement)
		return findTextBoundary(textElement, Number.isFinite(offset) ? Math.max(0, Math.min(offset, length)) : length)
	}

	/** Place a collapsed caret at a character offset (Infinity → end); see {@link caretBoundary}. */
	placeCaret(offset: number): boolean {
		const boundary = this.caretBoundary(offset)
		const bindings = this.#bindings
		if (!boundary || !bindings) return false
		// The ELEMENT, not the boundary node: a text boundary's node is a `Text`, which carries
		// no `closest`. `caretBoundary` already declined the parentless case, so the fallback
		// here is unreachable and only satisfies the type.
		focusEditingHost(bindings.textElement ?? bindings.tokenElement.parentElement ?? bindings.tokenElement)
		collapseTo(boundary)
		return true
	}

	/**
	 * Focus the editing host of this token's scope element (the row, where the document has rows).
	 * Deliberately kept despite zero in-repo callers: public-reachable surface via the exported Store (`store.tokens.handle()`) — the `api.focus()` precedent.
	 */
	focus(): boolean {
		const scope = this.#measureScope()
		if (!scope) return false
		focusEditingHost(scope)
		return true
	}

	/**
	 * @internal Set/replace the DOM bindings and re-arm the text effect (structural bind).
	 * `node` is this handle's own node — an id and its node object are paired for the
	 * node's whole life (adoption mutates nodes in place and never reuses an id), so the
	 * caller cannot hand over a foreign one.
	 */
	bindElements(bindings: ElementBindings, node: TreeNode): void {
		if (this.#dead) return
		this.#bindings = bindings
		this.#armText(bindings.textElement, node)
	}

	/**
	 * THE writer of a text surface (S2.7): the DOM mirrors `node.text()` and nothing
	 * else touches it. See {@link writeSurface} for how it writes, which is the half
	 * a caret sitting in the surface can tell apart.
	 *
	 * WHEN it fires is up to the caller's batching, not to this module: adoption writes
	 * `text` inside its own batch, and a caller that wraps the whole edit in one more
	 * (`EditController.replace` does) defers the flush to the end of THAT batch — so the write
	 * lands at that batch's close, ahead of every `committed` subscriber.
	 */
	#armText(surface: HTMLElement | undefined, node: TreeNode): void {
		this.#disposeText?.()
		this.#disposeText = undefined
		if (!surface || node.kind !== 'text') return
		this.#disposeText = effect(() => {
			writeSurface(surface, node.text())
		})
	}

	/** @internal Clear the DOM bindings (token unmounted from the DOM). */
	unbind(): void {
		if (this.#dead) return
		this.#clearElements()
	}

	/** @internal Drops DOM, marks dead. A dead handle pins nothing; no unlink needed. */
	kill(): void {
		if (this.#dead) return
		this.#clearElements()
		this.#dead = true
	}

	#clearElements(): void {
		this.#disposeText?.()
		this.#disposeText = undefined
		this.#bindings = undefined
	}
}

/**
 * Write `text` into a surface WITHOUT destroying the `Text` node already in it.
 *
 * `textContent =` is a replace-all. MEASURED in Chromium: assigning a DIFFERENT string drops the
 * existing `Text` node, and every DOM Range anchored in it goes with it. A minimal `replaceData`
 * keeps the node and moves live ranges by the DOM's own rules — a position BEFORE the splice is
 * untouched, one AFTER it shifts by the delta, one INSIDE collapses to the splice start.
 *
 * WHAT THIS DOES NOT BUY, stated because the obvious reading is wrong and was measured to be
 * wrong: it fixes no caret bug today. `SelectionDriver` re-places the caret after EVERY commit
 * (`dom/SelectionDriver.ts`'s `changed` watch), so it already repairs whatever the replace-all
 * destroyed — probed in both adapters by forcing a replace-all mid-edit and watching the next
 * commit put the caret back. Any claim that a user currently loses a caret here is false.
 *
 * WHAT IT DOES BUY is the precondition for deleting that unconditional re-place, which is worth
 * having: the re-place is the dominant per-keystroke cost, and it can only be skipped when the
 * DOM caret is already correct without it. Nothing can make it already correct while the writer
 * destroys the node the caret lives in. So this lands first, and on its own it is a no-op for the
 * user — the honest reason it is not gated by a red-turns-green caret test.
 *
 * Its own observable effect is narrower and is what the specs pin: a `Text` reference captured
 * before a commit stays live and current across it, rather than being orphaned with pre-edit data
 * (`dom/domBoundary.spec.ts`), and the framework leaves that node alone (`pages/Base/surface.spec.ts`).
 *
 * The fallback keeps the old writer for a surface that is not a single `Text` node — freshly
 * created, emptied, or split in two by the browser's own editing — and normalises it back to one,
 * so every later write takes the fast path. A SPLIT surface therefore still loses its caret on
 * the first changed write; normalising first does not help (measured: merging the halves collapses
 * the range to 0 by itself), and it self-corrects from the second write on.
 *
 * The `''` case stays on `textContent` deliberately: it leaves NO `Text` child, which is the shape
 * every other DOM reader has always seen, and there is no caret inside an empty surface to keep.
 */
function writeSurface(surface: HTMLElement, text: string): void {
	const only = surface.childNodes.length === 1 ? surface.firstChild : undefined
	if (text !== '' && only instanceof Text) {
		if (only.data === text) return
		const {start, deleteCount, insert} = minimalSplice(only.data, text)
		only.replaceData(start, deleteCount, insert)
		return
	}
	// The comparison is load-bearing on THIS arm and not just a saved write: a re-bind arms a
	// fresh effect whose first run finds a split surface already showing the right string, and an
	// unconditional assignment would collapse its two `Text` children into one and drop the caret
	// to 0. Gated by bind.spec.ts's "keeps the caret when a re-bind finds the surface already
	// correct".
	if (surface.textContent !== text) surface.textContent = text
}

/**
 * The shortest single splice turning `from` into `to`: trim the common prefix, then the common
 * suffix of what is left.
 *
 * Code UNITS, not code points, and that is safe rather than sloppy: the result is
 * `from[0, start) + insert + from[end, …)`, which the two equalities make exactly `to` whatever
 * the boundaries land on. A prefix that stops between a surrogate pair's halves therefore still
 * produces the right string, and `replaceData` applies it as one operation, so no reader ever
 * sees the lone surrogate.
 */
function minimalSplice(from: string, to: string): {start: number; deleteCount: number; insert: string} {
	const shorter = Math.min(from.length, to.length)
	let start = 0
	while (start < shorter && from.charCodeAt(start) === to.charCodeAt(start)) start++
	let tail = 0
	while (tail < shorter - start && from.charCodeAt(from.length - 1 - tail) === to.charCodeAt(to.length - 1 - tail)) {
		tail++
	}
	return {start, deleteCount: from.length - start - tail, insert: to.slice(start, to.length - tail)}
}
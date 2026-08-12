import {effect} from '../../../shared/signals/index.js'
import type {TreeNode} from '../tree/types'
import {collapseTo, findTextBoundary, focusEditingHost, getCaretIndex} from './caret'
import type {CaretBoundary} from './caret'
import {textLength} from './textOffsets'

/** DOM bindings of a live node — set by bind, cleared on unbind/kill. */
export type ElementBindings = {
	readonly tokenElement: HTMLElement
	readonly textElement?: HTMLElement
	readonly rowElement?: HTMLElement
	readonly childSequenceHost?: HTMLElement
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
 * kind is readable off `textElement`) and `commit.ts`'s divergence detector, which
 * now compares the surface against the LIVE `TextNode.text()`.
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

	/** Row in block layout, else the text surface / token root. */
	#measureScope(): HTMLElement | undefined {
		const bindings = this.#bindings
		return bindings?.rowElement ?? bindings?.textElement ?? bindings?.tokenElement
	}

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

	/** Focus the editing host of this token's scope element (row in block layout). */
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
	 * else touches it.
	 *
	 * The comparison is load-bearing, and its reason is NOT the obvious one — MEASURED
	 * in Chromium. On an element with a single `Text` child the `textContent` setter
	 * takes Blink's fast path (`setData` on that node, itself a no-op for an identical
	 * string), so an unconditional write of the same string keeps both the node and the
	 * caret. The case it actually saves is a SPLIT surface — two `Text` children, which
	 * is what `splitText` and the browser's own editing of a contenteditable leave
	 * behind. There the setter is a genuine replace-all: measured, writing the same
	 * string collapses two children into one and drops the caret from 4 to 0. Gated by
	 * bind.spec.ts's "keeps the caret when a re-bind finds the surface already correct".
	 *
	 * WHEN it fires is up to the caller's batching, not to this module: adoption writes
	 * `text` inside its own batch, and a caller that wraps the whole edit in one more
	 * (`EditController.replace` does) defers the flush to the end of THAT batch. See
	 * `commit.ts`'s divergence-detector registration for what that costs.
	 */
	#armText(surface: HTMLElement | undefined, node: TreeNode): void {
		this.#disposeText?.()
		this.#disposeText = undefined
		if (!surface || node.kind !== 'text') return
		this.#disposeText = effect(() => {
			const text = node.text()
			if (surface.textContent !== text) surface.textContent = text
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
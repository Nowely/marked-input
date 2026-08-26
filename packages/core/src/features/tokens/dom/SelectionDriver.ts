import {listen, watch} from '../../../shared/signals'
import type {Event} from '../../../shared/signals'
import type {Host} from '../../state/Host'
import {anchorEquals} from '../tree/anchors'
import type {Selection} from '../tree/selection'
import type {Anchors, Id, NodeAnchor, TreeNode} from '../tree/types'
import type {DomModel} from './DomModel'
import type {TokenHandle} from './TokenHandle'

/**
 * WHICH ELEMENTS ANSWER THE KEYBOARD THEMSELVES. A focused one of these owns arrow keys, typing or
 * both, so the editor leaves it the focus a click gave it — see the `click` listener below. Every
 * other focusable thing inside the host (a `<button>`, a `[tabindex]` div) answers the pointer and
 * nothing else, and holding the focus after its click only makes the editor deaf.
 */
const KEYBOARD_OWNERS = 'select, input, textarea, [contenteditable="true"], [contenteditable=""]'

/** What the selection's DOM half reads from the model — nothing more. */
export type SelectionDriverDeps = {
	/** The tree-space half: the stored anchors this driver applies and rewrites. */
	selection: Selection
	host: Host
	readOnly(): boolean
	/** THE DOM clock. See the watch below for why the caret needs this one and not the commit. */
	bound: Event<void>
	/** The live root nodes — {@link SelectionDriver.focusFirst}'s first-token read, and nothing more. */
	nodes(): readonly TreeNode[]
	find(id: Id): TreeNode | undefined
	handle(id: Id): TokenHandle | undefined
	dom: DomModel
	/**
	 * A GESTURE LANDED ON FROZEN PRESENTATION — the caret belongs to the ROW that presentation is
	 * painted in, and nowhere else. Answered by the model, which is the layer that owns both the
	 * row a DOM node sits in and the entry a caret may take inside it.
	 */
	claimRow(origin: Node): void
}

/**
 * The selection's DOM I/O: the listeners that read the live selection into
 * anchors, the caret application that writes them back, and the one editing
 * host's `contenteditable`. The stored state it applies is {@link Selection},
 * which is DOM-free.
 */
export class SelectionDriver {
	/**
	 * The control root a pointer went down in, held for exactly as long as the gesture that set
	 * it: written by every `pointerdown`, consumed by the first selection sync after it, dropped
	 * by the next keydown. See {@link SelectionDriver.#trackSelection} for why the correlation
	 * cannot be read off `selectionchange` itself.
	 */
	#pointerControl: Node | undefined

	constructor(private readonly deps: SelectionDriverDeps) {
		deps.host.onMounted(container => {
			this.#trackSelection(container)

			// THE DOM clock, not the commit clock, and the difference is load-bearing: a caret
			// landing in a node BORN by this commit has no handle until `bind` makes one, so a
			// placement attempted at commit time declines and the caret is simply never placed.
			watch(this.deps.bound, () => this.#applySelection())
			// THE editing host: the container, gated only by readOnly. `immediate` is the
			// mount write; per-token topology is bind's.
			watch(
				() => this.deps.readOnly(),
				readOnly => {
					const attr = readOnly ? 'false' : 'true'
					if (container.contentEditable !== attr) container.contentEditable = attr
				},
				{immediate: true}
			)

			// The STORED anchors, not the derived `range` — MEASURED, not stylistic. `range`
			// dedupes on `shallow`, so at a shared boundary `placeAtHandle` changes the anchor
			// without changing the number and a `range` watch NEVER FIRES: the caret is simply
			// not placed (8 assertion failures across react and vue, in the three focus specs;
			// the core suite stays green, so only `pnpm test` sees this one).
			// Separately, `range` also moves when adoption shifts positions, and re-placing on
			// that would fight the DOM after every commit; the post-bind re-place is the
			// `bound` watch above, which fires only once the DOM is consistent.
			watch(
				() => this.deps.selection.anchors(),
				() => this.#applySelection()
			)
		})
	}

	focusFirst(): void {
		// `.at`, not `[]`: `noUncheckedIndexedAccess` is off, so an index read types as
		// `TreeNode` and the empty-tree guard is linted away as an impossible condition.
		const first = this.deps.nodes().at(0)
		const handle = first && this.deps.handle(first.id)
		if (handle && this.placeAtHandle(handle, 'start')) return
		this.deps.host.container()?.focus()
	}

	/**
	 * THE EDITING HOST TAKES ITS FOCUS BACK FROM ONE OF ITS OWN CONTROLS — the focus half of the
	 * caret invariant, and the whole of it. `false` when there was nothing to reclaim.
	 *
	 * A row kind paints inside the one contenteditable container, so a to-do's checkbox, a
	 * fence's language `<select>`, a toggle's arrow and the editor's own grip are all FOCUSABLE
	 * elements inside the editing host. The browser's default is to focus one on mousedown, and
	 * it leaves the SELECTION exactly where it was — so the model still holds a live caret while
	 * `document.activeElement` is the widget. In that state the editor is deaf and says nothing:
	 * a contenteditable emits no `beforeinput` while a descendant control has focus, so typing
	 * changes nothing, and `isConsumerKeyOrigin` declines the whole keydown tier for a registered
	 * control root, so Enter and Backspace are dead keys too. MEASURED on the Notion showcase:
	 * tick a to-do, press `X`, and the value does not move.
	 *
	 * It reads {@link DomModel.handleAt}'s `'control'` verdict, which is the registration
	 * `tokens.control()` files — so the rule reaches every control a consumer declares through
	 * `useControlRef`, not just the two the editor paints itself. THE GRIP'S OWN TWO CALL SITES
	 * (`RowController.endDrag`, `runMenuVerb`) were this rule written twice by hand, and they
	 * route through here now.
	 *
	 * DECLARED COST: a control driven by the KEYBOARD that commits per keystroke — a `<select>`
	 * arrowed with its popup closed — loses focus after the first commit. `:focus-visible` was
	 * measured as the discriminator and rejected: Chromium reports `true` for a MOUSE-clicked
	 * `<select>`, which is half the defect this fixes.
	 */
	reclaimFocus(): boolean {
		const container = this.deps.host.container()
		const active = document.activeElement
		if (!container || active === container || !(active instanceof HTMLElement)) return false
		if (!container.contains(active) || this.deps.dom.handleAt(active) !== 'control') return false
		// `preventScroll`: the reclaim follows an edit whose own caret has already been revealed,
		// and focusing the host would otherwise scroll its top edge into view instead.
		container.focus({preventScroll: true})
		return true
	}

	/**
	 * DOM TRUTH as anchors (spec S2 D5): what the live window selection says right now,
	 * resolved in the LIVE tree. The `dom*` prefix is the authority marker —
	 * `selection.anchors()` is what the model believes, this is what the DOM says.
	 *
	 * `undefined` for BOTH "no window selection" and "a boundary this layer cannot
	 * resolve", and no caller tells them apart.
	 *
	 * S2.5 REVIEWED the fold against its consumers (`keyboard/input.ts`,
	 * `keyboard/rowKeys.ts`, `ClipboardController`) and kept it: every one of them bails on
	 * both reasons alike, because both mean "the caret's position is unknown". What they DO
	 * need apart is collapsed-ness, and that is an `anchorEquals` comparison on the answer,
	 * not a second `undefined`.
	 */
	domAnchors(): Anchors | undefined {
		const range = this.deps.dom.selection()?.range
		return range ? this.#anchorsIn(range) : undefined
	}

	/** The `anchorFor` reads both DOM-truth reads share; `undefined` if either end declines. */
	#anchorsIn(range: globalThis.Range): Anchors | undefined {
		// ONE READ for a collapsed range, because the ranged pair's opposite affinities exist to
		// make the ENDS of a span lean inward — read twice against a single boundary they answer
		// two NAMES for one position and the pair stops comparing equal. That is not cosmetic:
		// `#applySelection` would take the ranged branch for a caret, where `selectRange`
		// declines any endpoint without a text surface. Reachable since a mark's caret became
		// a container boundary, whose two sides are different nodes ({before: next root} vs
		// {after: the mark}).
		//
		// And `'nearest'` — the collapsed reader is the ONLY caller that passes it. A caret has
		// no inside, so a boundary Chromium put inside a mark's text answers with the edge the
		// click was aimed at rather than always the left one; see {@link BoundaryAffinity}.
		if (range.collapsed) {
			const caret = this.deps.dom.anchorFor(range.startContainer, range.startOffset, 'nearest')
			return caret && {anchor: caret, head: caret}
		}
		// A DOM Range is always document-ordered, and these are the affinities the numeric
		// read used, so `anchor` is the low end and `head` the high one.
		const anchor = this.deps.dom.anchorFor(range.startContainer, range.startOffset, 'after')
		const head = this.deps.dom.anchorFor(range.endContainer, range.endOffset, 'before')
		return anchor && head ? {anchor, head} : undefined
	}

	placeAtHandle(handle: TokenHandle, boundary: 'start' | 'end'): boolean {
		// A dead or unbound handle fails closed; alive() is the mount check.
		if (!handle.alive()) return false
		const node = this.deps.find(handle.id)
		if (!node) return false
		// Re-apply even when the write dedupes: the DOM caret may have moved since.
		if (!this.deps.selection.selectNode(node, boundary)) this.#applySelection()
		return true
	}

	/**
	 * {@link placeAtHandle} for an anchor the caller already resolved, and it carries the same
	 * dedupe rule for the same reason: the caret recovery runs when the DOM caret is somewhere the
	 * STORED anchors never followed it to, so a write that changes nothing still has to be applied.
	 */
	placeAt(anchor: NodeAnchor): void {
		if (!this.deps.selection.select(anchor)) this.#applySelection()
	}

	/**
	 * NOTHING MOVED — the answer for a gesture the editor refuses to read as a caret intent, and
	 * the reason it is a WRITE rather than a return: the browser has already moved its own caret
	 * by the time anyone asks, so leaving the model alone is not leaving the caret alone.
	 *
	 * Two arms, one meaning: the stored caret goes back into the DOM, and a model holding NO caret
	 * takes the browser's out of the document rather than letting it stand somewhere the user never
	 * put it. The second arm is what a click on frozen presentation needs on a page nobody has
	 * typed in yet: Chromium answers a mousedown on a `draggable` island by collapsing the caret to
	 * the START OF THE EDITING HOST — measured with no editor present — and an edit reads the DOM
	 * for its own span, so a caret left standing there types into the document's first row.
	 */
	restoreCaret(): void {
		if (this.deps.selection.anchors()) this.#applySelection()
		else this.deps.dom.releaseCaret()
	}

	#applySelection(): void {
		const anchors = this.deps.selection.anchors()
		if (anchors === undefined) return

		// NO CLAMP (spec S1 §4.6 item 5): an anchor cannot point past its own node, `anchorAt`
		// answers `'end'` for an out-of-range offset, and `TokenHandle.placeCaret` bounds
		// the local offset to the surface it places in. There is nothing left to clamp and
		// nothing to write back.
		//
		// No re-entry flag either: Chromium — the pinned scope — dispatches `selectionchange`
		// on a task, never synchronously from the write, so the sync below cannot observe a
		// half-applied placement. MEASURED across all three write forms (`addRange`,
		// `setBaseAndExtent`, `collapse` under focus).
		//
		// ANCHORS on both arms, and the ranged one no longer detours through the derived
		// numeric `range`: normalizing the pair is DOM-order work the placement owns.
		if (anchorEquals(anchors.anchor, anchors.head)) {
			// AND THE CARET IS FOLLOWED. The browser scrolls the caret into view for edits IT
			// performed; every caret here is written programmatically, so it scrolls nothing —
			// typing at the end of a long page left the caret at y=882 of a 900px viewport with
			// the scroll position untouched, and the next line was typed below the fold. Only on
			// the placement that SUCCEEDED: a declined placement left the caret where it was, and
			// following it there would scroll to a position the model does not believe in.
			if (this.deps.dom.placeCaret(anchors.head)) this.deps.dom.revealCaret()
			return
		}
		// NOT on the ranged arm. A selection that grows is grown by the browser's own keys, which
		// scroll their focus end natively; a select-all would otherwise yank the view to whichever
		// end the pair happens to name.
		this.deps.dom.selectRange(anchors.anchor, anchors.head)
	}

	/**
	 * THE DOM→model direction, and the whole of it: the DOM's own boundaries resolved
	 * straight into anchors in the live tree. No offset is formed anywhere on this path,
	 * so the anchor the DOM produces IS the anchor stored and `anchorEquals` dedupes on
	 * identity.
	 *
	 * That is what retired the numeric-equality guard this used to open with. The guard
	 * existed only because `anchorAt(offsetOf(a)) !== a` at a shared boundary — `anchorAt`
	 * is right-affine, so every deliberately far-side anchor (`{before}`, `{after}`, an
	 * end-of-text offset) came back as a DIFFERENT anchor with the SAME number and dragged
	 * focus onto the neighbouring text node. With no round-trip the premise is gone, and
	 * with it the guard's cost: a caret that MOVES ACROSS a shared boundary without moving
	 * its offset now updates the stored anchor, where the guard suppressed it.
	 *
	 * ONE EXIT, and it LEAVES THE ANCHORS STANDING (spec S2 D4 — `undefined` means "the
	 * DOM cannot be read here", and the next `selectionchange` corrects it). Gated by
	 * `SelectionDriver.spec`'s "a half-outside range leaves the stored anchors standing".
	 * That exit covers a boundary inside a consumer's control or editable island too —
	 * `anchorFor` declines both by construction — so the ON-DEMAND caller inherits the refusal
	 * the listener spells out for itself. Dropping the selection entirely is the `focusout`
	 * clear, not this path.
	 *
	 * ON DEMAND as well as on `selectionchange`, because that event is delivered on a TASK:
	 * between a caret moving and the browser saying so, the stored anchors name where the caret
	 * WAS. An edit arriving in that gap is addressed from the DOM — a `beforeinput` names the
	 * span it is about to change — so whatever else reads the selection for that same edit has
	 * to read the DOM too. `EditController` calls this first for exactly that reason.
	 */
	syncFromDom(): void {
		const anchors = this.domAnchors()
		if (!anchors) return
		this.deps.selection.select(anchors.anchor, anchors.head)
	}

	#trackSelection(container: HTMLElement): void {
		const syncIfInEditor = (node: Node): void => {
			// THE POINTER OUTRANKS THE BROWSER'S ANSWER, and only inside a control root. What the
			// browser answers there is not a position the user aimed at: Chromium either leaves the
			// caret in the frozen node (which is the `'control'` arm below) or — for a `draggable`
			// one — collapses it to the START OF THE EDITING HOST, a perfectly valid anchor in a row
			// the pointer is nowhere near. Both are the same question, so both get the same rule:
			// the row the pointer is IN is the row the caret belongs to.
			const pointer = this.#pointerControl
			this.#pointerControl = undefined
			// FOCUS DECIDES WHOSE GESTURE IT IS, the discriminator {@link reclaimFocus} already
			// reads: the browser hands focus to a control it can operate — a `<select>`, a
			// checkbox, a button — and a caret written into the host would take it straight back.
			if (pointer && document.activeElement === container) {
				this.deps.claimRow(pointer)
				return
			}
			// The container IS the editor, and it owns no token: `handleAt` answers
			// `undefined` for it, which is the "outside" verdict. Its own boundaries are
			// where a caret before or after a top-level mark lives, so they must SYNC.
			if (node === container) {
				this.syncFromDom()
				return
			}
			const at = this.deps.dom.handleAt(node)
			if (at && at !== 'control') {
				this.syncFromDom()
				return
			}
			// A CONTROL ROOT IS `contenteditable="false"`, so the browser's own caret can land in
			// one and the model can name no position there: `anchorFor` declines the boundary by
			// construction. Leaving it standing is what stranded the caret — ArrowDown could not
			// move it and every keystroke after it was dropped with nothing said — so the caret
			// goes to the row that control is painted IN instead.
			//
			// AN INTERACTIVE CONTROL NEVER REACHES HERE, measured rather than assumed: a click on
			// a `<select>`, a checkbox, a `<button>` or a row grip moves FOCUS and leaves the
			// selection exactly where it was, so no `selectionchange` is delivered at all. What
			// does reach here is a click on frozen PRESENTATION — an atomic row's card, table of
			// contents or properties grid — which is the case this claims.
			if (at === 'control') {
				this.deps.claimRow(node)
				return
			}
			this.deps.selection.clear()
		}

		// SET ON THE WAY DOWN, read by the sync the browser's own default provokes — the two are
		// one gesture and there is no other way to correlate them: `selectionchange` carries no
		// pointer. Every `pointerdown` writes this field, so a click on ordinary text clears it.
		listen(container, 'pointerdown', event => {
			const target = event.target
			this.#pointerControl =
				target instanceof Node && this.deps.dom.handleAt(target) === 'control' ? target : undefined
		})
		// AND A KEY ENDS THE GESTURE. A pointer that landed on a FOCUSABLE control provokes no
		// `selectionchange` at all, so the claim above is never consumed; without this the next
		// one — an arrow key, or the caret re-placed after that control's own edit — would be
		// answered with a row the user pointed at several keystrokes ago.
		listen(container, 'keydown', () => {
			this.#pointerControl = undefined
		})

		// AND A CONTROL THAT KEEPS NO KEYBOARD GIVES THE FOCUS BACK WHEN ITS CLICK IS OVER, which is
		// the trigger {@link reclaimFocus} was missing. It ran only after a COMMIT, so the rule
		// reached exactly the controls that write to the document — a to-do's box, a fence's
		// language, a toggle's arrow — and none of the ones that do not. Measured on the showcase,
		// all four registered through `useControlRef`: `'+ Add a property'`, a view tab, a comment
		// thread's `'Reply…'` and the same view bar's actions all took focus on mousedown, wrote
		// nothing, and the next keystroke was lost with nothing on screen to say why.
		//
		// A KEYBOARD OWNER KEEPS IT, and that is the whole discriminator: a `<select>`, an `<input>`,
		// a `<textarea>` and an editable island answer arrow keys and typing of their own, and taking
		// the focus off one on `click` would close the very popup the click opened. Those give it
		// back on their COMMIT, which is the path that already existed.
		//
		// AND ONLY WHERE THERE IS A CARET TO GO BACK TO. "Take the focus back" means "back to the
		// position the user still holds", and with none there is nothing to return to: focusing the
		// host would have Chromium INVENT one at its start, which is {@link DomModel.releaseCaret}'s
		// own measured hazard read at the other end. Measured on `Drag`'s grip — clicked in a field
		// nobody had typed in, the `x` after it landed at the top of the document.
		//
		// It is the LIVE selection that answers, not the stored anchors, and that is measured too:
		// Chromium routes focus through `<body>` on the way from the host to a control inside it, so
		// the `focusout` rule below has already cleared the stored pair by the time this runs. The
		// DOM selection is what a control click leaves standing, which is the whole reason the
		// reclaim exists, and the stored pair heals itself on the next `selectionchange` — every edit
		// path reads DOM truth first anyway. The COMMIT path is not gated at all and is left exactly
		// as it was: an edit has landed there, so the caret it named is the one being returned to.
		//
		// AFTER the consumer's own handler, which is what the microtask is for: a control that moves
		// focus somewhere itself has done so by then, and it is `document.activeElement` — not the
		// element clicked — that this reads.
		listen(container, 'click', () => {
			queueMicrotask(() => {
				if (!this.domAnchors()) return
				const active = document.activeElement
				if (active instanceof Element && active.matches(KEYBOARD_OWNERS)) return
				this.reclaimFocus()
			})
		})

		listen(container, 'focusout', () => {
			queueMicrotask(() => {
				if (!container.contains(document.activeElement)) this.deps.selection.clear()
			})
		})

		listen(document, 'selectionchange', () => {
			const focusNode = this.deps.dom.selection()?.focusNode
			if (!focusNode) return
			syncIfInEditor(focusNode)
		})
	}
}
// packages/core/src/features/selection/SelectionController.ts
import {firstHtmlChild, nodeTarget} from '../../shared/checkers'
import type {Range, RawSelection} from '../../shared/editorContracts'
import {listen, signal, watch} from '../../shared/signals'
import type {Computed, Signal} from '../../shared/signals'
import type {Host} from '../state/Host'
import type {PropsModel} from '../state/PropsModel'
import {anchorEquals, createSelection} from '../tokens'
import type {Anchors, NodeAnchor, TokenHandle, TokenModel, TransactionResult} from '../tokens'

export class SelectionController {
	/** The tree-space half (spec D7): the stored anchors, the derived range, the repair. */
	readonly #state = createSelection({
		offsetOf: anchor => this.tokens.offsetOf(anchor),
		anchorAt: offset => this.tokens.anchorAt(offset),
		value: () => this.tokens.value(),
	})

	readonly range: Computed<Range | undefined> = this.#state.range

	readonly position: Signal<number | undefined> = this.#state.position

	readonly isAllSelected: Computed<boolean> = this.#state.isAllSelected

	readonly isUserSelecting: Signal<boolean> = signal({initial: false})

	#isPlacingCaret = false

	constructor(
		private readonly host: Host,
		private readonly tokens: TokenModel,
		private readonly props: PropsModel
	) {
		host.onMounted(container => {
			this.#focusEmptyEditorOnClick(container)
			this.#trackSelection(container)
			this.#trackUserSelecting(container)

			// The model announces `changed` only after the DOM is consistent (both
			// commit branches), so the caret re-place runs against live surfaces —
			// exactly when the old per-commit index event fired.
			watch(this.tokens.changed, () => this.#applySelection())
			// Editable POLICY stays here (readOnly + user-selection sweep gating);
			// the model owns the application: scoped writes on bound surfaces now,
			// and the seed for surfaces bound later.
			watch(this.props.readOnly, () => this.#applyEditablePolicy())
			watch(this.isUserSelecting, () => this.#applyEditablePolicy())

			// The STORED anchors, not the derived `range` — MEASURED, not stylistic. `range`
			// dedupes on `shallow`, so at a shared boundary `placeAtHandle` changes the anchor
			// without changing the number and a `range` watch NEVER FIRES: the caret is simply
			// not placed (8 assertion failures across react and vue, in the three focus specs;
			// the core suite stays green, so only `pnpm test` sees this one).
			// Separately, `range` also moves when adoption shifts positions, and re-placing on
			// that would fight the DOM after every commit; the post-commit re-place is the
			// `tokens.changed` watch above, which fires only once the DOM is consistent.
			watch(this.#state.stored, () => this.#applySelection())
		})
	}

	#applyEditablePolicy(): void {
		const readOnly = this.props.readOnly()
		const editable = !(readOnly || this.isUserSelecting())
		this.tokens.setEditable({editable, readOnly})
	}

	selectAll(): void {
		this.#state.selectAll()
	}

	/** @internal See {@link Selection.select}. */
	select(anchor: NodeAnchor, head: NodeAnchor = anchor): boolean {
		return this.#state.select(anchor, head)
	}

	/** @internal See {@link Selection.repair} — the `SelectionPort` half `TokenModel` calls. */
	repair(result: TransactionResult): void {
		this.#state.repair(result)
	}

	/** Spec §2.3's `input.selection()`: the STORED anchors (spec D7). */
	anchors(): Anchors | undefined {
		return this.#state.anchors()
	}

	focusFirst(): void {
		const handle = this.tokens.handleOf(this.tokens.current()[0])
		if (handle && this.placeAtHandle(handle, 'start')) return
		this.host.container()?.focus()
	}

	readRaw(): RawSelection | undefined {
		return this.tokens.selection()?.raw
	}

	placeAtHandle(handle: TokenHandle, boundary: 'start' | 'end' = 'start'): boolean {
		// A dead or mid-window handle fails closed; alive() is the mount check.
		if (!handle.alive()) return false
		const node = this.tokens.find(handle.id)
		if (!node) return false
		// Re-apply even when the write dedupes: the DOM caret may have moved since.
		if (!this.#state.selectNode(node, boundary)) this.#applySelection()
		return true
	}

	#applySelection(): void {
		if (this.isUserSelecting()) return
		const anchors = this.#state.anchors()
		if (anchors === undefined) return

		// NO CLAMP (spec §4.6 item 5): an anchor cannot point past its own node, `anchorAt`
		// answers `'end'` for an out-of-range offset, and `TokenHandle.placeCaret` bounds
		// the local offset to the surface it places in. There is nothing left to clamp and
		// nothing to write back.
		this.#isPlacingCaret = true
		try {
			if (anchorEquals(anchors.anchor, anchors.head)) {
				this.#placeAt(anchors.head)
				return
			}
			const range = this.range()
			if (range) this.tokens.selectRange(range.start, range.end)
		} finally {
			this.#isPlacingCaret = false
		}
	}

	/**
	 * Collapsed placement through the anchor's OWN node: the handle places a LOCAL offset
	 * inside its own surface, so it cannot pick the wrong node at a shared boundary and it
	 * never converts to an absolute coordinate (which would resolve against
	 * bind-generation positions, spec D9). The raw fallback covers an anchor whose node
	 * has no bound handle yet — the latch-gated `handle(id)` serves `undefined` during the
	 * pending window, exactly as the old stash did.
	 */
	#placeAt(anchor: NodeAnchor): void {
		const target = anchorTarget(anchor)
		if (target) {
			const handle = this.tokens.handle(target.id)
			if (handle?.alive() && handle.placeCaret(target.offset)) return
		}
		this.tokens.placeCaret(this.tokens.offsetOf(anchor))
	}

	#focusEmptyEditorOnClick(container: HTMLElement): void {
		listen(container, 'click', () => {
			// The fresh reconciled tree: after typing into the single empty text
			// token, tokens() tracks value.current() (renderTree keeps its stale
			// reference — reading it would steal focus into a non-empty editor).
			const tokens = this.tokens.current()
			if (tokens.length === 1 && tokens[0].type === 'text' && tokens[0].content === '') {
				firstHtmlChild(container)?.focus()
			}
		})
	}

	#trackUserSelecting(container: HTMLElement): void {
		let pressedAt: Node | null = null

		listen(document, 'mousedown', e => {
			pressedAt = nodeTarget(e)
		})

		listen(document, 'mousemove', e => {
			if (pressedAt === null) return
			const startedOutsideEditor = !container.contains(pressedAt)
			const sweepingAcrossNodes = pressedAt !== e.target
			const selectionIntersectsEditor = this.tokens.selection()?.intersects(container) ?? false
			if ((startedOutsideEditor || sweepingAcrossNodes) && selectionIntersectsEditor) {
				this.isUserSelecting(true)
			}
		})

		const clearIfCollapsed = (): void => {
			if (!this.isUserSelecting()) return
			// No selection (undefined) is treated like collapsed, matching the raw `!sel || sel.isCollapsed`.
			if (this.tokens.selection()?.anchor.isCollapsed !== false) this.isUserSelecting(false)
		}

		listen(document, 'mouseup', () => {
			pressedAt = null
			clearIfCollapsed()
		})

		listen(document, 'selectionchange', clearIfCollapsed)
	}

	#trackSelection(container: HTMLElement): void {
		const sync = (): void => {
			const raw = this.readRaw()?.range
			// GUARD, and it is load-bearing (measured): the DOM→anchor round-trip is NOT
			// idempotent. `readRaw` answers an absolute offset; `anchorAt` is right-affine, so
			// it re-resolves a shared boundary onto the LAST node containing that offset. An
			// anchor deliberately placed on the OTHER side — every `{before}`, every `{after}`,
			// every end-of-text anchor `placeAtHandle` stores — therefore comes back as a
			// DIFFERENT anchor with the SAME number. Without this guard `anchorEquals` says
			// "changed", the `#anchors` watch fires, and the async `selectionchange` drags
			// focus back onto the neighbouring text node. Rewriting only when the NUMBER moved
			// keeps the DOM as the authority for user-driven selection while leaving a
			// programmatic anchor that already agrees with the DOM alone.
			const current = this.range()
			if (raw && current && current.start === raw.start && current.end === raw.end) return
			// STILL a round-trip through absolute offsets: `readRaw` resolves the DOM against
			// BIND-GENERATION positions (spec D9) while `anchorAt` resolves against live ones,
			// so during the adopt→bind window the two spaces can disagree. Improving that means
			// a DOM-node→TreeNode path through `handleAt`, which would have to re-implement
			// `boundaryFor`'s container/child-sequence/mark cases. Out of scope here; recorded
			// so it is a decision, not an oversight.
			//
			// THE ONE RECORDED GAP of the S1.6c hardening pass, and it is ungatable rather
			// than merely ungated: the pending window is exactly when no bound surface answers,
			// so a test can neither observe the disagreement nor construct it. The guard above
			// — the round-trip's NON-IDEMPOTENCE — is a different claim and is gated, by the
			// 8 browser assertions it names.
			this.#state.stored(
				raw ? {anchor: this.tokens.anchorAt(raw.start), head: this.tokens.anchorAt(raw.end)} : undefined
			)
		}

		const syncIfInEditor = (node: Node): void => {
			const at = this.tokens.handleAt(node)
			if (at && at !== 'control') {
				sync()
				return
			}
			if (at === 'control') return
			this.#state.stored(undefined)
		}

		listen(container, 'focusin', e => {
			if (this.#isPlacingCaret) return
			const target = e.target instanceof HTMLElement ? e.target : undefined
			if (!target) {
				this.#state.stored(undefined)
				return
			}
			syncIfInEditor(target)
		})

		listen(container, 'focusout', () => {
			queueMicrotask(() => {
				if (!container.contains(document.activeElement)) this.#state.stored(undefined)
			})
		})

		listen(document, 'selectionchange', () => {
			if (this.#isPlacingCaret) return
			const focusNode = this.tokens.selection()?.focusNode
			if (!focusNode) return
			syncIfInEditor(focusNode)
		})
	}
}

/** Id and local offset of an anchor's own node; undefined for the document edges. */
function anchorTarget(anchor: NodeAnchor): {id: number; offset: number} | undefined {
	if (typeof anchor === 'string') return undefined
	if ('node' in anchor) return {id: anchor.node.id, offset: anchor.offset}
	if ('before' in anchor) return {id: anchor.before.id, offset: 0}
	return {id: anchor.after.id, offset: Infinity}
}
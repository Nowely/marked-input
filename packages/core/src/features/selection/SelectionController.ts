// packages/core/src/features/selection/SelectionController.ts
import {firstHtmlChild, nodeTarget} from '../../shared/checkers'
import type {Range, RawSelection} from '../../shared/editorContracts'
import {computed, listen, signal, watch} from '../../shared/signals'
import type {Computed, Signal} from '../../shared/signals'
import {shallow} from '../../shared/utils/shallow'
import type {Host} from '../state/Host'
import type {PropsModel} from '../state/PropsModel'
import type {ValueModel} from '../state/ValueModel'
import {anchorEquals} from '../tokens'
import type {NodeAnchor, TokenHandle, TokenModel, TransactionResult} from '../tokens'

type Anchors = {anchor: NodeAnchor; head: NodeAnchor}

export class SelectionController {
	/**
	 * THE stored selection (spec D7/G4): node anchors, not offsets. Equality is anchor
	 * IDENTITY — the DOM sync rebuilds anchors on every `selectionchange`, so without it
	 * a mouse sweep would re-enter placement on every tick (the job today's
	 * `{equals: shallow}` on the numeric range did).
	 *
	 * Its gate is `SelectionController.spec`'s "repeated selectAll applies to the DOM
	 * once" — measured, and it has to be a RANGED selection: `range` keeps
	 * `{equals: shallow}` whatever this does, so a notification count cannot see the
	 * difference, and the collapsed path is masked by {@link placeAtHandle}'s re-apply
	 * branch. Dropping the equality fails that one case and nothing else in the repo.
	 */
	readonly #anchors: Signal<Anchors | undefined> = signal<Anchors>({
		equals: (a, b) => anchorEquals(a?.anchor, b?.anchor) && anchorEquals(a?.head, b?.head),
	})

	/**
	 * Bumped once per adoption by {@link repair}, its only writer. Stored positions are
	 * plain fields (spec D3), so nothing else can invalidate a derived offset when
	 * adoption shifts them — and an anchor that survives an edit UNCHANGED (AC-3.2) must
	 * still resolve to its new absolute offset. This is the only reason {@link range} is
	 * not a pure computed over `#anchors`.
	 *
	 * Exactly ONE case can gate it, by construction — `SelectionController.spec`'s "keeps
	 * node and offset when the edit is outside the anchor…". Every other repair case
	 * changes the anchor as well, so the `#anchors` write notifies on its own.
	 */
	readonly #generation: Signal<number> = signal({initial: 0})

	/**
	 * DERIVED (spec D7): the numeric range every offset-speaking consumer still reads —
	 * {@link isAllSelected}, `OverlayController`'s trigger probe, the boundary's
	 * pre-adoption capture. Read-only: the stored form is `#anchors`, and
	 * {@link select}/{@link position} are the writes.
	 */
	readonly range: Computed<Range | undefined> = computed(
		() => {
			this.#generation()
			const anchors = this.#anchors()
			if (!anchors) return undefined
			const anchor = this.tokens.offsetOf(anchors.anchor)
			const head = this.tokens.offsetOf(anchors.head)
			return anchor <= head ? {start: anchor, end: head} : {start: head, end: anchor}
		},
		{equals: shallow}
	)

	readonly position = computed({
		get: () => this.range()?.start,
		set: value => {
			// The undefined arm is unreachable: a writable computed short-circuits an
			// `undefined` write before the setter runs (`shared/signals/signal.ts`'s
			// `writableComputedOper`), which is why the pre-anchor version's clear branch was
			// dead. Kept as a type narrow only.
			if (value !== undefined) this.select(this.tokens.anchorAt(value))
		},
	})

	readonly isAllSelected: Computed<boolean> = computed(() => {
		const s = this.range()
		const v = this.value.current()
		return s?.start === 0 && s.end === v.length && v.length > 0
	})

	readonly isUserSelecting: Signal<boolean> = signal({initial: false})

	#isPlacingCaret = false

	constructor(
		private readonly host: Host,
		private readonly tokens: TokenModel,
		private readonly value: ValueModel,
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
			watch(this.#anchors, () => this.#applySelection())
		})
	}

	#applyEditablePolicy(): void {
		const readOnly = this.props.readOnly()
		const editable = !(readOnly || this.isUserSelecting())
		this.tokens.setEditable({editable, readOnly})
	}

	selectAll(): void {
		// Node anchors, not the `'start'`/`'end'` edges: a later edit that grows the value
		// must NOT keep `isAllSelected` true, and edge anchors would.
		this.select(this.tokens.anchorAt(0), this.tokens.anchorAt(this.value.current().length))
	}

	/**
	 * @internal THE write (spec D7's stored form). {@link selectAll}, {@link position},
	 * {@link placeAtHandle} and the DOM sync all go through it; S1.7 promotes it to
	 * §2.3's `input.select`. Returns whether the stored selection actually changed.
	 */
	select(anchor: NodeAnchor, head: NodeAnchor = anchor): boolean {
		return this.#anchors({anchor, head})
	}

	/**
	 * @internal Post-adoption caret repair (spec D7, §4.5). Called by the token layer
	 * inside the commit, after the pipeline applied — never by anything else. Together
	 * with {@link range} this is the `SelectionPort` `TokenModel` is constructed with.
	 *
	 * The anchor can never dangle: `selectionBefore` is DERIVED from these same anchors
	 * (the capture thunk is this controller's `range`), so it is defined exactly when they
	 * are, and every adoption that could remove an anchor's node re-derives it here.
	 * `map` resolves against the post-adoption roots and is property-proven never to
	 * answer with a dead node (`tree/adopt.property.spec.ts`).
	 */
	repair(result: TransactionResult): void {
		// Unconditional: positions move whether or not there is a selection, and `range`
		// derives from fields no signal covers (spec D3).
		this.#generation(this.#generation() + 1)
		const before = result.selectionBefore
		if (!before) return
		this.select(result.map(before.start), result.map(before.end))
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
		// The NODE is the disambiguator two tokens sharing a boundary offset need — the job
		// the consume-once `#preferredHandle` stash did (spec §4.6 item 5). A mark has no
		// anchorable interior (spec §2.3), so it answers with its own boundary.
		//
		// Re-resolving the number instead (`tokens.anchorAt(node.position.start)`) is what
		// this replaces, and it is gated twice over: `SelectionController.spec`'s "places at
		// a mark whose start equals the previous text node end…" plus the same 8 browser
		// assertions the `#anchors` watch above names.
		const anchor: NodeAnchor =
			node.kind === 'text'
				? // The length comes from `position`, not `text()`: that is the coordinate space
					// the anchor resolves in, and reading the signal would add a dependency.
					{node, offset: boundary === 'end' ? node.position.end - node.position.start : 0}
				: boundary === 'end'
					? {after: node}
					: {before: node}
		// Re-apply even when the write dedupes: the DOM caret may have moved since.
		if (!this.select(anchor)) this.#applySelection()
		return true
	}

	#applySelection(): void {
		if (this.isUserSelecting()) return
		const anchors = this.#anchors()
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
	#placeAt(anchor: NodeAnchor): boolean {
		const target = anchorTarget(anchor)
		if (target) {
			const handle = this.tokens.handle(target.id)
			if (handle?.alive() && handle.placeCaret(target.offset)) return true
		}
		return this.tokens.placeCaret(this.tokens.offsetOf(anchor))
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
			this.#anchors(
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
			this.#anchors(undefined)
		}

		listen(container, 'focusin', e => {
			if (this.#isPlacingCaret) return
			const target = e.target instanceof HTMLElement ? e.target : undefined
			if (!target) {
				this.#anchors(undefined)
				return
			}
			syncIfInEditor(target)
		})

		listen(container, 'focusout', () => {
			queueMicrotask(() => {
				if (!container.contains(document.activeElement)) this.#anchors(undefined)
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
// packages/core/src/features/selection/SelectionController.ts
import {firstHtmlChild, nodeTarget} from '../../shared/checkers'
import type {Range, RawSelection, TokenAddress} from '../../shared/editorContracts'
import {computed, listen, signal, watch} from '../../shared/signals'
import type {Computed, Signal} from '../../shared/signals'
import {shallow} from '../../shared/utils/shallow'
import type {Host} from '../state/Host'
import type {PropsModel} from '../state/PropsModel'
import type {ValueModel} from '../state/ValueModel'
import type {TokenModel} from '../tokens'
import {freshTokens} from '../tokens'

export class SelectionController {
	readonly range: Signal<Range | undefined> = signal<Range>({equals: shallow})
	readonly position = computed({
		get: () => this.range()?.start,
		set: value => this.range(value !== undefined ? {start: value, end: value} : undefined),
	})

	readonly isAllSelected: Computed<boolean> = computed(() => {
		const s = this.range()
		const v = this.value.current()
		return s?.start === 0 && s.end === v.length && v.length > 0
	})

	readonly isUserSelecting: Signal<boolean> = signal({initial: false})

	#isPlacingCaret = false
	#preferredAddress: TokenAddress | undefined

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
			watch(this.tokens.changed, () => this.#applyRange())
			// Editable POLICY stays here (readOnly + user-selection sweep gating);
			// the model owns the application: scoped writes on bound surfaces now,
			// and the seed for surfaces bound later.
			watch(this.props.readOnly, () => this.#applyEditablePolicy())
			watch(this.isUserSelecting, () => this.#applyEditablePolicy())

			watch(this.range, () => this.#applyRange())
		})
	}

	#applyEditablePolicy(): void {
		const readOnly = this.props.readOnly()
		const editable = !(readOnly || this.isUserSelecting())
		this.tokens.setEditable({editable, readOnly})
	}

	selectAll(): void {
		this.range({start: 0, end: this.value.current().length})
	}

	focusFirst(): void {
		const first = this.tokens.tree().at(0)
		if (first && this.placeAtAddress({path: [0], token: first}, 'start')) return
		this.host.container()?.focus()
	}

	readRaw(): RawSelection | undefined {
		return this.tokens.readSelection()
	}

	placeAtAddress(address: TokenAddress, boundary: 'start' | 'end' = 'start'): boolean {
		const resolved = this.#resolveAddress(address, boundary)
		if (!resolved) return false
		if (!this.range(resolved)) this.#applyRange()
		return true
	}

	#applyRange(): void {
		if (this.isUserSelecting()) return
		const range = this.range()
		if (range === undefined) return

		const maxPos = this.value.current().length
		const clamped: Range = {
			start: Math.min(range.start, maxPos),
			end: Math.min(range.end, maxPos),
		}

		this.#isPlacingCaret = true
		let placed: boolean
		try {
			placed = clamped.start === clamped.end ? this.#placeCollapsed(clamped.start) : this.#placeExtended(clamped)
		} finally {
			this.#isPlacingCaret = false
		}
		if (!placed) return

		if (clamped.start !== range.start || clamped.end !== range.end) {
			this.range(clamped)
		}
	}

	#resolveAddress(address: TokenAddress, boundary: 'start' | 'end'): Range | undefined {
		// Mount-check via the bound layer, identity via the id bridge: a stale
		// tree() token resolves to its live handle, a replaced or foreign one
		// fails closed (handleOf is also latch-gated through structural windows).
		const handle = this.tokens.handleFor(address)
		if (!handle || this.tokens.handleOf(address.token) !== handle) return undefined
		const position = handle.token().position
		const pos = boundary === 'end' ? position.end : position.start
		this.#preferredAddress = address
		return {start: pos, end: pos}
	}

	#applyPreferredAddress(rawPosition: number): boolean {
		const address = this.#preferredAddress
		this.#preferredAddress = undefined
		if (!address) return false
		const handle = this.tokens.handleFor(address)
		if (!handle || this.tokens.handleOf(address.token) !== handle) return false
		return this.tokens.placeCaret({address, offset: rawPosition - handle.token().position.start})
	}

	#placeCollapsed(rawPosition: number): boolean {
		if (this.#applyPreferredAddress(rawPosition)) return true
		return this.tokens.placeCaret(rawPosition)
	}

	#placeExtended(range: Range): boolean {
		return this.tokens.selectRange(range.start, range.end)
	}

	#focusEmptyEditorOnClick(container: HTMLElement): void {
		listen(container, 'click', () => {
			// freshTokens, not tree(): after typing into the single empty text
			// token the tree keeps its reference (text path) — the stale ''
			// content would steal focus on every click into a non-empty editor.
			const tokens = freshTokens(this.tokens)
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
			const selectionIntersectsEditor = this.tokens.selectionIntersects(container)
			if ((startedOutsideEditor || sweepingAcrossNodes) && selectionIntersectsEditor) {
				this.isUserSelecting(true)
			}
		})

		const clearIfCollapsed = (): void => {
			if (!this.isUserSelecting()) return
			// No selection (undefined) is treated like collapsed, matching the raw `!sel || sel.isCollapsed`.
			if (this.tokens.isSelectionCollapsed() !== false) this.isUserSelecting(false)
		}

		listen(document, 'mouseup', () => {
			pressedAt = null
			clearIfCollapsed()
		})

		listen(document, 'selectionchange', clearIfCollapsed)
	}

	#trackSelection(container: HTMLElement): void {
		const sync = (): void => {
			this.range(this.readRaw()?.range)
		}

		const syncIfInEditor = (node: Node): void => {
			const at = this.tokens.handleAt(node)
			if (at && at !== 'control') {
				sync()
				return
			}
			if (at === 'control') return
			this.range(undefined)
		}

		listen(container, 'focusin', e => {
			if (this.#isPlacingCaret) return
			const target = e.target instanceof HTMLElement ? e.target : undefined
			if (!target) {
				this.range(undefined)
				return
			}
			syncIfInEditor(target)
		})

		listen(container, 'focusout', () => {
			queueMicrotask(() => {
				if (!container.contains(document.activeElement)) this.range(undefined)
			})
		})

		listen(document, 'selectionchange', () => {
			if (this.#isPlacingCaret) return
			const focusNode = this.tokens.selectionFocusNode()
			if (!focusNode) return
			syncIfInEditor(focusNode)
		})
	}
}
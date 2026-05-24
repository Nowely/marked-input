// packages/core/src/features/selection/SelectionController.ts
import type {BoundaryPositionResult, Range, RawSelectionResult, TokenAddress} from '../../shared/editorContracts'
import {computed, signal, watch} from '../../shared/signals'
import type {Computed, Signal} from '../../shared/signals'
import {shallow} from '../../shared/utils/shallow'
import type {DomTokenBridge} from '../bridge'
import type {TokenModel} from '../parsing/TokenModel'
import type {Host} from '../state/Host'
import type {PropsModel} from '../state/PropsModel'
import type {ValueModel} from '../state/ValueModel'
import {DomSelectionBridge} from './DomSelectionBridge'
import type {SelectionBridgeAttachDeps} from './DomSelectionBridge'

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

	readonly isUserSelecting: Signal<boolean> = signal<boolean>({initial: false})

	readonly #bridge: DomSelectionBridge
	#isPlacingCaret = false
	#deps: SelectionBridgeAttachDeps | undefined

	constructor(
		private readonly host: Host,
		private readonly bridge: DomTokenBridge,
		private readonly tokens: TokenModel,
		private readonly value: ValueModel,
		private readonly props: PropsModel
	) {
		this.#bridge = new DomSelectionBridge(this.bridge, this.tokens, this.value, this.host)

		host.onMounted(container => {
			const deps: SelectionBridgeAttachDeps = {
				onRangeRead: range => this.range(range),
				isUserSelecting: this.isUserSelecting,
				isPlacingCaret: () => this.#isPlacingCaret,
			}
			this.#deps = deps
			this.#bridge.attach(container, deps)

			watch(this.range, () => this.#applyRange())
			watch(bridge.indexed, () => this.#applyRange())
			watch(this.isUserSelecting, () => bridge.setSelecting(this.isUserSelecting()))
		})
	}

	selectAll(): void {
		this.range({start: 0, end: this.value.current().length})
	}

	focusFirst(): void {
		const firstAddress = this.tokens.index().addressFor([0])
		if (firstAddress && this.placeAtAddress(firstAddress, 'start')) return
		this.host.container()?.focus()
	}

	placeAtAddress(address: TokenAddress, boundary: 'start' | 'end' = 'start'): boolean {
		const resolved = this.#bridge.resolveAddress(address, boundary)
		if (!resolved) return false
		// When pos equals the prior range, the signal's shallow-equals dedupe
		// suppresses the watch effect, leaving the preferred-address hint
		// unconsumed. Apply directly in that case.
		if (!this.range(resolved)) this.#applyRange()
		return true
	}

	readRaw(): RawSelectionResult {
		return this.#bridge.readRaw()
	}

	rawPositionFromBoundary(
		node: Node,
		offset: number,
		affinity: 'before' | 'after' = 'after'
	): BoundaryPositionResult {
		return this.#bridge.rawPositionFromBoundary(node, offset, affinity)
	}

	readSelectedContent(): {html: string; text: string} | undefined {
		return this.#bridge.readSelectedContent()
	}

	#applyRange(): void {
		if (!this.#deps) return
		this.#isPlacingCaret = true
		try {
			this.#bridge.applyRange(this.range(), this.#deps)
		} finally {
			this.#isPlacingCaret = false
		}
	}
}
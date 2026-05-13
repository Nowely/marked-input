import {firstHtmlChild} from '../../shared/checkers'
import type {
	BoundaryPositionResult,
	DomIndex,
	DomRef,
	NodeLocationResult,
	Range,
	RawSelectionResult,
	Result,
	TokenAddress,
	TokenPath,
} from '../../shared/editorContracts'
import {computed, event, listen, signal} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {Lifecycle} from '../lifecycle/Lifecycle'
import type {ParseController} from '../parsing/ParseController'
import {pathKey} from '../parsing/tokenIndex'
import type {PropsModel} from '../props/PropsModel'
import type {ValueModel} from '../value/ValueModel'
import {DomBoundary} from './DomBoundary'
import type {DomBoundaryHost} from './DomBoundary'
import {DomCaretPlacer} from './DomCaretPlacer'
import type {DomCaretHost} from './DomCaretPlacer'
import {DomIndexer} from './DomIndexer'
import type {ChildSequenceRegistration, ControlRegistration, DomIndexerHost} from './DomIndexer'

export class DomModel {
	readonly container = signal<HTMLElement | null>(null)
	readonly indexed = event<void>()
	readonly readOnly: Computed<boolean> = computed(() => this.props.readOnly())

	readonly #pendingControls = new Map<string, ControlRegistration>()
	readonly #pendingChildSequences = new Map<string, ChildSequenceRegistration>()
	#nextControlId = 0
	#nextChildSequenceId = 0
	#isComposing = false

	readonly #indexer: DomIndexer
	readonly #boundary: DomBoundary
	readonly #caret: DomCaretPlacer
	readonly index: Computed<DomIndex | undefined>

	constructor(
		private readonly lifecycle: Lifecycle,
		private readonly props: PropsModel,
		private readonly parsing: ParseController,
		private readonly value: ValueModel
	) {
		const indexerHost: DomIndexerHost = {
			container: () => this.container(),
			pendingControls: () => this.#pendingControls.values(),
			pendingChildSequences: () => this.#pendingChildSequences.values(),
			emitIndexed: () => this.indexed(),
		}
		this.#indexer = new DomIndexer(indexerHost, lifecycle, props, parsing)
		this.index = this.#indexer.index

		const boundaryHost: DomBoundaryHost = {
			container: () => this.container(),
			isIndexed: () => this.index() !== undefined,
			isComposing: () => this.#isComposing,
			locateNode: node => this.#indexer.locateNode(node),
			roleFor: element => this.#indexer.roleFor(element),
			pathElementsFor: address => this.#indexer.pathElementsFor(address),
		}
		this.#boundary = new DomBoundary(boundaryHost, parsing)

		const caretHost: DomCaretHost = {
			isIndexed: () => this.index() !== undefined,
			pathElements: () => this.#indexer.pathElements(),
			pathElementsFor: address => this.#indexer.pathElementsFor(address),
		}
		this.#caret = new DomCaretPlacer(caretHost, parsing, value)

		lifecycle.onMounted(() => {
			const container = this.container()
			if (container) {
				listen(container, 'click', () => {
					const tokens = this.parsing.tokens()
					if (tokens.length === 1 && tokens[0].type === 'text' && tokens[0].content === '') {
						const c = this.container()
						const element = c ? firstHtmlChild(c) : null
						element?.focus()
					}
				})
			}
		})
	}

	compositionStarted(): void {
		this.#isComposing = true
	}

	compositionEnded(): void {
		if (!this.#isComposing) return
		this.#isComposing = false
	}

	controlFor(ownerPath?: TokenPath): DomRef {
		const key = `control:${ownerPath ? pathKey(ownerPath) : 'global'}:${++this.#nextControlId}`

		const callback: DomRef = element => {
			if (element) {
				this.#pendingControls.set(key, {ownerPath: ownerPath ? [...ownerPath] : undefined, element})
			} else {
				this.#pendingControls.delete(key)
			}
		}
		return callback
	}

	childrenFor(ownerPath: TokenPath): DomRef {
		const key = `children:${pathKey(ownerPath)}:${++this.#nextChildSequenceId}`

		const callback: DomRef = element => {
			if (element) {
				this.#pendingChildSequences.set(key, {ownerPath: [...ownerPath], element})
			} else {
				this.#pendingChildSequences.delete(key)
			}
		}
		return callback
	}

	reconcile(opts?: {isUserSelecting?: boolean}): void {
		this.#indexer.reconcile(opts)
	}

	locateNode(node: Node): NodeLocationResult {
		return this.#indexer.locateNode(node)
	}

	placeAt(
		rawPosition: number,
		affinity: 'before' | 'after' = 'after'
	): Result<{applied: number}, 'notIndexed' | 'invalidBoundary'> {
		return this.#caret.placeAt(rawPosition, affinity)
	}

	placeRange(range: Range): Result<{applied: Range}, 'notIndexed' | 'invalidBoundary'> {
		return this.#caret.placeRange(range)
	}

	focusAddress(address: TokenAddress, boundary: 'start' | 'end' = 'start'): Result<void, 'notIndexed' | 'stale'> {
		return this.#caret.focusAddress(address, boundary)
	}

	rawPositionFromBoundary(
		node: Node,
		offset: number,
		affinity: 'before' | 'after' = 'after'
	): BoundaryPositionResult {
		return this.#boundary.fromBoundary(node, offset, affinity)
	}

	readRawSelection(): RawSelectionResult {
		return this.#boundary.readSelection()
	}
}
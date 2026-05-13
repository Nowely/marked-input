import type {
	BoundaryPositionResult,
	DomIndex,
	DomRef,
	NodeLocationResult,
	RawSelectionResult,
	TokenAddress,
	TokenPath,
} from '../../shared/editorContracts'
import {event, signal} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {Lifecycle} from '../lifecycle/Lifecycle'
import type {ParseController} from '../parsing/ParseController'
import type {PropsModel} from '../props/PropsModel'
import {DomBoundary} from './DomBoundary'
import type {DomBoundaryHost} from './DomBoundary'
import {DomIndexer} from './DomIndexer'
import type {ChildSequenceRegistration, ControlRegistration, DomIndexerHost, PathElements} from './DomIndexer'

export class DomModel {
	readonly container = signal<HTMLElement | null>(null)
	readonly indexed = event<void>()
	readonly isUserSelecting = signal<boolean>(false)

	readonly #pendingControls = new Map<string, ControlRegistration>()
	readonly #pendingChildSequences = new Map<string, ChildSequenceRegistration>()
	#nextControlId = 0
	#nextChildSequenceId = 0
	#isComposing = false

	readonly #indexer: DomIndexer
	readonly #boundary: DomBoundary
	readonly index: Computed<DomIndex | undefined>

	constructor(lifecycle: Lifecycle, props: PropsModel, parsing: ParseController) {
		const indexerHost: DomIndexerHost = {
			container: () => this.container(),
			pendingControls: () => this.#pendingControls.values(),
			pendingChildSequences: () => this.#pendingChildSequences.values(),
			emitIndexed: () => this.indexed(),
			isUserSelecting: this.isUserSelecting,
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
	}

	compositionStarted(): void {
		this.#isComposing = true
	}

	compositionEnded(): void {
		this.#isComposing = false
	}

	controlFor(ownerPath?: TokenPath): DomRef {
		const key = `control:${++this.#nextControlId}`

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
		const key = `children:${++this.#nextChildSequenceId}`

		const callback: DomRef = element => {
			if (element) {
				this.#pendingChildSequences.set(key, {ownerPath: [...ownerPath], element})
			} else {
				this.#pendingChildSequences.delete(key)
			}
		}
		return callback
	}

	reconcile(): void {
		this.#indexer.reconcile()
	}

	locateNode(node: Node): NodeLocationResult {
		return this.#indexer.locateNode(node)
	}

	pathElements(): IterableIterator<PathElements> {
		return this.#indexer.pathElements()
	}

	pathElementsFor(address: TokenAddress): PathElements | undefined {
		return this.#indexer.pathElementsFor(address)
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
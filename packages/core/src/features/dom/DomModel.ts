import type {
	BoundaryPositionResult,
	DomRef,
	NodeLocationResult,
	RawSelectionResult,
	TokenAddress,
	TokenPath,
} from '../../shared/editorContracts'
import {event, signal} from '../../shared/signals/index.js'
import type {Signal} from '../../shared/signals/index.js'
import type {TokenModel} from '../parsing/TokenModel'
import type {Lifecycle} from '../state/Lifecycle'
import type {PropsModel} from '../state/PropsModel'
import {DomBoundary} from './DomBoundary'
import type {DomBoundaryHost} from './DomBoundary'
import {DomIndexer} from './DomIndexer'
import type {ChildSequenceRegistration, ControlRegistration, DomIndexerHost, PathElements} from './DomIndexer'

export class DomModel {
	readonly container = signal<HTMLElement | null>({initial: null})
	readonly indexed = event<void>()
	readonly isUserSelecting = signal<boolean>({initial: false})

	readonly #pendingControls = new Map<string, ControlRegistration>()
	readonly #pendingChildSequences = new Map<string, ChildSequenceRegistration>()
	#nextControlId = 0
	#nextChildSequenceId = 0
	#isComposing = false

	readonly #indexer: DomIndexer
	readonly #boundary: DomBoundary
	readonly isIndexed: Signal<boolean>

	constructor(lifecycle: Lifecycle, props: PropsModel, tokens: TokenModel) {
		const indexerHost: DomIndexerHost = {
			container: () => this.container(),
			pendingControls: () => this.#pendingControls.values(),
			pendingChildSequences: () => this.#pendingChildSequences.values(),
			emitIndexed: () => this.indexed(),
			isUserSelecting: this.isUserSelecting,
		}
		this.#indexer = new DomIndexer(indexerHost, lifecycle, props, tokens)
		this.isIndexed = this.#indexer.isIndexed

		const boundaryHost: DomBoundaryHost = {
			container: () => this.container(),
			isIndexed: () => this.isIndexed(),
			isComposing: () => this.#isComposing,
			locateNode: node => this.#indexer.locateNode(node),
			roleFor: element => this.#indexer.roleFor(element),
			pathElementsFor: address => this.#indexer.pathElementsFor(address),
		}
		this.#boundary = new DomBoundary(boundaryHost, tokens)
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

	readSelectedContent(): {html: string; text: string} | undefined {
		const sel = window.getSelection()
		const range = sel?.rangeCount ? sel.getRangeAt(0) : undefined
		if (!range) return undefined
		const fragment = range.cloneContents()
		const div = document.createElement('div')
		div.appendChild(fragment)
		return {html: div.innerHTML, text: range.toString()}
	}
}
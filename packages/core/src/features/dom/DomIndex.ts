import type {TokenAddress} from '../../shared/editorContracts'
import {event, watch} from '../../shared/signals/index.js'
import type {Event} from '../../shared/signals/index.js'
import {pathKey} from '../parsing/tokenIndex'
import type {TokenModel} from '../parsing/TokenModel'
import type {Host} from '../state/Host'
import {buildIndex} from './buildIndex'
import type {TokenRefs} from './TokenRefs'
import type {Lookup, TokenNode} from './types'

export class DomIndex {
	readonly indexed: Event<void> = event<void>()

	#byPath: ReadonlyMap<string, TokenNode> = new Map()
	#byElement: WeakMap<HTMLElement, TokenNode> = new WeakMap()
	#controlRoots: WeakSet<HTMLElement> = new WeakSet()
	#composing = false
	#committing = false

	constructor(
		private readonly host: Host,
		private readonly tokens: TokenModel,
		private readonly refs: TokenRefs,
		private readonly layout: {isBlock: () => boolean}
	) {
		host.onMounted(() => {
			watch(host.rendered, () => this.#commit(), {immediate: true})
		})
	}

	locate(node: Node): Lookup | undefined {
		const container = this.host.container()
		if (!container) return undefined

		let current: Node | null = node
		while (current && current !== container) {
			if (current instanceof HTMLElement) {
				const tokenNode = this.#byElement.get(current)
				if (tokenNode) return {kind: 'token', node: tokenNode, element: current}
				if (this.#controlRoots.has(current)) return {kind: 'control'}
			}
			current = current.parentNode
		}
		return undefined
	}

	nodeFor(address: TokenAddress): TokenNode | undefined {
		return this.#byPath.get(pathKey(address.path))
	}

	nodes(): IterableIterator<TokenNode> {
		return this.#byPath.values()
	}

	compositionStarted(): void {
		this.#composing = true
	}

	compositionEnded(): void {
		this.#composing = false
	}

	isComposing(): boolean {
		return this.#composing
	}

	#commit(): void {
		if (this.#committing) throw new Error('DomIndex re-entry')
		const container = this.host.container()
		if (!container) return
		this.#committing = true
		try {
			const tokens = this.tokens.current()
			const tokenIndex = this.tokens.index()
			const result = buildIndex({
				container,
				tokens,
				addressFor: path => tokenIndex.addressFor(path),
				controlElements: this.refs.controlElements(),
				childSequenceHostsFor: path => this.refs.childSequenceHostsFor(path),
				isBlock: this.layout.isBlock(),
			})

			this.#byPath = result.byPath
			this.#byElement = result.byElement
			this.#controlRoots = result.controlRoots

			this.indexed()
		} finally {
			this.#committing = false
		}
	}
}
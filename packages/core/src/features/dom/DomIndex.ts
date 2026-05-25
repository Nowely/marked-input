import type {TokenAddress, TokenPath} from '../../shared/editorContracts'
import {batch, event, signal, watch} from '../../shared/signals/index.js'
import type {Event, Signal} from '../../shared/signals/index.js'
import type {Token} from '../parsing/parser/types'
import {pathKey} from '../parsing/tokenIndex'
import type {TokenModel} from '../parsing/TokenModel'
import type {Host} from '../state/Host'
import {buildIndex} from './buildIndex'
import type {TokenRefs} from './TokenRefs'
import type {Lookup, TokenNode} from './types'

export class DomIndex {
	readonly indexed: Event<void> = event<void>()
	readonly isIndexed: Signal<boolean>

	readonly #isIndexed = signal({initial: false, readonly: true})
	#byPath: ReadonlyMap<string, TokenNode> = new Map()
	#byElement: WeakMap<HTMLElement, TokenNode> = new WeakMap()
	#controlRoots: WeakSet<HTMLElement> = new WeakSet()
	#composing = false
	#rendering = false
	#queuedRender = false

	constructor(
		private readonly host: Host,
		private readonly tokens: TokenModel,
		private readonly refs: TokenRefs,
		private readonly layout: {isBlock: () => boolean}
	) {
		this.isIndexed = this.#isIndexed
		host.onMounted(() => {
			watch(host.rendered, () => this.#handleRendered(), {immediate: true})
		})
	}

	locate(node: Node): Lookup | undefined {
		if (!this.#isIndexed()) return undefined
		const container = this.host.container()
		if (!container || !container.contains(node)) return undefined

		let current: Node | null = node
		while (current) {
			if (current instanceof HTMLElement) {
				const tokenNode = this.#byElement.get(current)
				if (tokenNode) return {kind: 'token', node: tokenNode, element: current}
				if (this.#controlRoots.has(current)) return {kind: 'control'}
			}
			if (current === container) return undefined
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

	isControl(node: Node): boolean {
		return this.locate(node)?.kind === 'control'
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

	#handleRendered(): void {
		if (this.#rendering) {
			this.#queuedRender = true
			return
		}
		this.#rendering = true
		try {
			this.#commit()
		} finally {
			this.#rendering = false
			const queued = this.#queuedRender
			this.#queuedRender = false
			if (queued) this.#handleRendered()
		}
	}

	#commit(): void {
		const container = this.host.container()
		if (!container) return

		const tokens = this.tokens.current()
		const tokenIndex = this.tokens.index()
		const result = buildIndex({
			container,
			tokens,
			addressFor: path => tokenIndex.addressFor(path),
			controlElements: this.refs.controlElements(),
			childSequenceHostsByPath: this.#collectChildSequenceHostsByPath(tokens),
			isBlock: this.layout.isBlock(),
		})

		this.#byPath = result.byPath
		this.#byElement = result.byElement
		this.#controlRoots = result.controlRoots

		if (!this.#isIndexed()) batch(() => this.#isIndexed(true), {mutable: true})
		this.indexed()
	}

	#collectChildSequenceHostsByPath(tokens: readonly Token[]): ReadonlyMap<string, readonly HTMLElement[]> {
		const out = new Map<string, readonly HTMLElement[]>()
		const walk = (list: readonly Token[], basePath: TokenPath): void => {
			list.forEach((token, i) => {
				const path = [...basePath, i]
				const hosts = this.refs.childSequenceHostsFor(path)
				if (hosts.length > 0) out.set(pathKey(path), hosts)
				if (token.type === 'mark' && token.children.length > 0) walk(token.children, path)
			})
		}
		walk(tokens, [])
		return out
	}
}
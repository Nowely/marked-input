import type {DomRef, TokenAddress, TokenPath} from '../../shared/editorContracts'
import {computed, event, signal, watch} from '../../shared/signals/index.js'
import type {Computed, Event, Signal} from '../../shared/signals/index.js'
import type {Host} from '../state/Host'
import type {PropsModel} from '../state/PropsModel'
import type {ValueModel} from '../state/ValueModel'
import {buildIndex} from './buildIndex'
import type {Lookup, TokenNode} from './domTypes'
import {Parser} from './parser/Parser'
import type {Token} from './parser/types'
import {createTextToken} from './parser/utils/createTextToken'
import {TokenHandle} from './TokenHandle'
import type {HandleHost} from './TokenHandle'
import {createTokenIndex, pathEquals, pathKey, type TokenIndex} from './tokenIndex'

type ControlRegistration = {
	readonly ownerPath?: TokenPath
	readonly element: HTMLElement
}

type ChildSequenceRegistration = {
	readonly ownerPath: TokenPath
	readonly element: HTMLElement
}

/**
 * Single home for the token layer: parses the value into a token tree, indexes
 * it (path ↔ token ↔ address), collects framework ref callbacks, and maintains
 * the token ↔ DOM-element index that selection and keyboard navigation rely on.
 *
 * The heavy logic lives in pure free functions (`buildIndex`, `createTokenIndex`);
 * this class is the thin orchestrator that wires them to the live DOM.
 */
export class TokenModel {
	readonly current: Computed<Token[]> = computed(() => {
		const parser = this.#parser()
		const value = this.value.current()
		const tokens = parser ? parser.parse(value) : [createTextToken(value)]
		return this.props.layout.isBlock() ? filterEmptyText(tokens) : tokens
	})
	readonly index: Computed<TokenIndex> = computed(() => createTokenIndex(this.current()))

	/** Fires after each DOM re-index. */
	readonly indexed: Event<void> = event<void>()

	readonly #parser: Computed<Parser | undefined> = computed(() => {
		const Mark = this.props.Mark()
		const options = this.props.options()
		// TODO maybe in the future it place in one again
		const hasMark = Mark != null || options.some(opt => 'Mark' in opt && opt.Mark != null)
		if (!hasMark) return
		const markups = options.map(opt => opt.markup)
		if (!markups.some(Boolean)) return
		return new Parser(markups)
	})

	// Ref registries (formerly TokenRefs) — populated by framework ref callbacks.
	readonly #pendingControls = new Map<string, ControlRegistration>()
	readonly #pendingChildSequences = new Map<string, ChildSequenceRegistration>()
	#nextControlId = 0
	#nextChildSequenceId = 0

	// DOM index (formerly DomIndex) — rebuilt on every render.
	#byPath: ReadonlyMap<string, TokenNode> = new Map()
	#byElement: WeakMap<HTMLElement, TokenNode> = new WeakMap()
	#controlRoots: WeakSet<HTMLElement> = new WeakSet()
	#committing = false

	// Handle registry — path-keyed live token objects.
	readonly #handles = new Map<string, TokenHandle>()
	readonly #domVersion: Signal<number> = signal({initial: 0})
	readonly #handleHost: HandleHost = {
		version: () => this.#domVersion(),
		nodeByKey: key => this.#byPath.get(key),
	}

	constructor(
		private readonly value: ValueModel,
		private readonly props: PropsModel,
		private readonly host: Host
	) {
		host.onMounted(() => {
			watch(host.rendered, () => this.#commit(), {immediate: true})
		})
	}

	/** Ref callback for a control element (e.g. overlay, drag handle). */
	control(ownerPath?: TokenPath): DomRef {
		const key = `control:${++this.#nextControlId}`
		return element => {
			if (element) {
				this.#pendingControls.set(key, {ownerPath: ownerPath ? [...ownerPath] : undefined, element})
			} else {
				this.#pendingControls.delete(key)
			}
		}
	}

	/** Ref callback for the element hosting a token's child sequence. */
	children(ownerPath: TokenPath): DomRef {
		const key = `children:${++this.#nextChildSequenceId}`
		return element => {
			if (element) {
				this.#pendingChildSequences.set(key, {ownerPath: [...ownerPath], element})
			} else {
				this.#pendingChildSequences.delete(key)
			}
		}
	}

	/** Locate the indexed token node owning a DOM node, walking up to the container. */
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

	/** Return the live handle for a token at the given address, or undefined if not indexed. */
	handleFor(address: TokenAddress): TokenHandle | undefined {
		const key = pathKey(address.path)
		const existing = this.#handles.get(key)
		if (existing) return existing
		const node = this.#byPath.get(key)
		if (!node) return undefined
		return this.#ensureHandle(node)
	}

	/**
	 * Resolve a DOM node to its handle, 'control' if inside a control root,
	 * or undefined if outside the container.
	 */
	handleAt(node: Node): TokenHandle | 'control' | undefined {
		const lookup = this.locate(node)
		if (!lookup) return undefined
		if (lookup.kind === 'control') return 'control'
		return this.#ensureHandle(lookup.node)
	}

	/**
	 * Iterate all live handles in the registry.
	 * @yields {TokenHandle} each live handle
	 */
	*handles(): IterableIterator<TokenHandle> {
		for (const node of this.#byPath.values()) yield this.#ensureHandle(node)
	}

	#ensureHandle(node: TokenNode): TokenHandle {
		const key = pathKey(node.path)
		let handle = this.#handles.get(key)
		if (!handle) {
			handle = new TokenHandle(key, this.#handleHost, node.address.token, node.address)
			this.#handles.set(key, handle)
		}
		return handle
	}

	#syncHandles(): void {
		const tokenIndex = this.index()
		// Kill handles whose path key no longer exists in the new index.
		for (const [key, handle] of this.#handles) {
			if (!this.#byPath.has(key)) {
				handle.kill()
				this.#handles.delete(key)
			}
		}
		// Sync survivors — update token + address snapshots and emit change events.
		for (const [key, handle] of this.#handles) {
			const node = this.#byPath.get(key)
			if (!node) continue
			const token = tokenIndex.resolve(node.path)
			handle.sync(node, token)
		}
	}

	#controlElements(): ReadonlySet<HTMLElement> {
		const out = new Set<HTMLElement>()
		for (const {element} of this.#pendingControls.values()) out.add(element)
		return out
	}

	#childSequenceHostsFor(ownerPath: TokenPath): HTMLElement[] {
		const out: HTMLElement[] = []
		for (const registration of this.#pendingChildSequences.values()) {
			if (pathEquals(registration.ownerPath, ownerPath)) out.push(registration.element)
		}
		return out
	}

	#commit(): void {
		if (this.#committing) throw new Error('TokenModel index re-entry')
		const container = this.host.container()
		if (!container) return
		this.#committing = true
		try {
			const tokens = this.current()
			const tokenIndex = this.index()
			const result = buildIndex({
				container,
				tokens,
				addressFor: path => tokenIndex.addressFor(path),
				controlElements: this.#controlElements(),
				childSequenceHostsFor: path => this.#childSequenceHostsFor(path),
				isBlock: this.props.layout.isBlock(),
			})

			this.#byPath = result.byPath
			this.#byElement = result.byElement
			this.#controlRoots = result.controlRoots

			this.#syncHandles()
			this.#domVersion(this.#domVersion() + 1)
			this.indexed()
		} finally {
			this.#committing = false
		}
	}
}

function filterEmptyText(tokens: Token[]): Token[] {
	return tokens.filter(token => {
		if (token.type !== 'text') return true
		return token.position.start !== token.position.end
	})
}
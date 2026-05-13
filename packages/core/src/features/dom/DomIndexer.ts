import type {DomIndex, NodeLocationResult, TokenAddress, TokenPath} from '../../shared/editorContracts'
import {batch, computed, signal, watch} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {Lifecycle} from '../lifecycle/Lifecycle'
import type {Token} from '../parsing'
import type {ParseController} from '../parsing/ParseController'
import {pathEquals, pathKey} from '../parsing/tokenIndex'
import type {TokenIndex} from '../parsing/tokenIndex'
import type {PropsModel} from '../props/PropsModel'

export type RegisteredRole =
	| {readonly role: 'control'}
	| {
			readonly role: 'childSequence' | 'row' | 'token' | 'text'
			readonly path: TokenPath
			readonly address: TokenAddress
	  }

export type PathElements = {
	path: TokenPath
	address: TokenAddress
	rowElement?: HTMLElement
	tokenElement: HTMLElement
	textElement?: HTMLElement
}

export type ControlRegistration = {
	readonly ownerPath?: TokenPath
	readonly element: HTMLElement
}

export type ChildSequenceRegistration = {
	readonly ownerPath: TokenPath
	readonly element: HTMLElement
}

export interface DomIndexerHost {
	container(): HTMLElement | null
	pendingControls(): IterableIterator<ControlRegistration>
	pendingChildSequences(): IterableIterator<ChildSequenceRegistration>
	emitIndexed(): void
}

export class DomIndexer {
	readonly #domIndex = signal<DomIndex>(undefined, {readonly: true})
	readonly index: Computed<DomIndex | undefined> = computed(() => this.#domIndex())

	#elementRoles = new WeakMap<HTMLElement, RegisteredRole>()
	#pathElements = new Map<string, PathElements>()
	#generation = 0
	#rendering = false
	#queuedRender = false

	constructor(
		private readonly host: DomIndexerHost,
		private readonly lifecycle: Lifecycle,
		private readonly props: PropsModel,
		private readonly parsing: ParseController
	) {
		lifecycle.onMounted(() => {
			watch(lifecycle.rendered, () => {
				this.#handleRendered()
			})
			watch(
				computed(() => props.readOnly()),
				() => this.reconcile()
			)
		})
	}

	reconcile(opts?: {isUserSelecting?: boolean}): void {
		this.#reconcileStructuralTextSurfaces(opts?.isUserSelecting)
	}

	locateNode(node: Node): NodeLocationResult {
		if (!this.index()) return {ok: false, reason: 'notIndexed'}
		const container = this.host.container()
		if (!container || !container.contains(node)) return {ok: false, reason: 'outsideEditor'}

		let current: Node | null = node
		while (current) {
			if (current instanceof HTMLElement) {
				const role = this.#elementRoles.get(current)
				if (role?.role === 'control') return {ok: false, reason: 'control'}
				if (role) {
					const elements = this.#pathElements.get(pathKey(role.path))
					if (!elements?.tokenElement) return {ok: false, reason: 'notIndexed'}
					return {
						ok: true,
						value: {
							address: role.address,
							tokenElement: elements.tokenElement,
							textElement: elements.textElement,
							rowElement: elements.rowElement,
						},
					}
				}
			}
			if (current === container) break
			current = current.parentNode
		}

		return {ok: false, reason: 'outsideEditor'}
	}

	pathElements(): IterableIterator<PathElements> {
		return this.#pathElements.values()
	}

	pathElementsFor(address: TokenAddress): PathElements | undefined {
		return this.#pathElements.get(pathKey(address.path))
	}

	roleFor(element: HTMLElement): RegisteredRole | undefined {
		return this.#elementRoles.get(element)
	}

	#handleRendered(): void {
		if (this.#rendering) {
			this.#queuedRender = true
			return
		}

		this.#rendering = true
		try {
			this.#commitRendered()
		} finally {
			this.#rendering = false
			const queued = this.#queuedRender
			this.#queuedRender = false
			if (queued) this.#handleRendered()
		}
	}

	#commitRendered(): void {
		const container = this.host.container()
		if (!container) {
			return
		}

		const tokenIndex = this.parsing.index()
		const pathElements = new Map<string, PathElements>()
		const elementRoles = new WeakMap<HTMLElement, RegisteredRole>()
		const controlElements = new Set<HTMLElement>()

		for (const {element} of this.host.pendingControls()) {
			controlElements.add(element)
			elementRoles.set(element, {role: 'control'})
		}

		const tokens = this.parsing.tokens()
		if (this.props.layout() === 'block') {
			this.#indexBlockTokens(container, tokens, tokenIndex, controlElements, pathElements, elementRoles)
		} else {
			this.#indexTokenSequence(
				container,
				tokens,
				[],
				undefined,
				tokenIndex,
				controlElements,
				pathElements,
				elementRoles
			)
		}

		this.#pathElements = pathElements
		this.#elementRoles = elementRoles
		this.#reconcileStructuralTextSurfaces()

		batch(() => this.#domIndex({generation: ++this.#generation}), {mutable: true})
		this.host.emitIndexed()
	}

	#elementChildren(element: HTMLElement): HTMLElement[] {
		return Array.from(element.children).filter(child => child instanceof HTMLElement)
	}

	#isControlRoot(element: HTMLElement, controlElements: Set<HTMLElement>): boolean {
		if (controlElements.has(element)) return true
		for (const control of controlElements) {
			if (element.contains(control)) return true
		}
		return false
	}

	#childSequenceHostsFor(ownerPath: TokenPath): HTMLElement[] {
		const hosts: HTMLElement[] = []
		for (const registration of this.host.pendingChildSequences()) {
			if (pathEquals(registration.ownerPath, ownerPath)) hosts.push(registration.element)
		}
		return hosts
	}

	#indexNestedTokenSequence(
		token: Token,
		path: TokenPath,
		address: TokenAddress,
		ownerElement: HTMLElement,
		rowElement: HTMLElement | undefined,
		tokenIndex: TokenIndex,
		controlElements: Set<HTMLElement>,
		pathElements: Map<string, PathElements>,
		elementRoles: WeakMap<HTMLElement, RegisteredRole>
	): void {
		if (token.type !== 'mark' || token.children.length === 0) return

		const hosts = this.#childSequenceHostsFor(path)
		if (hosts.length === 0) {
			this.#indexTokenSequence(
				ownerElement,
				token.children,
				path,
				rowElement,
				tokenIndex,
				controlElements,
				pathElements,
				elementRoles
			)
			return
		}

		if (hosts.length !== 1) {
			return
		}

		const host = hosts[0]
		if (!ownerElement.contains(host)) {
			return
		}

		elementRoles.set(host, {role: 'childSequence', path, address})
		this.#indexTokenSequence(
			host,
			token.children,
			path,
			rowElement,
			tokenIndex,
			controlElements,
			pathElements,
			elementRoles
		)
	}

	#indexBlockTokens(
		container: HTMLElement,
		tokens: readonly Token[],
		tokenIndex: TokenIndex,
		controlElements: Set<HTMLElement>,
		pathElements: Map<string, PathElements>,
		elementRoles: WeakMap<HTMLElement, RegisteredRole>
	): void {
		const rows = this.#elementChildren(container)

		tokens.forEach((token, i) => {
			const row = rows.at(i)
			if (!row) return
			const candidates = this.#elementChildren(row).filter(child => !this.#isControlRoot(child, controlElements))
			if (candidates.length !== 1) {
				return
			}
			this.#indexTokenElement(
				token,
				[i],
				candidates[0],
				row,
				tokenIndex,
				controlElements,
				pathElements,
				elementRoles
			)
		})
	}

	#indexTokenSequence(
		parent: HTMLElement,
		tokens: readonly Token[],
		basePath: TokenPath,
		rowElement: HTMLElement | undefined,
		tokenIndex: TokenIndex,
		controlElements: Set<HTMLElement>,
		pathElements: Map<string, PathElements>,
		elementRoles: WeakMap<HTMLElement, RegisteredRole>
	): void {
		const elements = this.#elementChildren(parent).filter(child => !this.#isControlRoot(child, controlElements))
		if (elements.length !== tokens.length) {
			return
		}

		tokens.forEach((token, i) => {
			const element = elements.at(i)
			if (!element) return
			this.#indexTokenElement(
				token,
				[...basePath, i],
				element,
				rowElement,
				tokenIndex,
				controlElements,
				pathElements,
				elementRoles
			)
		})
	}

	#indexTokenElement(
		token: Token,
		path: TokenPath,
		element: HTMLElement,
		rowElement: HTMLElement | undefined,
		tokenIndex: TokenIndex,
		controlElements: Set<HTMLElement>,
		pathElements: Map<string, PathElements>,
		elementRoles: WeakMap<HTMLElement, RegisteredRole>
	): void {
		const address = tokenIndex.addressFor(path)
		if (!address) {
			return
		}

		const record: PathElements = {
			path: [...path],
			address,
			tokenElement: element,
			textElement: token.type === 'text' ? element : undefined,
			rowElement,
		}
		pathElements.set(tokenIndex.key(path), record)
		elementRoles.set(element, {role: token.type === 'text' ? 'text' : 'token', path, address})
		if (rowElement && path.length === 1) elementRoles.set(rowElement, {role: 'row', path, address})

		this.#indexNestedTokenSequence(
			token,
			path,
			address,
			element,
			rowElement,
			tokenIndex,
			controlElements,
			pathElements,
			elementRoles
		)
	}

	#reconcileStructuralTextSurfaces(isUserSelecting?: boolean): void {
		const tokenIndex = this.parsing.index()
		const editable = this.props.readOnly() || isUserSelecting ? 'false' : 'true'

		for (const record of this.#pathElements.values()) {
			const resolved = tokenIndex.resolveAddress(record.address)
			if (!resolved.ok) {
				continue
			}

			if (record.textElement) {
				if (resolved.value.type !== 'text') {
					continue
				}
				if (record.textElement.textContent !== resolved.value.content) {
					record.textElement.textContent = resolved.value.content
				}
				record.textElement.contentEditable = editable
				continue
			}

			if (resolved.value.type === 'mark') {
				if (this.props.readOnly()) {
					record.tokenElement.removeAttribute('tabindex')
				} else {
					record.tokenElement.tabIndex = 0
				}
			}
		}
	}
}
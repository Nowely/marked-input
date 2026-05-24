// packages/core/src/features/bridge/DomTokenBridge.ts
import type {DomRef, TokenAddress, TokenPath} from '../../shared/editorContracts'
import {batch, event, signal, watch} from '../../shared/signals/index.js'
import type {Event, Signal} from '../../shared/signals/index.js'
import type {Token} from '../parsing'
import {pathEquals, pathKey} from '../parsing/tokenIndex'
import type {TokenIndex} from '../parsing/tokenIndex'
import type {TokenModel} from '../parsing/TokenModel'
import type {Host} from '../state/Host'
import type {PropsModel} from '../state/PropsModel'

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

export type LocatedNode = {
	readonly address: TokenAddress
	readonly tokenElement: HTMLElement
	readonly textElement?: HTMLElement
	readonly rowElement?: HTMLElement
}

type ControlRegistration = {
	readonly ownerPath?: TokenPath
	readonly element: HTMLElement
}

type ChildSequenceRegistration = {
	readonly ownerPath: TokenPath
	readonly element: HTMLElement
}

export class DomTokenBridge {
	readonly indexed: Event<void> = event<void>()
	readonly isIndexed: Signal<boolean>

	readonly #pendingControls = new Map<string, ControlRegistration>()
	readonly #pendingChildSequences = new Map<string, ChildSequenceRegistration>()
	#nextControlId = 0
	#nextChildSequenceId = 0

	#selecting = false
	#composing = false

	readonly #isIndexed = signal<boolean>({initial: false, readonly: true})

	#elementRoles = new WeakMap<HTMLElement, RegisteredRole>()
	#pathElements = new Map<string, PathElements>()
	#rendering = false
	#queuedRender = false

	constructor(
		private readonly host: Host,
		private readonly props: PropsModel,
		private readonly tokens: TokenModel
	) {
		this.isIndexed = this.#isIndexed
		host.onMounted(() => {
			watch(host.rendered, () => this.#handleRendered(), {immediate: true})
			watch(props.readOnly, () => this.reconcile())
		})
	}

	controlFor(ownerPath?: TokenPath): DomRef {
		const key = `control:${++this.#nextControlId}`
		return element => {
			if (element) {
				this.#pendingControls.set(key, {ownerPath: ownerPath ? [...ownerPath] : undefined, element})
			} else {
				this.#pendingControls.delete(key)
			}
		}
	}

	childrenFor(ownerPath: TokenPath): DomRef {
		const key = `children:${++this.#nextChildSequenceId}`
		return element => {
			if (element) {
				this.#pendingChildSequences.set(key, {ownerPath: [...ownerPath], element})
			} else {
				this.#pendingChildSequences.delete(key)
			}
		}
	}

	setSelecting(active: boolean): void {
		if (this.#selecting === active) return
		this.#selecting = active
		this.reconcile()
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

	reconcile(): void {
		this.#reconcileStructuralTextSurfaces()
	}

	locateNode(node: Node): LocatedNode | undefined {
		const role = this.#nearestRegisteredAncestor(node)
		if (!role || role.role === 'control') return undefined

		const elements = this.#pathElements.get(pathKey(role.path))
		if (!elements?.tokenElement) return undefined
		return {
			address: role.address,
			tokenElement: elements.tokenElement,
			textElement: elements.textElement,
			rowElement: elements.rowElement,
		}
	}

	isControlAncestor(node: Node): boolean {
		return this.#nearestRegisteredAncestor(node)?.role === 'control'
	}

	#nearestRegisteredAncestor(node: Node): RegisteredRole | undefined {
		if (!this.#isIndexed()) return undefined
		const container = this.host.container()
		if (!container || !container.contains(node)) return undefined

		let current: Node | null = node
		while (current) {
			if (current instanceof HTMLElement) {
				const role = this.#elementRoles.get(current)
				if (role) return role
			}
			if (current === container) return undefined
			current = current.parentNode
		}
		return undefined
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
		if (!container) return

		const tokenIndex = this.tokens.index()
		const pathElements = new Map<string, PathElements>()
		const elementRoles = new WeakMap<HTMLElement, RegisteredRole>()
		const controlElements = new Set<HTMLElement>()

		for (const {element} of this.#pendingControls.values()) {
			controlElements.add(element)
			elementRoles.set(element, {role: 'control'})
		}

		const tokens = this.tokens.current()
		if (this.props.layout.isBlock()) {
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

		if (!this.#isIndexed()) batch(() => this.#isIndexed(true), {mutable: true})
		this.indexed()
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
		for (const registration of this.#pendingChildSequences.values()) {
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

		if (hosts.length !== 1) return

		const host = hosts[0]
		if (!ownerElement.contains(host)) return

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
			if (candidates.length !== 1) return
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
		if (elements.length !== tokens.length) return
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
		if (!address) return

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

	#reconcileStructuralTextSurfaces(): void {
		const tokenIndex = this.tokens.index()
		const editable = this.props.readOnly() || this.#selecting ? 'false' : 'true'

		for (const record of this.#pathElements.values()) {
			const resolved = tokenIndex.resolveAddress(record.address)
			if (!resolved) continue

			if (record.textElement) {
				if (resolved.type !== 'text') continue
				if (record.textElement.textContent !== resolved.content) {
					record.textElement.textContent = resolved.content
				}
				record.textElement.contentEditable = editable
				continue
			}

			if (resolved.type === 'mark') {
				if (this.props.readOnly()) {
					record.tokenElement.removeAttribute('tabindex')
				} else {
					record.tokenElement.tabIndex = 0
				}
			}
		}
	}
}
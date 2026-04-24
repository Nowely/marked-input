import type {
	DomDiagnostic,
	DomIndex,
	DomRef,
	DomRefTarget,
	NodeLocationResult,
	TokenAddress,
	TokenPath,
} from '../../shared/editorContracts'
import {batch, computed, effectScope, event, signal, watch} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'
import type {RenderedPayload} from '../lifecycle/LifecycleFeature'
import {pathKey} from '../parsing/tokenIndex'

type RegisteredRole =
	| {readonly role: 'container'; readonly element: HTMLElement}
	| {readonly role: 'control'; readonly element: HTMLElement; readonly ownerPath?: TokenPath}
	| {
			readonly role: 'row' | 'token' | 'text' | 'slotRoot'
			readonly element: HTMLElement
			readonly path: TokenPath
			readonly address: TokenAddress
	  }

type PathElements = {
	path: TokenPath
	address: TokenAddress
	rowElement?: HTMLElement
	tokenElement?: HTMLElement
	textElement?: HTMLElement
	slotRootElement?: HTMLElement
}

export class DomFeature {
	readonly #domIndex = signal<DomIndex | undefined>(undefined, {readonly: true})
	readonly index: Computed<DomIndex | undefined> = computed(() => this.#domIndex())
	readonly diagnostics = event<DomDiagnostic>()
	readonly structuralKey = computed(() => {
		this._store.parsing.index()
		this._store.props.layout()
		this._store.props.readOnly()
		this._store.props.Mark()
		this._store.props.Span()
		this._store.props.slots()
		this._store.props.slotProps()
		this._store.props.draggable()
		return {}
	})

	readonly #refCallbacks = new Map<string, DomRef>()
	readonly #pendingElements = new Map<string, {target: DomRefTarget; element: HTMLElement | null}>()
	#elementRoles = new WeakMap<HTMLElement, RegisteredRole>()
	#pathElements = new Map<string, PathElements>()
	#container: HTMLElement | undefined
	#generation = 0
	#rendering = false
	#isComposing = false
	#queuedRender: RenderedPayload | undefined
	#scope?: () => void

	constructor(private readonly _store: Store) {}

	enable() {
		if (this.#scope) return
		this.#scope = effectScope(() => {
			watch(this._store.lifecycle.rendered, rendered => {
				this.#handleRendered(rendered)
			})
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
	}

	compositionStarted(): void {
		this.#isComposing = true
	}

	compositionEnded(): void {
		if (!this.#isComposing) return
		this.#isComposing = false
	}

	refFor(target: DomRefTarget): DomRef {
		const key = this.#targetKey(target)
		const existing = this.#refCallbacks.get(key)
		if (existing) return existing

		const callback: DomRef = element => {
			this.#pendingElements.set(key, {target, element})
		}
		this.#refCallbacks.set(key, callback)
		return callback
	}

	reconcile(): void {
		this.#reconcileRegisteredTextSurfaces()
	}

	locateNode(node: Node): NodeLocationResult {
		if (!this.index()) return {ok: false, reason: 'notIndexed'}
		const container = this.#container
		if (!container || !container.contains(node)) return {ok: false, reason: 'outsideEditor'}

		let current: Node | null = node
		while (current) {
			if (current instanceof HTMLElement) {
				const role = this.#elementRoles.get(current)
				if (role?.role === 'control') return {ok: false, reason: 'control'}
				if (role && role.role !== 'container') {
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

	#targetKey(target: DomRefTarget): string {
		if (target.role === 'container') return 'container'
		if (target.role === 'control') return `control:${target.ownerPath ? pathKey(target.ownerPath) : 'global'}`
		return `${target.role}:${pathKey(target.path)}`
	}

	#handleRendered(payload: RenderedPayload): void {
		if (this.#rendering) {
			this.#queuedRender = payload
			this.diagnostics({kind: 'renderReentry', reason: 'rendered event queued during DOM indexing'})
			return
		}

		this.#rendering = true
		try {
			this.#commitRendered(payload)
		} finally {
			this.#rendering = false
			const queued = this.#queuedRender
			this.#queuedRender = undefined
			if (queued) this.#handleRendered(queued)
		}
	}

	#commitRendered(payload: RenderedPayload): void {
		const tokenIndex = this._store.parsing.index()
		const pathElements = new Map<string, PathElements>()
		const elementRoles = new WeakMap<HTMLElement, RegisteredRole>()
		this.#container = payload.container
		elementRoles.set(payload.container, {role: 'container', element: payload.container})

		for (const {target, element} of this.#pendingElements.values()) {
			if (!element) continue
			if (target.role === 'container') {
				this.#container = element
				elementRoles.set(element, {role: 'container', element})
				continue
			}
			if (target.role === 'control') {
				elementRoles.set(element, {role: 'control', element, ownerPath: target.ownerPath})
				continue
			}

			const address = tokenIndex.addressFor(target.path)
			if (!address) {
				this.diagnostics({kind: 'stalePath', path: target.path, reason: 'registered path no longer resolves'})
				continue
			}

			const key = tokenIndex.key(target.path)
			const record = pathElements.get(key) ?? {path: [...target.path], address}
			if (target.role === 'row') record.rowElement = element
			if (target.role === 'token') record.tokenElement = element
			if (target.role === 'text') record.textElement = element
			if (target.role === 'slotRoot') record.slotRootElement = element
			pathElements.set(key, record)
			elementRoles.set(element, {...target, element, address})
		}

		this.#pathElements = pathElements
		this.#elementRoles = elementRoles
		this.#reconcileRegisteredTextSurfaces()

		batch(() => this.#domIndex({generation: ++this.#generation}), {mutable: true})
	}

	#reconcileRegisteredTextSurfaces(): void {
		const tokenIndex = this._store.parsing.index()
		const editable = this._store.props.readOnly() ? 'false' : 'true'

		for (const record of this.#pathElements.values()) {
			const resolved = tokenIndex.resolveAddress(record.address)
			if (!resolved.ok) {
				this.diagnostics({
					kind: 'stalePath',
					path: record.path,
					reason: 'registered path became stale during reconciliation',
				})
				continue
			}

			if (record.textElement) {
				if (resolved.value.type !== 'text') {
					this.diagnostics({
						kind: 'missingRole',
						path: record.path,
						reason: 'text role registered for non-text token',
					})
					continue
				}
				if (record.textElement.textContent !== resolved.value.content) {
					record.textElement.textContent = resolved.value.content
				}
				record.textElement.contentEditable = editable
				continue
			}

			if (record.tokenElement && resolved.value.type === 'mark') {
				if (this._store.props.readOnly()) {
					record.tokenElement.removeAttribute('tabindex')
				} else {
					record.tokenElement.tabIndex = 0
				}
			}
		}
	}
}
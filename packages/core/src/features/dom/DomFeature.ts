import type {
	DomDiagnostic,
	DomIndex,
	DomRef,
	DomRefTarget,
	NodeLocationResult,
	RawSelection,
	Result,
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

function nextTextNode(walker: TreeWalker): Text | null {
	const node = walker.nextNode()
	return node instanceof Text ? node : null
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
			watch(
				computed(() => ({
					readOnly: this._store.props.readOnly(),
					selecting: this._store.caret.selecting(),
				})),
				() => this.reconcile()
			)
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

	placeCaretAtRawPosition(
		rawPosition: number,
		affinity: 'before' | 'after' = 'after'
	): Result<void, 'notIndexed' | 'invalidBoundary'> {
		if (!this.index()) return {ok: false, reason: 'notIndexed'}
		const target = this.#findTextTargetForRawPosition(rawPosition, affinity)
		if (!target) return {ok: false, reason: 'invalidBoundary'}

		target.element.focus()
		this.#placeCaretInTextSurface(target.element, rawPosition - target.start)
		return {ok: true, value: undefined}
	}

	focusAddress(address: TokenAddress): Result<void, 'notIndexed' | 'stale'> {
		if (!this.index()) return {ok: false, reason: 'notIndexed'}
		const resolved = this._store.parsing.index().resolveAddress(address)
		if (!resolved.ok) return {ok: false, reason: 'stale'}

		const elements = this.#pathElements.get(pathKey(address.path))
		const target = elements?.textElement ?? elements?.tokenElement ?? elements?.rowElement
		if (!target) return {ok: false, reason: 'notIndexed'}

		target.focus()
		return {ok: true, value: undefined}
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
		this.#clearStaleCaretLocation()
		this.#applyPendingRecovery()
	}

	#reconcileRegisteredTextSurfaces(): void {
		const tokenIndex = this._store.parsing.index()
		const editable = this._store.props.readOnly() || this._store.caret.selecting() ? 'false' : 'true'

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

	#findTextTargetForRawPosition(
		rawPosition: number,
		affinity: 'before' | 'after'
	): {element: HTMLElement; start: number; end: number} | undefined {
		const candidates: Array<{element: HTMLElement; start: number; end: number}> = []
		const tokenIndex = this._store.parsing.index()

		for (const record of this.#pathElements.values()) {
			if (!record.textElement) continue
			const resolved = tokenIndex.resolveAddress(record.address)
			if (!resolved.ok || resolved.value.type !== 'text') continue
			candidates.push({
				element: record.textElement,
				start: resolved.value.position.start,
				end: resolved.value.position.end,
			})
		}

		candidates.sort((a, b) => a.start - b.start)
		const containing = candidates.find(candidate => rawPosition >= candidate.start && rawPosition <= candidate.end)
		if (containing) return containing
		if (affinity === 'before') return [...candidates].toReversed().find(candidate => candidate.end <= rawPosition)
		return candidates.find(candidate => candidate.start >= rawPosition)
	}

	#placeCaretInTextSurface(surface: HTMLElement, offset: number): void {
		const selection = window.getSelection()
		if (!selection) return

		const boundary = this.#boundaryInTextSurface(surface, offset)
		if (!boundary) return
		const range = document.createRange()
		range.setStart(boundary.node, boundary.offset)
		range.collapse(true)
		selection.removeAllRanges()
		selection.addRange(range)
	}

	#applyPendingRecovery(): void {
		const recovery = this._store.caret.recovery()
		if (!recovery || !('kind' in recovery)) return

		if (recovery.kind === 'caret') {
			const result = this._store.caret.placeAt(recovery.rawPosition, recovery.affinity)
			if (result.ok) this._store.caret.recovery(undefined)
			return
		}

		const result = this.#placeSelection(recovery.selection)
		if (result.ok) this._store.caret.recovery(undefined)
	}

	#placeSelection(selection: RawSelection): Result<void, 'notIndexed' | 'invalidBoundary'> {
		const start = this.#findTextTargetForRawPosition(selection.range.start, 'after')
		const end = this.#findTextTargetForRawPosition(selection.range.end, 'before')
		const browserSelection = window.getSelection()
		if (!start || !end || !browserSelection) return {ok: false, reason: 'invalidBoundary'}

		const startBoundary = this.#boundaryInTextSurface(start.element, selection.range.start - start.start)
		const endBoundary = this.#boundaryInTextSurface(end.element, selection.range.end - end.start)
		if (!startBoundary || !endBoundary) return {ok: false, reason: 'invalidBoundary'}

		const range = document.createRange()
		range.setStart(startBoundary.node, startBoundary.offset)
		range.setEnd(endBoundary.node, endBoundary.offset)
		browserSelection.removeAllRanges()
		browserSelection.addRange(range)
		return {ok: true, value: undefined}
	}

	#boundaryInTextSurface(surface: HTMLElement, offset: number): {node: Text; offset: number} | undefined {
		const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT)
		let remaining = Math.max(0, offset)
		let node = nextTextNode(walker)
		while (node) {
			if (remaining <= node.length) return {node, offset: remaining}
			remaining -= node.length
			node = nextTextNode(walker)
		}

		const text = surface.firstChild instanceof Text ? surface.firstChild : document.createTextNode('')
		if (!text.parentNode) surface.append(text)
		return {node: text, offset: text.length}
	}

	#clearStaleCaretLocation(): void {
		const location = this._store.caret.location()
		if (!location) return
		const resolved = this._store.parsing.index().resolveAddress(location.address)
		if (!resolved.ok || !this.#pathElements.has(pathKey(location.address.path))) {
			this._store.caret.location(undefined)
		}
	}
}
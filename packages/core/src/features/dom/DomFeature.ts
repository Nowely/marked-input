import type {
	BoundaryPositionResult,
	DomDiagnostic,
	DomIndex,
	DomRef,
	DomRefTarget,
	NodeLocationResult,
	RawSelection,
	RawSelectionResult,
	Result,
	TokenAddress,
	TokenPath,
} from '../../shared/editorContracts'
import {batch, computed, effectScope, event, signal, watch} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'
import type {Token} from '../parsing'
import {pathKey} from '../parsing/tokenIndex'

type RegisteredRole =
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

function splitsSurrogatePair(text: string, offset: number): boolean {
	if (offset <= 0 || offset >= text.length) return false
	const prev = text.charCodeAt(offset - 1)
	const next = text.charCodeAt(offset)
	return prev >= 0xd800 && prev <= 0xdbff && next >= 0xdc00 && next <= 0xdfff
}

function textOffsetWithin(surface: HTMLElement, node: Node, offset: number): number | undefined {
	if (node.nodeType === Node.TEXT_NODE) {
		const text = node.textContent ?? ''
		if (splitsSurrogatePair(text, offset)) return undefined
		return node instanceof Text ? textOffsetFromTreeWalker(surface, node, offset) : undefined
	}

	if (node === surface) return elementBoundaryOffset(surface, offset)
	return undefined
}

function textOffsetFromTreeWalker(surface: HTMLElement, target: Text, targetOffset: number): number | undefined {
	let total = 0
	const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT)
	let current = nextTextNode(walker)
	while (current) {
		if (current === target) return total + targetOffset
		total += current.length
		current = nextTextNode(walker)
	}
	return undefined
}

function textLength(surface: HTMLElement): number {
	let total = 0
	const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT)
	let current = nextTextNode(walker)
	while (current) {
		total += current.length
		current = nextTextNode(walker)
	}
	return total
}

function elementBoundaryOffset(surface: HTMLElement, offset: number): number | undefined {
	if (offset <= 0) return 0
	if (offset >= surface.childNodes.length) return textLength(surface)

	let total = 0
	for (let i = 0; i < offset; i++) {
		const child = surface.childNodes.item(i)
		if (child.nodeType === Node.TEXT_NODE && child instanceof Text) {
			total += child.length
			continue
		}
		if (child instanceof HTMLElement) total += textLength(child)
	}
	return total
}

function hasEditableAncestorBefore(node: Node, boundary: HTMLElement): boolean {
	let current = node instanceof HTMLElement ? node : node.parentElement
	while (current && current !== boundary) {
		if (
			current.isContentEditable ||
			current.contentEditable === 'true' ||
			current.contentEditable === 'plaintext-only'
		) {
			return true
		}
		current = current.parentElement
	}
	return false
}

export class DomFeature {
	readonly #domIndex = signal<DomIndex | undefined>(undefined, {readonly: true})
	readonly index: Computed<DomIndex | undefined> = computed(() => this.#domIndex())
	readonly container = signal<HTMLElement | null>(null)
	readonly diagnostics = event<DomDiagnostic>()
	readonly structuralKey = computed(() => {
		this._store.parsing.index()
		this._store.props.layout()
		this._store.props.readOnly()
		this._store.props.options()
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
	#generation = 0
	#rendering = false
	#isComposing = false
	#queuedRender = false
	#scope?: () => void

	constructor(private readonly _store: Store) {}

	enable() {
		if (this.#scope) return
		this.#scope = effectScope(() => {
			watch(this._store.lifecycle.rendered, () => {
				this.#handleRendered()
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
		const container = this.container()
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
							slotRootElement: elements.slotRootElement,
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
		if (!target) return this.#focusMarkBoundaryForRawPosition(rawPosition)

		target.element.focus()
		this.#placeCaretInTextSurface(target.element, rawPosition - target.start)
		return {ok: true, value: undefined}
	}

	focusAddress(address: TokenAddress, boundary: 'start' | 'end' = 'start'): Result<void, 'notIndexed' | 'stale'> {
		if (!this.index()) return {ok: false, reason: 'notIndexed'}
		const resolved = this._store.parsing.index().resolveAddress(address)
		if (!resolved.ok) return {ok: false, reason: 'stale'}

		const elements = this.#pathElements.get(pathKey(address.path))
		const target = elements?.textElement ?? elements?.tokenElement ?? elements?.rowElement
		if (!target) return {ok: false, reason: 'notIndexed'}

		target.focus()
		const role =
			target === elements?.textElement ? 'text' : target === elements?.rowElement ? 'row' : 'markDescendant'
		if (role === 'markDescendant') {
			this.#placeCollapsedBoundary(target, boundary === 'end' ? target.childNodes.length : 0)
		}
		this._store.caret.location({address, role})
		return {ok: true, value: undefined}
	}

	rawPositionFromBoundary(
		node: Node,
		offset: number,
		affinity: 'before' | 'after' = 'after'
	): BoundaryPositionResult {
		if (!this.index()) return {ok: false, reason: 'notIndexed'}
		if (this.#isComposing) return {ok: false, reason: 'composing'}

		const container = this.container()
		if (container && node === container) {
			return this.#rawPositionFromContainerBoundary(offset, affinity)
		}

		const location = this.locateNode(node)
		if (!location.ok) return location.reason === 'control' ? {ok: false, reason: 'control'} : location

		const token = this._store.parsing.index().resolveAddress(location.value.address)
		if (!token.ok) return {ok: false, reason: 'notIndexed'}

		const textElement = location.value.textElement
		if (textElement?.contains(node)) {
			const local = textOffsetWithin(textElement, node, offset)
			if (local === undefined) return {ok: false, reason: 'invalidBoundary'}
			return {ok: true, value: token.value.position.start + local}
		}

		if (node === location.value.tokenElement) {
			const childCount = location.value.tokenElement.childNodes.length
			if (offset <= 0) return {ok: true, value: token.value.position.start}
			if (offset >= childCount) return {ok: true, value: token.value.position.end}
			return this.#rawPositionFromTokenChildBoundary(location.value.tokenElement, offset, token.value, affinity)
		}

		if (node === location.value.slotRootElement) {
			return this.#rawPositionFromTokenChildBoundary(
				location.value.slotRootElement,
				offset,
				token.value,
				affinity
			)
		}

		if (token.value.type === 'mark' && location.value.tokenElement.contains(node)) {
			if (hasEditableAncestorBefore(node, location.value.tokenElement)) {
				return {ok: false, reason: 'invalidBoundary'}
			}
			return {
				ok: true,
				value: affinity === 'after' ? token.value.position.start : token.value.position.end,
			}
		}

		if (location.value.rowElement && node === location.value.rowElement) {
			return {ok: true, value: offset <= 0 ? token.value.position.start : token.value.position.end}
		}

		return {ok: false, reason: 'invalidBoundary'}
	}

	readRawSelection(): RawSelectionResult {
		if (!this.index()) return {ok: false, reason: 'notIndexed'}
		const selection = window.getSelection()
		if (!selection || selection.rangeCount === 0) return {ok: false, reason: 'invalidBoundary'}

		const range = selection.getRangeAt(0)
		const start = this.rawPositionFromBoundary(range.startContainer, range.startOffset, 'after')
		const end = this.rawPositionFromBoundary(range.endContainer, range.endOffset, 'before')

		if (!start.ok) {
			const reason = start.reason === 'composing' ? 'invalidBoundary' : start.reason
			return {
				ok: false,
				reason: reason === 'control' || reason === 'outsideEditor' ? 'mixedBoundary' : reason,
			}
		}
		if (!end.ok) {
			const reason = end.reason === 'composing' ? 'invalidBoundary' : end.reason
			return {
				ok: false,
				reason: reason === 'control' || reason === 'outsideEditor' ? 'mixedBoundary' : reason,
			}
		}

		const rangeValue =
			start.value <= end.value ? {start: start.value, end: end.value} : {start: end.value, end: start.value}
		const direction =
			rangeValue.start === rangeValue.end
				? undefined
				: selection.anchorNode === range.endContainer && selection.anchorOffset === range.endOffset
					? 'backward'
					: 'forward'

		return {ok: true, value: direction ? {range: rangeValue, direction} : {range: rangeValue}}
	}

	#targetKey(target: DomRefTarget): string {
		if (target.role === 'control') return `control:${target.ownerPath ? pathKey(target.ownerPath) : 'global'}`
		return `${target.role}:${pathKey(target.path)}`
	}

	#handleRendered(): void {
		if (this.#rendering) {
			this.#queuedRender = true
			this.diagnostics({kind: 'renderReentry', reason: 'rendered event queued during DOM indexing'})
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
		const tokenIndex = this._store.parsing.index()
		const pathElements = new Map<string, PathElements>()
		const elementRoles = new WeakMap<HTMLElement, RegisteredRole>()

		for (const {target, element} of this.#pendingElements.values()) {
			if (!element) continue
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

	#rawPositionFromContainerBoundary(offset: number, affinity: 'before' | 'after'): BoundaryPositionResult {
		const tokens = this._store.parsing.tokens()
		if (tokens.length === 0) return {ok: true, value: 0}
		if (offset <= 0) return {ok: true, value: tokens[0].position.start}
		if (offset >= tokens.length) return {ok: true, value: tokens[tokens.length - 1].position.end}

		const before = tokens[offset - 1]
		const after = tokens[offset]
		return {ok: true, value: affinity === 'before' ? before.position.end : after.position.start}
	}

	#rawPositionFromTokenChildBoundary(
		tokenElement: HTMLElement,
		offset: number,
		token: Token,
		affinity: 'before' | 'after'
	): BoundaryPositionResult {
		if (token.type === 'text') {
			const textElement = this.#pathElements.get(
				pathKey(this._store.parsing.index().pathFor(token) ?? [])
			)?.textElement
			if (!textElement || textLength(textElement) === 0) return {ok: true, value: token.position.start}
		}

		const before = this.#locateRegisteredDescendant(tokenElement.childNodes.item(offset - 1))
		const after = this.#locateRegisteredDescendant(tokenElement.childNodes.item(offset))
		if (before?.ok && after?.ok) {
			const beforeToken = this._store.parsing.index().resolveAddress(before.value.address)
			const afterToken = this._store.parsing.index().resolveAddress(after.value.address)
			if (beforeToken.ok && afterToken.ok) {
				return {
					ok: true,
					value: affinity === 'before' ? beforeToken.value.position.end : afterToken.value.position.start,
				}
			}
		}

		return {ok: true, value: affinity === 'before' ? token.position.start : token.position.end}
	}

	#locateRegisteredDescendant(node: Node | null): NodeLocationResult | undefined {
		if (!node) return undefined
		return this.locateNode(node)
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

	#focusMarkBoundaryForRawPosition(rawPosition: number): Result<void, 'notIndexed' | 'invalidBoundary'> {
		const tokenIndex = this._store.parsing.index()

		for (const record of this.#pathElements.values()) {
			if (!record.tokenElement) continue
			const resolved = tokenIndex.resolveAddress(record.address)
			if (!resolved.ok || resolved.value.type !== 'mark') continue
			if (rawPosition !== resolved.value.position.start && rawPosition !== resolved.value.position.end) continue

			const boundary = rawPosition === resolved.value.position.end ? 'end' : 'start'
			record.tokenElement.focus()
			this.#placeCollapsedBoundary(
				record.tokenElement,
				boundary === 'end' ? record.tokenElement.childNodes.length : 0
			)
			this._store.caret.location({address: record.address, role: 'markDescendant'})
			return {ok: true, value: undefined}
		}

		return {ok: false, reason: 'invalidBoundary'}
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

	#placeCollapsedBoundary(element: HTMLElement, offset: number): void {
		const selection = window.getSelection()
		if (!selection) return

		const range = document.createRange()
		range.setStart(element, Math.min(Math.max(offset, 0), element.childNodes.length))
		range.collapse(true)
		selection.removeAllRanges()
		selection.addRange(range)
	}

	#applyPendingRecovery(): void {
		const recovery = this._store.caret.recovery()
		if (!recovery) return

		if (recovery.kind === 'caret') {
			const result = this._store.caret.placeAt(recovery.rawPosition, recovery.affinity)
			this._store.caret.recovery(undefined)
			if (!result.ok) {
				this.diagnostics({
					kind: 'recoveryFailed',
					reason: `pending caret recovery could not be applied: ${result.reason}`,
				})
			}
			return
		}

		const result = this.#placeSelection(recovery.selection)
		this._store.caret.recovery(undefined)
		if (!result.ok) {
			this.diagnostics({
				kind: 'recoveryFailed',
				reason: `pending selection recovery could not be applied: ${result.reason}`,
			})
		}
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
import type {
	BoundaryPositionResult,
	DomDiagnostic,
	DomIndex,
	DomRef,
	NodeLocationResult,
	RawSelection,
	RawSelectionResult,
	Result,
	TokenAddress,
	TokenPath,
} from '../../shared/editorContracts'
import {batch, computed, event, signal, watch} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {CaretModel} from '../caret/CaretModel'
import {enableFocus} from '../caret/focus'
import {enableSelection} from '../caret/selection'
import type {Lifecycle} from '../lifecycle/Lifecycle'
import type {Token} from '../parsing'
import type {ParseController} from '../parsing/ParseController'
import {pathEquals, pathKey} from '../parsing/tokenIndex'
import type {TokenIndex} from '../parsing/tokenIndex'
import type {PropsModel} from '../props/PropsModel'
import type {ValueModel} from '../value/ValueModel'

type RegisteredRole =
	| {readonly role: 'control'}
	| {
			readonly role: 'childSequence' | 'row' | 'token' | 'text'
			readonly path: TokenPath
			readonly address: TokenAddress
	  }

type PathElements = {
	path: TokenPath
	address: TokenAddress
	rowElement?: HTMLElement
	tokenElement: HTMLElement
	textElement?: HTMLElement
}

type ControlRegistration = {
	readonly ownerPath?: TokenPath
	readonly element: HTMLElement
}

type ChildSequenceRegistration = {
	readonly ownerPath: TokenPath
	readonly element: HTMLElement
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

export class DomController {
	readonly #domIndex = signal<DomIndex | undefined>(undefined, {readonly: true})
	readonly index: Computed<DomIndex | undefined> = computed(() => this.#domIndex())
	readonly container = signal<HTMLElement | null>(null)
	readonly diagnostics = event<DomDiagnostic>()

	readonly #pendingControls = new Map<string, ControlRegistration>()
	readonly #pendingChildSequences = new Map<string, ChildSequenceRegistration>()
	#nextControlId = 0
	#nextChildSequenceId = 0
	#elementRoles = new WeakMap<HTMLElement, RegisteredRole>()
	#pathElements = new Map<string, PathElements>()
	#generation = 0
	#rendering = false
	#isComposing = false
	#queuedRender = false

	constructor(
		private readonly lifecycle: Lifecycle,
		private readonly props: PropsModel,
		private readonly caret: CaretModel,
		private readonly parsing: ParseController,
		private readonly value: ValueModel
	) {
		caret._bindDom(this)
		lifecycle.onMounted(() => {
			enableFocus({dom: this, caret, parsing})
			enableSelection({dom: this, caret})
			watch(lifecycle.rendered, () => {
				this.#handleRendered()
			})
			watch(
				computed(() => ({
					readOnly: props.readOnly(),
					selecting: caret.selecting(),
				})),
				() => this.reconcile()
			)
		})
	}

	compositionStarted(): void {
		this.#isComposing = true
	}

	compositionEnded(): void {
		if (!this.#isComposing) return
		this.#isComposing = false
	}

	controlFor(ownerPath?: TokenPath): DomRef {
		const key = `control:${ownerPath ? pathKey(ownerPath) : 'global'}:${++this.#nextControlId}`

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
		const key = `children:${pathKey(ownerPath)}:${++this.#nextChildSequenceId}`

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
		this.#reconcileStructuralTextSurfaces()
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
		const resolved = this.parsing.index().resolveAddress(address)
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

		const token = this.parsing.index().resolveAddress(location.value.address)
		if (!token.ok) return {ok: false, reason: 'notIndexed'}

		if (node instanceof HTMLElement) {
			const role = this.#elementRoles.get(node)
			if (role?.role === 'childSequence') {
				const childCount = node.childNodes.length
				if (offset <= 0) return {ok: true, value: token.value.position.start}
				if (offset >= childCount) return {ok: true, value: token.value.position.end}
				return this.#rawPositionFromTokenChildBoundary(node, offset, token.value, affinity)
			}
		}

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
		const container = this.container()
		if (!container) {
			this.diagnostics({kind: 'missingContainer', reason: 'container is not registered'})
			return
		}

		const tokenIndex = this.parsing.index()
		const pathElements = new Map<string, PathElements>()
		const elementRoles = new WeakMap<HTMLElement, RegisteredRole>()
		const controlElements = new Set<HTMLElement>()

		for (const {element} of this.#pendingControls.values()) {
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
		this.#applyRangeToDOM()
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

		const ownerKey = pathKey(path)
		if (hosts.length !== 1) {
			this.diagnostics({
				kind: 'ambiguousStructure',
				path,
				reason: `expected exactly 1 child sequence host for owner path ${ownerKey} but found ${hosts.length}`,
			})
			return
		}

		const host = hosts[0]
		if (!ownerElement.contains(host)) {
			this.diagnostics({
				kind: 'ambiguousStructure',
				path,
				reason: `child sequence host for owner path ${ownerKey} is not contained by owner token element`,
			})
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
		if (rows.length !== tokens.length) {
			this.diagnostics({
				kind: 'ambiguousStructure',
				reason: `expected ${tokens.length} block rows but found ${rows.length}`,
			})
		}

		tokens.forEach((token, i) => {
			const row = rows.at(i)
			if (!row) return
			const candidates = this.#elementChildren(row).filter(child => !this.#isControlRoot(child, controlElements))
			if (candidates.length !== 1) {
				this.diagnostics({
					kind: 'ambiguousStructure',
					path: [i],
					reason: `expected 1 block token element but found ${candidates.length}`,
				})
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
			this.diagnostics({
				kind: 'ambiguousStructure',
				path: basePath.length ? basePath : undefined,
				reason: `expected ${tokens.length} child token elements but found ${elements.length}`,
			})
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
			this.diagnostics({kind: 'stalePath', path, reason: 'structural path no longer resolves'})
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

	#reconcileStructuralTextSurfaces(): void {
		const tokenIndex = this.parsing.index()
		const editable = this.props.readOnly() || this.caret.selecting() ? 'false' : 'true'

		for (const record of this.#pathElements.values()) {
			const resolved = tokenIndex.resolveAddress(record.address)
			if (!resolved.ok) {
				this.diagnostics({
					kind: 'stalePath',
					path: record.path,
					reason: 'structural path became stale during reconciliation',
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

			if (resolved.value.type === 'mark') {
				if (this.props.readOnly()) {
					record.tokenElement.removeAttribute('tabindex')
				} else {
					record.tokenElement.tabIndex = 0
				}
			}
		}
	}

	#rawPositionFromContainerBoundary(offset: number, affinity: 'before' | 'after'): BoundaryPositionResult {
		const tokens = this.parsing.tokens()
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
			const textElement = this.#pathElements.get(pathKey(this.parsing.index().pathFor(token) ?? []))?.textElement
			if (!textElement || textLength(textElement) === 0) return {ok: true, value: token.position.start}
		}

		const before = this.#locateRegisteredDescendant(tokenElement.childNodes.item(offset - 1))
		const after = this.#locateRegisteredDescendant(tokenElement.childNodes.item(offset))
		if (before?.ok && after?.ok) {
			const beforeToken = this.parsing.index().resolveAddress(before.value.address)
			const afterToken = this.parsing.index().resolveAddress(after.value.address)
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
		const tokenIndex = this.parsing.index()

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
		const tokenIndex = this.parsing.index()

		for (const record of this.#pathElements.values()) {
			const resolved = tokenIndex.resolveAddress(record.address)
			if (!resolved.ok || resolved.value.type !== 'mark') continue
			if (rawPosition !== resolved.value.position.start && rawPosition !== resolved.value.position.end) continue

			const boundary = rawPosition === resolved.value.position.end ? 'end' : 'start'
			record.tokenElement.focus()
			this.#placeCollapsedBoundary(
				record.tokenElement,
				boundary === 'end' ? record.tokenElement.childNodes.length : 0
			)
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

	#applyRangeToDOM(): void {
		if (this.caret.selecting() === 'drag') return
		const range = this.caret.range()
		if (range === undefined) return

		const maxPos = this.value.current().length
		const clampedStart = Math.min(range.start, maxPos)
		const clampedEnd = Math.min(range.end, maxPos)

		// Write back clamped values; structural equality prevents re-propagation if unchanged.
		if (clampedStart !== range.start || clampedEnd !== range.end) {
			this.caret.select({start: clampedStart, end: clampedEnd})
		}

		if (clampedStart === clampedEnd) {
			const result = this.placeCaretAtRawPosition(clampedStart)
			if (!result.ok) {
				this.caret.range(undefined)
				this.diagnostics({kind: 'recoveryFailed', reason: `caret placement failed: ${result.reason}`})
			}
			return
		}

		const result = this.#placeSelection({range: {start: clampedStart, end: clampedEnd}, direction: undefined})
		if (!result.ok) {
			this.caret.range(undefined)
			this.diagnostics({kind: 'recoveryFailed', reason: `selection placement failed: ${result.reason}`})
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
}
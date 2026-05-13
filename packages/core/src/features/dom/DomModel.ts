import {firstHtmlChild} from '../../shared/checkers'
import type {
	BoundaryPositionResult,
	DomDiagnostic,
	DomIndex,
	DomRef,
	NodeLocationResult,
	Range,
	RawSelection,
	RawSelectionResult,
	Result,
	TokenAddress,
	TokenPath,
} from '../../shared/editorContracts'
import {computed, event, listen, signal} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {Lifecycle} from '../lifecycle/Lifecycle'
import type {Token} from '../parsing'
import type {ParseController} from '../parsing/ParseController'
import {pathKey} from '../parsing/tokenIndex'
import type {PropsModel} from '../props/PropsModel'
import type {ValueModel} from '../value/ValueModel'
import type {ChildSequenceRegistration, ControlRegistration, DomIndexerHost} from './DomIndexer'
import {DomIndexer} from './DomIndexer'
import {hasEditableAncestorBefore, nextTextNode, textLength, textOffsetWithin} from './textOffsets'

export class DomModel {
	readonly container = signal<HTMLElement | null>(null)
	readonly diagnostics = event<DomDiagnostic>()
	readonly indexed = event<void>()
	readonly readOnly: Computed<boolean> = computed(() => this.props.readOnly())

	readonly #pendingControls = new Map<string, ControlRegistration>()
	readonly #pendingChildSequences = new Map<string, ChildSequenceRegistration>()
	#nextControlId = 0
	#nextChildSequenceId = 0
	#isComposing = false

	readonly #indexer: DomIndexer
	readonly index: Computed<DomIndex | undefined>

	constructor(
		private readonly lifecycle: Lifecycle,
		private readonly props: PropsModel,
		private readonly parsing: ParseController,
		private readonly value: ValueModel
	) {
		const host: DomIndexerHost = {
			container: () => this.container(),
			pendingControls: () => this.#pendingControls.values(),
			pendingChildSequences: () => this.#pendingChildSequences.values(),
			emitDiagnostic: diagnostic => this.diagnostics(diagnostic),
			emitIndexed: () => this.indexed(),
		}
		this.#indexer = new DomIndexer(host, lifecycle, props, parsing)
		this.index = this.#indexer.index

		lifecycle.onMounted(() => {
			const container = this.container()
			if (container) {
				listen(container, 'click', () => {
					const tokens = this.parsing.tokens()
					if (tokens.length === 1 && tokens[0].type === 'text' && tokens[0].content === '') {
						const c = this.container()
						const element = c ? firstHtmlChild(c) : null
						element?.focus()
					}
				})
			}
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

	reconcile(opts?: {isUserSelecting?: boolean}): void {
		this.#indexer.reconcile(opts)
	}

	locateNode(node: Node): NodeLocationResult {
		return this.#indexer.locateNode(node)
	}

	placeAt(
		rawPosition: number,
		affinity: 'before' | 'after' = 'after'
	): Result<{applied: number}, 'notIndexed' | 'invalidBoundary'> {
		if (!this.index()) return {ok: false, reason: 'notIndexed'}
		const maxPos = this.value.current().length
		const clamped = Math.min(rawPosition, maxPos)
		const target = this.#findTextTargetForRawPosition(clamped, affinity)
		if (!target) {
			const boundary = this.#focusMarkBoundaryForRawPosition(clamped)
			if (!boundary.ok) return boundary
			return {ok: true, value: {applied: clamped}}
		}
		target.element.focus()
		this.#placeCaretInTextSurface(target.element, clamped - target.start)
		return {ok: true, value: {applied: clamped}}
	}

	placeRange(range: Range): Result<{applied: Range}, 'notIndexed' | 'invalidBoundary'> {
		const maxPos = this.value.current().length
		const clamped: Range = {
			start: Math.min(range.start, maxPos),
			end: Math.min(range.end, maxPos),
		}
		const result = this.#placeSelection({range: clamped, direction: undefined})
		if (!result.ok) return result
		return {ok: true, value: {applied: clamped}}
	}

	focusAddress(address: TokenAddress, boundary: 'start' | 'end' = 'start'): Result<void, 'notIndexed' | 'stale'> {
		if (!this.index()) return {ok: false, reason: 'notIndexed'}
		const resolved = this.parsing.index().resolveAddress(address)
		if (!resolved.ok) return {ok: false, reason: 'stale'}

		const elements = this.#indexer.pathElementsFor(address)
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
			const role = this.#indexer.roleFor(node)
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
			const path = this.parsing.index().pathFor(token) ?? []
			const address = this.parsing.index().addressFor(path)
			const textElement = address ? this.#indexer.pathElementsFor(address)?.textElement : undefined
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

		for (const record of this.#indexer.pathElements()) {
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

		for (const record of this.#indexer.pathElements()) {
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
import {describe, it, expect, vi} from 'vitest'

import {Store} from '../../store/Store'
import {
	consignRendered,
	mountStructuralInline,
	mountStructuralInlineMark,
	mountValue,
	mountWithMark,
	selectionRange,
} from '../tokens/__testing__/mountFixtures'
import {offsetOfAnchor} from '../tokens/tree/anchors'

/**
 * A consumer's own editable island inside a mark — the shape the guard must neither edit
 * nor cancel. Built on the shared empty-mark fixture, which exists for exactly this: the
 * island is presentation the adapter rendered, and `bind` gives a mark no text surface, so
 * hanging it off the mark after the mount binds the same state as building it before.
 */
function mountStructuralMarkWithDescendant(value = '@[world]', editableSpelling = 'true') {
	const {store, container, mark} = mountStructuralInlineMark(value)
	const descendant = document.createElement('span')
	// The ATTRIBUTE, in the consumer's own spelling — Chromium normalizes '' and 'TRUE'
	// to the `contentEditable` property value 'true', which is what the guard reads.
	descendant.setAttribute('contenteditable', editableSpelling)
	descendant.textContent = 'inner'
	mark.append(descendant)
	const descendantText = descendant.firstChild
	if (!(descendantText instanceof Text)) throw new Error('Structural mark descendant did not render a text node')
	return {store, container, descendantText}
}

/**
 * '@[a @[b] c]' — a mark whose slot children hang off a registered child-sequence host, the
 * shape an adapter renders for a `__slot__` markup. The parse brackets the mark with empty text
 * tokens, so the container holds three root elements.
 *
 * Consigned explicitly rather than through `consignRendered`, which pairs a mark's children
 * with the mark ELEMENT's own children: here they hang off the host one level down, so that
 * helper hands the 'a ' token the host itself and its text effect overwrites the whole slot.
 * The shared `mountNested` has that defect today, which is why this fixture is local.
 */
function mountNestedSlot() {
	const store = new Store()
	store.props.set({
		separator: null,
		defaultValue: '@[a @[b] c]',
		options: [{markup: '@[__slot__]'}],
		Mark: () => null,
	})
	const container = document.createElement('div')
	const leading = document.createElement('span')
	const outer = document.createElement('mark')
	const host = document.createElement('span')
	const before = document.createElement('span')
	const inner = document.createElement('mark')
	const after = document.createElement('span')
	const trailing = document.createElement('span')
	host.style.display = 'contents'
	host.append(before, inner, after)
	outer.append(host)
	container.append(leading, outer, trailing)
	document.body.append(container)
	store.host.container(container)
	const roots = store.tokens.nodes()
	const mark = roots[1]
	if (mark.kind !== 'mark') throw new Error('expected the slot mark as the middle root')
	store.tokens.children(mark.id)(host)
	const consign = (id: number, element: HTMLElement) => store.tokens.consign(id)(element)
	consign(roots[0].id, leading)
	consign(mark.id, outer)
	consign(roots[2].id, trailing)
	const children = mark.children()
	consign(children[0].id, before)
	consign(children[1].id, inner)
	consign(children[2].id, after)
	return {store, container, leading, host, before}
}

/**
 * A NESTED document as an adapter paints it: the parent row's own element is both its token
 * element and its INLINE child-sequence host, and a separate `display: contents` span hosts its
 * child rows — the two named parts `TokenModel.children(id, part)` registers.
 */
function mountNestedRows() {
	const store = new Store()
	store.props.set({separator: '\n', indent: '\t', defaultValue: 'a\n\tb', options: [], Mark: () => null})
	const container = document.createElement('div')
	const parent = document.createElement('div')
	const parentText = document.createElement('span')
	const rowsHost = document.createElement('span')
	const child = document.createElement('div')
	const childText = document.createElement('span')
	rowsHost.style.display = 'contents'
	child.append(childText)
	rowsHost.append(child)
	parent.append(parentText, rowsHost)
	container.append(parent)
	document.body.append(container)
	store.host.container(container)
	const roots = store.tokens.nodes()
	const row = roots[0]
	if (row.kind !== 'row') throw new Error('expected a row root')
	const nested = row.rows()[0]
	const consign = (id: number, element: HTMLElement) => store.tokens.consign(id)(element)
	consign(row.id, parent)
	store.tokens.children(row.id)(parent)
	store.tokens.children(row.id, 'rows')(rowsHost)
	consign(row.inline()[0].id, parentText)
	consign(nested.id, child)
	store.tokens.children(nested.id)(child)
	consign(nested.inline()[0].id, childText)
	return {store, container, rowsHost, nested}
}

/** A registered control root (row menu, custom control) holding its own `<input>`. */
function mountInlineWithControl(value = 'hello') {
	const store = new Store()
	store.props.set({separator: null, defaultValue: value})
	const container = document.createElement('div')
	const textSurface = document.createElement('span')
	const control = document.createElement('div')
	const controlInput = document.createElement('input')
	control.append(controlInput)
	container.append(textSurface, control)
	document.body.append(container)
	store.host.container(container)
	store.tokens.control()(control)
	consignRendered(store, container)
	return {store, container, controlInput}
}

/**
 * Two ADJACENT marks. The parser puts an EMPTY text token between them and every adapter
 * renders its bare span, so the container children are [text, mark, GAP, mark, text] and the
 * boundary between the two marks is the CONTAINER offset 2. MEASURED in Chromium (react demo
 * app, real keys): one ArrowRight off the end of the preceding text stops exactly there, and
 * the raw `selectionchange` reports `DIV(host):2` before the driver re-places it.
 */
function mountAdjacentMarks() {
	return mountValue('a@[m1](1)@[m2](2)b', {options: [{markup: '@[__value__](__meta__)'}], Mark: () => null})
}

/** Collapse the window selection onto one DOM boundary and hand back the range it made. */
function selectBoundary(node: Node, offset: number): Range {
	const selection = window.getSelection()
	if (!selection) throw new Error('no window selection')
	const range = document.createRange()
	range.setStart(node, offset)
	range.collapse(true)
	selection.removeAllRanges()
	selection.addRange(range)
	return range
}

/**
 * {@link mountAdjacentMarks} under a CONTROLLED parent that echoes every `onChange` straight
 * back, the way an adapter's `useState` does. The echo is what owns the caret there.
 */
function mountControlledAdjacentMarks() {
	const store = new Store()
	const echoed = {value: 'a@[m1](1)@[m2](2)b'}
	store.props.set({
		separator: null,
		value: echoed.value,
		onChange: (next: string) => {
			echoed.value = next
			store.props.update({value: next})
		},
		options: [{markup: '@[__value__](__meta__)'}],
		Mark: () => null,
	})
	const container = document.createElement('div')
	document.body.append(container)
	store.host.container(container)
	for (const _root of store.tokens.nodes()) container.append(document.createElement('span'))
	consignRendered(store, container)
	return {store, container, echoed}
}

/** The live caret as the browser would hand it to `getTargetRanges()` on the next keystroke. */
function liveCaretRange(): Range {
	const selection = window.getSelection()
	if (!selection?.rangeCount) throw new Error('no window selection')
	return selection.getRangeAt(0)
}

/**
 * A document with ROWS and a MARK at one edge — the shape the select-all defect lived in, kept as
 * its regression gate. The premise that made it reachable is gone: a document with rows no longer
 * filters the empty text tokens a mark is bracketed with, because a row's body is built by
 * `TreeBuilder` and opens and closes with one.
 *
 * One `<div>` per ROOT holding exactly one token element — the row wrapper and the token
 * element are consigned separately, which is how `bind` tells them apart; a mark with children
 * gets one element per child, a markless one gets the presentation text an adapter would render.
 */
function mountRowWithMarkEdge(value: string) {
	const store = new Store()
	store.props.set({
		defaultValue: value,
		separator: '\n\n',
		Mark: () => null,
		options: [{markup: '@[__value__](__meta__)'}],
	})
	const container = document.createElement('div')
	document.body.append(container)
	store.host.container(container)
	for (const root of store.tokens.nodes()) {
		const row = document.createElement('div')
		const children = root.kind === 'row' ? root.children() : []
		for (const child of children) {
			const element = document.createElement('span')
			// A mark child renders presentation text; a text child's span is its Surface
			if (child.kind === 'mark') element.append(document.createTextNode('MARK'))
			row.append(element)
			store.tokens.consign(child.id)(element)
		}
		container.append(row)
		store.tokens.consign(root.id)(row)
	}
	return {store, container}
}

/** The live DOM selection as document offsets — what the model believes is SHOWN. */
function domSelectionRange(store: Store): {start: number; end: number} | undefined {
	const anchors = store.tokens.domAnchors()
	if (!anchors) return undefined
	const roots = store.tokens.nodes()
	const anchor = offsetOfAnchor(roots, anchors.anchor)
	const head = offsetOfAnchor(roots, anchors.head)
	return anchor <= head ? {start: anchor, end: head} : {start: head, end: anchor}
}

function inputEvent(inputType: string, range: Range, init?: InputEventInit): InputEvent {
	const event = new InputEvent('beforeinput', {
		inputType,
		bubbles: true,
		cancelable: true,
		...init,
	})
	Object.defineProperty(event, 'getTargetRanges', {value: () => [range]})
	return event
}

describe('handleBeforeInput()', () => {
	it('inserts text at the target range resolved as anchors', () => {
		const {store, container, textNode} = mountStructuralInline('hello')
		const replace = vi.spyOn(store.edit, 'replace')
		const node = store.tokens.nodes()[0]
		const range = document.createRange()
		range.setStart(textNode, 1)
		range.setEnd(textNode, 1)
		const event = inputEvent('insertText', range, {data: 'x'})

		// Drive handleBeforeInput through the beforeinput listener enableInput
		// wired at mount (capture phase on the container).
		textNode.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		// The DOM boundary resolves to the LIVE node, not to the number 1 (spec S2 §4.5).
		expect(replace).toHaveBeenCalledWith({node, offset: 1}, {node, offset: 1}, 'x')
		expect(selectionRange(store)).toEqual({start: 2, end: 2})
		container.remove()
	})

	it('types two characters into the gap of a CONTROLLED document, through the echo', async () => {
		// The controlled path is a different caret owner: `EditController` moves no caret there
		// (the tree has not changed yet), so the post-edit position comes from the ECHO's
		// repair — `map` re-anchoring the captured selection through `anchorAt`. A left-leaning
		// reading of the mark fallback once landed the second character before the preceding
		// mark here ('aY@[m1](1)X@…'), which is why `anchorAt` carried a `side` parameter until
		// the branch it fed was measured unreachable on any parsed tree.
		//
		// This case does NOT discriminate that affinity and never did — MEASURED: the
		// unconditional arm leaves it green, because every offset it maps through IS covered by
		// a text token (the inline parse keeps the gap token, and the repair lands inside it).
		const {store, container, echoed} = mountControlledAdjacentMarks()
		selectBoundary(container, 2)
		// The driver's sync and re-place own the caret before the first keystroke, exactly as
		// they do between two real key events.
		await new Promise(resolve => setTimeout(resolve, 0))

		container.dispatchEvent(inputEvent('insertText', liveCaretRange(), {data: 'X'}))
		expect(echoed.value).toBe('a@[m1](1)X@[m2](2)b')
		await new Promise(resolve => setTimeout(resolve, 0))
		container.dispatchEvent(inputEvent('insertText', liveCaretRange(), {data: 'Y'}))

		expect(echoed.value).toBe('a@[m1](1)XY@[m2](2)b')
		expect(store.tokens.value()).toBe('a@[m1](1)XY@[m2](2)b')
		container.remove()
	})

	it('types two characters into the EMPTY token addressed by a container boundary', () => {
		// The one-host sweep's gap case, end to end: caret at the boundary between two
		// adjacent marks (container offset 2), then two keystrokes. Both must land in the
		// empty token between the marks, and the second one only can if the post-commit
		// caret names that same (now non-empty) node — its id survives adoption, which pairs
		// it with the parsed 'X' token in the middle region.
		const {store, container} = mountAdjacentMarks()
		const gap = store.tokens.nodes()[2]
		container.dispatchEvent(inputEvent('insertText', selectBoundary(container, 2), {data: 'X'}))
		expect(store.tokens.value()).toBe('a@[m1](1)X@[m2](2)b')

		// The SECOND keystroke reads the caret the commit left, exactly as the browser does.
		container.dispatchEvent(inputEvent('insertText', liveCaretRange(), {data: 'Y'}))

		expect(store.tokens.value()).toBe('a@[m1](1)XY@[m2](2)b')
		expect(store.tokens.nodes()[2]).toBe(gap)
		expect(selectionRange(store)).toEqual({start: 11, end: 11})
		container.remove()
	})

	it.each([
		['at the slot start', 0, '@[Xa @[b] c]'],
		['inside the slot text', 1, '@[aX @[b] c]'],
	])(
		'keeps a collapsed edit %s where the CARET is, not where the target range was canonicalized',
		(_label, caretOffset, expected) => {
			// MEASURED in the react demo app with real keys: a slot mark is bare by policy, so
			// the position before its first slot child and the position after the preceding text
			// are the same pixel, and Chromium canonicalizes a COLLAPSED target range to the
			// earliest of them — `text('…Slot doc: '):12`, outside the mark, while the caret sat
			// at `text('a'):0` inside it. The character spliced before the markup ('X#[a…]').
			//
			// `leading` is that outside boundary in this fixture: the leading root is the empty
			// text token at [0,0], so offset 0 is its only one. BOTH rows carry it as the target
			// and differ only in where the CARET sits — at the slot's start, and one character
			// into the slot's text. Neither is a control: the caret has to win in both, and both
			// go red on the precedence revert (the second lands 'X' outside as well, not merely
			// at the wrong offset inside).
			const {store, container, leading, before} = mountNestedSlot()
			const slotText = before.firstChild
			if (!(slotText instanceof Text)) throw new Error('expected the slot text surface to be filled')
			selectBoundary(slotText, caretOffset)
			const canonicalized = document.createRange()
			canonicalized.setStart(leading, 0)
			canonicalized.collapse(true)

			container.dispatchEvent(inputEvent('insertText', canonicalized, {data: 'X'}))

			expect(store.tokens.value()).toBe(expected)
			container.remove()
		}
	)

	it.each([
		['leading', 0, '@[Xa @[b] c]'],
		['trailing', 3, '@[a @[b] cX]'],
	])('types INTO the slot at its %s host edge', (_label, offset, expected) => {
		// A slot host holds the mark's children, so its edges are the slot's own start and
		// end. Answering with the OWNER's boundary put the character outside the markup
		// ('X@[a @[b] c]' / '@[a @[b] c]X') — the slot content is editable, so the caret at
		// that edge has exactly one meaning.
		const {store, container, host} = mountNestedSlot()

		container.dispatchEvent(inputEvent('insertText', selectBoundary(host, offset), {data: 'X'}))

		expect(store.tokens.value()).toBe(expected)
		container.remove()
	})

	it.each([
		['leading', 0, 'a\n\tXb'],
		['trailing', 1, 'a\n\tbX'],
	])('types INTO a nested row at its %s ROW-host edge', (_label, offset, expected) => {
		// The row twin of the slot-host pin above. A row's child-rows host holds its `rows()`, so
		// its edges are the FIRST child row's start and the LAST child row's end — not the parent
		// row's own boundary, which sits outside the whole subtree and would type into the parent
		// instead. Named parts are what make the answer decidable: a row's own element is its
		// INLINE host, so an unnamed second registration would be indistinguishable from it.
		const {store, container, rowsHost} = mountNestedRows()

		container.dispatchEvent(inputEvent('insertText', selectBoundary(rowsHost, offset), {data: 'X'}))

		expect(store.tokens.value()).toBe(expected)
		container.remove()
	})

	it('ignores beforeinput from editable mark descendants', () => {
		const {store, container, descendantText} = mountStructuralMarkWithDescendant()
		const replaceRange = vi.spyOn(store.tokens, 'replaceBetween')
		const range = document.createRange()
		range.setStart(descendantText, 0)
		range.setEnd(descendantText, 0)
		const event = inputEvent('insertText', range, {data: 'x'})

		// Through the wired beforeinput listener (see above).
		descendantText.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(false)
		expect(replaceRange).not.toHaveBeenCalled()
		container.remove()
	})

	it('does not wipe the value when an unhandled input type arrives with everything selected', () => {
		// MEASURED BUG, not a hypothesis: the all-selected branch used to compute
		// `event.data ?? ''` for every non-delete input type, so Enter (insertParagraph,
		// data === null) preventDefaulted and replaced the WHOLE value with ''. Measured
		// on a mounted store with defaultValue 'hello': {value: '', prevented: true}.
		// Enter now HAS a replacement ('\n', pinned below), so the unhandled type this
		// case needs is one the guard cannot express at all — and under one host it is
		// dropped rather than let through.
		const {store, container} = mountStructuralInline('hello')
		store.tokens.selection.selectAll()
		expect(store.tokens.selection.isAllSelected()).toBe(true)
		const event = new InputEvent('beforeinput', {inputType: 'formatBold', bubbles: true, cancelable: true})

		container.dispatchEvent(event)

		expect(store.tokens.value()).toBe('hello')
		expect(event.defaultPrevented).toBe(true)
		container.remove()
	})

	it('replaces the whole value with a newline on Enter with everything selected', () => {
		const {store, container} = mountStructuralInline('hello')
		store.tokens.selection.selectAll()
		const event = new InputEvent('beforeinput', {inputType: 'insertParagraph', bubbles: true, cancelable: true})

		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('\n')
		container.remove()
	})

	it('insertParagraph maps to a newline through the guard', () => {
		const {store, container, textNode} = mountStructuralInline('ab')
		const range = document.createRange()
		range.setStart(textNode, 1)
		range.setEnd(textNode, 1)
		const event = inputEvent('insertParagraph', range)

		textNode.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('a\nb')
		container.remove()
	})

	it('insertLineBreak maps to a newline through the guard', () => {
		const {store, container, textNode} = mountStructuralInline('ab')
		const range = document.createRange()
		range.setStart(textNode, 1)
		range.setEnd(textNode, 1)
		const event = inputEvent('insertLineBreak', range)

		textNode.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('a\nb')
		container.remove()
	})

	it('an unhandled cancelable inputType is prevented and changes nothing (fail closed)', () => {
		// Under one host every default this guard leaves standing edits the DOM the model
		// owns, so an input type it cannot express as an edit is dropped, not forwarded.
		const {store, container} = mountStructuralInline('ab')
		const event = new InputEvent('beforeinput', {inputType: 'formatBold', bubbles: true, cancelable: true})

		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('ab')
		container.remove()
	})

	it('fails an unhandled type closed even when it originates BELOW the container', () => {
		// THE discriminating shape: a real beforeinput carries a target range INSIDE the
		// host, and everything in there INHERITS `isContentEditable` from the container.
		// An inherited-editability test therefore reads every ordinary edit as a consumer
		// island and lets it through — the case dispatched on the container cannot see it.
		const {store, container, textNode} = mountStructuralInline('ab')
		const range = document.createRange()
		range.setStart(textNode, 0)
		range.setEnd(textNode, 2)
		const event = inputEvent('formatBold', range)

		textNode.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('ab')
		container.remove()
	})

	it('leaves an unhandled type alone inside an EXPLICIT contenteditable island', () => {
		// The consumer's own DOM, marked as such by an explicit attribute — the model
		// neither owns it nor resolves boundaries in it, so cancelling would only freeze
		// the widget.
		const {store, container, descendantText} = mountStructuralMarkWithDescendant()
		const range = document.createRange()
		range.setStart(descendantText, 0)
		range.setEnd(descendantText, 5)
		const event = inputEvent('formatBold', range)

		descendantText.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(false)
		expect(store.tokens.value()).toBe('@[world]')
		container.remove()
	})

	it.each([
		['the empty-string spelling', ''],
		['an upper-case spelling', 'TRUE'],
	])('leaves an unhandled type alone inside an island written with %s', (_label, spelling) => {
		const {store, container, descendantText} = mountStructuralMarkWithDescendant('@[world]', spelling)
		const range = document.createRange()
		range.setStart(descendantText, 0)
		range.setEnd(descendantText, 5)
		const event = inputEvent('formatBold', range)

		descendantText.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(false)
		expect(store.tokens.value()).toBe('@[world]')
		container.remove()
	})

	it('inserts the dropped text at the caret the drop moved', () => {
		// THE SHIPPED PATH. A caret drop is COLLAPSED and Chromium moves the live selection to
		// the drop point before firing `insertFromDrop`, so the target range and the caret name
		// the same boundary and the collapsed arm resolves it through `domAnchors`. (Only
		// `deleteByDrag` — the source half of a move — is ranged.)
		const {store, container, textNode} = mountStructuralInline('ab')
		const dataTransfer = new DataTransfer()
		dataTransfer.setData('text/plain', 'X')
		const event = inputEvent('insertFromDrop', selectBoundary(textNode, 1), {dataTransfer})

		textNode.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('aXb')
		container.remove()
	})

	it('inserts the dropped text from the target range when the selection cannot be read', () => {
		// The same drop with no window selection — the fallback arm for a NON-delete input
		// type, which the mark-swallow case cannot cover: it pins that the fallback still
		// carries the payload and the position, not just that a delete expands correctly.
		const {store, container, textNode} = mountStructuralInline('ab')
		const dataTransfer = new DataTransfer()
		dataTransfer.setData('text/plain', 'X')
		const range = document.createRange()
		range.setStart(textNode, 1)
		range.collapse(true)
		window.getSelection()?.removeAllRanges()
		const event = inputEvent('insertFromDrop', range, {dataTransfer})

		textNode.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('aXb')
		container.remove()
	})

	it('takes the RANGED live selection over a collapsed target range', () => {
		// DECLARED BEHAVIOUR CHANGE, and the pin it replaces had it backwards on a premise that
		// has since been measured false. It read "Chromium sets the live selection to the caret
		// the event describes, so this disagreement is not one it produces" — a row selection
		// across a FROZEN row produces exactly it. That selection is not an editable extent, so
		// Chromium canonicalizes the target range to the nearest position it can name, which is
		// in the row ABOVE: on the showcase's bookmark the row painted as selected and the typed
		// character appended to the quote above it. The selection the user can SEE is the answer.
		const {store, container, textNode} = mountStructuralInline('ab')
		const selection = window.getSelection()
		if (!selection) throw new Error('no window selection')
		const spread = document.createRange()
		spread.setStart(textNode, 0)
		spread.setEnd(textNode, 2)
		selection.removeAllRanges()
		selection.addRange(spread)
		const caret = document.createRange()
		caret.setStart(textNode, 1)
		caret.collapse(true)

		textNode.dispatchEvent(inputEvent('insertText', caret, {data: 'X'}))

		expect(store.tokens.value()).toBe('X')
		container.remove()
	})

	it('a RANGED target range outranks the live caret', () => {
		// The other half of the precedence contract, and it needs its own case: a ranged target
		// carries an EXTENT the caret does not. MEASURED in Chromium on `deleteWordBackward`
		// (Alt/Ctrl+Backspace): the target spans the whole word while the live selection is the
		// collapsed caret at its end. Resolving the caret instead would hand `anchorsForDelete`
		// a collapsed pair and delete ONE character (or swallow a neighbouring mark).
		const {store, container, textNode} = mountStructuralInline('alpha beta')
		selectBoundary(textNode, 6)
		const word = document.createRange()
		word.setStart(textNode, 0)
		word.setEnd(textNode, 6)
		const event = inputEvent('deleteWordBackward', word)

		textNode.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('beta')
		container.remove()
	})

	it('a non-cancelable inputType passes through untouched', () => {
		// A CHARACTERIZATION pin, and it cannot be otherwise: `preventDefault` on an
		// uncancelable event is a no-op, so deleting the guard's `!event.cancelable` return
		// keeps this green. That return earns its place by keeping Chromium from logging
		// "Ignored attempt to cancel a beforeinput event with cancelable=false" on every
		// composition keystroke — console noise no assertion here can see.
		const {store, container} = mountStructuralInline('ab')
		const event = new InputEvent('beforeinput', {
			inputType: 'insertCompositionText',
			bubbles: true,
			cancelable: false,
		})

		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(false)
		expect(store.tokens.value()).toBe('ab')
		container.remove()
	})

	it('leaves a control root alone even when the model believes everything is selected', () => {
		// MEASURED HARM the consumer-origin test prevents: the all-selected branch keys on
		// the STORED selection, so a character typed into a control's own `<input>` used to
		// replace the whole value with that character.
		const {store, container, controlInput} = mountInlineWithControl()
		store.tokens.selection.selectAll()
		const event = new InputEvent('beforeinput', {
			inputType: 'insertText',
			data: 'z',
			bubbles: true,
			cancelable: true,
		})

		controlInput.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(false)
		expect(store.tokens.value()).toBe('hello')
		container.remove()
	})

	it('leaves Ctrl/Cmd+A to a consumer EDITABLE ISLAND', () => {
		// The keydown tier's half of the consumer-origin rule, and the asymmetry it closes:
		// `handleBeforeInput` has exempted explicit islands all along, this branch exempted
		// CONTROLS only. So Ctrl+A inside a consumer's own editable widget took the model's
		// select-all — measured harm, because the next character then reached the
		// all-selected branch and replaced the whole value with it.
		const {store, container, descendantText} = mountStructuralMarkWithDescendant()
		const event = new KeyboardEvent('keydown', {code: 'KeyA', ctrlKey: true, bubbles: true, cancelable: true})

		descendantText.parentElement?.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(false)
		expect(store.tokens.selection.isAllSelected()).toBe(false)
		expect(store.tokens.selection.anchors()).toBeUndefined()
		container.remove()
	})

	it('leaves Ctrl/Cmd+A to a control root', () => {
		const {store, container, controlInput} = mountInlineWithControl()

		const event = new KeyboardEvent('keydown', {code: 'KeyA', ctrlKey: true, bubbles: true, cancelable: true})
		controlInput.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(false)
		expect(store.tokens.selection.isAllSelected()).toBe(false)
		container.remove()
	})

	it('Ctrl/Cmd+A selects all from the input keydown path', () => {
		const {store, container} = mountStructuralInline('ab')

		const event = new KeyboardEvent('keydown', {code: 'KeyA', ctrlKey: true, bubbles: true, cancelable: true})
		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.selection.isAllSelected()).toBe(true)
		container.remove()
	})

	it('still replaces the whole value on insertText with everything selected', () => {
		const {store, container} = mountStructuralInline('hello')
		store.tokens.selection.selectAll()
		const event = new InputEvent('beforeinput', {
			inputType: 'insertText',
			data: 'a',
			bubbles: true,
			cancelable: true,
		})

		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('a')
		container.remove()
	})

	it('still clears the whole value on a delete input type with everything selected', () => {
		const {store, container} = mountStructuralInline('hello')
		store.tokens.selection.selectAll()
		const event = new InputEvent('beforeinput', {
			inputType: 'deleteContentBackward',
			bubbles: true,
			cancelable: true,
		})

		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('')
		container.remove()
	})

	/**
	 * THE mark-swallow gate (spec S2 AC-4.4), and the only one outside the browser suites:
	 * a caret sitting exactly on a mark's boundary deletes the WHOLE mark, not one character
	 * of the neighbouring text.
	 *
	 * Both directions are asserted because that is what makes the case discriminate —
	 * measured: inverting `anchorsForDelete`'s direction (`-1`/`+1` swapped) turns BOTH red,
	 * where either one alone would only pin "some mark got deleted".
	 */
	describe('mark swallow', () => {
		/** Collapse the window selection onto one DOM boundary — the caret a delete key reads. */
		function caretAt(node: Node, offset: number) {
			const selection = window.getSelection()
			if (!selection) throw new Error('no window selection')
			const range = document.createRange()
			range.setStart(node, offset)
			range.setEnd(node, offset)
			selection.removeAllRanges()
			selection.addRange(range)
		}

		it('Backspace right AFTER a mark deletes the mark', () => {
			// 'he@[x]llo' — the text surfaces mount empty and the per-node text effect fills
			// them at bind, so `text2.firstChild` is the 'llo' node the caret needs.
			const {store, container, text2} = mountWithMark()
			caretAt(text2.firstChild!, 0)

			container.dispatchEvent(new KeyboardEvent('keydown', {key: 'Backspace', bubbles: true, cancelable: true}))

			expect(store.tokens.value()).toBe('hello')
			container.remove()
		})

		it('Delete right BEFORE a mark deletes the mark', () => {
			const {store, container, text1} = mountWithMark()
			caretAt(text1.firstChild!, 2)

			container.dispatchEvent(new KeyboardEvent('keydown', {key: 'Delete', bubbles: true, cancelable: true}))

			expect(store.tokens.value()).toBe('hello')
			container.remove()
		})

		it('swallows the mark when the delete target range is a COLLAPSED container boundary', () => {
			// The caret between two adjacent marks is a CONTAINER boundary, and Chromium's own
			// delete target ranges are anchored there. Read with both affinities that one
			// boundary answers `{before: the gap token}` and `{after: the first mark}` — two
			// names, one position — and `anchorsForDelete`'s collapsed test is `anchorEquals`,
			// so the caret used to read as a RANGE: no swallow, an empty replace, and the
			// keystroke lost to the guard's own `preventDefault`.
			//
			// This one resolves through the LIVE CARET (`selectBoundary` leaves the window
			// selection on the same boundary, where `domAnchors` measures `{before: the gap}`),
			// so it pins the collapse in `SelectionDriver`. The target-range collapse has its
			// own case below. The keydown path discriminates neither: it has always read
			// `domAnchors()`.
			const {store, container} = mountAdjacentMarks()
			const range = selectBoundary(container, 2)
			const event = inputEvent('deleteContentBackward', range)

			container.dispatchEvent(event)

			expect(event.defaultPrevented).toBe(true)
			expect(store.tokens.value()).toBe('a@[m2](2)b')
			container.remove()
		})

		it('swallows the mark from the TARGET RANGE alone when the window selection is gone', () => {
			// THE fallback arm, and the only case that reaches it: with no window selection
			// `domAnchors()` declines, so the collapsed target range is the sole reading — and
			// its two affinities name that one boundary twice unless the reader collapses it.
			// Chromium produces exactly this state on a caret event whose selection was cleared
			// (a control took focus, a re-render dropped the range).
			const {store, container} = mountAdjacentMarks()
			const range = document.createRange()
			range.setStart(container, 2)
			range.collapse(true)
			window.getSelection()?.removeAllRanges()
			expect(store.tokens.domAnchors()).toBeUndefined()
			const event = inputEvent('deleteContentBackward', range)

			container.dispatchEvent(event)

			expect(event.defaultPrevented).toBe(true)
			expect(store.tokens.value()).toBe('a@[m2](2)b')
			container.remove()
		})
	})

	/**
	 * SELECT-ALL over a document whose EDGE is a mark — silent data loss until this pair
	 * landed, and it took two roots to reach: `anchorAt`'s mark fallback answered offset 0 with
	 * the mark's END, and `selectRange` refused an endpoint without a text surface.
	 *
	 * Mark-LAST lost the DOM half only: stored anchors said all-selected while the DOM
	 * selection never moved, so the next keystroke replaced a document nothing showed as
	 * selected. Mark-FIRST lost both: `{after: mark}` projected to the mark's END, so
	 * `isAllSelected` was false, and the keystroke that follows a cancelled Ctrl+A edited one
	 * character where the user expected a replacement.
	 *
	 * The first root was closed by a `side` parameter and is now closed by the parser: a row's
	 * body opens with a text token, so offset 0 resolves inside it and never reaches the
	 * fallback. THIS is the case that would catch that invariant
	 * breaking — `tree/anchors.spec` pins it directly.
	 */
	describe('select-all over mark-edge row documents', () => {
		const ctrlA = () => new KeyboardEvent('keydown', {code: 'KeyA', ctrlKey: true, bubbles: true, cancelable: true})

		it.each([
			['LAST', 'plain\n\n@[m](1)'],
			['FIRST', '@[m](1)\n\nplain\n\n'],
		])('selects the whole document when the mark is %s', (_label, value) => {
			const {store, container} = mountRowWithMarkEdge(value)
			const length = store.tokens.value().length

			container.dispatchEvent(ctrlA())

			expect(store.tokens.selection.isAllSelected()).toBe(true)
			// The DOM half, and the one the stored state cannot vouch for: the live selection
			// must SPAN the document, not merely have been asked to.
			expect(domSelectionRange(store)).toEqual({start: 0, end: length})
			expect(window.getSelection()?.isCollapsed).toBe(false)
			expect(window.getSelection()?.toString()).toContain('plain')
			container.remove()
		})

		it.each([
			['LAST', 'plain\n\n@[m](1)'],
			['FIRST', '@[m](1)\n\nplain\n\n'],
		])('typing after select-all replaces the whole document (mark %s)', (_label, value) => {
			// The intended semantics, now VISIBLE: the same keystroke did this before the fix
			// on the mark-LAST document while the DOM showed no selection at all.
			const {store, container} = mountRowWithMarkEdge(value)

			container.dispatchEvent(ctrlA())
			container.dispatchEvent(
				new InputEvent('beforeinput', {inputType: 'insertText', data: 'Z', bubbles: true, cancelable: true})
			)

			expect(store.tokens.value()).toBe('Z')
			container.remove()
		})
	})

	/**
	 * The keydown path had NO direct coverage before S1.8. It was flagged as redundant with its
	 * own fallthrough — the DOM read on an all-selected editor spans the whole document, which
	 * the delete target passes straight through — and the first case below does NOT discriminate
	 * it: deleting the branch keeps that one green. The second case does, and that is what
	 * refutes the claim. The two paths diverge exactly when the STORED selection says
	 * all-selected while the DOM selection is gone: the branch still preventDefaults and clears,
	 * the fallthrough bails on `domAnchors()` and lets the browser mutate contenteditable behind
	 * the model's back.
	 */
	describe('handleDeleteKey()', () => {
		it('clears the whole value on Backspace with everything selected', () => {
			const {store, container} = mountStructuralInline('hello')
			store.tokens.selection.selectAll()

			const event = new KeyboardEvent('keydown', {key: 'Backspace', bubbles: true, cancelable: true})
			container.dispatchEvent(event)

			expect(event.defaultPrevented).toBe(true)
			expect(store.tokens.value()).toBe('')
			container.remove()
		})

		it('clears the whole value even when the DOM selection is gone', () => {
			// THE discriminating case (see the note above): the only one that fails when the
			// all-selected branch is deleted.
			const {store, container} = mountStructuralInline('hello')
			store.tokens.selection.selectAll()
			window.getSelection()?.removeAllRanges()

			const event = new KeyboardEvent('keydown', {key: 'Backspace', bubbles: true, cancelable: true})
			container.dispatchEvent(event)

			expect(event.defaultPrevented).toBe(true)
			expect(store.tokens.value()).toBe('')
			container.remove()
		})

		it('undoes and redoes on Mod+Z, and on Shift+Mod+Z', () => {
			const {store, container, textNode} = mountStructuralInline('hello')
			selectBoundary(textNode, 5)
			store.edit.replace(store.tokens.anchorAt(5), store.tokens.anchorAt(5), '!')
			expect(store.tokens.value()).toBe('hello!')

			const undo = new KeyboardEvent('keydown', {code: 'KeyZ', ctrlKey: true, bubbles: true, cancelable: true})
			container.dispatchEvent(undo)
			expect(undo.defaultPrevented).toBe(true)
			expect(store.tokens.value()).toBe('hello')

			const redo = new KeyboardEvent('keydown', {
				code: 'KeyZ',
				ctrlKey: true,
				shiftKey: true,
				bubbles: true,
				cancelable: true,
			})
			container.dispatchEvent(redo)
			expect(redo.defaultPrevented).toBe(true)
			expect(store.tokens.value()).toBe('hello!')
			container.remove()
		})

		it('leaves Mod+Z to a consumer editable island', () => {
			// The keydown tier's one consumer-origin test covers this arm too: an island runs the
			// browser's own undo over its own DOM, and the model must neither act nor cancel.
			const {store, container, descendantText} = mountStructuralMarkWithDescendant()
			const event = new KeyboardEvent('keydown', {code: 'KeyZ', ctrlKey: true, bubbles: true, cancelable: true})

			descendantText.parentElement?.dispatchEvent(event)

			expect(event.defaultPrevented).toBe(false)
			expect(store.tokens.value()).toBe('@[world]')
			container.remove()
		})

		it('EXPRESSES a historyUndo beforeinput instead of dropping it', () => {
			// ADR-0012's structural claim, stated the only way it can be observed: the value moved.
			// `dropUnexpressedInput` cancels and nothing else, so a document that came back cannot
			// have gone through it.
			const {store, container} = mountStructuralInline('hello')
			store.edit.replace(store.tokens.anchorAt(5), store.tokens.anchorAt(5), '!')

			const event = new InputEvent('beforeinput', {inputType: 'historyUndo', bubbles: true, cancelable: true})
			container.dispatchEvent(event)

			expect(event.defaultPrevented).toBe(true)
			expect(store.tokens.value()).toBe('hello')

			const redo = new InputEvent('beforeinput', {inputType: 'historyRedo', bubbles: true, cancelable: true})
			container.dispatchEvent(redo)
			expect(store.tokens.value()).toBe('hello!')
			container.remove()
		})

		it('undoes on a historyUndo with everything selected, rather than replacing the value', () => {
			// The arm has to sit AHEAD of the all-selected branch: that branch keys on the stored
			// selection and would read an undo as "replace the document with nothing".
			const {store, container} = mountStructuralInline('hello')
			store.edit.replace(store.tokens.anchorAt(5), store.tokens.anchorAt(5), '!')
			store.tokens.selection.selectAll()

			const event = new InputEvent('beforeinput', {inputType: 'historyUndo', bubbles: true, cancelable: true})
			container.dispatchEvent(event)

			expect(store.tokens.value()).toBe('hello')
			container.remove()
		})

		it('still cancels a historyUndo with nothing to undo', () => {
			// The guard stays fail-closed (ADR-0006): the browser's own stack is empty, and an
			// uncancelled default would edit DOM the model owns.
			const {store, container} = mountStructuralInline('hello')

			const event = new InputEvent('beforeinput', {inputType: 'historyUndo', bubbles: true, cancelable: true})
			container.dispatchEvent(event)

			expect(event.defaultPrevented).toBe(true)
			expect(store.tokens.value()).toBe('hello')
			container.remove()
		})

		it('leaves a word delete to the beforeinput that names its own range', () => {
			// The extent of Alt/Ctrl/Cmd+Backspace belongs to the platform, and only the
			// `beforeinput` carries it. Answering the keydown cancelled that event before it
			// existed, so 'alpha beta' lost ONE character instead of the word — pinned here
			// because the ranged case above ('a RANGED target range outranks the live caret')
			// proves the tail handles it and cannot see that the keydown ate the event first.
			const {store, container, textNode} = mountStructuralInline('alpha beta')
			selectBoundary(textNode, 10)

			const event = new KeyboardEvent('keydown', {
				key: 'Backspace',
				altKey: true,
				bubbles: true,
				cancelable: true,
			})
			container.dispatchEvent(event)

			expect(event.defaultPrevented).toBe(false)
			expect(store.tokens.value()).toBe('alpha beta')
			container.remove()
		})
	})
})
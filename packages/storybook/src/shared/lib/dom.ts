import type {Locator} from 'vitest/browser'

export function getElement(locator: Locator): HTMLElement {
	const el = locator.element()
	if (el instanceof HTMLElement) return el
	throw new Error('Expected HTMLElement')
}

export function firstChild(element: Element): HTMLElement | null {
	const child = element.firstElementChild
	return child instanceof HTMLElement ? child : null
}

export function childAt(element: Element, index: number): HTMLElement | null {
	const child = element.children[index]
	return child instanceof HTMLElement ? child : null
}

export function childrenOf(element: Element): HTMLElement[] {
	return Array.from(element.children).filter((c): c is HTMLElement => c instanceof HTMLElement)
}

export function getActiveElement(): HTMLElement | null {
	return document.activeElement instanceof HTMLElement ? document.activeElement : null
}

/**
 * The attribute both host lookups match on, in EITHER state. `[contenteditable="true"]` is
 * wrong for the same reason the bare attribute needs care: the selection driver writes
 * `false` on the very same element while `readOnly` is set, so a value test throws on a
 * readOnly editor, while the bare attribute ALSO matches value-only mark roots — they carry
 * `contenteditable="false"` to stay atomic. Both lookups below therefore take the OUTERMOST
 * match, which is the container in either state: it encloses every mark.
 */
const EDITING_HOST = '[contenteditable]'

/**
 * THE editing host: the container. Under the single-host topology it is the only element that
 * can hold focus, so every `toHaveFocus()` in the browser suites resolves through here.
 */
export function editingHost(element: Element): HTMLElement {
	let host: HTMLElement | undefined
	// The OUTERMOST match, not `closest`: from inside a value-only mark the nearest one is the
	// MARK (see {@link EDITING_HOST}), and the assertion would then compare a mark to the host.
	for (let current: Element | null = element; current; current = current.parentElement) {
		if (current instanceof HTMLElement && current.matches(EDITING_HOST)) host = current
	}
	if (!host) throw new Error('Expected an editing host ancestor')
	return host
}

/**
 * THE editing host inside a rendered tree. Story decorators wrap the editor in panels, so
 * `container.firstElementChild` is not it. `querySelector` answers in DOCUMENT ORDER, so the
 * container precedes the marks nested in it — the outermost match again.
 */
export function findEditingHost(root: ParentNode): HTMLElement {
	const host = root.querySelector<HTMLElement>(EDITING_HOST)
	if (!host) throw new Error('Expected an editing host')
	return host
}

/**
 * The node the caret sits in. Element-anchored boundaries (the caret between two atomics,
 * or at a container edge) resolve to the child they point at — `startContainer` alone would
 * answer the container for those and lose the position entirely.
 */
export function caretNode(): Node | null {
	const selection = window.getSelection()
	if (!selection || selection.rangeCount === 0) return null
	const {startContainer, startOffset} = selection.getRangeAt(0)
	if (!(startContainer instanceof Element)) return startContainer
	// `Array.at`, not an index read: `noUncheckedIndexedAccess` is off, so `childNodes[i]`
	// types as `ChildNode` and the fallbacks below would be linted away as impossible.
	const children = Array.from(startContainer.childNodes)
	if (startOffset === 0) return children.at(0) ?? startContainer
	return children.at(startOffset) ?? children.at(startOffset - 1) ?? startContainer
}

/**
 * The caret oracle that replaced `activeElement` for row identity: focus is on the container
 * under one host, so "which row am I in" is a question only the selection can answer.
 */
export function caretIsInside(element: Element): boolean {
	const node = caretNode()
	return node !== null && element.contains(node)
}

/**
 * The text-token surfaces of an inline editor: the host's direct `<span>` children that hold
 * only text. Text spans are bare now, so the old `[contenteditable="true"]` enumeration
 * answers the container instead of them.
 *
 * The attribute alone does NOT separate them, which is the trap this predicate exists to
 * avoid: only a VALUE-ONLY mark root carries `contenteditable="false"`: a SLOT mark root is
 * bare by policy (core's `editableState.ts`), so on a nested story
 * `:scope > span:not([contenteditable])` hands back slot marks as if they were text. What
 * separates them is structural and exact: a text surface's content is written as
 * `textContent` by the token layer, so it has no ELEMENT children, while a slot mark root
 * holds its slot host.
 */
export function textSurfaces(host: Element): HTMLElement[] {
	const spans = host.querySelectorAll<HTMLElement>(':scope > span:not([contenteditable])')
	return Array.from(spans).filter(span => span.childElementCount === 0)
}
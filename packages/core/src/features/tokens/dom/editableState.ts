import type {ElementBindings} from './TokenHandle'

/**
 * One-host editable topology for a single bound token. The CONTAINER is the only
 * editing host; nothing below it opens a second one.
 *
 * - Text surface: BARE — no contenteditable attribute at all; it inherits
 *   editability from the container.
 * - Value-only mark root (no slot): `contenteditable=false` — atomic by
 *   contract, not by accident of "my parent is not an editing host". No
 *   tabindex either way: marks are not tab stops (Tab leaves the field
 *   natively).
 * - Slot mark: the root and the slot host go BARE, so slot content stays in the
 *   ONE host, and only the CHROME around it — every element hanging off the
 *   root→host path — becomes atomic. A nested `contenteditable=true` host is
 *   what this policy exists to avoid: the host both adapters render is
 *   `display: contents`, and a boxless element cannot take focus, so Chromium
 *   accepts a caret there and then fires no `beforeinput` at all.
 *
 * readOnly lives on the CONTAINER (the selection driver writes it), not here.
 */
export function applyEditableState(bindings: ElementBindings): void {
	if (bindings.textElement) {
		bindings.textElement.removeAttribute('contenteditable')
		return
	}
	const {tokenElement, childSequenceHost} = bindings
	tokenElement.removeAttribute('tabindex')
	if (!childSequenceHost) {
		if (tokenElement.contentEditable !== 'false') tokenElement.contentEditable = 'false'
		return
	}
	tokenElement.removeAttribute('contenteditable')
	childSequenceHost.removeAttribute('contenteditable')
	// Walk the host back up to the root, freezing every sibling of the path: those are
	// the mark's own chrome, and chrome is not document content.
	let onPath: HTMLElement = childSequenceHost
	while (onPath !== tokenElement) {
		const parent = onPath.parentElement
		// The walk bound this host under this root, but nothing pins the DOM between that
		// walk and this write — a host detached in between must not spin.
		if (!parent) break
		for (const child of parent.children) {
			if (child !== onPath && child instanceof HTMLElement && child.contentEditable !== 'false') {
				child.contentEditable = 'false'
			}
		}
		onPath = parent
	}
}
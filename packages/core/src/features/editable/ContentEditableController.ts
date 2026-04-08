import {effectScope, effect} from '../../shared/alien-signals/src/index.js'
import {childAt} from '../../shared/checkers'
import type {Token} from '../parsing'
import type {Store} from '../store/Store'

/** A text-token span has no attributes, or only the contenteditable attribute. */
function isTextTokenSpan(el: HTMLElement) {
	return (
		el.tagName === 'SPAN' &&
		(el.attributes.length === 0 || (el.attributes.length === 1 && el.hasAttribute('contenteditable')))
	)
}

export class ContentEditableController {
	#scope?: () => void

	constructor(private store: Store) {}

	enable() {
		if (this.#scope) return

		this.#scope = effectScope(() => {
			effect(() => {
				this.store.state.readOnly()
				this.sync()
			})
			effect(() => {
				if (this.store.state.selecting() === undefined) this.sync()
			})
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
	}

	sync() {
		const container = this.store.refs.container
		if (!container) return

		const readOnly = this.store.state.readOnly.get()
		const value = readOnly ? 'false' : 'true'
		const children = container.children
		const isDrag = !!this.store.state.drag.get()

		if (isDrag) {
			// In drag mode, only set contentEditable on text rows (DragMark divs).
			// Mark rows get tabIndex for focusability but are not contentEditable.
			const tokens = this.store.state.tokens.get()
			for (let i = 0; i < tokens.length && i < children.length; i++) {
				const el = childAt(container, i)
				if (!el) continue
				if (tokens[i].type === 'mark') {
					if (!readOnly) el.tabIndex = 0
				} else {
					el.contentEditable = value
				}
			}
		} else {
			// In non-drag mode, even-indexed children are text spans (odd are marks).
			for (let i = 0; i < children.length; i += 2) {
				const el = childAt(container, i)
				if (el) el.contentEditable = value
			}
		}

		// Sync textContent for all text spans (including nested)
		const tokens = this.store.state.tokens.get()
		if (isDrag) {
			this.#syncDragTextContent(tokens, container, readOnly)
		} else {
			this.#syncTextContent(tokens, container)
		}
	}

	#syncTextContent(tokens: Token[], parent: HTMLElement) {
		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i]
			const el = childAt(parent, i)
			if (!el) continue
			if (token.type === 'text') {
				if (el.textContent !== token.content) {
					el.textContent = token.content
				}
			} else if (token.children.length > 0) {
				this.#syncMarkChildren(token.children, el)
			}
		}
	}

	#syncMarkChildren(tokens: Token[], parent: HTMLElement, editable?: string) {
		// Walk direct children and match to tokens sequentially.
		// Text tokens render as <span> (no attributes, or only contenteditable).
		// Mark tokens render as elements with attributes (classes, data-*, etc).
		// Skip any extra mark-component elements (inputs, buttons, etc.)
		const children = parent.children
		let childIdx = 0

		for (const token of tokens) {
			if (token.type === 'text') {
				// Find next text-token span (bare or with only contenteditable)
				while (childIdx < children.length) {
					const el = childAt(parent, childIdx)
					if (el && isTextTokenSpan(el)) break
					childIdx++
				}
				const el = childAt(parent, childIdx)
				if (el) {
					if (el.textContent !== token.content) {
						el.textContent = token.content
					}
					if (editable !== undefined) el.contentEditable = editable
					childIdx++
				}
			} else if (token.children.length > 0) {
				// Find next element with attributes (mark element)
				while (childIdx < children.length) {
					const el = childAt(parent, childIdx)
					if (el && !isTextTokenSpan(el)) break
					childIdx++
				}
				const el = childAt(parent, childIdx)
				if (el) {
					this.#syncMarkChildren(token.children, el, editable)
					childIdx++
				}
			}
		}
	}

	#syncDragTextContent(tokens: Token[], container: HTMLElement, readOnly: boolean) {
		const editable = readOnly ? 'false' : 'true'
		for (let ri = 0; ri < tokens.length; ri++) {
			const token = tokens[ri]
			const blockEl = childAt(container, ri)
			if (!blockEl) continue

			if (token.type === 'mark') {
				if (token.children.length > 0) {
					// In Vue, mark rows are wrapped in DragMark (has data-testid).
					// In React, mark rows render directly as the mark element.
					const hasDragWrapper = blockEl.hasAttribute('data-testid')
					const markEl = hasDragWrapper ? childAt(blockEl, readOnly ? 0 : 1) : blockEl
					if (markEl) {
						this.#syncMarkChildren(token.children, markEl, editable)
					}
				}
				continue
			}

			// Text row: DragMark div with side panel offset
			const offset = readOnly ? 0 : 1
			const el = childAt(blockEl, offset)
			if (!el) continue
			if (el.textContent !== token.content) {
				el.textContent = token.content
			}
		}
	}
}
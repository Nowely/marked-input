import {splitTokensIntoDragRows} from '../blocks'
import type {Token} from '../parsing'
import type {Store} from '../store/Store'

export class ContentEditableController {
	#unsubscribe?: () => void

	constructor(private store: Store) {}

	enable() {
		if (this.#unsubscribe) return

		this.#unsubscribe = this.store.state.readOnly.on(() => this.sync())
		this.sync()
	}

	disable() {
		this.#unsubscribe?.()
		this.#unsubscribe = undefined
	}

	sync() {
		const container = this.store.refs.container
		if (!container) return

		const readOnly = this.store.state.readOnly.get()
		const value = readOnly ? 'false' : 'true'
		const children = container.children
		const isDrag = !!this.store.state.drag.get()

		// In non-drag mode, even-indexed children are text spans (odd are marks).
		// In drag mode, all children are DraggableBlock divs and need contentEditable.
		const step = isDrag ? 1 : 2
		for (let i = 0; i < children.length; i += step) {
			;(children[i] as HTMLElement).contentEditable = value
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
		const children = parent.children
		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i]
			const el = children[i] as HTMLElement | undefined
			if (!el) continue
			if (token.type === 'text') {
				if (el.textContent !== token.content) {
					el.textContent = token.content
				}
			} else if (token.type === 'mark' && token.children.length > 0) {
				this.#syncMarkChildren(token.children, el)
			}
		}
	}

	#syncMarkChildren(tokens: Token[], parent: HTMLElement) {
		// Walk direct children and match to tokens sequentially.
		// Text tokens render as bare <span> (no attributes).
		// Mark tokens render as elements with attributes (classes, data-*, etc).
		// Skip any extra mark-component elements (inputs, buttons, etc.)
		const children = parent.children
		let childIdx = 0

		for (const token of tokens) {
			if (token.type === 'text') {
				// Find next bare span (text token element)
				while (childIdx < children.length) {
					const el = children[childIdx] as HTMLElement
					if (el.tagName === 'SPAN' && el.attributes.length === 0) break
					childIdx++
				}
				const el = children[childIdx] as HTMLElement | undefined
				if (el) {
					if (el.textContent !== token.content) {
						el.textContent = token.content
					}
					childIdx++
				}
			} else if (token.type === 'mark' && token.children.length > 0) {
				// Find next element with attributes (mark element)
				while (childIdx < children.length) {
					const el = children[childIdx] as HTMLElement
					if (el.attributes.length > 0 || el.tagName !== 'SPAN') break
					childIdx++
				}
				const el = children[childIdx] as HTMLElement | undefined
				if (el) {
					this.#syncMarkChildren(token.children, el)
					childIdx++
				}
			}
		}
	}

	#syncDragTextContent(tokens: Token[], container: HTMLElement, readOnly: boolean) {
		const blocks = splitTokensIntoDragRows(tokens)
		for (let bi = 0; bi < blocks.length; bi++) {
			const block = blocks[bi]
			const blockEl = container.children[bi] as HTMLElement | undefined
			if (!blockEl) continue

			const isMark = block.tokens.length === 1 && block.tokens[0].type === 'mark'
			if (isMark) {
				const markToken = block.tokens[0]
				if (markToken.type === 'mark' && markToken.children.length > 0) {
					// In Vue, mark blocks are wrapped in DragMark (has data-testid).
					// In React, mark blocks render directly as the mark element.
					const hasDragWrapper = blockEl.hasAttribute('data-testid')
					const markEl = hasDragWrapper
						? (blockEl.children[readOnly ? 0 : 1] as HTMLElement | undefined)
						: blockEl
					if (markEl) {
						this.#syncMarkChildren(markToken.children, markEl)
					}
				}
				continue
			}

			// Text block: DragMark div with side panel offset
			const offset = readOnly ? 0 : 1
			for (let ti = 0; ti < block.tokens.length; ti++) {
				const token = block.tokens[ti]
				const el = blockEl.children[ti + offset] as HTMLElement | undefined
				if (!el) continue
				if (token.type === 'text') {
					if (el.textContent !== token.content) {
						el.textContent = token.content
					}
				}
			}
		}
	}
}
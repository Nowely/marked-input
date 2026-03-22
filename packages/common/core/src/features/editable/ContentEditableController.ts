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
				this.#syncTextContent(token.children, el)
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
					this.#syncTextContent(markToken.children, blockEl)
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
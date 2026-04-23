import {childAt} from '../../shared/checkers'
import {effectScope, effect} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'
import type {Token} from '../parsing'
import {isTextTokenSpan} from './isTextTokenSpan'

export class DomFeature {
	readonly state = {} as const
	readonly computed = {} as const
	#scope?: () => void

	constructor(private readonly _store: Store) {}

	enable() {
		if (this.#scope) return

		this.#scope = effectScope(() => {
			effect(() => {
				this._store.props.readOnly()
				this.reconcile()
			})
			effect(() => {
				if (this._store.feature.caret.state.selecting() === undefined) this.reconcile()
			})
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
	}

	reconcile() {
		const container = this._store.feature.slots.state.container()
		if (!container) return

		const readOnly = this._store.props.readOnly()
		const value = readOnly ? 'false' : 'true'
		const children = container.children
		const isBlock = this._store.feature.slots.computed.isBlock()

		if (isBlock) {
			const tokens = this._store.feature.parsing.state.tokens()
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
			for (let i = 0; i < children.length; i += 2) {
				const el = childAt(container, i)
				if (el) el.contentEditable = value
			}
		}

		const tokens = this._store.feature.parsing.state.tokens()
		if (isBlock) {
			this.#reconcileDragTextContent(tokens, container, readOnly)
		} else {
			this.#reconcileTextContent(tokens, container)
		}
	}

	#reconcileTextContent(tokens: Token[], parent: HTMLElement) {
		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i]
			const el = childAt(parent, i)
			if (!el) continue
			if (token.type === 'text') {
				if (el.textContent !== token.content) {
					el.textContent = token.content
				}
			} else if (token.children.length > 0) {
				this.#reconcileMarkChildren(token.children, el)
			}
		}
	}

	#reconcileMarkChildren(tokens: Token[], parent: HTMLElement, editable?: string) {
		const children = parent.children
		let childIdx = 0

		for (const token of tokens) {
			if (token.type === 'text') {
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
				while (childIdx < children.length) {
					const el = childAt(parent, childIdx)
					if (el && !isTextTokenSpan(el)) break
					childIdx++
				}
				const el = childAt(parent, childIdx)
				if (el) {
					this.#reconcileMarkChildren(token.children, el, editable)
					childIdx++
				}
			}
		}
	}

	#reconcileDragTextContent(tokens: Token[], container: HTMLElement, readOnly: boolean) {
		const editable = readOnly ? 'false' : 'true'
		for (let ri = 0; ri < tokens.length; ri++) {
			const token = tokens[ri]
			const blockEl = childAt(container, ri)
			if (!blockEl) continue

			if (token.type === 'mark') {
				if (token.children.length > 0) {
					const hasDragWrapper = blockEl.hasAttribute('data-testid')
					const markEl = hasDragWrapper ? childAt(blockEl, readOnly ? 0 : 1) : blockEl
					if (markEl) {
						this.#reconcileMarkChildren(token.children, markEl, editable)
					}
				}
				continue
			}

			const offset = readOnly ? 0 : 1
			const el = childAt(blockEl, offset)
			if (!el) continue
			if (el.textContent !== token.content) {
				el.textContent = token.content
			}
		}
	}
}
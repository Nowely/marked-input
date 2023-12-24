import {Caret} from './Caret'
import {Store} from './Store'

export class NodeProxy {
	#target?: HTMLElement
	#store: Store

	get target(): HTMLElement | undefined {
		return this.#target
	}

	set target(value: Node | HTMLElement | EventTarget | undefined | null) {
		this.#target = value as HTMLElement | undefined
	}

	get next() {
		return new NodeProxy(this.target?.nextSibling, this.#store)
	}

	get prev() {
		return new NodeProxy(this.target?.previousSibling, this.#store)
	}

	get isEditable() {
		return this.target?.isContentEditable ?? false
	}

	get isCaretAtBeginning() {
		if (!this.target) return

		const caretIndex = Caret.getCaretIndex(this.target)
		return caretIndex === 0
	}

	get isCaretAtEnd() {
		if (!this.target) return

		const caretIndex = Caret.getCaretIndex(this.target)
		return caretIndex === this.target.textContent?.length
	}

	get index() {
		if (!this.target?.parentElement) return -1

		return [...this.target.parentElement.children].indexOf(this.target)
	}

	set caret(value: number) {
		if (this.target)
			Caret.trySetIndex(this.target, value)
	}

	get length() {
		return this.target?.textContent?.length ?? -1
	}

	get content(): string {
		return this.target?.textContent ?? ''
	}

	set content(value: string | undefined) {
		if (this.target)
			this.target.textContent = value ?? ''
	}

	get head() {
		return this.#store.refs.container.current?.firstChild as HTMLElement
	}

	get tail() {
		return this.#store.refs.container.current?.lastChild as HTMLElement
	}

	constructor(active: Node | EventTarget | null | undefined, store: Store) {
		this.target = active
		this.#store = store
	}

	setCaretToEnd() {
		Caret.setCaretToEnd(this.target)
		return
	}

	focus() {
		this.target?.focus()
		return
	}

	clear() {
		this.target = undefined
	}
}
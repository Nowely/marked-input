import type {Store} from '../../store'
import type {MarkToken, Token} from '../parsing'
import {findToken} from '../parsing'

export interface RefAccessor<T> {
	current: T | null
}

export class MarkHandler<T extends HTMLElement = HTMLElement> {
	readonly ref: RefAccessor<T>
	readonly #store: Store
	readonly #token: MarkToken
	#readOnly?: boolean

	constructor(param: {ref: RefAccessor<T>; store: Store; token: MarkToken}) {
		this.ref = param.ref
		this.#store = param.store
		this.#token = param.token
	}

	get readOnly() {
		return this.#readOnly
	}

	set readOnly(value: boolean | undefined) {
		this.#readOnly = value
	}

	get content() {
		return this.#token.content
	}

	set content(value: string) {
		this.#token.content = value
		this.#emitChange()
	}

	get value() {
		return this.#token.value
	}

	set value(v: string | undefined) {
		this.#token.value = v ?? ''
		this.#emitChange()
	}

	get meta() {
		return this.#token.meta
	}

	set meta(v: string | undefined) {
		this.#token.meta = v
		this.#emitChange()
	}

	get slot(): string | undefined {
		return this.#token.slot?.content
	}

	get #tokenInfo() {
		return findToken(this.#store.state.tokens(), this.#token)
	}

	get depth(): number {
		return this.#tokenInfo?.depth ?? 0
	}

	get hasChildren(): boolean {
		return this.#token.children.some(child => child.type === 'mark')
	}

	get parent(): MarkToken | undefined {
		return this.#tokenInfo?.parent
	}

	get tokens(): Token[] {
		return this.#token.children
	}

	change = (props: {content: string; value?: string; meta?: string}) => {
		this.#token.content = props.content
		this.#token.value = props.value ?? ''
		if (props.meta !== undefined) {
			this.#token.meta = props.meta
		}
		this.#emitChange()
	}

	remove = () => this.#store.emit.markRemove({token: this.#token})

	#emitChange(): void {
		this.#store.emit.change()
	}
}
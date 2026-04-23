import type {Feature} from '../../shared/types'
import type {Store} from '../../store/Store'
import {enableArrowNav} from './arrowNav'
import {enableBlockEdit} from './blockEdit'
import {enableInput} from './input'

export class KeyboardFeature implements Feature {
	#disposers: Array<() => void> = []

	constructor(private readonly _store: Store) {}

	enable() {
		if (this.#disposers.length) return
		this.#disposers = [enableInput(this._store), enableBlockEdit(this._store), enableArrowNav(this._store)]
	}

	disable() {
		this.#disposers.forEach(d => d())
		this.#disposers = []
	}
}
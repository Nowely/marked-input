import type {Store} from '../../store/Store'
import {enableArrowNav} from './arrowNav'
import {enableBlockEdit} from './blockEdit'
import {enableInput} from './input'

export class KeyboardFeature {
	constructor(store: Store) {
		store.lifecycle.onMounted(() => {
			enableInput(store)
			enableBlockEdit(store)
			enableArrowNav(store)
		})
	}
}
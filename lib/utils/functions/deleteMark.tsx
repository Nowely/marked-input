import {Store} from '../classes/Store'
import {toString} from './toString'

export function deleteMark(place: 'prev' | 'self' | 'next', store: Store) {
	const placeMap = {
		'prev': 2,
		'self': 1,
		'next': 0
	}
	const placeIndex = placeMap[place]
	const {focus} = store

	const [span1, mark, span2] = store.tokens.splice(focus.index - placeIndex, 3)
	store.tokens = store.tokens.toSpliced(focus.index - placeIndex, 0, {
		label: span1.label + span2.label
	})

	let caretAnchor = focus
	for (let i = 0; i < placeIndex; i++) {
		caretAnchor = caretAnchor.prev
	}
	const caret = caretAnchor.length

	store.recovery = {anchor: caretAnchor.prev, caret}

	store.props.onChange?.(toString(store.tokens, store.props.options))
}
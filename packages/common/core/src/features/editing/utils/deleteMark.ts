import {toString} from '../../parsing'
import type {Store} from '../../store'

export function deleteMark(place: 'prev' | 'self' | 'next', store: Store) {
	const placeMap = {
		prev: 2,
		self: 1,
		next: 0,
	}
	const placeIndex = placeMap[place]
	const {focus} = store.nodes

	const tokens = store.state.tokens.get()
	const spliced = tokens.splice(focus.index - placeIndex, 3)
	const span1 = spliced.at(0)
	const span2 = spliced.at(2)
	const content1 = span1?.content ?? ''
	const content2 = span2?.content ?? ''
	store.state.tokens.set(
		tokens.toSpliced(focus.index - placeIndex, 0, {
			type: 'text',
			content: content1 + content2,
			position: {
				start: span1?.position.start ?? 0,
				end: span2?.position.end ?? (content1 + content2).length,
			},
		})
	)

	let caretAnchor = focus
	for (let i = 0; i < placeIndex; i++) {
		caretAnchor = caretAnchor.prev
	}
	const caret = caretAnchor.length

	store.state.recovery.set({anchor: caretAnchor.prev, caret})

	store.state.onChange.get()?.(toString(store.state.tokens.get()))
}
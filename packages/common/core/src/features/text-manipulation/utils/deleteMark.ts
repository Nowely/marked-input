import type {Store} from '../../store'
import {toString} from '../../parsing'

export function deleteMark(place: 'prev' | 'self' | 'next', store: Store) {
	const placeMap = {
		prev: 2,
		self: 1,
		next: 0,
	}
	const placeIndex = placeMap[place]
	const {focus} = store.nodes

	const tokens = store.state.tokens()
	const [span1, , span2] = tokens.splice(focus.index - placeIndex, 3)
	const content1 = span1.type === 'text' ? span1.content : span1.content
	const content2 = span2.type === 'text' ? span2.content : span2.content
	store.state.tokens(
		tokens.toSpliced(focus.index - placeIndex, 0, {
			type: 'text',
			content: content1 + content2,
			position: {
				start: span1.position.start,
				end: span2.position.end,
			},
		})
	)

	let caretAnchor = focus
	for (let i = 0; i < placeIndex; i++) {
		caretAnchor = caretAnchor.prev
	}
	const caret = caretAnchor.length

	store.state.recovery({anchor: caretAnchor.prev, caret})

	store.props.onChange?.(toString(store.state.tokens()))
}

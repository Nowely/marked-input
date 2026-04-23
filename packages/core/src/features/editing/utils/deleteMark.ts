import {childAt} from '../../../shared/checkers'
import type {Store} from '../../../store'

export function deleteMark(place: 'prev' | 'self' | 'next', store: Store) {
	const placeMap = {
		prev: 2,
		self: 1,
		next: 0,
	}
	const placeIndex = placeMap[place]
	const {focus} = store.nodes
	const targetIndex = Math.max(0, focus.index - placeIndex)

	const tokens = store.parsing.tokens()
	const spliced = tokens.splice(focus.index - placeIndex, 3)
	const span1 = spliced.at(0)
	const span2 = spliced.at(2)
	const content1 = span1?.content ?? ''
	const content2 = span2?.content ?? ''
	store.parsing.tokens(
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

	store.caret.recovery({anchor: caretAnchor.prev, caret})

	store.value.change()

	queueMicrotask(() => {
		const container = store.slots.container()
		const target = container ? childAt(container, targetIndex) : null
		if (!target) return
		store.nodes.focus.target = target
		target.focus()
		store.nodes.focus.caret = caret
	})
}
import {describe, it, expect, vi, beforeEach} from 'vitest'

import {Store} from '../../store/Store'
import type {TextToken} from '../parsing'

function text(content: string, start: number): TextToken {
	return {type: 'text', content, position: {start, end: start + content.length}}
}

describe('DragFeature', () => {
	let store: Store

	beforeEach(() => {
		vi.clearAllMocks()
		store = new Store()
	})

	describe('activation via props', () => {
		it('does not leak a watcher when props toggle', () => {
			store.props.set({
				layout: 'block',
				draggable: true,
				value: 'test',
				onChange: () => {},
			})
			store.lifecycle.mounted()

			// disable drag
			store.props.set({layout: 'inline', draggable: false})

			const currentSpy = vi.spyOn(store.value, 'current')
			store.drag.action({type: 'delete', index: 0})
			expect(currentSpy).not.toHaveBeenCalled()
		})
	})

	it('owns the drag event', () => {
		const store = new Store()
		expect(typeof store.drag.action).toBe('function')
	})

	it('commits drag edits through current() and writes caret.range', () => {
		store.props.set({layout: 'block', draggable: true})
		store.lifecycle.mounted()
		store.value.current('alpha\n\nbeta\n\n')
		store.parsing.acceptTokens([text('alpha', 0), text('beta', 7)])
		const currentSpy = vi.spyOn(store.value, 'current')

		store.drag.action({type: 'delete', index: 0})

		expect(currentSpy).toHaveBeenCalledWith('beta\n\n')
		expect(store.caret.range()).toEqual({start: 6, end: 6})
	})
})
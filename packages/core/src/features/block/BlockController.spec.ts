import {describe, it, expect, vi, beforeEach} from 'vitest'

import {Store} from '../../store/Store'

describe('BlockController', () => {
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
			store.block.action({type: 'delete', index: 0})
			expect(currentSpy).not.toHaveBeenCalled()
		})
	})

	it('owns the drag event', () => {
		const store = new Store()
		expect(typeof store.block.action).toBe('function')
	})

	it('commits drag edits through current() and writes caret.selection', () => {
		store.props.set({
			layout: 'block',
			draggable: true,
			Mark: () => null,
			options: [{markup: '__slot__\n\n'}],
		})
		store.lifecycle.mounted()
		store.value.current('alpha\n\nbeta\n\n')
		const currentSpy = vi.spyOn(store.value, 'current')

		store.block.action({type: 'delete', index: 0})

		expect(currentSpy).toHaveBeenCalledWith('beta\n\n')
		expect(store.selection.range()).toEqual({start: 6, end: 6})
	})
})
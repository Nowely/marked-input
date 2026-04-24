import {describe, it, expect, vi} from 'vitest'

import {Store} from '../../store/Store'
import {applySpanInput, replaceAllContentWith} from './input'

describe('applySpanInput()', () => {
	it('delete the next character when deleteContentForward has no target ranges', () => {
		const focus = {
			content: '!',
			caret: 0,
		}
		const event = {
			inputType: 'deleteContentForward',
			getTargetRanges: () => [],
			preventDefault: vi.fn(),
		}

		// oxlint-disable-next-line no-unsafe-type-assertion -- applySpanInput only touches content/caret in this focused regression test
		expect(applySpanInput(focus as never, event as never)).toBe(true)
		expect(event.preventDefault).toHaveBeenCalledOnce()
		expect(focus.content).toBe('')
		expect(focus.caret).toBe(0)
	})
})

describe('replaceAllContentWith()', () => {
	it('controlled full-content replace emits without committing current', () => {
		const store = new Store()
		const onChange = vi.fn()
		// oxlint-disable-next-line no-unsafe-type-assertion -- minimal container stub
		store.slots.container({firstChild: null} as unknown as HTMLDivElement)
		store.props.set({value: 'hello', onChange})
		store.value.enable()

		replaceAllContentWith(store, 'world')

		expect(onChange).toHaveBeenCalledWith('world')
		expect(store.value.current()).toBe('hello')
		expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
		store.value.disable()
	})
})
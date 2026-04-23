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
	it('sets previousValue to the new content', () => {
		const store = new Store()
		// oxlint-disable-next-line no-unsafe-type-assertion -- minimal container stub
		store.feature.slots.state.container({firstChild: null} as unknown as HTMLDivElement)
		store.feature.value.state.previousValue('old value')

		replaceAllContentWith(store, 'new content')

		expect(store.feature.value.state.previousValue()).toBe('new content')
	})
})
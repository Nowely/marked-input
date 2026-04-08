import {describe, it, expect, vi} from 'vitest'

import {applySpanInput} from './KeyDownController'

describe('applySpanInput()', () => {
	it('should delete the next character when deleteContentForward has no target ranges', () => {
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
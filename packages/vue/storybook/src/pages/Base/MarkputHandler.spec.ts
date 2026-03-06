import type {MarkputHandler} from '@markput/vue'
import {composeStories} from '@storybook/vue3-vite'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-vue'
import {ref} from 'vue'

import * as BaseStories from './Base.stories'

const {Default} = composeStories(BaseStories)

describe('API: MarkputHandler', () => {
	it('should support the ref prop for accessing component handler', async () => {
		const handler = ref<MarkputHandler | null>(null)

		await render(Default, {ref: handler})

		expect(handler.value?.container).not.toBeNull()
	})
})
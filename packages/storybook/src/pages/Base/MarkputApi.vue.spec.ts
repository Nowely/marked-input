import type {MarkputApi} from '@markput/vue'
import {composeStories} from '@storybook/vue3-vite'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-vue'
import {ref} from 'vue'

import * as BaseStories from './Base.vue.stories'

const {Default} = composeStories(BaseStories)

describe('API: MarkputApi', () => {
	it('support the ref prop for accessing the component API', async () => {
		const api = ref<MarkputApi | null>(null)

		await render(Default, {ref: api})

		expect(api.value?.container).not.toBeNull()
	})
})
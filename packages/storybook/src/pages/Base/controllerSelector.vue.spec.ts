import {useMarkput} from '@markput/vue'
import {describe, expect, it} from 'vitest'
import {defineComponent, h} from 'vue'

import {mountComponent} from '../../shared/lib/page'

/**
 * `useMarkput(s => s.rows)` — issue 10's spelling — through the VUE bridge. React's half is
 * pinned by the `guides/rows.md` sample, which the `docs` project compiles against the adapter
 * source; Vue's samples harness does not exist yet (issue 26), so its half of the same capability
 * was pinned by nothing and could have been deleted unnoticed.
 *
 * Both halves are under assertion at once. Deleting the third overload reddens the file at
 * COMPILE time with the ticket's own TS2769; making `readSelected` copy a controller key by key
 * reddens it at RUN time, because a prototype's verbs are not enumerable and `boxOf` would be
 * gone.
 */
const ControllerMark = defineComponent({
	inheritAttrs: false,
	setup: () => {
		const rows = useMarkput(s => s.rows)
		return () => h('mark', {}, typeof rows.value.boxOf)
	},
})

describe('selecting a controller', () => {
	it('hands the controller back with its verbs, not a copy of its enumerable keys', async () => {
		const {host} = await mountComponent({
			separator: null,
			value: '@[someone]',
			options: [{markup: '@[__value__]', Mark: ControllerMark}],
		})

		expect(host.querySelector('mark')?.textContent).toBe('function')
	})
})
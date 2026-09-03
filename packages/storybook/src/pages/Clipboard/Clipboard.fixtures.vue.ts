import {MarkedInput} from '@markput/vue'
import {computed, defineComponent, ref} from 'vue'

import {Mark} from '../../shared/lib/marks'

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Clipboard.stories.ts` is the contract, and it fails to compile under either
 * project if this file drifts.
 *
 * Hand-written components are written with `template:` rather than `h()`, matching their React
 * counterparts. `meta` is declared even though nothing reads it: an undeclared prop falls
 * through onto the mark root as an attribute, which no React fixture does.
 */

/** Nested HTML inside the mark element, so one mark holds MORE than one text node. */
const NestedMark = defineComponent({
	props: {value: {type: String, default: ''}, meta: String},
	setup(props) {
		const mid = computed(() => Math.ceil(props.value.length / 2))
		return {
			head: computed(() => props.value.slice(0, mid.value)),
			tail: computed(() => props.value.slice(mid.value)),
		}
	},
	template: '<mark><strong>{{ head }}</strong><em>{{ tail }}</em></mark>',
})

/** The `PlainText` story's harness: a controlled editor whose value starts markless. */
const PlainTextInput = defineComponent({
	components: {MarkedInput},
	setup: () => ({Mark, value: ref('abc')}),
	template: '<MarkedInput :separator="null" :Mark="Mark" :value="value" @change="value = $event" />',
})

export const fixtures = {
	NestedMark,
	renderPlainText: () => PlainTextInput,
}
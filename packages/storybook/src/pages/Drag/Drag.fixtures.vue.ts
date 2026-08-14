import type {Option} from '@markput/vue'
import {defineComponent} from 'vue'

import {markdownOptions} from '../Nested/MarkdownOptions'

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Drag.stories.ts` is the contract, and it fails to compile under either
 * project if this file drifts.
 *
 * Components are written with `template:` rather than `h()`, matching their React
 * counterparts. `<slot>{{ value }}</slot>` is the template spelling of
 * `slots.default?.() ?? value`: `Token.vue` passes NO default slot for a value-only mark, so
 * the fallback is what a `__value__` markup renders. `meta` is declared even though nothing
 * reads it — an undeclared prop falls through onto the mark root as an attribute, which no
 * React fixture does.
 */

const MarkdownMark = defineComponent({
	props: {value: String, meta: String, style: {type: Object}},
	template: `<span :style="[style, {margin: '0 1px'}]"><slot>{{ value }}</slot></span>`,
})

const ParagraphMark = defineComponent({
	props: {value: String, meta: String},
	template: '<span><slot>{{ value }}</slot></span>',
})

/** One block-level markup, so a plain-text document is split into one draggable row per paragraph. */
const paragraphOptions: Option[] = [{markup: '__slot__\n\n', Mark: ParagraphMark}]

export const fixtures = {
	MarkdownMark,
	ParagraphMark,
	paragraphOptions,
	markdownOptions,
}

/** Spec fixtures: mark components the shared spec mounts through `mountComponent`. */
export const marks = {
	Value: defineComponent({
		props: {value: String, meta: String},
		template: '<mark>{{ value }}</mark>',
	}),
}
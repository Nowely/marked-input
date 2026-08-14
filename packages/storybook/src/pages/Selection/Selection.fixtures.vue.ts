import {defineComponent} from 'vue'

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Selection.stories.ts` is the contract, and it fails to compile under either
 * project if this file drifts.
 *
 * Components are written with `template:` rather than `h()`: `@storybook/vue3-vite` aliases
 * `vue` to the runtime-compiler build for exactly this, and it keeps these fixtures readable
 * next to their React counterparts. The trade is that a template string is not typechecked.
 */
export const fixtures = {
	Value: defineComponent({
		// `meta` is declared but never read: core hands every mark `{value, meta}`, and an
		// undeclared prop falls through onto the root element as `meta="1"`.
		props: {value: String, meta: String},
		template: '<mark>{{ value }}</mark>',
	}),
}

/** Spec fixture: the adapter-owned text surface the cross-select spec configures. */
export const Span = defineComponent({template: '<strong><slot /></strong>'})
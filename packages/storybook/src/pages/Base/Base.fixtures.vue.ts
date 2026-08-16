import {defineComponent} from 'vue'

import Button from '../../shared/components/Button/Button.vue'

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Base.stories.ts` is the contract, and it fails to compile under either
 * project if this file drifts.
 *
 * Hand-written components are written with `template:` rather than `h()`: `@storybook/vue3-vite`
 * aliases `vue` to the runtime-compiler build for exactly this, and it keeps these fixtures
 * readable next to their React counterparts. The trade is that a template string is not
 * typechecked.
 */
export const fixtures = {
	Button,
}

/**
 * Spec fixtures: mark components the shared spec mounts through story args.
 *
 * `inheritAttrs: false` is what keeps the rendered DOM equal to React's. Core hands every mark
 * `{value, meta}`; Vue puts every prop a component does not declare onto its root element, so
 * they would land there as attributes — `<mark meta="1">` against React's `<mark>`. Every mark
 * that reads through `useMark()`, through the slot, or through only part of the pair needs it.
 */
export const marks = {
	Todo: defineComponent({
		inheritAttrs: false,
		template: '<span><input type="checkbox" aria-label="done" /><slot /></span>',
	}),
}

export const Overlay = defineComponent({template: `<span>I'm here!</span>`})
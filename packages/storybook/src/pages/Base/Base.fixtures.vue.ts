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

/**
 * Spec fixtures: a row KIND that paints its own child rows. React delivers them as the `rows`
 * PROP and Vue as the `rows` SLOT, which is the one place the two adapters' row contract
 * differs — so the shared spec needs one fixture per framework to read it at all.
 *
 * The row props are DECLARED for `marks.vue.ts`'s reason: vue puts every undeclared prop onto
 * the root element, so `node` and `depth` would face React's bare `<li>` as attributes.
 */
export const rows = {
	Bullet: defineComponent({
		inheritAttrs: false,
		props: {meta: String, node: {type: null}, depth: Number, index: Number},
		template: '<li><slot /><slot name="rows" /></li>',
	}),
}
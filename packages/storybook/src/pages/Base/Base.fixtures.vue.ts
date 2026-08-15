import {MarkedInput, useMark} from '@markput/vue'
import {defineComponent, ref} from 'vue'

import Button from '../../shared/components/Button/Button.vue'
import {Mark} from '../../shared/lib/marks'

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
	Alerting: defineComponent({
		props: {value: String, meta: String},
		methods: {
			alertMeta() {
				alert(this.meta)
			},
		},
		template: '<mark @click="alertMeta">{{ value }}</mark>',
	}),
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
	Updatable: defineComponent({
		inheritAttrs: false,
		setup: () => ({mark: useMark()}),
		template: '<mark @click="mark.update({value: `${mark.value()}1`})">{{ mark.value() }}</mark>',
	}),
}

export const Overlay = defineComponent({template: `<span>I'm here!</span>`})

/**
 * A harness whose `readOnly` prop DISAPPEARS rather than turning false — the shape a tabbed
 * story has, and the one that used to leave the editor read-only for good.
 */
export const DroppedReadOnly = defineComponent({
	components: {MarkedInput},
	setup() {
		const locked = ref(true)
		return {locked, unlock: () => (locked.value = false), Mark}
	},
	template: `
		<div>
			<button @click="unlock">unlock</button>
			<MarkedInput v-if="locked" :Mark="Mark" defaultValue="hello @[x](1)" :readOnly="true" />
			<MarkedInput v-else :Mark="Mark" defaultValue="hello @[x](1)" />
		</div>
	`,
})
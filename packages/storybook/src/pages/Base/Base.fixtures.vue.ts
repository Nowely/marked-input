import {useMark} from '@markput/vue'
import {defineComponent} from 'vue'

import Button from '../../shared/components/Button/Button.vue'

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Base.stories.ts` is the contract, and it fails to compile under either
 * project if this file drifts.
 *
 * Components are written with `template:` rather than `h()`: `@storybook/vue3-vite` aliases
 * `vue` to the runtime-compiler build for exactly this, and it keeps these fixtures readable
 * next to their React counterparts. The trade is that a template string is not typechecked.
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
	/** Vue takes `onKeydown`; React takes `onKeyDown`. The other four are named identically. */
	containerSlotProps: {
		onKeydown: () => console.log('onKeyDown'),
	},
}

/** Spec fixtures: mark components the shared spec mounts through story args. */
export const marks = {
	Value: defineComponent({
		props: {value: String},
		template: '<mark>{{ value }}</mark>',
	}),
	Testid: defineComponent({
		props: {value: String},
		template: '<mark data-testid="mark">{{ value }}</mark>',
	}),
	Children: defineComponent({
		props: {children: {type: null}},
		template: '<mark data-testid="mark"><slot>{{ children }}</slot></mark>',
	}),
	Todo: defineComponent({
		template: '<span data-testid="todo-mark"><input type="checkbox" aria-label="done" /><slot /></span>',
	}),
	Focusable: defineComponent({
		setup: () => ({mark: useMark()}),
		template: '<abbr :title="mark.meta()" style="outline: none; white-space: pre-wrap">{{ mark.value() }}</abbr>',
	}),
	Removable: defineComponent({
		setup: () => ({mark: useMark()}),
		template: '<mark @click="mark.remove()">{{ mark.value() }}</mark>',
	}),
	Updatable: defineComponent({
		setup: () => ({mark: useMark()}),
		template: '<mark @click="mark.update({value: `${mark.value()}1`})">{{ mark.value() }}</mark>',
	}),
	Empty: defineComponent({template: ''}),
}

export const Overlay = defineComponent({template: `<span>I'm here!</span>`})
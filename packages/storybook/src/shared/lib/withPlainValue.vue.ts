import type {StoryContext, VueRenderer} from '@storybook/vue3-vite'
import {useArgs, useGlobals} from 'storybook/preview-api'
import {defineComponent, h, ref} from 'vue'

import PlainValuePanel from '../components/Text/PlainValuePanel.vue'

function narrowPosition(v: unknown): 'right' | 'bottom' | undefined {
	return v === 'right' || v === 'bottom' ? v : undefined
}

function narrowGlobal(v: unknown): 'right' | 'bottom' | 'hide' {
	return v === 'right' || v === 'bottom' || v === 'hide' ? v : 'right'
}

// `VueRenderer['storyResult']`, not `VNode`: a decorated story may also be a component
// options object, and the narrower annotation makes this decorator unassignable to `Decorator`,
// which only surfaced once the preview started being typechecked.
export const withPlainValue = (story: () => VueRenderer['storyResult'], context: StoryContext) => {
	// Storybook hooks — ok to call here (hookify wrapper active at decorator level)
	/* oxlint-disable no-unsafe-argument */
	const [args, updateArgs] = useArgs()
	const [globals] = useGlobals()

	const mergedArgs = {...context.args, ...args}
	const isControlled = 'value' in mergedArgs
	const rawPosition = narrowPosition(context.parameters.plainValue)
	const showPanel = rawPosition === 'right' || rawPosition === 'bottom'
	const globalValue = narrowGlobal(globals.showPlainValue ?? 'right')
	const showPlainValue = globalValue !== 'hide'

	// Stories that don't opt in to the panel, or are uncontrolled.
	if (!showPanel || !isControlled) {
		return story()
	}

	// Panel opted in but globally hidden — still wire onChange so controls stay in sync.
	if (!showPlainValue) {
		return defineComponent({
			setup: () => () => h(story(), {onChange: (v: string) => updateArgs({value: v})}),
		})
	}

	const position = rawPosition

	return defineComponent({
		setup() {
			const value = ref<string>(mergedArgs.value ?? '')

			return () => {
				// The layout mirrors withPlainValue.react.tsx element for element: the same story
				// renders in both frameworks, so their HTML snapshots have to be comparable.
				const storyNode = h(story(), {
					value: value.value,
					onChange: (v: string) => {
						value.value = v
					},
				})
				const panel = h(PlainValuePanel, {value: value.value, position})

				if (position === 'right') {
					return h('div', {style: {display: 'flex', height: '100%'}}, [
						h('div', {style: {flex: 3, minWidth: 0, overflowY: 'auto'}}, [storyNode]),
						panel,
					])
				}

				return h('div', {}, [storyNode, h('div', {class: 'pvp-divider'}), panel])
			}
		},
	})
}
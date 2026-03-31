import type {StoryContext} from '@storybook/vue3-vite'
import {useArgs, useGlobals} from 'storybook/preview-api'
import type {VNode} from 'vue'
import {defineComponent, h, ref} from 'vue'

export const withPlainValue = (story: () => VNode, context: StoryContext) => {
	// Storybook hooks — ok to call here (hookify wrapper active at decorator level)
	/* oxlint-disable no-unsafe-member-access, no-unsafe-argument */
	const [args, updateArgs] = useArgs()
	const [globals] = useGlobals()

	const mergedArgs = {...context.args, ...args}
	const isControlled = 'value' in mergedArgs
	const rawPosition = context.parameters.plainValue as 'right' | 'bottom' | undefined
	const showPanel = rawPosition === 'right' || rawPosition === 'bottom'
	const globalValue = (globals.showPlainValue ?? 'right') as 'right' | 'bottom' | 'hide'
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
				const storyNode = h(story(), {
					value: value.value,
					onChange: (v: string) => {
						value.value = v
					},
				})
				const preNode = h(
					'pre',
					{style: {padding: '8px', fontFamily: 'monospace', fontSize: '14px', margin: 0}},
					value.value
				)

				if (position === 'right') {
					return h('div', {style: {display: 'flex', gap: '16px', height: '100%'}}, [
						h('div', {style: {flex: 3, minWidth: 0}}, [storyNode]),
						h('div', {style: {flex: 1, minWidth: 0}}, [
							h(
								'div',
								{
									style: {
										fontSize: '11px',
										fontWeight: 'bold',
										color: '#666',
										marginBottom: '4px',
										textTransform: 'uppercase',
									},
								},
								'Plain Value'
							),
							preNode,
						]),
					])
				}

				return h('div', {}, [
					storyNode,
					h('hr', {style: {margin: '8px 0', border: '1px solid #e0e0e0'}}),
					preNode,
				])
			}
		},
	})
}
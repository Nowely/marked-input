import type {StoryContext, VueRenderer} from '@storybook/vue3-vite'
import {useArgs, useGlobals} from 'storybook/preview-api'
import {defineComponent, h, reactive} from 'vue'

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

	// Vue has no counterpart to React's `<Story args={...} />`. The component `story()` builds
	// closes over `context.args` and ignores the props it is rendered with (its own args land
	// there through Vue's functional fallthrough, which passes only `class`, `style` and `on*`),
	// and every `story()` call builds a NEW component object. So this decorator:
	//   - builds the story ONCE — calling it per render gives the vnode a fresh type, and Vue
	//     remounts the editor on every keystroke, losing its content, caret and focus;
	//   - writes the value INTO `context.args`, kept reactive so the mounted story patches in
	//     place. `renderToCanvas` already does this in the Storybook preview; doing it here too
	//     is what makes portable stories (the browser suites) behave like the preview;
	//   - keeps passing `onChange` on the vnode: `on*` is what fallthrough lets through, and an
	//     `onChange` injected into args would be dropped again by Storybook's own arg sync.
	const liveArgs = reactive(context.args)
	context.args = liveArgs
	const Story = story()

	// Args are untyped (`Args` is an index signature), so the panel's string prop is narrowed here.
	const plainValue = () => (typeof liveArgs.value === 'string' ? liveArgs.value : '')

	const onChange = (next: string) => {
		liveArgs.value = next
		// Storybook owns the args; the controls panel and the docs args table read them.
		updateArgs({value: next})
	}

	// Panel opted in but globally hidden — still wire onChange so controls stay in sync.
	if (!showPlainValue) {
		return defineComponent({setup: () => () => h(Story, {onChange})})
	}

	const position = rawPosition

	return defineComponent({
		setup: () => () => {
			// The layout mirrors withPlainValue.react.tsx element for element: the same story
			// renders in both frameworks, so their HTML snapshots have to be comparable.
			const storyNode = h(Story, {onChange})
			const panel = h(PlainValuePanel, {value: plainValue(), position})

			if (position === 'right') {
				return h('div', {style: {display: 'flex', height: '100%'}}, [
					h('div', {style: {flex: 3, minWidth: 0, overflowY: 'auto'}}, [storyNode]),
					panel,
				])
			}

			return h('div', {}, [storyNode, h('div', {class: 'pvp-divider'}), panel])
		},
	})
}
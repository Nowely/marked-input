import {component, story, type PageMeta} from '../../shared/lib/stories'
import {fixtures} from './Slots.fixtures'

const CUSTOM_COMPONENTS_VALUE = 'Both @[container] and @[span] are @[customized]'

/**
 * The React-only half of `API/Slots`. Same `title` as `Slots.stories.ts`, so React indexes both
 * files into the one entry; Vue never sees this file.
 *
 * `slots.container` = a COMPONENT is React-only NOT by choice: under the Vue adapter it renders
 * an EMPTY editor. `Container.vue` re-announces `host.rendered()` from its own `onUpdated`, but
 * the token list lives inside the container's SLOT, and a slot function is evaluated by the
 * CHILD's render effect — so `Container.vue` never re-renders, `rendered()` never fires again
 * and the DOM is never bound. Reproducer (pre-existing, no page code involved):
 *
 * ```ts
 * const Custom = defineComponent({setup: (_, {slots}) => () => h('div', slots.default?.())})
 * const {container} = await render(MarkedInput, {props: {Mark, value: 'Hello world', slots: {container: Custom}}})
 * expect(container.textContent).toBe('Hello world') // got '' — the span is empty
 * ```
 *
 * A string tag (`slots: {container: 'article'}`) is unaffected and IS covered in both, by the
 * shared `Slots.spec.ts`.
 */
export default {
	title: 'API/Slots',
	component,
	parameters: {
		docs: {
			description: {
				component:
					'Demonstrates the slots API for customizing internal components. ' +
					'Use `slots` to replace components and `slotProps` to customize their appearance and behavior.',
			},
		},
	},
} satisfies PageMeta

/**
 * Using slots to completely replace the container component.
 * This is useful when you need full control over the component structure.
 */
export const CustomComponents = story({
	args: {
		Mark: fixtures.SimpleMark,
		defaultValue: CUSTOM_COMPONENTS_VALUE,
		slots: {container: fixtures.FancyContainer},
	},
})
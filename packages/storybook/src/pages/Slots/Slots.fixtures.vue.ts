import {MarkedInput} from '@markput/vue'
import type {PropType} from 'vue'
import {computed, defineComponent, reactive} from 'vue'

import {defineMark} from '../../shared/lib/marks'
import type {PageArgs} from '../../shared/lib/stories'

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Slots.stories.ts` is the contract, and it fails to compile under either
 * project if this file drifts.
 *
 * Hand-written components are written with `template:` rather than `h()`, matching their React
 * counterparts. The containers below deliberately declare no props: `slots.container` is fed
 * by attribute fallthrough here where React destructures `{ref, ...props}` by hand, and that
 * difference is what the `StyleMerging` story demonstrates.
 */

/**
 * `WithSlotProps`' harness. It MERGES its handlers into the story's own `slotProps` rather than
 * hardcoding the whole bag, so the story keeps owning the presentational half.
 *
 * `slotProps` is the one declared prop; every other story arg arrives through `$attrs` and is
 * forwarded, which is what React's `{slotProps, ...args}` destructuring does.
 */
const EventLog = defineComponent({
	components: {MarkedInput},
	inheritAttrs: false,
	props: {slotProps: {type: Object as PropType<PageArgs['slotProps']>, default: undefined}},
	setup(props) {
		const events = reactive<string[]>([])
		const addEvent = (event: string) => {
			if (events.length > 4) events.splice(0, events.length - 4)
			events.push(event)
		}

		const merged = computed(() => ({
			...props.slotProps,
			container: {
				...props.slotProps?.container,
				onKeydown: (e: KeyboardEvent) => {
					if (e.key === 'Enter') {
						e.preventDefault()
						addEvent('Enter pressed')
					}
				},
				onClick: () => addEvent('Clicked'),
				onFocusin: () => addEvent('Focused'),
				onFocusout: () => addEvent('Blurred'),
			},
		}))

		return {events, merged}
	},
	template: `
		<h3>Styling & Events via slotProps</h3>
		<p>Customize styling and add custom event handlers without replacing components:</p>

		<MarkedInput v-bind="$attrs" :slotProps="merged" />

		<div style="margin-top: 16px; padding: 12px; background-color: #f0f0f0; border-radius: 4px">
			<strong>Recent events:</strong>
			<p v-if="events.length === 0" style="margin-top: 8px; color: #666">No events yet</p>
			<ul v-else style="margin-top: 8px; padding-left: 20px">
				<li v-for="event in events" :key="event">{{ event }}</li>
			</ul>
		</div>
	`,
})

/** `slots.container` replacing the container outright. */
const FancyContainer = defineComponent({
	template: `
		<div
			style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1)"
		><slot /></div>
	`,
})

/**
 * `StyleMerging`'s container. Vue merges a fallthrough `style` attribute with the component's
 * own, which is what the story demonstrates.
 */
const StyledContainer = defineComponent({
	template: '<div style="background: #e3f2fd; border-radius: 8px"><slot /></div>',
})

export const fixtures = {
	SimpleMark: defineMark({
		tag: 'mark',
		style: {backgroundColor: '#ffd700', padding: '2px 4px', borderRadius: '3px'},
	}),
	FancyContainer,
	StyledContainer,
	/**
	 * `render: () => EventLog` would DROP the args — the returned component is mounted with no
	 * props, so the editor rendered empty. Binding the closure's `args` is what carries them.
	 */
	renderEventLog: (args: PageArgs) =>
		defineComponent({
			components: {EventLog},
			setup: () => ({args}),
			template: '<EventLog v-bind="args" />',
		}),
}

/**
 * Spec fixture: the `slots.container` replacement. A `<section>` so the spec can tell it from the
 * default `<div>` by its tag — the container IS the editing host, so no id is needed to find it.
 */
export const CustomContainer = defineComponent({template: '<section><slot /></section>'})

/**
 * Spec fixture: a container component that carries a class OF ITS OWN. Vue merges the editor's
 * through attribute fallthrough where React's twin merges it by hand, so the mechanism differs and
 * the outcome must not: both classes have to be on the element. `styles.Container` is the controls
 * layer's containing block and carries the `white-space: pre-wrap` rule for every span, so dropping
 * it is not cosmetic.
 */
export const ClassyContainer = defineComponent({template: '<div class="mine"><slot /></div>'})
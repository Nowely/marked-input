import {MarkedInput} from '@markput/vue'
import type {PropType, Ref} from 'vue'
import {computed, defineComponent, reactive, ref} from 'vue'

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
 * Spec fixtures: `slots.container` replacements. `Custom` is a `<section>` so the spec can tell
 * it from the default `<div>` by its tag — the container IS the editing host, so no id is needed
 * to find it.
 */
export const containers = {
	Custom: defineComponent({template: '<section><slot /></section>'}),
	Plain: defineComponent({template: '<div><slot /></div>'}),
}

/**
 * Spec fixtures: `Span` replacements, each differing only in its decoration. What a span puts
 * inside itself is not a knob any of them turn: core is THE writer of a text surface and mirrors
 * the token's text into it whatever the component rendered.
 */
export const spans = {
	/** A `<b>`, not a `<span>`: the tag alone proves the supplied component replaced the default. */
	Custom: defineMark({tag: 'b'}),
	Classy: defineMark({tag: 'span', class: 'custom-span-class'}),
	Styled: defineMark({tag: 'span', style: {fontWeight: 'bold', fontSize: '16px'}}),
	/** Carries an attribute of its own, which the both-slots case asserts survives. */
	SpanProp: defineMark({tag: 'b', attrs: {'data-span-prop': 'span'}}),
}

/**
 * The `slotProps.container` keys the two adapters spell differently. React's synthetic
 * `onFocus`/`onBlur` bubble, so it needs no capture-phase pair; Vue binds the native events,
 * which do not, and takes `onFocusin`/`onFocusout` instead.
 */
export const eventProps = {
	keyDown: 'onKeydown',
	focus: 'onFocusin',
	blur: 'onFocusout',
} as const

/** The OUTER class arg — `class` here, `className` in React. */
export const outerClass = (name: string) => ({class: name})

/**
 * An object ref for `slotProps.container.ref`: Vue's is a `Ref`, React's is `{current}`. The
 * reader is what the shared spec asserts on.
 */
export function containerRef() {
	const element: Ref<HTMLElement | null> = ref(null)
	return {ref: element, current: () => element.value}
}
import {MarkedInput} from '@markput/vue'
import type {PropType, Ref} from 'vue'
import {computed, defineComponent, reactive, ref} from 'vue'

import type {PageArgs} from '../../shared/lib/stories'

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Slots.stories.ts` is the contract, and it fails to compile under either
 * project if this file drifts.
 *
 * Components are written with `template:` rather than `h()`, matching their React counterparts.
 * `value`/`meta` are declared even where nothing reads them: an undeclared prop falls through
 * onto the root element as an attribute, which no React fixture does.
 */

const SimpleMark = defineComponent({
	props: {value: String, meta: String},
	template:
		'<mark style="background-color: #ffd700; padding: 2px 4px; border-radius: 3px"><slot>{{ value }}</slot></mark>',
})

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
	SimpleMark,
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

/** Spec fixture: the mark the shared spec mounts everywhere. */
export const marks = {
	Children: defineComponent({
		props: {value: String, meta: String, children: {type: null}},
		template: '<mark><slot>{{ children }}</slot></mark>',
	}),
}

/** Spec fixtures: `slots.container` replacements. */
export const containers = {
	Testid: defineComponent({template: '<div data-testid="custom-container"><slot /></div>'}),
	Plain: defineComponent({template: '<div><slot /></div>'}),
}

/** Spec fixtures: `Span` replacements. */
export const spans = {
	Testid: defineComponent({
		props: {value: String},
		template: '<span data-testid="custom-span">{{ value }}</span>',
	}),
	Classy: defineComponent({
		props: {value: String},
		template: '<span class="custom-span-class">{{ value }}</span>',
	}),
	Styled: defineComponent({
		props: {value: String},
		template: '<span style="font-weight: bold; font-size: 16px">{{ value }}</span>',
	}),
	SpanProp: defineComponent({
		props: {value: String},
		template: '<span data-testid="custom-span" data-span-prop="span">{{ value }}</span>',
	}),
	Children: defineComponent({
		props: {children: {type: null}},
		template: '<span data-testid="custom-editable-span"><slot>{{ children }}</slot></span>',
	}),
	TextTestid: defineComponent({
		props: {value: String},
		template: '<span data-testid="text-span">{{ value }}</span>',
	}),
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
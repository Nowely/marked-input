import type {Ref} from 'vue'
import {ref} from 'vue'

/**
 * What the two adapters simply spell differently, and nothing else. These are facts about React
 * and Vue rather than fixtures of any one page: a spec asking "how does this adapter name blur"
 * should not have to open `Slots.fixtures` to find out.
 *
 * `framework.react.ts` and `framework.vue.ts` expose the same shape; an importer of
 * `../../shared/lib/framework` gets its own project's file through `resolve.extensions`
 * (vitest/Storybook) and `moduleSuffixes` (tsc/vue-tsc).
 */

/**
 * The `slotProps.container` keys. Vue binds the native events, and `focus`/`blur` do not bubble,
 * so it takes the capture-phase `onFocusin`/`onFocusout`; React's synthetic pair bubbles and
 * needs no such thing.
 */
export const eventProps = {
	keyDown: 'onKeydown',
	focus: 'onFocusin',
	blur: 'onFocusout',
} as const

/** The OUTER class arg — `class` here, `className` in React. */
export const outerClass = (name: string) => ({class: name})

/** A `slotProps.container` bag naming its handlers this adapter's way. */
export const containerSlotProps = {onKeydown: () => console.log('onKeyDown')}

/**
 * An object ref for `slotProps.container.ref`: Vue's is a `Ref`, React's is `{current}`. The
 * reader is what a shared spec asserts on.
 */
export function containerRef() {
	const element: Ref<HTMLElement | null> = ref(null)
	return {ref: element, current: () => element.value}
}

/** The react instance hides a story from its docs page; this one shows it. */
export const hiddenFromDocs = {}

/** No vue counterpart to react's caret-info decorator. */
export const caretInfo = []
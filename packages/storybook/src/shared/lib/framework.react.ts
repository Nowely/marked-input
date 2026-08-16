import type {Decorator} from '@storybook/react'
import {createElement} from 'react'

import {useCaretInfo} from '../hooks/useCaretInfo.react'

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
 * The `slotProps.container` keys. React's synthetic `onFocus`/`onBlur` bubble, so it needs no
 * capture-phase pair; Vue binds the native events, which do not, and takes
 * `onFocusin`/`onFocusout` instead.
 */
export const eventProps = {
	keyDown: 'onKeyDown',
	focus: 'onFocus',
	blur: 'onBlur',
} as const

/** The OUTER class arg — `className` here, `class` in Vue. */
export const outerClass = (name: string) => ({className: name})

/** A `slotProps.container` bag naming its handlers this adapter's way. */
export const containerSlotProps = {onKeyDown: () => console.log('onKeyDown')}

/**
 * An object ref for `slotProps.container.ref`: React's is `{current}`, Vue's is a `Ref`. The
 * reader is what a shared spec asserts on.
 */
export function containerRef() {
	const ref: {current: HTMLElement | null} = {current: null}
	return {ref, current: () => ref.current}
}

/** Debug aid with no Vue counterpart: a tooltip on `document.body`, outside the story container. */
const withCaretInfo: Decorator = Story => {
	useCaretInfo(true)
	return createElement(Story)
}

/** Only the react instance hides a story from its docs page; the vue one shows it. */
export const hiddenFromDocs = {docs: {disable: true}}

export const caretInfo = [withCaretInfo]
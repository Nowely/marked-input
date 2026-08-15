import type {CSSProperties} from '@markput/core'
import type {MarkProps} from '@markput/vue'
import {useMark} from '@markput/vue'
import type {VNodeArrayChildren} from 'vue'
import {defineComponent, h} from 'vue'

// The exact sibling, not the seam name: oxlint does not honour `moduleSuffixes`.
import type {MarkSpec} from './marks.shared'

/**
 * The framework seam for fixture marks. `marks.react.tsx` and `marks.vue.ts` expose the same
 * shape; a page's `*.fixtures.*` importing `../../shared/lib/marks` gets its own project's
 * file through `resolve.extensions` (vitest) and `moduleSuffixes` (tsc).
 *
 * Generated marks are written with `h()` rather than a `template:` string: the spec's `class`,
 * `style` and `attrs` would otherwise be interpolated into an unchecked string. Hand-written
 * fixtures keep `template:` — `@storybook/vue3-vite` aliases `vue` to the runtime-compiler
 * build, and the vue vitest project does the same.
 */

/** The props a mark receives once an option's `mark` mapper adds a style, as the preset does. */
export type StyledMarkProps = MarkProps & {style?: CSSProperties}

/**
 * Declared on every generated mark, read or not. Core hands a mark `{value, meta}` and an
 * option's mapper may add `children` or `style`; vue puts every UNDECLARED prop onto the root
 * element as an attribute, so `<mark meta="1">` would face react's `<mark>`. `inheritAttrs:
 * false` closes the same hole for anything the pair does not cover.
 */
const MARK_PROPS = {value: String, meta: String, children: {type: null}, style: {type: Object}}

/** `MARK_PROPS.children` is declared `type: null`, so vue infers `any` and the read needs narrowing. */
type MarkChildren = string | VNodeArrayChildren | undefined

/**
 * A mark that is one element plus static decoration. Anything past that — a hook, a handler,
 * a second child element, a tag derived from the value — stays hand-written on its page.
 */
export function defineMark(spec: MarkSpec) {
	const {tag, class: className, style: ownStyle, attrs, onRender} = spec

	return defineComponent({
		inheritAttrs: false,
		props: MARK_PROPS,
		setup:
			(props, {slots}) =>
			() => {
				onRender?.()
				// Read inside the render function, not in `setup`: a mark's children change in place.
				const children: MarkChildren = props.children

				return h(
					tag,
					{class: className, style: [props.style, ownStyle], ...attrs},
					slots.default?.() ?? children ?? props.value
				)
			},
	})
}

/**
 * A generated mark that counts its render invocations, and the reader for the count.
 *
 * The counter fires from the render function `setup` RETURNS, which is where one call means one
 * render. `setup` itself runs once per mounted instance, so counting there would measure mounts
 * instead — which is what `markMounts` in `renderCount.fixtures.*` does deliberately.
 */
export function countRenders(spec: MarkSpec = {tag: 'mark'}) {
	let renders = 0
	return [defineMark({...spec, onRender: () => renders++}), () => renders] as const
}

/**
 * THE undecorated mark: `<mark>{children ?? value}</mark>`. Ten pages wrote this call out under
 * ten different names; a page names it again only when the name carries meaning its story needs.
 */
export const Mark = defineMark({tag: 'mark'})

/** The same in a `<span>` — a block row's mark, a bare nested shell, an unstyled `Span` slot. */
export const Span = defineMark({tag: 'span'})

/** The `useMark()` marks the `Base` and `Dynamic` pages both mount, identical on both today. */
export const Removable = defineComponent<MarkProps>({
	inheritAttrs: false,
	setup: () => ({mark: useMark()}),
	template: '<mark @click="mark.remove()">{{ mark.value() }}</mark>',
})

export const Focusable = defineComponent<MarkProps>({
	inheritAttrs: false,
	setup: () => ({mark: useMark()}),
	template: '<abbr :title="mark.meta()" style="outline: none; white-space: pre-wrap">{{ mark.value() }}</abbr>',
})

/**
 * A mark that renders nothing, for the stories whose subject is the overlay. A render function
 * rather than `template: ''`, which vue reads as no template at all and dev-warns about.
 */
export const Empty = defineComponent<MarkProps>({
	inheritAttrs: false,
	setup: () => () => null,
})
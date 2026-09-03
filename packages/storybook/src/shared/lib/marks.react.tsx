import type {CSSProperties} from '@markput/core'
import type {MarkProps} from '@markput/react'
import {useMark, useMarkInfo} from '@markput/react'
import type {ComponentType, RefCallback} from 'react'
import {createElement} from 'react'

// The exact sibling, not the seam name: oxlint does not honour `moduleSuffixes`.
import type {MarkContext, MarkSpec} from './marks.shared'

/**
 * The framework seam for fixture marks. `marks.react.tsx` and `marks.vue.ts` expose the same
 * shape; a page's `*.fixtures.*` importing `../../shared/lib/marks` gets its own project's
 * file through `resolve.extensions` (vitest) and `moduleSuffixes` (tsc).
 */

/**
 * The props a mark receives once an option's `mark` mapper adds a style, as the preset does.
 *
 * `ref` is forwarded because a consumer's `Span` IS the text Surface and so cannot be wrapped the
 * way a Mark is — core writes into it directly, and it has to be consigned to be found. A Mark's
 * own ref is unused (markput wraps it), but this factory serves both and forwarding costs nothing.
 * It is `SpanProps`' own callback rather than the wider `Ref`, because that is what the editor
 * hands over and a `Ref` also admits `null`, which a generated mark can never be handed.
 */
export type StyledMarkProps = MarkProps & {style?: CSSProperties; ref?: RefCallback<HTMLElement>}

/**
 * A mark that is one element, its decoration, and at most a click. Anything past that — a second
 * child element, a nested component, a hook this seam does not pass on — stays hand-written.
 *
 * Two component functions, picked at DEFINITION time rather than one that branches per render.
 * `useMark()` and `useMarkInfo()` both throw on a text token, and a generated mark also serves as
 * a `Span`; taking the branch here keeps every hook call unconditional inside its own component
 * and keeps the hooks out of the marks that never asked for them.
 */
export function defineMark(spec: MarkSpec): ComponentType<StyledMarkProps> {
	const {tag, class: className, style: ownStyle, attrs, on, onRender} = spec
	const click = on?.click

	if (typeof tag !== 'function' && typeof attrs !== 'function' && !click) {
		return function Mark({children, value, style, ref}: StyledMarkProps) {
			onRender?.()
			return createElement(tag, {className, style: {...style, ...ownStyle}, ...attrs, ref}, children ?? value)
		}
	}

	return function ComputedMark({children, value, meta, style, ref}: StyledMarkProps) {
		onRender?.()
		const context: MarkContext = {value, meta, info: useMarkInfo(), mark: useMark()}

		return createElement(
			typeof tag === 'function' ? tag(context) : tag,
			{
				className,
				style: {...style, ...ownStyle},
				...(typeof attrs === 'function' ? attrs(context) : attrs),
				onClick: click && (() => click(context)),
				ref,
			},
			children ?? value
		)
	}
}

/**
 * A generated mark that counts its render invocations, and the reader for the count.
 *
 * The counter fires from the component BODY, which is where one call means one render:
 * `useSyncExternalStore` calls `getSnapshot` without committing, and a body counter cannot see
 * those — counting anywhere else would measure the subscription instead of the render.
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

/** The same in a `<span>` — a row's mark, a bare nested shell, an unstyled `Span` slot. */
export const Span = defineMark({tag: 'span'})

/** The marks the `Base` and `Dynamic` pages both mount. */
export const Removable = defineMark({tag: 'mark', on: {click: ({mark}) => mark.remove()}})

export const Focusable = defineMark({
	tag: 'abbr',
	style: {outline: 'none', whiteSpace: 'pre-wrap'},
	// `{}`, not `{title: ''}`: an empty string renders `title=""` where React drops the attribute.
	attrs: ({meta}): Record<string, string> => (meta === undefined ? {} : {title: meta}),
})

/** A mark that renders nothing, for the stories whose subject is the overlay. */
export const Empty: ComponentType<MarkProps> = () => null
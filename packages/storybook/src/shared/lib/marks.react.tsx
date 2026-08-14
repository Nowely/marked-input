import type {CSSProperties} from '@markput/core'
import type {MarkProps} from '@markput/react'
import {useMark} from '@markput/react'
import type {ComponentType} from 'react'
import {createElement} from 'react'

// The exact sibling, not the seam name: oxlint does not honour `moduleSuffixes`.
import type {MarkSpec} from './marks.shared'

/**
 * The framework seam for fixture marks. `marks.react.tsx` and `marks.vue.ts` expose the same
 * shape; a page's `*.fixtures.*` importing `../../shared/lib/marks` gets its own project's
 * file through `resolve.extensions` (vitest) and `moduleSuffixes` (tsc).
 */

/** The props a mark receives once an option's `mark` mapper adds a style, as the preset does. */
export type StyledMarkProps = MarkProps & {style?: CSSProperties}

/**
 * A mark that is one element plus static decoration. Anything past that — a hook, a handler,
 * a second child element, a tag derived from the value — stays hand-written on its page.
 */
export function defineMark(spec: MarkSpec): ComponentType<StyledMarkProps> {
	const {tag, content, class: className, style: ownStyle, attrs} = spec

	return function Mark({children, value, style}: StyledMarkProps) {
		const inside = content === 'value' ? value : (children ?? (content === 'childrenOrValue' ? value : undefined))

		return createElement(tag, {className, style: {...style, ...ownStyle}, ...attrs}, inside)
	}
}

/** The `useMark()` marks the `Base` and `Dynamic` pages both mount, identical on both today. */
export const Removable: ComponentType<MarkProps> = () => {
	const mark = useMark()
	return <mark onClick={() => mark.remove()}>{mark.value()}</mark>
}

export const Focusable: ComponentType<MarkProps> = () => {
	const mark = useMark()
	return (
		<abbr title={mark.meta()} style={{outline: 'none', whiteSpace: 'pre-wrap'}}>
			{mark.value()}
		</abbr>
	)
}

/** A mark that renders nothing, for the stories whose subject is the overlay. */
export const Empty: ComponentType<MarkProps> = () => null
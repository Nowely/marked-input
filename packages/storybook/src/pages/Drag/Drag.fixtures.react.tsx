import type {MarkProps, Option} from '@markput/react'
import type {CSSProperties} from 'react'

import {markdownOptions} from '../Nested/MarkdownOptions'

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Drag.stories.ts` is the contract, and it fails to compile under either
 * project if this file drifts.
 */

/** The markdown options hand every mark a `style`; the page's own marks accept it. */
interface StyledMarkProps extends MarkProps {
	style?: CSSProperties
}

const MarkdownMark = ({children, value, style}: StyledMarkProps) => (
	<span style={{...style, margin: '0 1px'}}>{children ?? value}</span>
)

const ParagraphMark = ({children, value}: MarkProps) => <span>{children ?? value}</span>

/** One block-level markup, so a plain-text document is split into one draggable row per paragraph. */
const paragraphOptions: Option[] = [{markup: '__slot__\n\n', Mark: ParagraphMark}]

export const fixtures = {
	MarkdownMark,
	ParagraphMark,
	paragraphOptions,
	/** Shared with the `Nested` page; its Vue twin is inline in `Drag.fixtures.vue.ts` for now. */
	markdownOptions,
}

/** Spec fixtures: mark components the shared spec mounts through `mountComponent`. */
export const marks = {
	Value: ({value}: MarkProps) => <mark>{value}</mark>,
}
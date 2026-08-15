import type {Option} from '@markput/react'

import {defineMark, Mark, Span} from '../../shared/lib/marks'

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Drag.stories.ts` is the contract, and it fails to compile under either
 * project if this file drifts.
 */

const ParagraphMark = Span

/** One block-level markup, so a plain-text document is split into one draggable row per paragraph. */
const paragraphOptions: Option[] = [{markup: '__slot__\n\n', Mark: ParagraphMark}]

export const fixtures = {
	/** The markdown options hand every mark the `style` of whichever markup matched. */
	MarkdownMark: defineMark({tag: 'span', style: {margin: '0 1px'}}),
	ParagraphMark,
	paragraphOptions,
}

/** Spec fixtures: mark components the shared spec mounts through `mountComponent`. */
export const marks = {
	Value: Mark,
}
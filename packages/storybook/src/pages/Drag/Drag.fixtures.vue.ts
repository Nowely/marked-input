import type {Option} from '@markput/vue'

import {defineMark, Span} from '../../shared/lib/marks'

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Drag.stories.ts` is the contract, and it fails to compile under either
 * project if this file drifts.
 */

const ParagraphMark = Span

/** Paragraph rows need NO markup (issue 08): the structural separator splits the rows. */
const paragraphOptions: Option[] = []

export const fixtures = {
	/** The markdown options hand every mark the `style` of whichever markup matched. */
	MarkdownMark: defineMark({tag: 'span', style: {margin: '0 1px'}}),
	ParagraphMark,
	paragraphOptions,
}
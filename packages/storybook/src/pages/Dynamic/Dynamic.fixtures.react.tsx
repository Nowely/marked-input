import {useMark} from '@markput/react'
import type {Decorator} from '@storybook/react'

import {useCaretInfo} from '../../shared/hooks/useCaretInfo.react'
import {Focusable, Removable} from '../../shared/lib/marks'

/** Debug aid with no Vue counterpart: a tooltip on `document.body`, outside the story container. */
const withCaretInfo: Decorator = Story => {
	useCaretInfo(true)
	return <Story />
}

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Dynamic.stories.ts` is the contract, and it fails to compile under either
 * project if this file drifts.
 *
 * Every mark here is prop-less and reads through `useMark()`, which is what the page is about.
 * Two of the three are the ones the `Base` page mounts as well, so they live in the seam.
 */
export const fixtures = {
	Dynamic: () => {
		const mark = useMark()
		return <mark>{mark.value()}</mark>
	},
	Removable,
	Focusable,
	/** Only the react instance hides these stories from its docs page. */
	hiddenFromDocs: {docs: {disable: true}},
	caretInfo: [withCaretInfo],
}
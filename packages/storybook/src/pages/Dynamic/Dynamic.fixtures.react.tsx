import {useMark} from '@markput/react'

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
}
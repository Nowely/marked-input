import type {MarkProps} from '@markput/vue'
import {useMark} from '@markput/vue'
import {defineComponent} from 'vue'

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Dynamic.stories.ts` is the contract, and it fails to compile under either
 * project if this file drifts.
 *
 * Every mark here reads through `useMark()`, so `MarkProps` is a type argument only — without
 * it the mark has no props at all and `Story` narrows `Mark` to `Component<MarkProps>`, which a
 * prop-less component does not satisfy. Two of the three are the ones the `Base` page mounts as
 * well, so they live in the seam.
 *
 * `inheritAttrs: false` is what keeps the rendered DOM equal to React's. Vue puts every prop a
 * component does not declare onto its root element, so `value` and `meta` would land there as
 * attributes; React drops unknown props instead. Any Vue mark that reads through `useMark()`
 * needs this.
 */
export const fixtures = {
	Dynamic: defineComponent<MarkProps>({
		inheritAttrs: false,
		setup: () => ({mark: useMark()}),
		template: '<mark>{{ mark.value() }}</mark>',
	}),
}
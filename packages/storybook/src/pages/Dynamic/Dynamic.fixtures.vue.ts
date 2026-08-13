import type {MarkProps} from '@markput/vue'
import {useMark} from '@markput/vue'
import {defineComponent} from 'vue'

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Dynamic.stories.ts` is the contract, and it fails to compile under either
 * project if this file drifts.
 *
 * Every mark here reads through `useMark()`, which is what the page is about, so `MarkProps`
 * is declared as a type argument only: a runtime `props` option would claim `value` / `meta`
 * as props and stop them falling through as attributes onto the rendered element. Without the
 * type argument the mark has no props at all, and `Story` narrows `Mark` to
 * `Component<MarkProps>`, which a prop-less component does not satisfy.
 */
export const fixtures = {
	Dynamic: defineComponent<MarkProps>({
		setup: () => ({mark: useMark()}),
		template: '<mark>{{ mark.value() }}</mark>',
	}),
	Removable: defineComponent<MarkProps>({
		setup: () => ({mark: useMark()}),
		template: '<mark @click="mark.remove()">{{ mark.value() }}</mark>',
	}),
	Focusable: defineComponent<MarkProps>({
		setup: () => ({mark: useMark()}),
		template: '<abbr :title="mark.meta()" style="outline: none; white-space: pre-wrap">{{ mark.value() }}</abbr>',
	}),
	/** The react instance hides two of these stories from its docs page; this one shows them. */
	hiddenFromDocs: {},
	caretInfo: [],
}
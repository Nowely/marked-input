import type {MarkedInputProps, MarkProps} from '@markput/vue'
import {MarkedInput} from '@markput/vue'
import type {Meta, StoryObj} from '@storybook/vue3-vite'
import type {Component, DefineComponent} from 'vue'

/**
 * The story-authoring seam. `stories.react.ts` and `stories.vue.ts` expose the same three
 * names; a page's single `*.stories.ts` gets its own project's file through
 * `resolve.extensions` (vitest/Storybook) and `moduleSuffixes` (tsc/vue-tsc).
 *
 * There is deliberately no `defineMeta()`: the CSF indexer parses the file statically and
 * only accepts a default export that is an object literal or an identifier bound to one, so
 * meta stays written out and is only *checked* by the seam ({@link PageMeta}).
 */

/**
 * `MarkedInput.vue` declares `generic=`, so its type is a generic function rather than a
 * concrete component, and Storybook's `Meta` only accepts a `ConcreteComponent`. The
 * assertion is type-level only — the runtime value is the real component.
 */
// oxlint-disable-next-line no-unsafe-type-assertion -- generic SFC has no ConcreteComponent form; see above
const concrete = MarkedInput as unknown as DefineComponent<MarkedInputProps<MarkProps>>

/** The component a page's meta points at. */
export const component = concrete

/** What a page's `export default` must satisfy. */
export type PageMeta = Meta<typeof component>

/**
 * The args a story of this page takes. `Mark` is NOT narrowed here: a mark may legitimately
 * declare no props and read its value through `useMark()`, and Vue's `Component<T>` rejects
 * such a component against any concrete `T`. The narrowing lives in {@link Story}, where
 * every mark comes from the page's own fixtures.
 */
export type PageArgs<TMarkProps = MarkProps> = MarkedInputProps<TMarkProps> & {
	/** `MarkedInput.vue` declares `change` as an emit, so the listener is not in its props type. */
	onChange?: (value: string) => void
}

/**
 * Vue's published `MarkedInputProps` types `Mark` as a bare `Component`, so `TMarkProps` would
 * only reach `options[].mark`. Story args narrow it so a story's `Mark` is held to the same
 * contract React holds it to.
 */
type StoryArgs<TMarkProps> = Omit<PageArgs<TMarkProps>, 'Mark'> & {Mark?: Component<TMarkProps>}

/** One story's annotations, args-checked against this framework's `MarkedInputProps`. */
export type Story<TMarkProps = MarkProps> = StoryObj<StoryArgs<TMarkProps>>

/**
 * What the indexer reads off a story only when it is written literally in the story file.
 * Passing them through this helper compiles but is invisible to Storybook, so the helper
 * refuses them: a story that needs one is written as a plain object literal.
 */
type IndexedLiterally = 'name' | 'tags' | 'play'

/**
 * Declares a story. The type argument is the props this story's marks receive, so a page
 * can mix mark shapes that a single file-level `Meta` could never express.
 *
 * `NoInfer` is load-bearing: without it TS infers `TMarkProps` from `args.Mark`, so a story
 * that never declares its mark props silently accepts any component instead of being held to
 * the default `MarkProps`.
 */
export function story<TMarkProps = MarkProps>(
	input: Omit<Story<NoInfer<TMarkProps>>, IndexedLiterally>
): Story<TMarkProps> {
	return input
}
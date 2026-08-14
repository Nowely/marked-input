import type {MarkedInputProps, MarkProps} from '@markput/react'
import {MarkedInput} from '@markput/react'
import type {Meta, StoryObj} from '@storybook/react-vite'

/**
 * The story-authoring seam. `stories.react.ts` and `stories.vue.ts` expose the same three
 * names; a page's single `*.stories.ts` gets its own project's file through
 * `resolve.extensions` (vitest/Storybook) and `moduleSuffixes` (tsc/vue-tsc).
 *
 * There is deliberately no `defineMeta()`: the CSF indexer parses the file statically and
 * only accepts a default export that is an object literal or an identifier bound to one, so
 * meta stays written out and is only *checked* by the seam ({@link PageMeta}).
 */

/** The component a page's meta points at. */
export const component = MarkedInput

/** What a page's `export default` must satisfy. */
export type PageMeta = Meta<typeof component>

/** The args a story of this page takes, in this framework's shape. */
export type PageArgs<TMarkProps = MarkProps> = MarkedInputProps<TMarkProps>

/** One story's annotations, args-checked against this framework's `MarkedInputProps`. */
export type Story<TMarkProps = MarkProps> = StoryObj<PageArgs<TMarkProps>>

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
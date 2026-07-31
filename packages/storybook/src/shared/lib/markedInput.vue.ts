import type {MarkedInputProps, MarkProps} from '@markput/vue'
import {MarkedInput} from '@markput/vue'
import type {DefineComponent} from 'vue'

/**
 * `MarkedInput.vue` declares `generic=`, so its type is a generic function rather
 * than a concrete component. Storybook's `Meta` and `composeStories` only accept
 * `ConcreteComponent`, so stories type against a concrete view of it.
 *
 * Pass the mark-props type when a story's `options[].mark` returns custom props:
 * `const MarkedInputStory = asStoryComponent<ButtonProps>()`.
 *
 * The cast is type-level only — the runtime value is the real component.
 */
export function asStoryComponent<TMarkProps = MarkProps>() {
	// oxlint-disable-next-line no-unsafe-type-assertion -- generic SFC has no ConcreteComponent form; see above
	return MarkedInput as unknown as DefineComponent<MarkedInputProps<TMarkProps>>
}

export const MarkedInputStory = asStoryComponent()
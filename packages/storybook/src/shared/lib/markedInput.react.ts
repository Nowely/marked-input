import type {MarkedInputProps, MarkProps, OverlayProps} from '@markput/react'
import {MarkedInput} from '@markput/react'
import type {ComponentType} from 'react'

/**
 * `MarkedInput` is generic, so Storybook's `Meta`/`StoryObj` collapse its mark-props
 * parameter to `unknown` and reject typed `Mark` components. Stories type against a
 * concrete instantiation instead.
 *
 * Pass the mark-props type when a story's marks take custom props:
 * `const MarkedInputStory = asStoryComponent<ChipProps>()`.
 */
export function asStoryComponent<TMarkProps = MarkProps>(): ComponentType<MarkedInputProps<TMarkProps>> {
	return MarkedInput
}

export const MarkedInputStory = MarkedInput<MarkProps, OverlayProps>
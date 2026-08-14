import type {MarkProps, OverlayProps} from '@markput/react'
import {MarkedInput} from '@markput/react'

/**
 * `MarkedInput` is generic, so Storybook's `Meta`/`StoryObj` collapse its mark-props
 * parameter to `unknown` and reject typed `Mark` components. Stories type against a
 * concrete instantiation instead.
 */
export const MarkedInputStory = MarkedInput<MarkProps, OverlayProps>
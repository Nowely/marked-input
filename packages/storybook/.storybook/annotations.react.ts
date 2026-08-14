import type {ReactRenderer} from '@storybook/react-vite'
import type {ProjectAnnotations} from 'storybook/internal/types'

import {withPlainValue} from '../src/shared/lib/withPlainValue.react'
import {annotationsBase} from './annotations.base'

/**
 * The react half of the preview. `preview.ts` re-exports whichever of `annotations.react.ts`
 * / `annotations.vue.ts` the running instance resolves, and the vitest setup file imports
 * this one directly, so the Storybook UI and the browser tests share one source.
 */
const annotations: ProjectAnnotations<ReactRenderer> = {
	...annotationsBase,
	decorators: [withPlainValue],
}

export default annotations
import {component, story, type PageMeta} from '../../shared/lib/stories'
import {fixtures} from './Selection.fixtures'

const INLINE_VALUE = 'hello @[world](1) foo'
const BLOCK_VALUE = 'hello\n@[world](1)\nfoo'

/**
 * Every named export of a CSF file is indexed as a story, so this file exports stories and
 * nothing else — page constants stay module-private.
 */
export default {
	title: 'Selection',
	component,
} satisfies PageMeta

export const Inline = story({
	args: {Mark: fixtures.Value, defaultValue: INLINE_VALUE},
})

export const Drag = story({
	args: {layout: 'block', draggable: true, Mark: fixtures.Value, defaultValue: BLOCK_VALUE},
})
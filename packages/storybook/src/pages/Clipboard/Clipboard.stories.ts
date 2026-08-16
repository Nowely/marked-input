import {Mark} from '../../shared/lib/marks'
import {component, story, type PageMeta} from '../../shared/lib/stories'
import {fixtures} from './Clipboard.fixtures'

const INLINE_VALUE = 'hello @[world](1) foo'
const BLOCK_VALUE = 'hello\n@[world](1)\nfoo'

/**
 * Every named export of a CSF file is indexed as a story, so this file exports stories and
 * nothing else — page constants stay module-private.
 */
export default {
	title: 'Clipboard',
	component,
} satisfies PageMeta

export const Inline = story({
	args: {Mark, defaultValue: INLINE_VALUE},
})

/** The one story with a `render`: React returns an element, Vue a component. */
export const PlainText = story({
	render: fixtures.renderPlainText,
})

export const Drag = story({
	args: {layout: 'block', draggable: true, Mark, defaultValue: BLOCK_VALUE},
})

export const NestedMarkStory = story({
	args: {Mark: fixtures.NestedMark, defaultValue: INLINE_VALUE},
})
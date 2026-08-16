import {component, story, type PageMeta} from '../../shared/lib/stories'
import {fixtures} from './Api.fixtures'

const INLINE_VALUE = 'hello @[world](u1) foo'

// Block ROWS are top-level TOKENS, not newline-separated lines: two marks are two rows,
// and `'first row\nsecond row'` would be ONE text row — which is why the between-rows
// scenario needs this value and not a multi-line string.
const BLOCK_VALUE = '@[a](x)@[b](y)'

/**
 * Every named export of a CSF file is indexed as a story, so this file exports stories and
 * nothing else — page constants stay module-private.
 *
 * Both stories render through the fixture harness: the page's subject is the toolbar driving
 * `MarkputApi`, so the buttons and the `<output>` are the only part written twice.
 */
export default {
	title: 'Api',
	component,
} satisfies PageMeta

export const Default = story({
	args: {layout: 'inline', defaultValue: INLINE_VALUE},
	render: fixtures.renderPlayground,
})

export const Block = story({
	args: {layout: 'block', defaultValue: BLOCK_VALUE},
	render: fixtures.renderPlayground,
})
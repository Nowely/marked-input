import {component, story, type PageMeta} from '../../shared/lib/stories'
import {fixtures} from './Dynamic.fixtures'

const DYNAMIC_VALUE = 'Hello, dynamical mark @[world]( )!'

const REMOVABLE_VALUE = 'I @[contain]( ) @[removable]( ) by click @[marks]( )!'

const FOCUSABLE_VALUE = 'Hello, @[focusable](By key operations) abbreviation @[world](Hello! Hello!)!'

/**
 * Every named export of a CSF file is indexed as a story, so this file exports stories and
 * nothing else — page constants stay module-private.
 */
export default {
	title: 'MarkedInput/Mark',
	tags: ['autodocs'],
	component,
} satisfies PageMeta

export const Dynamic = story({
	args: {Mark: fixtures.Dynamic, defaultValue: DYNAMIC_VALUE},
})

export const Removable = story({
	parameters: fixtures.hiddenFromDocs,
	args: {Mark: fixtures.Removable, defaultValue: REMOVABLE_VALUE},
})

export const Focusable = story({
	parameters: {...fixtures.hiddenFromDocs, plainValue: 'right'},
	args: {Mark: fixtures.Focusable, value: FOCUSABLE_VALUE},
	decorators: fixtures.caretInfo,
})
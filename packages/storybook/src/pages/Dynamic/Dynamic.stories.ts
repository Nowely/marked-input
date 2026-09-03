import {caretInfo, hiddenFromDocs} from '../../shared/lib/framework'
// Aliased: this file's own stories are named `Removable` and `Focusable`.
import {Focusable as FocusableMark, Removable as RemovableMark} from '../../shared/lib/marks'
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
	title: 'Markput/Mark',
	tags: ['autodocs'],
	component,
	/** A plain annotated field: this page never splits its value into rows (ADR-0011). */
	args: {separator: null},
} satisfies PageMeta

export const Dynamic = story({
	args: {Mark: fixtures.Dynamic, defaultValue: DYNAMIC_VALUE},
})

export const Removable = story({
	parameters: hiddenFromDocs,
	args: {Mark: RemovableMark, defaultValue: REMOVABLE_VALUE},
})

export const Focusable = story({
	parameters: {...hiddenFromDocs, plainValue: 'right'},
	args: {Mark: FocusableMark, value: FOCUSABLE_VALUE},
	decorators: caretInfo,
})
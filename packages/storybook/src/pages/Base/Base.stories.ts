import type {Markup} from '@markput/core'

import {component, story, type PageMeta} from '../../shared/lib/stories'
import {fixtures} from './Base.fixtures'

/** Props the `Configured` story's marks produce for the shared `Button`. */
type ButtonMarkProps = {label: string; primary?: boolean; onClick?: () => void}

const DEFAULT_VALUE = 'Hello, clickable marked @[world](Hello! Hello!)!'

const CONFIGURED_VALUE =
	"Enter the '@' for calling @[primary](primary:4) suggestions and '/' for @[default](default:7)!\n" +
	'Mark is can be a any component with any logic. In this example it is the @[Button](primary:54): clickable primary or secondary.\n' +
	'For found mark used @[annotations](default:123).'

const AUTOCOMPLETE_VALUE = 'Hello, clickable marked @world!'

const PrimaryMarkup = '@[__value__](primary:__meta__)' as Markup
const DefaultMarkup = '@[__value__](default:__meta__)' as Markup

/** `slotProps.container` handlers both adapters name identically. */
const sharedContainerHandlers = {
	onClick: () => console.log('onClick'),
	onInput: () => console.log('onInput'),
	onBlur: () => console.log('onBlur'),
	onFocus: () => console.log('onFocus'),
}

/**
 * Every named export of a CSF file is indexed as a story, so this file exports stories and
 * nothing else — page constants stay module-private.
 */
export default {
	title: 'MarkedInput',
	tags: ['autodocs'],
	component,
} satisfies PageMeta

export const Default = story({
	args: {Mark: fixtures.Alerting, defaultValue: DEFAULT_VALUE},
})

export const Configured = story<ButtonMarkProps>({
	args: {
		Mark: fixtures.Button,
		options: [
			{
				markup: PrimaryMarkup,
				mark: ({value, meta}) => ({label: value ?? '', primary: true, onClick: () => alert(meta)}),
				overlay: {trigger: '@', data: ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth']},
			},
			{
				markup: DefaultMarkup,
				mark: ({value}) => ({label: value ?? ''}),
				overlay: {trigger: '/', data: ['Seventh', 'Eight', 'Ninth']},
			},
		],
		value: CONFIGURED_VALUE,
		slotProps: {container: {...sharedContainerHandlers, ...fixtures.containerSlotProps}},
	},
	parameters: {plainValue: fixtures.plainValue},
})

export const Autocomplete = story({
	args: {
		defaultValue: AUTOCOMPLETE_VALUE,
		options: [{markup: '@__value__' as Markup, overlay: {trigger: '@', data: ['one', 'two', 'three', 'four']}}],
	},
})
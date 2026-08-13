import type {Markup} from '@markput/core'

import {component, story, type PageMeta} from '../../shared/lib/stories'
import {fixtures} from './Overlay.fixtures'

const DEFAULT_VALUE = 'Hello, default - suggestion overlay by trigger @!'
const CUSTOM_VALUE = 'Hello, custom overlay by trigger @!'
const CUSTOM_TRIGGER_VALUE = 'Hello, custom overlay by trigger /!'
const POSITIONED_VALUE = 'Hello, positioned overlay by trigger @!'
const SELECTABLE_VALUE = 'Hello, suggest overlay by trigger @!'

/**
 * Every named export of a CSF file is indexed as a story, so this file exports stories and
 * nothing else — page constants stay module-private.
 */
export default {
	title: 'MarkedInput/Overlay',
	tags: ['autodocs'],
	component,
} satisfies PageMeta

export const DefaultOverlay = story({
	args: {
		Mark: fixtures.Mark,
		defaultValue: DEFAULT_VALUE,
		options: [
			{
				overlay: {
					trigger: '@',
					data: ['First', 'Second', 'Third'],
				},
			},
		],
	},
})

export const CustomOverlay = story({
	args: {
		Mark: fixtures.Empty,
		Overlay: fixtures.Overlay,
		defaultValue: CUSTOM_VALUE,
	},
})

export const CustomTrigger = story({
	args: {
		Mark: fixtures.Empty,
		Overlay: fixtures.Overlay,
		defaultValue: CUSTOM_TRIGGER_VALUE,
		options: [{overlay: {trigger: '/'}}],
	},
})

export const PositionedOverlay = story({
	args: {
		Mark: fixtures.Empty,
		Overlay: fixtures.Tooltip,
		defaultValue: POSITIONED_VALUE,
	},
})

export const SelectableOverlay = story({
	args: {
		Mark: fixtures.Mark,
		Overlay: fixtures.List,
		defaultValue: SELECTABLE_VALUE,
		options: [{markup: '@[__value__](__meta__)' as Markup, overlay: {trigger: '@'}}],
	},
})
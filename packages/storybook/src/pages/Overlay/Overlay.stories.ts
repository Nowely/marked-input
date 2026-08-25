import type {Markup} from '@markput/core'

import {Empty, Mark} from '../../shared/lib/marks'
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
	title: 'Markput/Overlay',
	tags: ['autodocs'],
	component,
	/** A plain annotated field: this page never splits its value into rows (ADR-0011). */
	args: {separator: null},
} satisfies PageMeta

export const DefaultOverlay = story({
	args: {
		Mark,
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
		Mark: Empty,
		Overlay: fixtures.Overlay,
		defaultValue: CUSTOM_VALUE,
	},
})

export const CustomTrigger = story({
	args: {
		Mark: Empty,
		Overlay: fixtures.Overlay,
		defaultValue: CUSTOM_TRIGGER_VALUE,
		options: [{overlay: {trigger: '/'}}],
	},
})

export const PositionedOverlay = story({
	args: {
		Mark: Empty,
		Overlay: fixtures.Tooltip,
		defaultValue: POSITIONED_VALUE,
	},
})

export const SelectableOverlay = story({
	args: {
		Mark,
		Overlay: fixtures.List,
		defaultValue: SELECTABLE_VALUE,
		options: [{markup: '@[__value__](__meta__)' as Markup, overlay: {trigger: '@'}}],
	},
})
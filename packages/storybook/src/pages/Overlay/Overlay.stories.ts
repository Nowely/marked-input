import type {Markup} from '@markput/core'

import {defineMark, Empty, Mark} from '../../shared/lib/marks'
import {component, story, type PageMeta} from '../../shared/lib/stories'
import {fixtures} from './Overlay.fixtures'

const DEFAULT_VALUE = 'Hello, default - suggestion overlay by trigger @!'
const CUSTOM_VALUE = 'Hello, custom overlay by trigger @!'
const CUSTOM_TRIGGER_VALUE = 'Hello, custom overlay by trigger /!'
const POSITIONED_VALUE = 'Hello, positioned overlay by trigger @!'
const SELECTABLE_VALUE = 'Hello, suggest overlay by trigger @!'
const ROW_MENU_VALUE = 'Intro\n\nplain row'

/** A row kind's component is a component in BOTH adapters, so a bare tag name will not do. */
const HeadingRow = defineMark({tag: 'h1'})
const BulletRow = defineMark({tag: 'li'})

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

/**
 * THE ROW MENU on the shipped `BlockMenu`, and the only place either adapter's is DRIVEN: the
 * probe page that exercises it is React-only until P12, so a Vue-side divergence in `entries`,
 * `choose` or the ref wiring would otherwise ship unmeasured.
 *
 * It overrides the page's `separator: null`: a menu turns ROWS into kinds, and a value that
 * never splits has none.
 */
export const RowMenu = story({
	args: {
		Mark: Empty,
		Overlay: fixtures.BlockMenu,
		defaultValue: ROW_MENU_VALUE,
		separator: '\n',
		options: [
			{overlay: {trigger: '/'}},
			{
				markup: '# __slot__' as Markup,
				row: {Component: HeadingRow},
				menu: {label: 'Heading 1', keywords: ['h1']},
			},
			{
				markup: '- __slot__' as Markup,
				row: {Component: BulletRow, continues: true},
				menu: {label: 'Bulleted list'},
			},
		],
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
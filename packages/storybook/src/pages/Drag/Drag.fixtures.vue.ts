import type {MarkProps, Option} from '@markput/vue'
import {defineComponent} from 'vue'

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Drag.stories.ts` is the contract, and it fails to compile under either
 * project if this file drifts.
 *
 * Components are written with `template:` rather than `h()`, matching their React
 * counterparts. `<slot>{{ value }}</slot>` is the template spelling of
 * `slots.default?.() ?? value`: `Token.vue` passes NO default slot for a value-only mark, so
 * the fallback is what a `__value__` markup renders. `meta` is declared even though nothing
 * reads it — an undeclared prop falls through onto the mark root as an attribute, which no
 * React fixture does.
 */

const MarkdownMark = defineComponent({
	props: {value: String, meta: String, style: {type: Object}},
	template: `<span :style="[style, {margin: '0 1px'}]"><slot>{{ value }}</slot></span>`,
})

const ParagraphMark = defineComponent({
	props: {value: String, meta: String},
	template: '<span><slot>{{ value }}</slot></span>',
})

/** One block-level markup, so a plain-text document is split into one draggable row per paragraph. */
const paragraphOptions: Option[] = [{markup: '__slot__\n\n', Mark: ParagraphMark}]

/**
 * The Vue transcription of `../Nested/MarkdownOptions`, element for element — same markups,
 * same styles, same order, so both frameworks parse the same document into the same rows.
 * It is a COPY only because that module still types its options against `@markput/react`,
 * and one import of it from a Vue-program file drags the whole React adapter into
 * `tsconfig.vue.json`. Delete this table and import the shared one once it is framework-free.
 */
const markdownOptions: Option[] = [
	{
		markup: '# __slot__\n\n',
		mark: (props: MarkProps) => ({
			...props,
			style: {display: 'block', fontSize: '2em', fontWeight: 'bold', margin: '0.5em 0'},
		}),
	},
	{
		markup: '## __slot__\n\n',
		mark: (props: MarkProps) => ({
			...props,
			style: {display: 'block', fontSize: '1.5em', fontWeight: 'bold', margin: '0.4em 0'},
		}),
	},
	{
		markup: '### __slot__\n\n',
		mark: (props: MarkProps) => ({
			...props,
			style: {display: 'block', fontSize: '1.17em', fontWeight: 'bold', margin: '0.83em 0'},
		}),
	},
	{
		markup: '- __slot__\n\n',
		mark: (props: MarkProps) => ({...props, style: {display: 'block', paddingLeft: '1em'}}),
	},
	{markup: '**__slot__**', mark: (props: MarkProps) => ({...props, style: {fontWeight: 'bold'}})},
	{markup: '*__slot__*', mark: (props: MarkProps) => ({...props, style: {fontStyle: 'italic'}})},
	{
		markup: '`__value__`',
		mark: (props: MarkProps) => ({
			...props,
			style: {
				backgroundColor: '#f6f8fa',
				padding: '2px 6px',
				borderRadius: '3px',
				fontFamily: 'monospace',
				fontSize: '0.9em',
			},
		}),
	},
	{
		markup: '```__meta__\n__value__```',
		mark: (props: MarkProps) => ({
			...props,
			style: {
				display: 'block',
				backgroundColor: '#f6f8fa',
				padding: '12px',
				borderRadius: '6px',
				fontFamily: 'monospace',
				fontSize: '0.9em',
				whiteSpace: 'pre-wrap',
				border: '1px solid #d1d9e0',
				margin: '8px 0',
			},
		}),
	},
	{
		markup: '[__value__](__meta__)',
		mark: (props: MarkProps) => ({
			...props,
			style: {color: '#0969da', textDecoration: 'underline', cursor: 'pointer'},
		}),
	},
	{
		markup: '~~__value__~~',
		mark: (props: MarkProps) => ({...props, style: {textDecoration: 'line-through', opacity: 0.7}}),
	},
]

export const fixtures = {
	MarkdownMark,
	ParagraphMark,
	paragraphOptions,
	markdownOptions,
}

/** Spec fixtures: mark components the shared spec mounts through `mountComponent`. */
export const marks = {
	Testid: defineComponent({
		props: {value: String, meta: String},
		template: '<mark data-testid="mark">{{ value }}</mark>',
	}),
}
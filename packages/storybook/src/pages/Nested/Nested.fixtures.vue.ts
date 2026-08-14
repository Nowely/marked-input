import type {CSSProperties} from '@markput/core'
import type {MarkProps} from '@markput/vue'
import {MarkedInput, useMark, useMarkInfo} from '@markput/vue'
import {computed, defineComponent, ref} from 'vue'

import {useTab} from '../../shared/components/Tabs'
import type {PageArgs} from '../../shared/lib/stories'
import {HTML_TAG_STYLES} from './HtmlTagStyles'
import {markdownOptions} from './MarkdownOptions'

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Nested.stories.ts` is the contract, and it fails to compile under either
 * project if this file drifts.
 *
 * Components are written with `template:` rather than `h()`, matching their React counterparts.
 * Every mark declares `value`/`meta`/`children` even when it reads none of them: an undeclared
 * prop falls through onto the mark root as an attribute, which no React fixture does, and the
 * two frameworks' DOM would stop matching.
 */

/**
 * The mark props this page's styled stories map to. Declared here rather than in the story
 * file because `children` is a framework type: vue's is a `VNodeChild`, react's a `ReactNode`,
 * and the story's `mark` mappers pass it straight through.
 */
export type StyledMarkProps = MarkProps & {style?: CSSProperties}

/** `ComplexMarkdown`'s mark: the markdown preset hands it the `style` of whichever markup matched. */
const MarkdownMark = defineComponent({
	props: {value: String, meta: String, children: {type: null}, style: {type: Object}},
	template: `<span :style="[style, {margin: '0 1px'}]"><slot>{{ value }}</slot></span>`,
})

/** `ComplexHtmlDocument`'s mark: this markup's VALUE is the tag name, so the mark IS that element. */
const HtmlDocMark = defineComponent({
	props: {value: String, meta: String, children: {type: null}},
	setup(props) {
		const tagName = computed(() => props.value?.toLowerCase() ?? 'span')
		return {tagName, style: computed(() => HTML_TAG_STYLES[tagName.value] ?? {})}
	},
	template: '<component :is="tagName" :style="style"><slot /></component>',
})

const TABS = [
	{value: 'preview', label: 'Preview'},
	{value: 'write', label: 'Write'},
] as const

/**
 * `ComplexMarkdown`'s harness. The harness owns the value: the Write tab is controlled, and
 * without a local writer its `change` would land nowhere and the tab would look frozen.
 *
 * The two tabs are two different editors — the preview one is read-only and rendered through
 * the markdown preset, the write one is a plain field over the same string — which is why the
 * options are not simply forwarded from the story's args.
 *
 * `inheritAttrs: false` because the template has two roots: vue has nowhere to put a
 * fallthrough attribute on a fragment and warns instead. `<component :is="Tab" />` rather than
 * `<Tab />` because a runtime-compiled template resolves a component NAME against the
 * `components` option, and this one is created per `useTab()` call.
 */
const TabbedMarkdown = defineComponent({
	components: {MarkedInput},
	inheritAttrs: false,
	props: {defaultValue: String},
	setup(props) {
		const value = ref(props.defaultValue)
		const {Tab, activeTab} = useTab(TABS)

		return {Tab, activeTab, value, MarkdownMark, markdownOptions}
	},
	template: `
		<component :is="Tab" />

		<MarkedInput
			v-if="activeTab === 'preview'"
			:Mark="MarkdownMark"
			:options="markdownOptions"
			:value="value"
			:readOnly="true"
		/>
		<MarkedInput v-else :options="[]" :value="value" @change="value = $event" />
	`,
})

/**
 * See {@link TabbedMarkdown}: the Write tab is controlled, so the harness has to own the writer.
 *
 * React keys THIS harness's two editors by the active tab to force a remount on every switch;
 * here the compiler already keys the two `v-if` branches apart, so the remount comes for free.
 */
const TabbedHtml = defineComponent({
	components: {MarkedInput},
	inheritAttrs: false,
	props: {defaultValue: String, options: {type: Array, default: undefined}},
	setup(props) {
		const value = ref(props.defaultValue)
		const {Tab, activeTab} = useTab(TABS)

		return {Tab, activeTab, value, HtmlDocMark}
	},
	template: `
		<component :is="Tab" />

		<MarkedInput
			v-if="activeTab === 'preview'"
			:Mark="HtmlDocMark"
			:value="value"
			:readOnly="true"
			:options="options"
		/>
		<MarkedInput v-else :value="value" :options="[]" @change="value = $event" />
	`,
})

export const fixtures = {
	/** The panel sits beside the editor here; the react fixtures put it underneath. */
	SimpleMark: defineComponent({
		props: {value: String, meta: String, children: {type: null}, style: {type: Object}},
		template: '<span :style="style"><slot>{{ value }}</slot></span>',
	}),
	MultiLevelMark: defineComponent({
		props: {value: String, meta: String, children: {type: null}, style: {type: Object}},
		template: `<span :style="[style, {margin: '0 2px'}]"><slot>{{ value }}</slot></span>`,
	}),
	HtmlLikeMark: defineComponent({
		props: {value: String, meta: String, children: {type: null}},
		template: `<component :is="value || 'span'"><slot /></component>`,
	}),
	/** The page's only `useMarkInfo()` story in either framework. */
	InteractiveMark: defineComponent({
		props: {value: String, meta: String, children: {type: null}},
		setup() {
			const info = useMarkInfo()
			const isHighlighted = ref(false)
			const handleAction = () => {
				console.log('Mark clicked:', {depth: info.depth, hasNestedMarks: info.hasNestedMarks})
			}

			return {
				isHighlighted,
				handleAction,
				title: `Depth: ${info.depth}, Nested: ${info.hasNestedMarks}`,
				handleKeydown(event: KeyboardEvent) {
					if (event.key !== 'Enter' && event.key !== ' ') return
					event.preventDefault()
					event.stopPropagation()
					handleAction()
				},
			}
		},
		template: `
			<span
				role="button"
				tabindex="0"
				:title="title"
				:style="{
					display: 'inline-block',
					padding: '4px 8px',
					margin: '2px',
					border: isHighlighted ? '2px solid #2196f3' : '1px solid #ccc',
					borderRadius: '4px',
					backgroundColor: isHighlighted ? '#e3f2fd' : '#f5f5f5',
					cursor: 'pointer',
					transition: 'all 0.2s',
				}"
				@click.stop="handleAction"
				@keydown="handleKeydown"
				@mouseenter="isHighlighted = true"
				@mouseleave="isHighlighted = false"
			><slot /></span>`,
	}),
	/**
	 * `render: () => TabbedMarkdown` would DROP the args — the returned component is mounted
	 * with no props, so the editor renders empty. Binding the closure's `args` is what carries
	 * them.
	 */
	renderTabbedMarkdown: (args: PageArgs) =>
		defineComponent({
			components: {TabbedMarkdown},
			setup: () => ({args}),
			template: '<TabbedMarkdown v-bind="args" />',
		}),
	renderTabbedHtml: (args: PageArgs) =>
		defineComponent({
			components: {TabbedHtml},
			setup: () => ({args}),
			template: '<TabbedHtml v-bind="args" />',
		}),
}

/**
 * What the capturing marks record. A mark can only report a hook's value by writing it
 * somewhere the spec can read, and the spec resets these before each mount.
 */
export const capture = {rootChildren: false, rootHasNestedMarks: false}

/** Spec fixtures: mark components the shared spec mounts through component args. */
export const marks = {
	Info: defineComponent({
		props: {value: String, meta: String, children: {type: null}},
		setup: () => ({info: useMarkInfo()}),
		template:
			'<span :data-testid="`mark-depth-${info.depth}`" :data-depth="info.depth" :data-has-children="info.hasNestedMarks"><slot /></span>',
	}),
	/** Names itself by depth, so one component covers two markups in the same value. */
	Tagged: defineComponent({
		props: {value: String, meta: String, children: {type: null}},
		setup: () => ({info: useMarkInfo()}),
		template: `<span :data-testid="info.depth === 0 ? 'tag-mark' : 'mention-mark'" :data-depth="info.depth"><slot /></span>`,
	}),
	Capturing: defineComponent({
		props: {value: String, meta: String, children: {type: null}},
		setup(_props, {slots}) {
			const info = useMarkInfo()
			if (info.depth === 0 && info.hasNestedMarks) capture.rootChildren = slots.default != null
			return {}
		},
		template: '<span data-testid="mark"><slot /></span>',
	}),
	RootInfo: defineComponent({
		props: {value: String, meta: String, children: {type: null}},
		setup() {
			const info = useMarkInfo()
			if (info.depth === 0) capture.rootHasNestedMarks = info.hasNestedMarks
			return {}
		},
		template: '<span><slot /></span>',
	}),
	Depth: defineComponent({
		props: {value: String, meta: String, children: {type: null}},
		setup: () => ({info: useMarkInfo()}),
		template: '<span :data-depth="info.depth"><slot /></span>',
	}),
	HasChildren: defineComponent({
		props: {value: String, meta: String, children: {type: null}},
		setup: () => ({info: useMarkInfo()}),
		template: '<span :data-has-children="info.hasNestedMarks"><slot /></span>',
	}),
	/** Renders only `value`: the backward-compatibility marks predate nesting. */
	Flat: defineComponent({
		props: {value: String, meta: String, children: {type: null}},
		template: '<span data-testid="flat-mark">{{ value }}</span>',
	}),
	Plain: defineComponent({
		props: {value: String, meta: String, children: {type: null}},
		template: '<span data-testid="mark"><slot /></span>',
	}),
	Bare: defineComponent({
		props: {value: String, meta: String, children: {type: null}},
		template: '<span><slot /></span>',
	}),
	Mixed: defineComponent({
		props: {value: String, meta: String, children: {type: null}},
		setup: () => ({info: useMarkInfo()}),
		template: '<span data-testid="mark" :data-has-children="info.hasNestedMarks"><slot /></span>',
	}),
	/** Renders the slot itself when there is nothing nested to render. */
	Rendering: defineComponent({
		props: {value: String, meta: String, children: {type: null}},
		setup: () => ({mark: useMark(), info: useMarkInfo()}),
		template: '<span><slot v-if="info.hasNestedMarks" /><template v-else>{{ mark.slot() }}</template></span>',
	}),
	/** A `<mark>` root, so the spec can tell mark roots from the spans around them. */
	Testid: defineComponent({
		props: {value: String, meta: String, children: {type: null}},
		template: '<mark data-testid="mark"><slot>{{ value }}</slot></mark>',
	}),
}
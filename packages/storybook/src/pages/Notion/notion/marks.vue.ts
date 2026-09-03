import {computed, defineComponent} from 'vue'

import {theme} from './theme'
import {Avatar} from './ui/Avatar'
import {Chip} from './ui/Chip'
import {EffortBar} from './ui/EffortBar'
import {readDue, statusTone} from './vocabulary'

/**
 * The INLINE marks, painted in Vue. Every reading they make — which tone a status takes, when a
 * date is overdue — is `vocabulary.ts`'s, so this file and `marks.tsx` agree by construction
 * rather than by review.
 *
 * None of them may render editable text: a mark's element is wrapped by the adapter and frozen,
 * so what a mark paints is a picture of its `value`, never a place to type.
 */

const markProps = {
	value: {type: String, default: ''},
	meta: {type: String, default: undefined},
} as const

/** A person, written `@[Name](id)` — the id is what the document stores, the name is what it shows. */
export const Mention = defineComponent({
	name: 'Mention',
	props: markProps,
	setup: () => ({theme}),
	template: '<span :class="theme.mention">@{{ value }}</span>',
})

/**
 * A link, as a SPAN. An `<a>` inside the editing host is a click target that fights the caret —
 * the same reading `BookmarkCard` records — so the destination is shown on hover and the text
 * stays text.
 */
export const Link = defineComponent({
	name: 'Link',
	props: markProps,
	setup: () => ({theme}),
	template: '<span :class="theme.link" :title="meta">{{ value }}</span>',
})

/** `==marked==`. The one mark with a SLOT, so its interior keeps its own marks and its caret. */
export const Highlight = defineComponent({
	name: 'Highlight',
	props: markProps,
	setup: () => ({theme}),
	template: '<span :class="theme.highlight"><slot /></span>',
})

/** A status pill. */
export const Status = defineComponent({
	name: 'Status',
	components: {Chip},
	props: markProps,
	setup: props => ({tone: computed(() => statusTone(props.value))}),
	template: '<Chip :tone="tone">{{ value }}</Chip>',
})

/** An owner, as the initials circle its name colours deterministically. */
export const Who = defineComponent({
	name: 'Who',
	components: {Avatar},
	props: markProps,
	template: '<Avatar :name="value" />',
})

/** A due date, red once it is past and muted once its row is done. */
export const Due = defineComponent({
	name: 'Due',
	props: markProps,
	setup: props => ({theme, due: computed(() => readDue(props.value))}),
	template: '<span :class="due.overdue ? theme.valueOverdue : theme.valueMuted">{{ due.date }}</span>',
})

/** An effort track, `<bar:0.6>`. Out-of-range values are clamped by the bar itself. */
export const Effort = defineComponent({
	name: 'Effort',
	components: {EffortBar},
	props: markProps,
	template: '<EffortBar :label="`Effort ${value}`" :value="Number(value)" />',
})
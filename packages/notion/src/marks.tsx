import type {MarkProps} from '@markput/react'

import {theme} from './theme'
import {Avatar} from './ui/Avatar'
import type {ChipTone} from './ui/Chip'
import {Chip} from './ui/Chip'
import {EffortBar} from './ui/EffortBar'

/**
 * The INLINE marks — the half of the vocabulary that is unchanged by rows: a markup matched
 * anywhere inside a row's own body, rendered by the consumer, atomic to the caret.
 *
 * Each one is a leaf from `./ui` with the document's own text mapped onto its props. Nothing
 * here reads the tree, and none of them may render editable text: a mark's element is wrapped by
 * the adapter and frozen, so what a mark paints is a picture of its `value`, never a place to
 * type.
 */

/** A person, written `@[Name](id)` — the id is what the document stores, the name is what it shows. */
export const Mention = ({value}: MarkProps) => <span className={theme.mention}>@{value}</span>

/**
 * A link, as a SPAN. An `<a>` inside the editing host is a click target that fights the caret —
 * the same reading `BookmarkCard` records — so the destination is shown on hover and the text
 * stays text.
 */
export const Link = ({value, meta}: MarkProps) => (
	<span className={theme.link} title={meta}>
		{value}
	</span>
)

/** `==marked==`. The one mark with a SLOT, so its interior keeps its own marks and its caret. */
export const Highlight = ({children}: MarkProps) => <span className={theme.highlight}>{children}</span>

/**
 * A status pill. The tone is a property of the STATUS, not of the document, so the map lives
 * here: a value nobody mapped falls back to grey rather than disappearing.
 */
const STATUS_TONE: Record<string, ChipTone> = {
	Blocked: 'red',
	'In progress': 'amber',
	Done: 'green',
	Planned: 'grey',
	'At risk': 'amber',
}

export const Status = ({value = ''}: MarkProps) => <Chip tone={STATUS_TONE[value] ?? 'grey'}>{value}</Chip>

/** An owner, as the initials circle its name colours deterministically. */
export const Who = ({value = ''}: MarkProps) => <Avatar name={value} />

/**
 * A due date. Red once it is past, muted once its row is done — and "done" is not knowable from
 * inside a mark, so the document says it: `<due:2026-04-02 done>`.
 */
export const Due = ({value = ''}: MarkProps) => {
	const [date = '', flag] = value.split(' ')
	const overdue = flag !== 'done' && date < TODAY
	return <span className={overdue ? theme.valueOverdue : theme.valueMuted}>{date}</span>
}

/**
 * The reference date the showcase is written against. A wall-clock read would make the page's
 * screenshot and its own story snapshot change colour on a date nobody chose.
 */
const TODAY = '2026-04-20'

/** An effort track, `<bar:0.6>`. Out-of-range values are clamped by the bar itself. */
export const Effort = ({value = '0'}: MarkProps) => <EffortBar label={`Effort ${value}`} value={Number(value)} />
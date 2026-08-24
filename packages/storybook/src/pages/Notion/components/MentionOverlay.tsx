import {useOverlay} from '@markput/react'

import styles from './notion.module.css'

/** The people a `@` can name. `id` is what the document stores, `name` is what it shows. */
export const TEAM = [
	{id: 'sarah.chen', name: 'Sarah Chen'},
	{id: 'marcus.kane', name: 'Marcus Kane'},
	{id: 'jia.lin', name: 'Jia Lin'},
	{id: 'amara.reed', name: 'Amara Reed'},
	{id: 'team-platform', name: 'Platform'},
]

/**
 * The `@` suggestion list.
 *
 * Hand-written rather than the built-in suggestion overlay because `overlay.data` is a
 * `string[]` (`packages/react/markput/src/types.ts:33`), and a mention needs a stable id beside
 * the display name — the `__meta__` half of `@[__value__](__meta__)`. Anything with an identity
 * behind the label has to filter its own list and call `select({value, meta})` itself.
 */
export const MentionOverlay = () => {
	const {match, style, select, close, ref} = useOverlay()
	const query = match?.value.toLowerCase() ?? ''
	const people = TEAM.filter(person => person.name.toLowerCase().includes(query))

	if (people.length === 0) return null

	return (
		<div
			className={styles.overlay}
			style={{position: 'absolute', ...style}}
			ref={element => {
				ref.current = element
			}}
		>
			{people.map(person => (
				<button
					key={person.id}
					type="button"
					className={styles.overlayItem}
					onMouseDown={event => event.preventDefault()}
					onClick={() => {
						select({value: person.name, meta: person.id})
						close()
					}}
				>
					<span className={styles.avatar}>{person.name.slice(0, 1)}</span>
					{person.name}
				</button>
			))}
		</div>
	)
}
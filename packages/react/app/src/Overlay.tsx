import {useOverlay} from '@markput/react'
import {useEffect, useMemo, useState} from 'react'

import {MENTIONS, TAGS} from './content'

type Item = {label: string; hint?: string; avatar?: string; value: string; meta?: string}

/** Custom overlays get no keyboard navigation from core, so the arrows/Enter/Escape live here. */
export const SuggestionOverlay = () => {
	const {select, close, match, style, ref} = useOverlay()
	const [active, setActive] = useState(0)

	const query = (match?.value ?? '').toLowerCase()
	const trigger = match?.option.overlay?.trigger

	const items = useMemo<Item[]>(() => {
		if (trigger === '@') {
			return MENTIONS.filter(m => m.name.toLowerCase().includes(query)).map(m => ({
				label: m.name,
				hint: `@${m.handle}`,
				avatar: m.name[0],
				value: m.name,
				meta: m.handle,
			}))
		}
		return TAGS.filter(t => t.includes(query)).map(t => ({label: `#${t}`, value: t}))
	}, [trigger, query])

	useEffect(() => setActive(0), [trigger, query])

	useEffect(() => {
		if (items.length === 0) return
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'ArrowDown') setActive(a => (a + 1) % items.length)
			else if (event.key === 'ArrowUp') setActive(a => (a - 1 + items.length) % items.length)
			else if (event.key === 'Enter') {
				const item = items[active]
				select({value: item.value, meta: item.meta})
			} else if (event.key === 'Escape') close()
			else return
			event.preventDefault()
			event.stopPropagation()
		}
		// Capture phase: runs before the contenteditable inserts a newline on Enter.
		document.addEventListener('keydown', onKeyDown, true)
		return () => document.removeEventListener('keydown', onKeyDown, true)
	}, [items, active, select, close])

	if (items.length === 0) return null

	return (
		<div
			className="overlay"
			ref={el => {
				ref.current = el
			}}
			style={{left: Math.min(style.left, window.innerWidth - 248), top: style.top}}
		>
			{items.map((item, index) => (
				<button
					className={index === active ? 'overlay-item active' : 'overlay-item'}
					key={item.value}
					onClick={() => select({value: item.value, meta: item.meta})}
					onMouseEnter={() => setActive(index)}
					tabIndex={-1}
					type="button"
				>
					{item.avatar && <span className="overlay-avatar">{item.avatar}</span>}
					{item.label}
					{item.hint && <span className="overlay-hint">{item.hint}</span>}
				</button>
			))}
		</div>
	)
}
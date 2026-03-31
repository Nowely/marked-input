import {filterSuggestions, navigateSuggestions} from '@markput/core'
import {useEffect, useMemo, useRef, useState} from 'react'

import {useOverlay} from '../../lib/hooks/useOverlay'
import {useStore} from '../../lib/providers/StoreContext'

import styles from '@markput/core/styles.module.css'

export const Suggestions = () => {
	const store = useStore()
	const {match, select, style, ref} = useOverlay()
	const [active, setActive] = useState(NaN)
	const data = match.option.overlay?.data ?? []
	const filtered = useMemo(() => filterSuggestions(data, match.value), [match.value, data])
	const length = filtered.length

	// Refs let the handler always read the latest values without re-registering
	// the listener on every keypress (which happened when `active` was a dep).
	const activeRef = useRef(active)
	activeRef.current = active
	const filteredRef = useRef(filtered)
	filteredRef.current = filtered

	useEffect(() => {
		const container = store.refs.container
		if (!container) return

		const handler = (event: KeyboardEvent) => {
			const result = navigateSuggestions(event.key, activeRef.current, length)
			switch (result.action) {
				case 'up':
				case 'down':
					event.preventDefault()
					setActive(result.index)
					break
				case 'select': {
					event.preventDefault()
					const suggestion = filteredRef.current[result.index]
					select({value: suggestion, meta: result.index.toString()})
					break
				}
				case 'none':
					break
			}
		}

		container.addEventListener('keydown', handler)
		return () => container.removeEventListener('keydown', handler)
	}, [length, select])

	if (!filtered.length) return null

	return (
		<ul
			ref={(el: HTMLUListElement | null) => {
				ref.current = el
			}}
			className={styles.Suggestions}
			style={style}
		>
			{filtered.map((suggestion, index) => {
				const className = index === active ? styles.suggestionActive : undefined

				return (
					<li
						key={suggestion}
						ref={el => {
							if (className && el) el.scrollIntoView(false)
						}}
						className={className}
						onClick={_ => select({value: suggestion, meta: index.toString()})}
						children={suggestion}
					/>
				)
			})}
		</ul>
	)
}
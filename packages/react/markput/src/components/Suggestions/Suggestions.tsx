import {KEYBOARD} from '@markput/core'
import type {RefObject} from 'react'
import {useEffect, useMemo, useState} from 'react'

import {useOverlay} from '../../lib/hooks/useOverlay'
import {useStore} from '../../lib/providers/StoreContext'

import styles from '@markput/core/styles.module.css'

export const Suggestions = () => {
	const store = useStore()
	const {match, select, style, ref} = useOverlay()
	const [active, setActive] = useState(NaN)
	const data = match.option.overlay?.data || []
	const filtered = useMemo(
		() => data.filter(s => s.toLowerCase().indexOf(match.value.toLowerCase()) > -1),
		[match.value, data]
	)
	const length = filtered.length

	useEffect(() => {
		const container = store.refs.container
		if (!container) return

		const handler = (event: KeyboardEvent) => {
			switch (event.key) {
				case KEYBOARD.UP:
					event.preventDefault()
					setActive(prev => (isNaN(prev) ? 0 : (length + ((prev - 1) % length)) % length))
					break
				case KEYBOARD.DOWN:
					event.preventDefault()
					setActive(prev => (isNaN(prev) ? 0 : (prev + 1) % length))
					break
				case KEYBOARD.ENTER:
					event.preventDefault()
					setActive(current => {
						if (isNaN(current)) return current
						const suggestion = filtered[current]
						select({value: suggestion, meta: current.toString()})
						return current
					})
					break
			}
		}

		container.addEventListener('keydown', handler)
		return () => container.removeEventListener('keydown', handler)
	}, [length, filtered])

	if (!filtered.length) return null

	return (
		<ul ref={ref as RefObject<HTMLUListElement>} className={styles.Suggestions} style={style}>
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
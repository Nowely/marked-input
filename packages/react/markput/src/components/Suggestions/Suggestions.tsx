import {filterSuggestions, navigateSuggestions} from '@markput/core'
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
	const filtered = useMemo(() => filterSuggestions(data, match.value), [match.value, data])
	const length = filtered.length

	useEffect(() => {
		const container = store.refs.container
		if (!container) return

		const handler = (event: KeyboardEvent) => {
			const result = navigateSuggestions(event.key, active, length)
			switch (result.action) {
				case 'up':
				case 'down':
					event.preventDefault()
					setActive(result.index)
					break
				case 'select':
					event.preventDefault()
					const suggestion = filtered[result.index]
					select({value: suggestion, meta: result.index.toString()})
					break
			}
		}

		container.addEventListener('keydown', handler)
		return () => container.removeEventListener('keydown', handler)
	}, [length, filtered, active])

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
import type {RefObject} from 'react'
import {useMemo, useState} from 'react'
import {useDownOf} from '../../lib/hooks/useDownOf'
import {useOverlay} from '../../lib/hooks/useOverlay'
import {KEYBOARD} from '@markput/core'
import styles from '@markput/core/styles.module.css'

export const Suggestions = () => {
	const {match, select, style, ref} = useOverlay()
	const [active, setActive] = useState(NaN)
	const data = match.option.overlay?.data || []
	const filtered = useMemo(
		() => data.filter(s => s.toLowerCase().indexOf(match.value.toLowerCase()) > -1),
		[match.value, data]
	)
	const length = filtered.length

	useDownOf(
		KEYBOARD.UP,
		event => {
			event.preventDefault()
			setActive(prevState => (isNaN(prevState) ? 0 : (length + ((prevState - 1) % length)) % length))
		},
		[length]
	)

	useDownOf(
		KEYBOARD.DOWN,
		event => {
			event.preventDefault()
			setActive(prevState => (isNaN(prevState) ? 0 : (prevState + 1) % length))
		},
		[length]
	)

	useDownOf(
		KEYBOARD.ENTER,
		event => {
			event.preventDefault()
			const suggestion = filtered[active]
			select({value: suggestion, meta: active.toString()})
		},
		[filtered, active]
	)

	if (!filtered.length) return null

	//TODO possible to add classes via slots
	return (
		<ul ref={ref as RefObject<HTMLUListElement>} className={styles.Suggestions} style={style}>
			{filtered.map((suggestion, index) => {
				const className = index === active ? styles.suggestionActive : undefined

				return (
					<li
						key={suggestion}
						ref={el => className && el?.scrollIntoView(false)}
						className={className}
						onClick={_ => select({value: suggestion, meta: index.toString()})}
						children={suggestion}
					/>
				)
			})}
		</ul>
	)
}

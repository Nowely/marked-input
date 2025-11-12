import {RefObject, useMemo, useState} from 'react'
import {useDownOf} from '../../utils/hooks/useDownOf'
import {useOverlay} from '../../utils/hooks/useOverlay'
import {KEYBOARD} from '@markput/core'

export const Suggestions = () => {
	const {match, select, style, ref} = useOverlay()
	const [active, setActive] = useState(NaN)
	const filtered = useMemo(
		() => match.option.data!.filter(s => s.toLowerCase().indexOf(match.value.toLowerCase()) > -1),
		[match.value]
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
		<ul ref={ref as RefObject<HTMLUListElement>} className="mk-suggestions" style={style}>
			{filtered.map((suggestion, index) => {
				const className = index === active ? 'mk-suggestion-active' : undefined

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

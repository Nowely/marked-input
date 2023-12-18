import {RefObject, useMemo, useState} from 'react'
import {KEYBOARD} from '../../constants'
import {useDownOf} from '../../utils/hooks/useDownOf'
import {useOverlay} from '../../utils/hooks/useOverlay'

export const Suggestions = () => {
	const {match, select, style, ref} = useOverlay()
	const [active, setActive] = useState(NaN)
	const filtered = useMemo(
		() => match.option.data!.filter(s => s.toLowerCase().indexOf(match.value.toLowerCase()) > -1),
		[match.value]
	)
	const length = filtered.length

	useDownOf(KEYBOARD.UP, event => {
		event.preventDefault()
		setActive(prevState => isNaN(prevState) ? 0 : (length + (prevState - 1) % length) % length)
	}, [length])

	useDownOf(KEYBOARD.DOWN, event => {
		event.preventDefault()
		setActive(prevState => isNaN(prevState) ? 0 : (prevState + 1) % length)
	}, [length])

	useDownOf(KEYBOARD.ENTER, event => {
		event.preventDefault()
		const suggestion = filtered[active]
		select({label: suggestion, value: active.toString()})
	}, [filtered, active])

	if (!filtered.length) return null

	return (
		<ul ref={ref as RefObject<HTMLUListElement>} className="mk-suggestions" style={style}>
			{filtered.map((suggestion, index) => {
				const className = index === active ? 'mk-suggestion-active' : undefined

				return (
					<li key={suggestion}
						ref={el => className && el?.scrollIntoView(false)}
						className={className}
						onClick={_ => select({label: suggestion, value: index.toString()})}
						children={suggestion}
					/>
				)
			})}
		</ul>
	)
}
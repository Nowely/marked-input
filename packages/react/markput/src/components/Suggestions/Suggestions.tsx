import {filterSuggestions, navigateSuggestions} from '@markput/core'
import {useEffect, useMemo, useRef, useState} from 'react'

import {useMarkput} from '../../lib/hooks/useMarkput'
import {useOverlay} from '../../lib/hooks/useOverlay'
import {List} from '../Popup/List'
import {ListItem} from '../Popup/ListItem'
import {Popup} from '../Popup/Popup'

export const Suggestions = () => {
	const {slotsState} = useMarkput(s => ({slotsState: s.feature.slots.state}))
	const {match, select, style, ref} = useOverlay()
	const [active, setActive] = useState(NaN)
	const data = match?.option.overlay?.data ?? []
	const filtered = useMemo(() => (match ? filterSuggestions(data, match.value) : []), [match, data])
	const length = filtered.length

	const activeRef = useRef(active)
	activeRef.current = active
	const filteredRef = useRef(filtered)
	filteredRef.current = filtered

	useEffect(() => {
		const container = slotsState.container()
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
		<Popup ref={ref} style={style}>
			<List>
				{filtered.map((suggestion, index) => (
					<ListItem
						key={suggestion}
						active={index === active}
						onClick={() => select({value: suggestion, meta: index.toString()})}
					>
						{suggestion}
					</ListItem>
				))}
			</List>
		</Popup>
	)
}
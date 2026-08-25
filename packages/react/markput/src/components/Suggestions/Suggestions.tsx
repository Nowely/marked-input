import {suggestionLabel} from '@markput/core'
import {useEffect} from 'react'

import {useMarkput} from '../../lib/hooks/useMarkput'
import {useOverlay} from '../../lib/hooks/useOverlay'
import {List} from '../Popup/List'
import {ListItem} from '../Popup/ListItem'
import {Popup} from '../Popup/Popup'

export const Suggestions = () => {
	const {style, ref} = useOverlay()
	const {filtered, active, suggestions} = useMarkput(s => ({
		filtered: s.overlay.suggestions.filtered,
		active: s.overlay.suggestions.active,
		suggestions: s.overlay.suggestions,
	}))

	useEffect(() => suggestions.activate(), [suggestions])

	if (!filtered.length) return null

	return (
		<Popup ref={ref} style={style}>
			<List>
				{filtered.map((suggestion, index) => (
					<ListItem
						key={suggestionLabel(suggestion)}
						active={index === active}
						onClick={() => suggestions.select(index)}
					>
						{suggestionLabel(suggestion)}
					</ListItem>
				))}
			</List>
		</Popup>
	)
}
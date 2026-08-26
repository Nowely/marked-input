import {useEffect} from 'react'

import {useOverlay} from '../../lib/hooks/useOverlay'
import {List} from '../Popup/List'
import {ListItem} from '../Popup/ListItem'
import {Popup} from '../Popup/Popup'

/**
 * THE OVERLAY LIST, shipped, and the DEFAULT overlay — one component for both lists this adapter
 * used to ship. `Suggestions` painted `overlay.data` with arrows and Enter; `RowMenu` painted the
 * options' own `menu` entries with neither, so typing `/h2` and pressing Enter left the literal
 * text in the row and split it. The rows now come from one model with one keyboard, and the only
 * difference left between the two lists is where core reads them from.
 *
 * A consumer wires a row menu with `{overlay: {trigger: '/'}}` and nothing else: no component, no
 * filtering, no insert logic. `rows` and `choose` are core's, and this is the paint over them.
 */
export const OverlayList = () => {
	const {rows, active, activate, choose, style, ref} = useOverlay()

	// The keydown protocol lives exactly as long as this component: `activate` is opt-in so a
	// custom overlay that is not a list keeps the arrows and Enter it never claimed.
	useEffect(activate, [activate])

	if (rows.length === 0) return null

	return (
		<Popup ref={ref} style={style}>
			<List>
				{rows.map((row, index) => (
					<ListItem key={row.label} active={index === active} onClick={() => choose(row.pick)}>
						{row.label}
					</ListItem>
				))}
			</List>
		</Popup>
	)
}
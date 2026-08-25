import {useOverlay} from '../../lib/hooks/useOverlay'
import {List} from '../Popup/List'
import {ListItem} from '../Popup/ListItem'
import {Popup} from '../Popup/Popup'

/**
 * THE ROW MENU, shipped: one entry per option that declares a `menu`, already narrowed by what
 * the user typed after the trigger, and a click turns the caret's row into that kind.
 *
 * A consumer wires it with one line — `{overlay: {trigger: '/'}, Overlay: BlockMenu}` — and a
 * consumer replacing it writes no filtering and no insert logic either: `entries`, `mode` and
 * `choose` are core's, and this component is the paint over them.
 *
 * `mousedown` is cancelled so the click does not move the caret out of the row the menu is
 * about before `choose` runs.
 */
export const BlockMenu = () => {
	const {entries, choose, style, ref} = useOverlay()

	if (entries.length === 0) return null

	return (
		<Popup ref={ref} style={style}>
			<List>
				{entries.map(entry => (
					<ListItem
						key={entry.label}
						onMouseDown={event => event.preventDefault()}
						onClick={() => choose({option: entry.option})}
					>
						{entry.label}
					</ListItem>
				))}
			</List>
		</Popup>
	)
}
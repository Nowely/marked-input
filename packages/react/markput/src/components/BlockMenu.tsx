import {BLOCK_MENU_ITEMS} from '@markput/core'
import type {TreeNode} from '@markput/core'
import {memo, useMemo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {List} from './Popup/List'
import {ListItem} from './Popup/ListItem'
import {Popup} from './Popup/Popup'

export const BlockMenu = memo(({node}: {node: TreeNode}) => {
	const {blockStore, menuOpen, menuPosition, tokens} = useMarkput(s => {
		const blockStore = s.block.get(node)

		return {
			blockStore,
			menuOpen: blockStore.state.menuOpen,
			menuPosition: blockStore.state.menuPosition,
			tokens: s.tokens,
		}
	})
	const controlRef = useMemo(() => tokens.control(), [tokens])

	if (!menuOpen) return null

	return (
		<Popup
			ref={(el: HTMLDivElement | null) => {
				blockStore.attachMenu(el)
				controlRef(el)
			}}
			style={{top: menuPosition.top, left: menuPosition.left}}
		>
			<List>
				{BLOCK_MENU_ITEMS.map(item => (
					<ListItem key={item.label} onClick={() => item.run(blockStore)}>
						<span className={item.iconClass} />
						<span>{item.label}</span>
					</ListItem>
				))}
			</List>
		</Popup>
	)
})

BlockMenu.displayName = 'BlockMenu'
import {cx} from '@markput/core'
import type {Token} from '@markput/core'
import {memo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {List} from './Popup/List'
import {ListItem} from './Popup/ListItem'
import {Popup} from './Popup/Popup'

import styles from '@markput/core/styles.module.css'

export const BlockMenu = memo(({token}: {token: Token}) => {
	const {blockStore, menuOpen, menuPosition} = useMarkput(s => ({
		blockStore: s.blocks.get(token),
		menuOpen: s.blocks.get(token).state.menuOpen,
		menuPosition: s.blocks.get(token).state.menuPosition,
	}))

	if (!menuOpen) return null

	return (
		<Popup
			ref={(el: HTMLDivElement | null) => blockStore.attachMenu(el)}
			style={{top: menuPosition.top, left: menuPosition.left}}
		>
			<List>
				<ListItem onClick={() => blockStore.addBlock()}>
					<span className={cx(styles.Icon, styles.IconAdd)} />
					<span>Add below</span>
				</ListItem>
				<ListItem onClick={() => blockStore.duplicateBlock()}>
					<span className={cx(styles.Icon, styles.IconDuplicate)} />
					<span>Duplicate</span>
				</ListItem>
				<ListItem onClick={() => blockStore.deleteBlock()}>
					<span className={cx(styles.Icon, styles.IconTrash)} />
					<span>Delete</span>
				</ListItem>
			</List>
		</Popup>
	)
})

BlockMenu.displayName = 'BlockMenu'
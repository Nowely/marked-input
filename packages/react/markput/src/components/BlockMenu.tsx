import {cx} from '@markput/core'
import type {Token} from '@markput/core'
import {memo} from 'react'

import {useStore} from '../lib/providers/StoreContext'

import styles from '@markput/core/styles.module.css'

export const BlockMenu = memo(({token}: {token: Token}) => {
	const store = useStore()
	const blockStore = store.blocks.get(token)
	const menuOpen = blockStore.state.menuOpen.use()
	const menuPosition = blockStore.state.menuPosition.use()

	if (!menuOpen) return null

	return (
		<div
			ref={(el: HTMLDivElement | null) => blockStore.attachMenu(el)}
			className={styles.BlockMenu}
			style={{top: menuPosition.top, left: menuPosition.left}}
		>
			<div
				role="button"
				tabIndex={0}
				className={styles.BlockMenuItem}
				onMouseDown={e => {
					e.preventDefault()
					blockStore.addBlock()
				}}
			>
				<span className={cx(styles.Icon, styles.IconAdd)} />
				<span>Add below</span>
			</div>
			<div
				role="button"
				tabIndex={0}
				className={styles.BlockMenuItem}
				onMouseDown={e => {
					e.preventDefault()
					blockStore.duplicateBlock()
				}}
			>
				<span className={cx(styles.Icon, styles.IconDuplicate)} />
				<span>Duplicate</span>
			</div>
			<div className={styles.BlockMenuSeparator} />
			<div
				role="button"
				tabIndex={0}
				className={cx(styles.BlockMenuItem, styles.BlockMenuItemDelete)}
				onMouseDown={e => {
					e.preventDefault()
					blockStore.deleteBlock()
				}}
			>
				<span className={cx(styles.Icon, styles.IconTrash)} />
				<span>Delete</span>
			</div>
		</div>
	)
})

BlockMenu.displayName = 'BlockMenu'
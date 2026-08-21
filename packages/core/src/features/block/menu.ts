import type {BlockStore} from './BlockStore'

import styles from '../../../styles.module.css'

// The menu's content contract — ordered items pairing a label and icon class with a
// BlockStore verb. Both adapters render exactly this list and keep only their framework
// event binding; the shared Drag spec asserts these labels in both projects. Core
// prebuilding class strings from styles.module.css follows SlotsFeature.
export const BLOCK_MENU_ITEMS: readonly {label: string; iconClass: string; run: (store: BlockStore) => void}[] = [
	{label: 'Add below', iconClass: `${styles.Icon} ${styles.IconAdd}`, run: store => store.addBlock()},
	{label: 'Duplicate', iconClass: `${styles.Icon} ${styles.IconDuplicate}`, run: store => store.duplicateBlock()},
	{label: 'Delete', iconClass: `${styles.Icon} ${styles.IconTrash}`, run: store => store.deleteBlock()},
]
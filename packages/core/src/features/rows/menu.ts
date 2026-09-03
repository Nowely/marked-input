import type {RowController} from './RowController'

import styles from '../../../styles.module.css'

// The menu's content contract — ordered items pairing a label and icon class with a row verb.
// Both adapters render exactly this list and keep only their framework event binding; the shared
// Drag spec asserts these labels in both projects. Core prebuilding class strings from
// styles.module.css follows SlotsFeature.
//
// `run` took a per-row store. There is no per-row anything now, so it takes the editor's ONE
// row controller, which knows the row from its own open-menu state. Published signature change.
export const ROW_MENU_ITEMS: readonly {label: string; iconClass: string; run: (rows: RowController) => void}[] = [
	{label: 'Add below', iconClass: `${styles.Icon} ${styles.IconAdd}`, run: rows => rows.addRow()},
	{label: 'Duplicate', iconClass: `${styles.Icon} ${styles.IconDuplicate}`, run: rows => rows.duplicateRow()},
	{label: 'Delete', iconClass: `${styles.Icon} ${styles.IconTrash}`, run: rows => rows.deleteRow()},
]
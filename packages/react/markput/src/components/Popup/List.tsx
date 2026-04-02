import type {ReactNode} from 'react'

import styles from '@markput/core/styles.module.css'

export const List = ({children}: {children: ReactNode}) => <ul className={styles.PopupList}>{children}</ul>
import type {CSSProperties, ReactNode, Ref} from 'react'

import styles from '@markput/core/styles.module.css'

export const Popup = ({
	ref,
	style,
	children,
}: {
	ref?: Ref<HTMLDivElement>
	style?: CSSProperties
	children: ReactNode
}) => {
	return (
		<div ref={ref} className={styles.Popup} style={style}>
			{children}
		</div>
	)
}
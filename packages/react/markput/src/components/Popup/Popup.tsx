import type {CSSProperties, ReactNode, Ref} from 'react'

import styles from '@markput/core/styles.module.css'

export const Popup = ({ref, style, children}: {ref?: Ref<HTMLElement>; style?: CSSProperties; children: ReactNode}) => {
	// oxlint-disable-next-line no-unsafe-type-assertion
	const divRef = ref as Ref<HTMLDivElement> | undefined
	return (
		<div ref={divRef} className={styles.Popup} style={style}>
			{children}
		</div>
	)
}
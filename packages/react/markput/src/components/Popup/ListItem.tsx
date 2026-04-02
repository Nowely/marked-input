import {cx} from '@markput/core'
import type {MouseEvent, ReactNode} from 'react'
import {useEffect, useRef} from 'react'

import styles from '@markput/core/styles.module.css'

export const ListItem = ({
	onClick,
	onMouseDown,
	active,
	children,
}: {
	onClick?: (e: MouseEvent<HTMLLIElement>) => void
	onMouseDown?: (e: MouseEvent<HTMLLIElement>) => void
	active?: boolean
	children: ReactNode
}) => {
	const ref = useRef<HTMLLIElement>(null)

	useEffect(() => {
		if (active) ref.current?.scrollIntoView(false)
	}, [active])

	return (
		<li
			ref={ref}
			className={cx(styles.PopupItem, active && styles.PopupItemActive)}
			onClick={onClick}
			onMouseDown={onMouseDown}
		>
			{children}
		</li>
	)
}
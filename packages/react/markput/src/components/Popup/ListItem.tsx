import {cx} from '@markput/core'
import type {MouseEvent, ReactNode} from 'react'
import {useEffect, useRef} from 'react'

import styles from '@markput/core/styles.module.css'

export const ListItem = ({
	onClick,
	active,
	children,
}: {
	onClick?: (e: MouseEvent<HTMLLIElement>) => void
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
			// A POPUP IS NOT A FOCUS TARGET. It is painted outside the editing host, so the default
			// mousedown moves focus off the host — and `SelectionDriver`'s `focusout` clears the
			// selection the pick is about to be applied at. The pick still lands, because the
			// overlay's match is held apart from the selection, but the caret it writes has nowhere
			// to go: after an insert focus stays on `<body>` and the next keystroke is swallowed
			// entirely, and after a turn-into the caret comes back at offset 0 so the next
			// character lands in FRONT of the text. Declining the mousedown is what keeps both.
			onMouseDown={event => event.preventDefault()}
		>
			{children}
		</li>
	)
}
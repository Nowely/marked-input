import type {CSSProperties} from 'react'
import {cx, merge} from '@markput/core'
import type {OverlayTrigger} from '@markput/core'
import styles from '@markput/core/styles.module.css'
import type {MarkedInputProps} from '../../components/MarkedInput'
import {DEFAULT_OPTIONS} from '../../constants'

export function normalizeProps(props: MarkedInputProps): {
	options: NonNullable<MarkedInputProps['options']>
	showOverlayOn: OverlayTrigger
	className: string | undefined
	style: CSSProperties | undefined
} {
	return {
		options: props.options ?? DEFAULT_OPTIONS,
		showOverlayOn: props.showOverlayOn ?? 'change',
		className: cx(styles.Container, props.className, props.slotProps?.container?.className),
		style: merge(props.style, props.slotProps?.container?.style),
	}
}

import type {MarkProps} from '@markput/react'
import type {CSSProperties} from 'react'

export interface TodoMarkProps extends MarkProps {
	style?: CSSProperties
	todo?: 'pending' | 'done'
}
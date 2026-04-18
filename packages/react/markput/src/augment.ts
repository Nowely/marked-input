import type {ElementType} from 'react'

declare module '@markput/core' {
	interface SlotRegistry {
		default: ElementType
	}
}
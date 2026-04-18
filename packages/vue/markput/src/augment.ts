import type {Component} from 'vue'

declare module '@markput/core' {
	interface SlotRegistry {
		default: Component
	}
}
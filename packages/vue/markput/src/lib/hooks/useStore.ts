import type {Store, Token} from '@markput/core'
import {inject} from 'vue'
import type {Component, Ref} from 'vue'

import type {MarkProps, Option, OverlayProps} from '../../types'
import {STORE_KEY} from '../providers/storeKey'

declare module '@markput/core' {
	interface Signal<T> {
		use(): Ref<T>
	}
	interface MarkSlot {
		use(token: Token): readonly [Component, MarkProps]
		get(token: Token): readonly [Component, MarkProps]
	}
	interface OverlaySlot {
		use(option?: Option, defaultComponent?: Component): readonly [Component, OverlayProps]
		get(option?: Option, defaultComponent?: Component): readonly [Component, OverlayProps]
	}
	interface Slot {
		use(): readonly [Component | string, Record<string, unknown> | undefined]
		get(): readonly [Component | string, Record<string, unknown> | undefined]
	}
}

export function useStore(): Store {
	const store = inject(STORE_KEY)
	if (!store) {
		throw new Error('Store not found. Make sure to use this composable inside a MarkedInput component.')
	}
	return store
}
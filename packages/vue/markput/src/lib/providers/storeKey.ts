import type {Store} from '@markput/core'
import type {InjectionKey} from 'vue'

export const STORE_KEY: InjectionKey<Store> = Symbol('MarkputStore')
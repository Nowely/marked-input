import type {InjectionKey} from 'vue'
import type {Store} from '@markput/core'

export const STORE_KEY: InjectionKey<Store> = Symbol('MarkputStore')

import type {TokenAddress} from '@markput/core'
import type {InjectionKey, Ref} from 'vue'

/** Render-time token address: the path arrives from the tree map, frozen at the last structural render. */
export const TOKEN_KEY: InjectionKey<Ref<TokenAddress>> = Symbol('MarkputToken')
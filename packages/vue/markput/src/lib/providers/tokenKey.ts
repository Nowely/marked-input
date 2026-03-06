import type {Token} from '@markput/core'
import type {InjectionKey, Ref} from 'vue'

export const TOKEN_KEY: InjectionKey<Ref<Token>> = Symbol('MarkputToken')
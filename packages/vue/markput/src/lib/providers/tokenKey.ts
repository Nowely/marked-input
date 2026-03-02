import type {InjectionKey, Ref} from 'vue'
import type {Token} from '@markput/core'

export const TOKEN_KEY: InjectionKey<Ref<Token>> = Symbol('MarkputToken')

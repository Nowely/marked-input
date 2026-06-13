import type {Token, TokenPath} from '@markput/core'
import type {InjectionKey, Ref} from 'vue'

/** Render-time token context: the path arrives from the tree map by construction. */
export type TokenContext = {readonly path: TokenPath; readonly token: Token}

export const TOKEN_KEY: InjectionKey<Ref<TokenContext>> = Symbol('MarkputToken')
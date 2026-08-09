import type {Token} from '@markput/core'
import type {InjectionKey, Ref} from 'vue'

/**
 * Render-time token context: `depth` arrives from the tree map by construction (a top-level
 * token is 0). It replaced the render-time `TokenPath` at S1.7 — `path.length - 1` was the
 * only thing anything here read off it (plan decision D-a).
 */
export type TokenContext = {readonly depth: number; readonly token: Token}

export const TOKEN_KEY: InjectionKey<Ref<TokenContext>> = Symbol('MarkputToken')
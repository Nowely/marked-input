// @markput/core/adapter — the renderer SPI, separate from the consumer surface.
//
// The renderer contract is reached on the live TokenModel via the Store
// (`store.tokens.renderTree` / `store.tokens.keyOf`); this module is the
// DOCUMENTED boundary — the type of the render tree and the handshake/key
// helpers an adapter binds to. Consumers never import this; they read
// `tokens()` for the always-fresh tree.

import type {Token} from './src/features/tokens'
import type {Computed} from './src/shared/signals'

/** The renderer signal's value: a structural snapshot whose REFERENCE change ⇔ the renderer must run. */
export type RenderTree = Computed<Token[]>
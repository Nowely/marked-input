import type {Token} from '@markput/core'

import {createContext} from '../utils/createContext'

export const [useToken, TokenProvider] = createContext<Token>('NodeProvider')
import {createContext} from '../functions/createContext'
import type {Token} from '@markput/core'

export const [useToken, TokenProvider] = createContext<Token>('NodeProvider')

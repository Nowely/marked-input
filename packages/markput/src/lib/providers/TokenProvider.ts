import {createContext} from '../utils/createContext'
import type {Token} from '@markput/core'

export const [useToken, TokenProvider] = createContext<Token>('NodeProvider')

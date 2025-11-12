import {createContext} from '../functions/createContext'
import {Token} from '@markput/core'

export const [useToken, TokenProvider] = createContext<Token>('NodeProvider')

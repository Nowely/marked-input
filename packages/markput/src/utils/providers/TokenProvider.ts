import {createContext} from '../functions/createContext'
import {MarkStruct} from '@markput/core'

export const [useToken, TokenProvider] = createContext<MarkStruct>('NodeProvider')

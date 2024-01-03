import {MarkStruct} from '../../types'
import {createContext} from '../functions/createContext'

export const [useToken, TokenProvider] = createContext<MarkStruct>('NodeProvider')
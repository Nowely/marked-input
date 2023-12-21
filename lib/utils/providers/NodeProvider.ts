import {MarkStruct} from '../../types'
import {createContext} from '../functions/createContext'

export const [useNode, NodeProvider] = createContext<MarkStruct>('NodeProvider')
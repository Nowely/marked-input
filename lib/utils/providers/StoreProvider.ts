import {createContext} from '../functions/createContext'
import {Store} from '../classes/Store'

export const [useStore, _, StoreContext] = createContext<Store>('StoreProvider')

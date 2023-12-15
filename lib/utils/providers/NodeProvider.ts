import {NodeData} from '../../types'
import {createContext} from '../functions/createContext'
import LinkedListNode from '../classes/LinkedList/LinkedListNode'

export const [useNode, NodeProvider] = createContext<LinkedListNode<NodeData>>('NodeProvider')
import LinkedList from './LinkedList'

/**
 * The class which represents one link or node in a linked list
 * ```ts
 * const node = new LinkedListNode(1, null, null, null);
 * ```
 */
export default class LinkedListNode<NodeData = any> {
    constructor(
        /** Data stored on the node */
        public data: NodeData,
        /** The previous node in the list */
        public prev: LinkedListNode<NodeData> | null,
        /** The next link in the list */
        public next: LinkedListNode<NodeData> | null,
        /** The list this node belongs to */
        public list: LinkedList<NodeData> | null,
    ) {
    }

    /**
     * Get the index of this node
     * ```ts
     * new LinkedList(1, 2, 3).head.index; // 0
     * ```
     */
    public get index() {
        if (!this.list) return
        return this.list.findIndex((data) => data === this.data)
    }

    /**
     * Insert a new node before this one
     * ```ts
     * new LinkedList(2, 3).head.insertBefore(1); // 1 <=> 2 <=> 3
     * ```
     * @param data Data to save in the node
     */
    public insertBefore(data: NodeData): LinkedList<NodeData> {
        return this.list !== null
            ? this.list.insertBefore(this, data)
            : new LinkedList(data, this.data)
    }

    /**
     * Insert new data after this node
     * ```ts
     * new LinkedList(1, 2).tail.insertAfter(3); // 1 <=> 2 <=> 3
     * ```
     * @param data Data to be saved in the node
     */
    public insertAfter(data: NodeData): LinkedList<NodeData> {
        return this.list !== null
            ? this.list.insertAfter(this, data)
            : new LinkedList(this.data, data)
    }

    /**
     * Remove this node
     * ```ts
     * new LinkedList(1, 2, 3, 4).tail.remove(); // 1 <=> 2 <=> 3
     * ```
     */
    public remove(): LinkedListNode<NodeData> {
        if (this.list === null)
            throw new ReferenceError('Node does not belong to any list')
        return this.list.removeNode(this)
    }
}
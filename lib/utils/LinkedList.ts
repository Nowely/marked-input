//Base of this structure getting from https://github.com/gfellerph/ts-linked-list
import LinkedListNode from './LinkedListNode'
export {LinkedListNode}

/** Type used for filter and find methods, returning a boolean */
export type TTestFunction<NodeData> = (data: NodeData, index: number, list: LinkedList<NodeData>) => boolean;

/** Type used for map and forEach methods, returning anything */
export type TMapFunction<NodeData> = (data: any, index: number, list: LinkedList<NodeData>) => any;

/**
 * A doubly linked list
 * ```ts
 * const list = new LinkedList(1, 2, 3);
 * const listFromArray = LinkedList.from([1, 2, 3]);
 * ```
 */
export default class LinkedList<NodeData = any> {

	/** The head of the list, the first node */
	head: LinkedListNode<NodeData> | null
	/** The tail of the list, the last node */
	tail: LinkedListNode<NodeData> | null
	/** Internal $length reference */
	$length: number

	constructor(...args: NodeData[]) {
		this.head = null
		this.tail = null
		this.$length = 0

		for (let i = 0; i < arguments.length; i++) {
			this.append(arguments[i])
		}
	}

	/**
	 * The length of the list
	 */
	get length(): number {
		return this.$length
	}

	/**
	 * Convert any iterable to a new linked list
	 * ```javascript
	 * const array = [1, 2, 3];
	 * const list = LinkedList.from(array);
	 * ```
	 * @param iterable Any iterable datatype like Array or Map
	 */
	static from<T>(iterable: Iterable<T>): LinkedList<T> {
		return new LinkedList(...iterable)
	}

	/**
	 * Get the node data at a specified index, zero based
	 * ```ts
	 * new LinkedList(1, 2, 3).get(0); // 1
	 * ```
	 * @param index to retrieve data at
	 */
	/*get(index: number): NodeData | undefined {
		const node = this.getNode(index)
		return node !== undefined ? node.data : undefined
	}*/

	/**
	 * Get the node at index, zero based
	 * ```ts
	 * new LinkedList(1, 2, 3).getNode(0);
	 * // { prev: null, data: 1, next: LinkedListNode }
	 * ```
	 */

	/*getNode(index: number): LinkedListNode<NodeData> | undefined {
		if (this.head === null || index < 0 || index >= this.length) {
			return undefined
		}
		const asc = index < this.length / 2
		const stopAt = asc ? index : this.length - index - 1
		const nextNode = asc ? 'next' : 'prev'
		let currentNode = asc ? this.head : this.tail
		for (let currentIndex = 0; currentIndex < stopAt; currentIndex++) {
			currentNode = currentNode![nextNode]
		}
		return currentNode!
	}*/

	/**
	 * Return the first node and its index in the list that
	 * satisfies the testing function
	 * ```ts
	 * new LinkedList(1, 2, 3).findNodeIndex(data => data === 1);
	 * // { node: LinkedListNode, index: 0 }
	 * ```
	 * @param f A function to be applied to the data of each node
	 */
	findNodeIndex(f: TTestFunction<NodeData>): ({
		node: LinkedListNode<NodeData>,
		index: number,
	}) | undefined {
		let currentIndex = 0
		let currentNode = this.head
		while (currentNode) {
			if (f(currentNode.data, currentIndex, this)) {
				return {
					index: currentIndex,
					node: currentNode,
				}
			}
			currentNode = currentNode.next
			currentIndex += 1
		}
		return undefined
	}

	/**
	 * Returns the first node in the list that
	 * satisfies the provided testing function. Otherwise undefined is returned.
	 * ```ts
	 * new LinkedList(1, 2, 3).findNode(data => data === 1);
	 * // { prev: null, data: 1, next: LinkedListNode }
	 * ```
	 * @param f Function to test data against
	 */
	findNode(f: TTestFunction<NodeData>): LinkedListNode<NodeData> | undefined {
		const nodeIndex = this.findNodeIndex(f)
		return nodeIndex !== undefined ? nodeIndex.node : undefined
	}

	/**
	 * Returns the value of the first element in the list that
	 * satisfies the provided testing function. Otherwise undefined is returned.
	 * ```ts
	 * new LinkedList(1, 2, 3).find(data => data === 1); // 1
	 * ```
	 * @param f Function to test data against
	 */
	find(f: TTestFunction<NodeData>): NodeData | undefined {
		const nodeIndex = this.findNodeIndex(f)
		return nodeIndex !== undefined ? nodeIndex.node.data : undefined
	}

	/**
	 * Returns the index of the first node in the list that
	 * satisfies the provided testing function. Ohterwise -1 is returned.
	 * ```ts
	 * new LinkedList(1, 2, 3).findIndex(data => data === 3); // 2
	 * ```
	 * @param f Function to test data against
	 */
	findIndex(f: TTestFunction<NodeData>): number {
		const nodeIndex = this.findNodeIndex(f)
		return nodeIndex !== undefined ? nodeIndex.index : -1
	}

	/**
	 * Append one or any number of nodes to the end of the list.
	 * This modifies the list in place and returns the list itself
	 * to make this method chainable.
	 * ```ts
	 * new LinkedList(1).append(2).append(3, 4); // 1 <=> 2 <=> 3 <=> 4
	 * ```
	 * @param args Data to be stored in the node, takes any number of arguments
	 */
	append(...args: NodeData[]): LinkedList<NodeData> {
		for (const data of args) {
			const node = new LinkedListNode(data, this.tail, null, this)
			if (this.head === null) {
				this.head = node
			}
			if (this.tail !== null) {
				this.tail.next = node
			}
			this.tail = node
			this.$length += 1
		}
		return this
	}

	/**
	 * Prepend any number of data arguments to the list. The
	 * argument list is prepended as a block to reduce confusion:
	 * ```javascript
	 * new LinkedList(3, 4).prepend(0, 1, 2); // [0, 1, 2, 3, 4]
	 * ```
	 * @param data Data to be stored in the node, accepts any number of arguments
	 */
	/*prepend(...args: NodeData[]): LinkedList<NodeData> {
		const reverseArgs = Array.from(args).reverse()
		for (const data of reverseArgs) {
			const node = new LinkedListNode(data, null, this.head, this)
			if (this.tail === null) {
				this.tail = node
			}
			if (this.head !== null) {
				this.head.prev = node
			}
			this.head = node
			this.$length += 1
		}
		return this
	}*/

	/**
	 * Insert a new node at a given index position. If index is
	 * out of bounds, the node is appended, if index is negative
	 * or 0, it will be prepended.
	 * ```ts
	 * new LinkedList(1, 3).insertAt(1, 2); // 1 <=> 2 <=> 3
	 * ```
	 * @param index The index to insert the new node at
	 * @param data Data to be stored on the new node
	 */

	/*insertAt(index: number, data: NodeData): LinkedList<NodeData> {
		if (this.head === null) {
			return this.append(data)
		}
		if (index <= 0) {
			return this.prepend(data)
		}

		let currentNode = this.head
		let currentIndex = 0
		while (currentIndex < index - 1 && currentNode.next !== null) {
			currentIndex += 1
			currentNode = currentNode.next
		}
		currentNode.insertAfter(data)
		return this
	}*/

	/**
	 * Remove the specified node from the list and return the removed
	 * node afterwards.
	 * ```ts
	 * const list = new LinkedList(1, 2, 3);
	 * list.removeNode(list.tail); // { prev: null, data: 3, next: null, list: null }
	 * ```
	 * @param node The node to be removed
	 */
	removeNode(node: LinkedListNode<NodeData>): LinkedListNode<NodeData> {
		if (node.list !== this) {
			throw new ReferenceError('Node does not belong to this list')
		}

		if (node.prev !== null) {
			node.prev.next = node.next
		}

		if (node.next !== null) {
			node.next.prev = node.prev
		}

		if (this.head === node) {
			this.head = node.next
		}

		if (this.tail === node) {
			this.tail = node.prev
		}

		this.$length -= 1
		node.next = null
		node.prev = null
		node.list = null
		return node
	}


	replace(referenceNode: LinkedListNode<NodeData>, data: NodeData): LinkedList<NodeData> {
		const linkedList = this.insertBefore(referenceNode, data)
		this.removeNode(referenceNode)
		return linkedList
	}

	/**
	 * Remove the node at the specified index
	 * ```ts
	 * new LinkedList(1, 2, 3).removeAt(2); // { prev: null, data: 3, next: null, list: null }
	 * ```
	 * @param index Index at which to remove
	 */

	/*removeAt(index: number): LinkedListNode<NodeData> | undefined {
		const node = this.getNode(index)
		return node !== undefined ? this.removeNode(node) : undefined
	}*/

	/**
	 * Insert a new node before the reference node
	 * ```ts
	 * const list = new LinkedList(1, 3);
	 * list.insertBefore(list.tail, 2); // 1 <=> 2 <=> 3
	 * ```
	 * @param referenceNode The node reference
	 * @param data Data to save in the node
	 */
	insertBefore(referenceNode: LinkedListNode<NodeData>, data: NodeData): LinkedList<NodeData> {
		const node = new LinkedListNode(data, referenceNode.prev, referenceNode, this)
		if (referenceNode.prev === null) {
			this.head = node
		}
		if (referenceNode.prev !== null) {
			referenceNode.prev.next = node
		}
		referenceNode.prev = node
		this.$length += 1
		return this
	}

	/**
	 * Sorts the linked list using the provided compare function
	 * @param compare A function used to compare the data of two nodes. It should return
	 *                a boolean. True will insert a before b, false will insert b before a.
	 *                (a, b) => a < b or (1, 2) => 1 < 2 === true, 2 will be inserted after 1,
	 *                the sort order will be ascending.
	 */
	/*sort(compare: (a: NodeData, b: NodeData) => boolean): LinkedList<NodeData> {
		if (this.head === null || this.tail === null) {
			return this
		}
		if (this.length < 2) {
			return this
		}

		const quicksort = (
			start: LinkedListNode<NodeData>,
			end: LinkedListNode<NodeData>,
		) => {
			if (start === end) {
				return
			}
			const pivotData = end.data
			let current: LinkedListNode | null = start
			let split: LinkedListNode = start
			while (current && current !== end) {
				const sort = compare(current.data, pivotData)
				if (sort) {
					if (current !== split) {
						const temp = split.data
						split.data = current.data
						current.data = temp
					}
					split = split.next!
				}
				current = current.next
			}
			end.data = split.data
			split.data = pivotData

			if (start.next === end.prev) {
				return
			}

			if (split.prev && split !== start) {
				quicksort(start, split.prev)
			}
			if (split.next && split !== end) {
				quicksort(split.next, end)
			}
		}

		quicksort(this.head, this.tail)
		return this
	}*/

	/**
	 * Insert a new node after this one
	 * ```ts
	 * const list = new LinkedList(2, 3);
	 * list.insertAfter(list.head, 1); // 1 <=> 2 <=> 3
	 * ```
	 * @param referenceNode The reference node
	 * @param data Data to be saved in the node
	 */
	/*insertAfter(
		referenceNode: LinkedListNode<NodeData>,
		data: NodeData,
	): LinkedList<NodeData> {
		const node = new LinkedListNode(data, referenceNode, referenceNode.next, this)
		if (referenceNode.next === null) {
			this.tail = node
		}
		if (referenceNode.next !== null) {
			referenceNode.next.prev = node
		}
		referenceNode.next = node
		this.$length += 1
		return this
	}*/

	/**
	 * Remove the first node from the list and return the data of the removed node
	 * or undefined
	 * ```ts
	 * new LinkedList(1, 2, 3).shift(); // 1
	 * ```
	 */
	/*shift(): NodeData | undefined {
		return this.removeFromAnyEnd(this.head)
	}*/

	/**
	 * Remove the last node from the list and return the data of the removed node
	 * or undefined if the list was empty
	 * ```ts
	 * new LinkedList(1, 2, 3).pop(); // 3
	 * ```
	 */
	/*pop(): NodeData | undefined {
		return this.removeFromAnyEnd(this.tail)
	}*/

	/**
	 * Merge the current list with another. Both lists will be
	 * equal after merging.
	 * ```ts
	 * const list = new LinkedList(1, 2);
	 * const otherList = new LinkedList(3);
	 * list.merge(otherList);
	 * (list === otherList); // true
	 * ```
	 * @param list The list to be merged
	 */
	/*merge(list: LinkedList<NodeData>): void {
		if (this.tail !== null) {
			this.tail.next = list.head
		}
		if (list.head !== null) {
			list.head.prev = this.tail
		}
		this.head = this.head || list.head
		this.tail = list.tail || this.tail
		this.$length += list.$length
		list.$length = this.$length
		list.head = this.head
		list.tail = this.tail
	}*/

	/**
	 * Removes all nodes from a list
	 *
	 * ```ts
	 * list.clear();
	 * ```
	 */
	/*clear() {
		this.head = null
		this.tail = null
		this.$length = 0
		return this
	}*/

	/**
	 * The slice() method returns a shallow copy of a
	 * portion of a list into a new list object selected
	 * from start to end (end not included).
	 * The original list will not be modified.
	 * ```ts
	 * const list = new LinkedList(1, 2, 3, 4, 5);
	 * const newList = list.slice(0, 3); // 1 <=> 2 <=> 3
	 * ```
	 * @param start Start index
	 * @param end End index, optional
	 */
	/*slice(start: number, end?: number): LinkedList<NodeData | {}> {
		const list = new LinkedList()
		let finish = end

		if (this.head === null || this.tail === null) {
			return list
		}
		if (finish === undefined || finish < start) {
			finish = this.length
		}

		let head: LinkedListNode<NodeData> | null | undefined = this.getNode(start)
		for (let i = 0; i < finish - start && head !== null && head !== undefined; i++) {
			list.append(head.data)
			head = head.next
		}
		return list
	}*/

	/**
	 * The reverse() function reverses the list in place and returns the list
	 * itself.
	 * ```ts
	 * new LinkedList(1, 2, 3).reverse(); // 3 <=> 2 <=> 1
	 * ```
	 */

	/*reverse(): LinkedList<NodeData> {
		let currentNode = this.head
		while (currentNode) {
			const next = currentNode.next
			currentNode.next = currentNode.prev
			currentNode.prev = next
			currentNode = currentNode.prev
		}
		const tail = this.tail
		this.tail = this.head
		this.head = tail
		return this
	}*/

	/**
	 * The forEach() method executes a provided function once for each list node.
	 * ```ts
	 * new LinkedList(1, 2, 3).forEach(data => log(data)); // 1 2 3
	 * ```
	 * @param f Function to execute for each element, taking up to three arguments.
	 * @param reverse Indicates if the list should be walked in reverse order, default is false
	 */
	forEach(f: TMapFunction<NodeData>, reverse = false): void {
		let currentIndex = reverse ? this.length - 1 : 0
		let currentNode = reverse ? this.tail : this.head
		const modifier = reverse ? -1 : 1
		const nextNode = reverse ? 'prev' : 'next'
		while (currentNode) {
			f(currentNode.data, currentIndex, this)
			currentNode = currentNode[nextNode]
			currentIndex += modifier
		}
	}

	/**
	 * The map() method creates a new list with the results of
	 * calling a provided function on every node in the calling list.
	 * ```ts
	 * new LinkedList(1, 2, 3).map(data => data + 10); // 11 <=> 12 <=> 13
	 * ```
	 * @param f Function that produces an node of the new list, taking up to three arguments
	 * @param reverse Indicates if the list should be mapped in reverse order, default is false
	 */
	/*map(f: TMapFunction<NodeData>, reverse = false): LinkedList<NodeData | {}> {
		const list = new LinkedList()
		this.forEach((data, index) => list.append(f(data, index, this)), reverse)
		return list
	}*/

	/**
	 * The filter() method creates a new list with all nodes
	 * that pass the test implemented by the provided function.
	 * ```ts
	 * new LinkedList(1, 2, 3, 4, 5).filter(data => data < 4); // 1 <=> 2 <=> 3
	 * ```
	 * @param f Function to test each node data in the list. Return true to keep the node
	 * @param reverse Indicates if the list should be filtered in reverse order, default is false
	 */
	/*filter(f: TTestFunction<NodeData>, reverse = false): LinkedList<NodeData | {}> {
		const list = new LinkedList()
		this.forEach((data, index) => {
			if (f(data, index, this)) {
				list.append(data)
			}
		}, reverse)
		return list
	}*/

	/**
	 * Reduce over each node in the list
	 * ```ts
	 * new LinkedList(1, 2, 3).reduce(n => n += 1, 0); // 3
	 * ```
	 * @param f A reducer function
	 * @param start An initial value
	 * @returns The final state of the accumulator
	 */

	/*reduce(
		f: (
			accumulator: any,
			currentNode: NodeData,
			index: number,
			list: LinkedList<NodeData>,
		) => any,
		start?: any,
		reverse = false,
	): any {
		let currentIndex = reverse ? this.length - 1 : 0
		const modifier = reverse ? -1 : 1
		const nextNode = reverse ? 'prev' : 'next'
		let currentElement = reverse ? this.tail : this.head
		let result

		if (start !== undefined) {
			result = start
		} else if (currentElement) {
			result = currentElement.data
			currentElement = currentElement[nextNode]
		} else {
			throw new TypeError('Reduce of empty LinkedList with no initial value')
		}

		while (currentElement) {
			result = f(result, currentElement.data, currentIndex, this)
			currentIndex += modifier
			currentElement = currentElement[nextNode]
		}

		return result
	}*/

	/**
	 * Convert the linked list to an array
	 * ```ts
	 * new LinkedList(1, 2, 3).toArray(); // [1, 2, 3]
	 * ```
	 */
	toArray(): NodeData[] {
		return [...this]
	}

	/**
	 * Convert a linked list to string
	 * ```ts
	 * new LinkedList('one', 'two', 'three').toString(' <=> ') === 'one <=> two <=> three';
	 * ```
	 * @param separator Optional string to be placed in between data nodes, default is one space
	 */

	/*toString(separator = ' '): string {
		return this.reduce((s, data) => `${s}${separator}${data}`)
	}*/

	/**
	 * The iterator implementation
	 * ```ts
	 * const list = new LinkedList(1, 2, 3);
	 * for (const data of list) { log(data); } // 1 2 3
	 * ```
	 */
	* [Symbol.iterator](): IterableIterator<NodeData> {
		let element = this.head

		while (element !== null) {
			yield element.data
			element = element.next
		}
	}

	/** Private helper function to reduce duplication of pop() and shift() methods */
	/*private removeFromAnyEnd(node: LinkedListNode<NodeData> | null) {
		return node !== null ? this.removeNode(node).data : undefined
	}*/
}
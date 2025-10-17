
/**
 * Node in the Aho-Corasick automaton trie
 */
class AhoNode {
	next: Map<string, AhoNode>
	fail: AhoNode | null
	out: number[] // indices of patterns that end at this node

	constructor() {
		this.next = new Map()
		this.fail = null
		this.out = []
	}
}

/**
 * Result of a segment match in the text
 */
export interface SegmentMatch {
	/** Index in the patterns array */
	index: number
	/** Start position in text */
	start: number
	/** End position in text (inclusive) */
	end: number
	/** Matched text */
	value: string
}

//TODO add support Unicode code points?
/**
 * Aho-Corasick automaton for efficient multi-pattern string matching
 * Finds all occurrences of multiple patterns in O(|text| + |patterns| + |matches|) time
 * 
 * Note: Expects deduplicated segments from MarkupRegistry for optimal performance
 */
export class AhoCorasick {
	private readonly segments: string[]
	private readonly root = new AhoNode()

	constructor(segments: string[]) {
		this.segments = segments
		this.buildTrie()
		this.buildFailures()
	}


	/**
	 * Searches for all pattern occurrences in the text
	 * @param text - Text to search in
	 * @returns Array of matches (unsorted)
	 */
	search(text: string): SegmentMatch[] {
		const results: SegmentMatch[] = []
		let node = this.root

		for (let i = 0; i < text.length; i++) {
			const char = text[i]

			// Follow failure links until we find a transition or reach root
			while (node !== this.root && !node.next.has(char)) {
				node = node.fail!
			}

			// Take the transition if it exists
			if (node.next.has(char)) {
				node = node.next.get(char)!
			}

			// Report all patterns that end at this position
			if (node.out.length > 0) {
				for (const index of node.out) {
					const pattern = this.segments[index]
					const start = i - pattern.length + 1

					results.push({
						index,
						start,
						end: i,
						value: pattern,
					})
				}
			}
		}

		return results.sort((a, b) => a.start - b.start || a.end - b.end)
	}

	/**
	 * Builds the trie structure from patterns
	 */
	private buildTrie(): void {
		for (let i = 0; i < this.segments.length; i++) {
			const pattern = this.segments[i]
			let node = this.root

			for (const char of pattern) {
				if (!node.next.has(char)) {
					node.next.set(char, new AhoNode())
				}
				node = node.next.get(char)!
			}

			node.out.push(i)
		}
	}

	/**
	 * Builds failure links for the automaton using BFS
	 */
	private buildFailures(): void {
		const queue: AhoNode[] = []
		this.root.fail = this.root

		// Initialize failure links for depth 1 nodes
		for (const [, node] of this.root.next) {
			node.fail = this.root
			queue.push(node)
		}

		// BFS to build failure links for deeper nodes
		while (queue.length > 0) {
			const current = queue.shift()!

			for (const [char, next] of current.next) {
				queue.push(next)

				// Find failure link
				let fail = current.fail
				while (fail !== this.root && !fail!.next.has(char)) {
					fail = fail!.fail
				}

				if (fail!.next.has(char) && fail!.next.get(char) !== next) {
					next.fail = fail!.next.get(char)!
				} else {
					next.fail = this.root
				}

				// Merge output from failure node
				if (next.fail && next.fail.out.length > 0) {
					next.out = next.out.concat(next.fail.out)
				}
			}
		}
	}
}

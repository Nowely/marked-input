import type {Token} from '../types'

export function tokensToDebugTree(tokens: Token[], level = 0, prefix = ''): string {
	const lines: string[] = []

	tokens.forEach((token, index) => {
		const currentPrefix = prefix + (prefix ? '.' : '') + index
		const indent = level > 0 ? '\t'.repeat(level) : ''
		const paddedPrefix = level === 0 && index > 0 ? ` ${currentPrefix}` : currentPrefix

		if (token.type === 'text') {
			const content = `"${escapeString(token.content)}"`
			lines.push(`${indent}${paddedPrefix}: TEXT ${content} [${token.position.start}-${token.position.end}]`)
		} else {
			let infoParts = [`value="${escapeString(token.value)}"`]

			if (token.meta !== undefined) {
				infoParts.push(`meta="${escapeString(token.meta)}"`)
			}

			if (token.slot) {
				infoParts.push(`slot="${escapeString(token.slot.content)}"`)
			}

			const labelValueInfo = `[${infoParts.join(', ')}]`

			lines.push(
				`${indent}${paddedPrefix}: MARK "${escapeString(token.content)}" [${token.position.start}-${token.position.end}] ${labelValueInfo}`
			)

			if (token.children.length > 0) {
				const childLines = tokensToDebugTree(token.children, level + 1, currentPrefix)
				if (childLines.trim()) {
					lines.push(childLines)
				}
			}
		}
	})

	return lines.join('\n')

	function escapeString(str: string): string {
		return str
			.replace(/\n/g, '↲') // Newline (down-left arrow)
			.replace(/\r/g, '⏎') // Carriage return (left arrow)
			.replace(/\t/g, '⇥') // Tab (right-up arrow)
	}
}

export function countMarks(tokens: Token[]): number {
	const countInNode = (node: Token): number => {
		let nodeCount = node.type === 'mark' ? 1 : 0

		if (node.type === 'mark') {
			nodeCount += node.children.reduce((sum, child) => sum + countInNode(child), 0)
		}

		return nodeCount
	}

	return tokens.reduce((sum, token) => sum + countInNode(token), 0)
}

export function findMaxDepth(tokens: Token[]): number {
	const findDepth = (node: Token): number => {
		if (node.type === 'text') {
			return 0
		}

		if (node.children.length === 0) {
			return 1
		}

		const childrenDepths = node.children.map(child => findDepth(child))
		const maxChildDepth = childrenDepths.length > 0 ? Math.max(...childrenDepths) : 0

		return maxChildDepth + 1
	}

	if (tokens.length === 0) {
		return 0
	}

	const depths = tokens.map(token => findDepth(token))
	return Math.max(...depths)
}

export function dedent(strings: TemplateStringsArray, ...values: unknown[]): string {
	let result = strings[0]
	for (let i = 0; i < values.length; i++) {
		result += String(values[i]) + strings[i + 1]
	}

	const lines = result.split('\n')

	let startIndex = 0
	let endIndex = lines.length - 1

	while (startIndex < lines.length && lines[startIndex].trim() === '') {
		startIndex++
	}

	while (endIndex >= 0 && lines[endIndex].trim() === '') {
		endIndex--
	}

	if (startIndex > endIndex) {
		return ''
	}

	const contentLines = lines.slice(startIndex, endIndex + 1)

	let minIndent = Infinity
	for (const line of contentLines) {
		if (line.trim() === '') continue

		const indent = line.length - line.trimStart().length
		if (indent < minIndent) {
			minIndent = indent
		}
	}

	if (minIndent === Infinity || minIndent === 0) {
		return contentLines.join('\n')
	}

	const dedentedLines = contentLines.map(line => {
		if (line.trim() === '') {
			return ''
		}
		return line.slice(minIndent)
	})

	return dedentedLines.join('\n')
}
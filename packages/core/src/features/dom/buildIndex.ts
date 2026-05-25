import type {TokenAddress, TokenPath} from '../../shared/editorContracts'
import type {Token} from '../parsing/parser/types'
import {pathKey} from '../parsing/tokenIndex'
import type {TokenNode} from './types'

export type BuildIndexInput = {
	container: HTMLElement
	tokens: readonly Token[]
	addressFor: (path: TokenPath) => TokenAddress | undefined
	controlElements: ReadonlySet<HTMLElement>
	childSequenceHostsByPath: ReadonlyMap<string, readonly HTMLElement[]>
	isBlock: boolean
}

export type IndexResult = {
	byPath: ReadonlyMap<string, TokenNode>
	byElement: WeakMap<HTMLElement, TokenNode>
	controlRoots: WeakSet<HTMLElement>
}

type Frame = {
	tokens: readonly Token[]
	elements: HTMLElement[]
	basePath: TokenPath
	rows?: ReadonlyMap<number, HTMLElement>
}

export function buildIndex(input: BuildIndexInput): IndexResult {
	const {container, tokens, addressFor, controlElements, childSequenceHostsByPath, isBlock} = input

	const byPath = new Map<string, TokenNode>()
	const byElement = new WeakMap<HTMLElement, TokenNode>()
	const controlRoots = computeControlRoots(container, controlElements)

	const stack: Frame[] = [resolveRoot()]

	while (stack.length > 0) {
		const frame = stack.pop()
		if (!frame) continue
		const {tokens: frameTokens, elements, basePath, rows} = frame
		if (elements.length !== frameTokens.length) continue

		frameTokens.forEach((token, i) => {
			const path = [...basePath, i]
			const node = indexToken(token, path, elements[i], rows?.get(i))
			if (!node || token.type !== 'mark' || token.children.length === 0) return
			stack.push({
				tokens: token.children,
				elements: nonControlChildren(node.childSequenceHost ?? elements[i], controlRoots),
				basePath: path,
			})
		})
	}

	return {byPath, byElement, controlRoots}

	function resolveRoot(): Frame {
		if (!isBlock) {
			return {tokens, elements: nonControlChildren(container, controlRoots), basePath: []}
		}
		// Block layout: take all container children as candidate rows (do NOT filter rows
		// by controlRoots — a row that contains controls is still a row). Controls are
		// filtered only inside each row when looking for the single token element.
		const rowEls = elementChildren(container)
		const tokenEls: HTMLElement[] = []
		const rows = new Map<number, HTMLElement>()
		const len = Math.min(tokens.length, rowEls.length)
		for (let i = 0; i < len; i++) {
			const row = rowEls[i]
			const inner = nonControlChildren(row, controlRoots)
			// Block alignment is all-or-nothing: one bad row bails the whole frame.
			if (inner.length !== 1) return {tokens, elements: [], basePath: []}
			tokenEls.push(inner[0])
			rows.set(i, row)
		}
		return {tokens, elements: tokenEls, basePath: [], rows}
	}

	function indexToken(
		token: Token,
		path: TokenPath,
		element: HTMLElement,
		rowElement: HTMLElement | undefined
	): TokenNode | undefined {
		const address = addressFor(path)
		if (!address) return

		const hosts = childSequenceHostsByPath.get(pathKey(path)) ?? []
		const childSequenceHost = hosts.length === 1 && element.contains(hosts[0]) ? hosts[0] : undefined

		const node: TokenNode = {
			path,
			address,
			tokenElement: element,
			textElement: token.type === 'text' ? element : undefined,
			rowElement,
			childSequenceHost,
		}

		byPath.set(pathKey(path), node)
		byElement.set(element, node)
		if (rowElement) byElement.set(rowElement, node)
		if (childSequenceHost) byElement.set(childSequenceHost, node)
		return node
	}
}

function nonControlChildren(parent: HTMLElement, controlRoots: WeakSet<HTMLElement>): HTMLElement[] {
	const out: HTMLElement[] = []
	for (const child of parent.children) {
		if (child instanceof HTMLElement && !controlRoots.has(child)) out.push(child)
	}
	return out
}

function elementChildren(parent: HTMLElement): HTMLElement[] {
	const out: HTMLElement[] = []
	for (const child of parent.children) {
		if (child instanceof HTMLElement) out.push(child)
	}
	return out
}

function computeControlRoots(container: HTMLElement, controlElements: ReadonlySet<HTMLElement>): WeakSet<HTMLElement> {
	const roots = new WeakSet<HTMLElement>()
	for (const ctrl of controlElements) {
		let el: HTMLElement | null = ctrl
		while (el && el !== container) {
			roots.add(el)
			el = el.parentElement
		}
	}
	return roots
}
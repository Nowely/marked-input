import {isHtmlElement, isTextNode, nextText} from '../../shared/checkers'
import {Caret} from '../caret'
import {isTextTokenSpan} from '../editable'
import type {MarkToken, Token} from '../parsing'

export function getCaretRawPosInBlock(blockDiv: HTMLElement, token: Token): number {
	const selection = window.getSelection()
	if (!selection?.rangeCount) return token.position.end

	const {focusNode, focusOffset} = selection
	if (!focusNode) return token.position.end

	return getDomRawPos(focusNode, focusOffset, blockDiv, token)
}

export function setCaretAtRawPos(blockDiv: HTMLElement, token: Token, rawAbsolutePos: number): void {
	const sel = window.getSelection()
	if (!sel) return

	if (token.type === 'mark') {
		if (setCaretInMarkAtRawPos(blockDiv, token, rawAbsolutePos)) return
		Caret.setCaretToEnd(blockDiv)
		return
	}

	const offsetWithinToken = rawAbsolutePos - token.position.start
	const walker = document.createTreeWalker(blockDiv, 4)
	const textNode = nextText(walker)
	if (textNode) {
		const charOffset = Math.min(offsetWithinToken, textNode.length)
		const range = document.createRange()
		range.setStart(textNode, charOffset)
		range.collapse(true)
		sel.removeAllRanges()
		sel.addRange(range)
		return
	}

	Caret.setCaretToEnd(blockDiv)
}

export function getDomRawPos(node: Node, offset: number, blockDiv: HTMLElement, token: Token): number {
	if (node === blockDiv) {
		const sel = window.getSelection()
		if (sel?.focusNode && sel.focusNode !== blockDiv) {
			return getDomRawPos(sel.focusNode, sel.focusOffset, blockDiv, token)
		}
		return token.position.end
	}

	if (node.nodeType === Node.TEXT_NODE && node.parentElement === blockDiv) {
		if (token.type === 'mark') {
			return getDomRawPosInMark(node, offset, blockDiv, token)
		}
		return token.position.start + Math.min(offset, token.content.length)
	}

	let child: Node | null = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement
	while (child && child.parentElement !== blockDiv) {
		child = child.parentElement
	}
	if (!child) return token.position.end

	if (token.type === 'mark') {
		return getDomRawPosInMark(node, offset, blockDiv, token)
	}

	return token.position.start + Math.min(offset, token.content.length)
}

export function getDomRawPosInMark(node: Node, offset: number, markElement: HTMLElement, markToken: MarkToken): number {
	if (markToken.children.length === 0) {
		if (offset === 0) return markToken.position.start
		const nestedLen = markToken.slot?.content.length ?? markToken.value.length
		if (nestedLen > 0 && offset >= nestedLen) {
			if (markToken.content.endsWith('\n\n') && markToken.slot) {
				return markToken.slot.end
			}
			return markToken.position.end
		}
		return (markToken.slot?.start ?? markToken.position.start) + Math.min(offset, nestedLen)
	}

	let tokenIdx = 0
	for (const childNode of Array.from(markElement.childNodes)) {
		if (tokenIdx >= markToken.children.length) break
		const tokenChild = markToken.children[tokenIdx]

		if (isHtmlElement(childNode) && tokenChild.type === 'text') {
			if (!isTextTokenSpan(childNode)) continue
			if (node === childNode) {
				const charOffset = offset === 0 ? 0 : tokenChild.content.length
				return tokenChild.position.start + Math.min(charOffset, tokenChild.content.length)
			}
			if (childNode.contains(node)) {
				return tokenChild.position.start + Math.min(offset, tokenChild.content.length)
			}
			tokenIdx++
		} else if (isTextNode(childNode) && tokenChild.type === 'text') {
			if (node === childNode) {
				return tokenChild.position.start + Math.min(offset, tokenChild.content.length)
			}
			tokenIdx++
		} else if (isHtmlElement(childNode) && tokenChild.type === 'mark') {
			if (childNode === node || childNode.contains(node)) {
				return getDomRawPosInMark(node, offset, childNode, tokenChild)
			}
			tokenIdx++
		}
	}

	return markToken.slot?.end ?? markToken.position.end
}

function setCaretInMarkAtRawPos(markElement: HTMLElement, markToken: MarkToken, rawAbsolutePos: number): boolean {
	const sel = window.getSelection()
	if (!sel) return false

	let tokenIdx = 0
	for (const childNode of Array.from(markElement.childNodes)) {
		if (tokenIdx >= markToken.children.length) break
		const tokenChild = markToken.children[tokenIdx]

		if (isHtmlElement(childNode) && tokenChild.type === 'text') {
			if (!isTextTokenSpan(childNode)) continue
			if (rawAbsolutePos >= tokenChild.position.start && rawAbsolutePos <= tokenChild.position.end) {
				const rawTextNode = childNode.firstChild
				const textNode = isTextNode(rawTextNode) ? rawTextNode : null
				const offset = rawAbsolutePos - tokenChild.position.start
				if (textNode) {
					const range = document.createRange()
					range.setStart(textNode, Math.min(offset, textNode.length))
					range.collapse(true)
					sel.removeAllRanges()
					sel.addRange(range)
				} else {
					const range = document.createRange()
					range.setStart(childNode, 0)
					range.collapse(true)
					sel.removeAllRanges()
					sel.addRange(range)
				}
				return true
			}
			tokenIdx++
		} else if (isTextNode(childNode) && tokenChild.type === 'text') {
			if (rawAbsolutePos >= tokenChild.position.start && rawAbsolutePos <= tokenChild.position.end) {
				const offset = Math.min(rawAbsolutePos - tokenChild.position.start, childNode.length)
				const range = document.createRange()
				range.setStart(childNode, offset)
				range.collapse(true)
				sel.removeAllRanges()
				sel.addRange(range)
				return true
			}
			tokenIdx++
		} else if (isHtmlElement(childNode) && tokenChild.type === 'mark') {
			const nextChild = tokenIdx + 1 < markToken.children.length ? markToken.children[tokenIdx + 1] : null
			const atBoundary =
				rawAbsolutePos === tokenChild.position.end && nextChild?.position.start === rawAbsolutePos
			if (
				!atBoundary &&
				rawAbsolutePos >= tokenChild.position.start &&
				rawAbsolutePos <= tokenChild.position.end
			) {
				return setCaretInMarkAtRawPos(childNode, tokenChild, rawAbsolutePos)
			}
			tokenIdx++
		}
	}

	return false
}
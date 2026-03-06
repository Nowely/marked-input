import {useEffect} from 'react'

const TOOLTIP_STYLES: Partial<CSSStyleDeclaration> = {
	position: 'fixed',
	background: '#333',
	color: '#fff',
	padding: '4px 8px',
	borderRadius: '4px',
	fontSize: '11px',
	fontFamily: 'monospace',
	whiteSpace: 'nowrap',
	pointerEvents: 'none',
	zIndex: '1000',
	display: 'none',
}

/** Hook to track and display caret position within contenteditable elements */
export function useCaretInfo(enabled?: boolean): void {
	useEffect(() => {
		if (!enabled) return

		const tooltip = document.createElement('div')
		Object.assign(tooltip.style, TOOLTIP_STYLES)
		document.body.appendChild(tooltip)

		const handleSelectionChange = () => {
			const selection = window.getSelection()
			const range = selection?.rangeCount ? selection.getRangeAt(0) : null
			const container = document.activeElement?.closest('[contenteditable]')

			if (!range || !container) {
				tooltip.style.display = 'none'
				return
			}

			const rect = range.getBoundingClientRect()
			const totalOffset = calculateTotalOffset(container, range)

			tooltip.style.display = 'block'
			tooltip.style.left = `${rect.left}px`
			tooltip.style.top = `${rect.bottom + 2}px`
			tooltip.textContent = `${document.activeElement!.tagName} | offset: ${range.startOffset} | total: ${totalOffset}`
		}

		document.addEventListener('selectionchange', handleSelectionChange)

		return () => {
			document.removeEventListener('selectionchange', handleSelectionChange)
			tooltip.remove()
		}
	}, [enabled])
}

/**
 * Calculates the total character offset from the start of a contenteditable
 * container to the current caret position by walking through text nodes.
 */
function calculateTotalOffset(container: Element, range: Range): number {
	const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
	let totalOffset = 0
	let node: Node | null

	while ((node = walker.nextNode())) {
		if (node === range.startContainer) {
			return totalOffset + range.startOffset
		}
		totalOffset += node.textContent?.length ?? 0
	}

	return totalOffset
}
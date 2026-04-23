import {page, userEvent} from 'vitest/browser'

import {childrenOf} from './dom'

export function findMarkputRowHost(container: Element): HTMLElement | null {
	const candidates = Array.from(container.querySelectorAll<HTMLElement>('[class*="Container"]'))
	for (const el of candidates) {
		const hasBlockChild = childrenOf(el).some(c => c instanceof HTMLElement && c.dataset.testid === 'block')
		if (hasBlockChild) return el
	}
	return container.querySelector<HTMLElement>('[class*="Container"]')
}

export function getAllRows(container: Element) {
	const host = findMarkputRowHost(container)
	return host ? childrenOf(host) : []
}

export function getBlocks(container: Element) {
	const host = findMarkputRowHost(container)
	if (!host) return []
	return Array.from(host.querySelectorAll<HTMLElement>('[data-testid="block"]'))
}

export function getEditableInRow(row: HTMLElement) {
	return row.querySelector('[contenteditable="true"]') ?? row
}

export async function openMenuForRow(container: Element, rowIndex: number) {
	const row = getAllRows(container)[rowIndex]
	await userEvent.hover(row)
	const grip = await page
		.elementLocator(row)
		.getByRole('button', {name: 'Drag to reorder or click for options'})
		.findElement()
	await userEvent.click(grip)
}

export async function simulateDragRow(
	container: Element,
	sourceIndex: number,
	targetIndex: number,
	position: 'before' | 'after' = 'after'
) {
	const rows = getAllRows(container)
	const sourceRow = rows[sourceIndex]
	const targetRow = rows[targetIndex]

	await userEvent.hover(sourceRow)
	const grip = await page
		.elementLocator(sourceRow)
		.getByRole('button', {name: 'Drag to reorder or click for options'})
		.findElement()

	const dt = new DataTransfer()

	grip.dispatchEvent(new DragEvent('dragstart', {bubbles: true, cancelable: true, dataTransfer: dt}))

	const rect = targetRow.getBoundingClientRect()
	targetRow.dispatchEvent(
		new DragEvent('dragover', {
			bubbles: true,
			cancelable: true,
			dataTransfer: dt,
			clientY: position === 'before' ? rect.top + 1 : rect.bottom - 1,
		})
	)

	await new Promise<void>(r => queueMicrotask(r))

	targetRow.dispatchEvent(new DragEvent('drop', {bubbles: true, cancelable: true, dataTransfer: dt}))
	grip.dispatchEvent(new DragEvent('dragend', {bubbles: true, cancelable: true}))
}

export function dispatchPaste(target: HTMLElement, text: string) {
	const sel = window.getSelection()
	if (!sel?.rangeCount) return
	const r = sel.getRangeAt(0)
	const staticRange = new StaticRange({
		startContainer: r.startContainer,
		startOffset: r.startOffset,
		endContainer: r.endContainer,
		endOffset: r.endOffset,
	})
	const dt = new DataTransfer()
	dt.setData('text/plain', text)
	target.dispatchEvent(
		new InputEvent('beforeinput', {
			bubbles: true,
			cancelable: true,
			inputType: 'insertFromPaste',
			dataTransfer: dt,
			targetRanges: [staticRange],
		})
	)
}

export function dispatchInsertText(target: HTMLElement, text: string) {
	const sel = window.getSelection()
	if (!sel?.rangeCount) return
	const r = sel.getRangeAt(0)
	const staticRange = new StaticRange({
		startContainer: r.startContainer,
		startOffset: r.startOffset,
		endContainer: r.endContainer,
		endOffset: r.endOffset,
	})
	target.dispatchEvent(
		new InputEvent('beforeinput', {
			bubbles: true,
			cancelable: true,
			inputType: 'insertText',
			data: text,
			targetRanges: [staticRange],
		})
	)
}
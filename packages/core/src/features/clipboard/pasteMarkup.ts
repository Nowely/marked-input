/** Custom MIME type for markput markup syntax. */
export const MARKPUT_MIME = 'application/x-markput'

let pendingMarkup: string | undefined

/**
 * Capture markup data from a paste event.
 * Call this from the `paste` event handler — custom MIME types are readable
 * on ClipboardEvent.clipboardData but not reliably on InputEvent.dataTransfer.
 */
export function captureMarkupPaste(event: ClipboardEvent): void {
	const raw = event.clipboardData?.getData(MARKPUT_MIME)
	pendingMarkup = raw !== '' ? raw : undefined
}

/**
 * Consume the pending markup data (if any) from a prior captureMarkupPaste call.
 * Returns undefined if no markup was captured or the data was already consumed.
 */
export function consumeMarkupPaste(): string | undefined {
	const markup = pendingMarkup
	pendingMarkup = undefined
	return markup
}

/**
 * Clear the pending markup buffer. Useful for test cleanup.
 */
export function clearMarkupPaste(): void {
	pendingMarkup = undefined
}
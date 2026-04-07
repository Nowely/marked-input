/** Custom MIME type for markput markup syntax. */
export const MARKPUT_MIME = 'application/x-markput'

const pendingMarkupByContainer = new WeakMap<HTMLElement, string>()

/**
 * Capture markup data from a paste event, scoped to a specific container.
 * Call this from the `paste` event handler — custom MIME types are readable
 * on ClipboardEvent.clipboardData but not reliably on InputEvent.dataTransfer.
 *
 * Scoping to the container prevents multiple editor instances from consuming
 * each other's clipboard data.
 */
export function captureMarkupPaste(event: ClipboardEvent, container: HTMLElement): void {
	const raw = event.clipboardData?.getData(MARKPUT_MIME)
	if (raw) {
		pendingMarkupByContainer.set(container, raw)
	} else {
		pendingMarkupByContainer.delete(container)
	}
}

/**
 * Consume the pending markup data (if any) for the given container.
 * Returns undefined if no markup was captured or the data was already consumed.
 */
export function consumeMarkupPaste(container: HTMLElement): string | undefined {
	const markup = pendingMarkupByContainer.get(container)
	pendingMarkupByContainer.delete(container)
	return markup
}

/**
 * Clear the pending markup buffer for the given container. Useful for test cleanup.
 */
export function clearMarkupPaste(container: HTMLElement): void {
	pendingMarkupByContainer.delete(container)
}
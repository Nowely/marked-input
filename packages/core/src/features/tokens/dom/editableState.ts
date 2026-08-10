import type {ElementBindings} from './TokenHandle'

/**
 * Apply contentEditable / tabindex to a handle's bindings.
 *
 * - Text surface: conditional contentEditable write (preserves the caret when
 *   the attribute already matches).
 * - Mark root (no text surface): tabindex — removed when readOnly, otherwise
 *   set to 0 only when the ATTRIBUTE is absent (natively focusable mark roots
 *   such as <button> carry tabIndex=0 as a property without the attribute;
 *   checking the attribute avoids a spurious attribute write on every call).
 *
 * Both callers — bind.ts (mount-time, newly bound only) and TokenModel.setEditable
 * (scoped sweep, all currently bound handles) — apply the same conditional-write
 * semantics and share this function.
 */
export function applyEditableState(bindings: ElementBindings, state: {editable: boolean; readOnly: boolean}): void {
	if (bindings.textElement) {
		const editableAttr = state.editable ? 'true' : 'false'
		if (bindings.textElement.contentEditable !== editableAttr) {
			bindings.textElement.contentEditable = editableAttr
		}
		return
	}
	if (state.readOnly) bindings.tokenElement.removeAttribute('tabindex')
	// Conditional on the ATTRIBUTE, not the property: natively focusable mark
	// roots (e.g. <button>) report tabIndex 0 without carrying the attribute.
	else if (bindings.tokenElement.getAttribute('tabindex') !== '0') bindings.tokenElement.tabIndex = 0
}
/**
 * A prop value the editor cannot use: reported once and then treated as absent.
 *
 * THE CHANNEL IS THE CONSOLE BECAUSE THE ALTERNATIVE IS A THROW IN THE WRONG STACK. Both
 * adapters push props into core from a framework lifecycle hook that runs on every render —
 * React's layout effect (`MarkedInput.tsx`) and Vue's watcher (`MarkedInput.vue`) — so an
 * exception raised while a prop is consumed does not land in the consumer's own frame. React
 * unmounts the whole render root; Vue keeps rendering the stale tree while every prop signal
 * has already taken the new value. A text field has no business doing either over its own
 * configuration. React and Vue report misconfiguration exactly this way.
 *
 * CALL IT WHERE THE VALUE IS CONSUMED, NOT WHERE IT ARRIVES. Every caller sits inside a
 * `computed`, whose equality gate collapses a per-render prop sync into one evaluation per
 * DISTINCT value — that placement, not any bookkeeping here, is what keeps a bad prop from
 * flooding the console on every parent render. A caller moved upstream of an equality gate
 * (for instance onto `props.options`, which compares array elements by reference) reports once
 * per render instead.
 *
 * Loud failure is still right where it lands in the CALLER's stack: `Parser` and
 * `createMarkupDescriptor` keep their throws, so the public `denote` and any direct parser use
 * are unchanged.
 */
export function reportBadProp(message: string): void {
	console.error(`[markput] ${message}`)
}
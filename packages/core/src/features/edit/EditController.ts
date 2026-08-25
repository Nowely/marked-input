import {batch} from '../../shared/signals'
import type {PropsModel} from '../state'
import type {NodeAnchor, TokenModel} from '../tokens'

/**
 * Single write path for text edits — delegates gating to the token layer's write verbs and
 * only moves the caret when the edit is accepted. Wrapped in {@link batch} so subscribers
 * observe a consistent value/selection pair on one tick.
 *
 * Addressed by NODE ANCHORS since S2.5 (spec S2 §4.5), and now WHOLLY: `setValue`'s
 * `caretOffset` was the one absolute offset left in any core module, and it is gone. It
 * existed for the row operations, which synthesised a whole new string from row positions and
 * computed a caret against THAT string before it was parsed, so no node existed to name it.
 * Row edits address their own nodes now, and `setValue` names no caret at all: its own
 * post-edit anchor already resolves inside the row the replacement produced.
 */
export class EditController {
	constructor(
		private readonly tokens: TokenModel,
		private readonly props: PropsModel
	) {}

	/** Replace the span between two anchors; the pair is normalized, so `from` after `to` is legal. */
	replace(from: NodeAnchor, to: NodeAnchor, text: string): void {
		batch(() => {
			const caret = this.tokens.replaceBetween(from, to, text)
			if (!caret) return
			// Controlled mode moves no DERIVED caret here (spec D6): the tree has not changed
			// yet, so this position would be captured as `selectionBefore` at the echo and
			// shifted a SECOND time by `map` — measured 'hello' + 'X' at 2 landing the caret at
			// 4 instead of 3. The echo's repair owns it, and a parent that never echoes now
			// leaves the caret alone instead of moving it and having it clamped back.
			if (this.props.value() !== undefined) return
			this.tokens.selection.select(caret)
		})
	}

	/**
	 * Whole-value rewrite (spec D6). The post-edit caret is the end of `text`, under the same
	 * controlled-mode rule as {@link replace}.
	 *
	 * The `caretOffset` override is GONE — it was the last absolute offset in any core module,
	 * an index into a string that had not been parsed yet. Its callers were all block row edits
	 * that wanted the caret inside a row of the RESULT, and they now say exactly that through
	 * `tokens.setValue(text, rootIndex)`. Its controlled-mode exemption went with it:
	 * the measurement that justified it had gone stale — `PlainTextDrag` stopped being
	 * controlled-and-echoing, and the case it cited runs under `mount`, not `mountEcho`.
	 */
	setValue(text: string): void {
		// The document edges, and it is {@link replace} verbatim: `'start'`/`'end'` always
		// resolve to the whole span, so `replaceBetween` takes its whole-value arm and answers
		// the caret at `text.length` — which is exactly what this used to recompute for itself,
		// along with a second copy of the controlled-mode rule.
		this.replace('start', 'end', text)
	}
}
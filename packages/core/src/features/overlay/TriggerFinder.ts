// packages/core/src/features/overlay/TriggerFinder.ts
import {escape} from '../../shared/escape'
import type {OverlayMatch} from '../../shared/types'
import type {TokenModel} from '../tokens/TokenModel'

const wordRegex = new RegExp(/^\w*/)

type TriggerExtractor<T> = (option: T, index: number) => string | undefined

// Exists for callers/tests that don't inject TokenModel; reads live selection directly.
// Slated for removal in sub-phase 1c (Task 11) when the encapsulation guard lands.
function fallbackAnchor(): {node: Node; offset: number; isCollapsed: boolean} | undefined {
	const sel = window.getSelection()
	if (!sel?.anchorNode) return undefined
	return {node: sel.anchorNode, offset: sel.anchorOffset, isCollapsed: sel.isCollapsed}
}

export class TriggerFinder {
	span: string
	node: Node
	dividedText: {left: string; right: string}

	constructor(
		private readonly tokens?: TokenModel,
		anchor?: {node: Node; offset: number; isCollapsed: boolean}
	) {
		const resolvedAnchor = anchor ?? tokens?.selectionAnchor() ?? fallbackAnchor()
		if (!resolvedAnchor || !document.contains(resolvedAnchor.node))
			throw new Error('Anchor node of selection is not exists!')
		this.node = resolvedAnchor.node
		this.span = resolvedAnchor.node.textContent ?? ''
		this.dividedText = this.getDividedTextBy(resolvedAnchor.offset)
	}

	static find<T>(
		options: T[] | undefined,
		getTrigger: TriggerExtractor<T>,
		tokens?: TokenModel
	): OverlayMatch<T> | undefined {
		if (!options) return
		const anchor = tokens?.selectionAnchor() ?? fallbackAnchor()
		if (!anchor?.isCollapsed) return
		try {
			return new TriggerFinder(tokens, anchor).find(options, getTrigger)
		} catch {
			return undefined
		}
	}

	getDividedTextBy(position: number) {
		return {left: this.span.slice(0, position), right: this.span.slice(position)}
	}

	find<T>(options: T[], getTrigger: TriggerExtractor<T>): OverlayMatch<T> | undefined {
		for (let i = 0; i < options.length; i++) {
			const option = options[i]
			const trigger = getTrigger(option, i)
			if (!trigger) continue

			const match = this.matchInTextVia(trigger)
			if (match) {
				const range = this.#rawRangeForMatch(match.annotation, match.index)
				if (!range) return undefined
				return {
					value: match.word,
					source: match.annotation,
					range,
					span: this.span,
					node: this.node,
					option,
				}
			}
		}
	}

	#rawRangeForMatch(source: string, index: number) {
		if (!this.tokens) return {start: index, end: index + source.length}
		const boundary = this.tokens.boundaryFor(this.node, index + source.length, 'after')
		if (boundary === undefined) return undefined
		return {start: boundary - source.length, end: boundary}
	}

	matchInTextVia(trigger: string = '@') {
		const rightMatch = this.matchRightPart()
		const leftMatch = this.matchLeftPart(trigger)
		if (leftMatch)
			return {
				word: leftMatch.word + rightMatch.word,
				annotation: leftMatch.annotation + rightMatch.word,
				index: leftMatch.index,
			}
	}

	matchRightPart() {
		const {right} = this.dividedText
		return {word: right.match(wordRegex)?.[0]}
	}

	matchLeftPart(trigger: string) {
		const regex = this.makeTriggerRegex(trigger)
		const {left} = this.dividedText
		const match = left.match(regex)
		if (!match) return
		const [annotation, word] = match
		return {word, annotation, index: match.index ?? 0}
	}

	makeTriggerRegex(trigger: string): RegExp {
		const patten = escape(trigger) + '(\\w*)$'
		return new RegExp(patten)
	}
}
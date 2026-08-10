// packages/core/src/features/overlay/TriggerFinder.ts
import {escape} from '../../shared/escape'
import type {OverlayMatch} from '../../shared/types'
import type {Anchors, SelectionAnchor, TokenModel} from '../tokens'

const wordRegex = new RegExp(/^\w*/)

type TriggerExtractor<T> = (option: T, index: number) => string | undefined

export class TriggerFinder {
	span: string
	node: Node
	dividedText: {left: string; right: string}

	/**
	 * @param anchor - Pre-resolved anchor to use; collapse-checking is `find`'s
	 *   responsibility. Direct constructors (e.g. in tests) bypass the collapse
	 *   guard deliberately.
	 */
	constructor(
		private readonly tokens: TokenModel,
		anchor?: SelectionAnchor
	) {
		const resolvedAnchor = anchor ?? tokens.selection()?.anchor
		if (!resolvedAnchor || !document.contains(resolvedAnchor.node))
			throw new Error('Anchor node of selection is not exists!')
		this.node = resolvedAnchor.node
		this.span = resolvedAnchor.node.textContent ?? ''
		this.dividedText = this.getDividedTextBy(resolvedAnchor.offset)
	}

	static find<T>(
		options: T[] | undefined,
		getTrigger: TriggerExtractor<T>,
		tokens: TokenModel,
		anchor?: SelectionAnchor
	): OverlayMatch<T> | undefined {
		if (!options) return
		const resolvedAnchor = anchor ?? tokens.selection()?.anchor
		if (!resolvedAnchor?.isCollapsed) return
		try {
			return new TriggerFinder(tokens, resolvedAnchor).find(options, getTrigger)
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
				const range = this.#anchorsForMatch(match.annotation, match.index)
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

	/**
	 * The matched span as anchors in the live tree. Two `anchorFor` calls, where the numeric
	 * version resolved ONE boundary and derived the other by subtracting `source.length` — an
	 * assumption that the DOM text and the model text advance in lockstep across the match.
	 * Resolving both ends drops it, and either end declining fails the whole match closed.
	 */
	#anchorsForMatch(source: string, index: number): Anchors | undefined {
		const anchor = this.tokens.anchorFor(this.node, index, 'after')
		if (!anchor) return undefined
		const head = this.tokens.anchorFor(this.node, index + source.length, 'after')
		if (!head) return undefined
		return {anchor, head}
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
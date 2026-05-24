// packages/core/src/features/overlay/TriggerFinder.ts
import {escape} from '../../shared/escape'
import type {OverlayMatch} from '../../shared/types'
import type {SelectionController} from '../selection/SelectionController'

const wordRegex = new RegExp(/^\w*/)

type TriggerExtractor<T> = (option: T, index: number) => string | undefined

export class TriggerFinder {
	span: string
	node: Node
	dividedText: {left: string; right: string}

	constructor(private readonly selection?: SelectionController) {
		const sel = window.getSelection()
		const node = sel?.anchorNode
		if (!sel || !node || !document.contains(node)) throw new Error('Anchor node of selection is not exists!')
		this.node = node
		this.span = node.textContent ?? ''
		this.dividedText = this.getDividedTextBy(sel.anchorOffset)
	}

	static find<T>(
		options: T[] | undefined,
		getTrigger: TriggerExtractor<T>,
		selection?: SelectionController
	): OverlayMatch<T> | undefined {
		if (!options) return
		if (!window.getSelection()?.isCollapsed) return
		try {
			return new TriggerFinder(selection).find(options, getTrigger)
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
		if (!this.selection) return {start: index, end: index + source.length}
		const boundary = this.selection.rawPositionFromBoundary(this.node, index + source.length, 'after')
		if (!boundary.ok) return undefined
		return {start: boundary.value - source.length, end: boundary.value}
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
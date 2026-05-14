import {escape} from '../../shared/escape'
import type {OverlayMatch} from '../../shared/types'
import type {DomModel} from '../dom/DomModel'

/** Regex to match word characters from the start of a string */
const wordRegex = new RegExp(/^\w*/)

/**
 * Function type for extracting trigger from option
 * @template T - Type of option
 * @param option - The option object
 * @param index - Index of option in array
 * @returns Trigger string or undefined
 */
type TriggerExtractor<T> = (option: T, index: number) => string | undefined

export class TriggerFinder {
	span: string
	node: Node
	dividedText: {left: string; right: string}

	constructor(private readonly dom?: DomModel) {
		const sel = window.getSelection()
		const node = sel?.anchorNode
		if (!sel || !node || !document.contains(node)) throw new Error('Anchor node of selection is not exists!')
		this.node = node
		this.span = node.textContent ?? ''
		this.dividedText = this.getDividedTextBy(sel.anchorOffset)
	}

	/**
	 * Find overlay match in text using provided options and trigger extractor.
	 * @template T - Type of option objects
	 * @param options - Array of options to search through
	 * @param getTrigger - Function that extracts trigger from each option
	 * @returns OverlayMatch with correct option type or undefined
	 *
	 * @example
	 * // React usage
	 * TriggerFinder.find(options, (opt) => opt.slotProps?.overlay?.trigger ?? '@')
	 *
	 * @example
	 * // Other framework usage
	 * TriggerFinder.find(vueOptions, (opt) => opt.overlay?.trigger ?? '@')
	 */
	static find<T>(
		options: T[] | undefined,
		getTrigger: TriggerExtractor<T>,
		dom?: DomModel
	): OverlayMatch<T> | undefined {
		if (!options) return
		if (!window.getSelection()?.isCollapsed) return
		try {
			return new TriggerFinder(dom).find(options, getTrigger)
		} catch {
			return undefined
		}
	}

	getDividedTextBy(position: number) {
		return {left: this.span.slice(0, position), right: this.span.slice(position)}
	}

	/**
	 * Find overlay match in provided options.
	 * @template T - Type of option objects
	 * @param options - Array of options
	 * @param getTrigger - Function to extract trigger from each option
	 */
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
		if (!this.dom) return {start: index, end: index + source.length}
		const boundary = this.dom.rawPositionFromBoundary(this.node, index + source.length, 'after')
		if (!boundary.ok) return undefined
		return {
			start: boundary.value - source.length,
			end: boundary.value,
		}
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

	//TODO new overlayMatch option if (isSpaceBeforeRequired) append space check for not first words '\\s'
	makeTriggerRegex(trigger: string): RegExp {
		const patten = escape(trigger) + '(\\w*)$'
		return new RegExp(patten)
	}
}
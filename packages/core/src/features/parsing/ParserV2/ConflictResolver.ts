import {MatchResult, TokenCandidate} from './types'

/**
 * Компонент для разрешения конфликтов между пересекающимися маркерами
 */
export class ConflictResolver {
	/**
	 * Преобразует матчи в кандидатов и разрешает конфликты
	 */
	resolve(matches: MatchResult[]): TokenCandidate[] {
		const candidates = this.createCandidates(matches)
		this.detectConflicts(candidates)
		return this.selectNonConflicting(candidates)
	}

	/**
	 * Создает кандидатов из матчей
	 */
	private createCandidates(matches: MatchResult[]): TokenCandidate[] {
		return matches.map(match => ({
			match,
			conflicts: new Set<TokenCandidate>()
		}))
	}

	/**
	 * Обнаруживает конфликты между кандидатами
	 */
	private detectConflicts(candidates: TokenCandidate[]): void {
		for (let i = 0; i < candidates.length; i++) {
			for (let j = i + 1; j < candidates.length; j++) {
				const candidate1 = candidates[i]
				const candidate2 = candidates[j]

				if (this.doCandidatesConflict(candidate1, candidate2)) {
					candidate1.conflicts.add(candidate2)
					candidate2.conflicts.add(candidate1)
				}
			}
		}
	}

	/**
	 * Проверяет, конфликтуют ли два кандидата
	 * Вложенные кандидаты НЕ конфликтуют друг с другом
	 */
	private doCandidatesConflict(candidate1: TokenCandidate, candidate2: TokenCandidate): boolean {
		const match1 = candidate1.match
		const match2 = candidate2.match

		// Если один кандидат полностью содержится в другом - это вложенность, не конфликт
		if (this.isContainedIn(match1, match2) || this.isContainedIn(match2, match1)) {
			return false
		}

		// Проверяем пересечение диапазонов (частичное перекрытие)
		return match1.start < match2.end && match2.start < match1.end
	}

	/**
	 * Проверяет, полностью ли inner содержится в outer
	 */
	private isContainedIn(inner: MatchResult, outer: MatchResult): boolean {
		return inner.start >= outer.start && 
		       inner.end <= outer.end && 
		       (inner.start > outer.start || inner.end < outer.end)
	}

	/**
	 * Выбирает непересекающиеся кандидаты с поддержкой вложенности
	 * Вложенные кандидаты сохраняются вместе с содержащими их
	 */
	private selectNonConflicting(candidates: TokenCandidate[]): TokenCandidate[] {
		// Группируем кандидаты по вложенности
		const nestingGroups = this.groupByNesting(candidates)
		
		const selected: TokenCandidate[] = []
		const usedRanges: Array<{start: number, end: number}> = []

		for (const group of nestingGroups) {
			// Проверяем, можем ли добавить группу
			// Группа конфликтует только если ВНЕШНИЙ элемент пересекается с уже использованными
			const outerCandidate = group[0] // Первый элемент - всегда внешний (самый длинный)
			const outerMatch = outerCandidate.match
			
			let hasConflict = false
			for (const used of usedRanges) {
				// Проверяем частичное перекрытие (не вложенность)
				if (outerMatch.start < used.end && used.start < outerMatch.end) {
					// Это перекрытие, если не полное вложение
					const isNested = (outerMatch.start >= used.start && outerMatch.end <= used.end) ||
					                 (used.start >= outerMatch.start && used.end <= outerMatch.end)
					if (!isNested) {
						hasConflict = true
						break
					}
				}
			}

			if (!hasConflict) {
				// Добавляем всю группу
				for (const candidate of group) {
					selected.push(candidate)
				}
				// Помечаем только ВНЕШНИЙ диапазон как использованный
				usedRanges.push({
					start: outerMatch.start,
					end: outerMatch.end
				})
			}
		}

		// Сортируем выбранные по позиции
		selected.sort((a, b) => a.match.start - b.match.start)

		return selected
	}

	/**
	 * Группирует кандидаты по вложенности
	 * Каждая группа содержит внешний кандидат и все вложенные в него
	 */
	private groupByNesting(candidates: TokenCandidate[]): TokenCandidate[][] {
		// Сортируем: сначала по start (ранние первыми), затем по длине (длинные первыми)
		const sorted = [...candidates].sort((a, b) => {
			const matchA = a.match
			const matchB = b.match

			if (matchA.start !== matchB.start) {
				return matchA.start - matchB.start
			}

			const lengthA = matchA.end - matchA.start
			const lengthB = matchB.end - matchB.start
			return lengthB - lengthA // Длинные (внешние) первыми
		})

		const groups: TokenCandidate[][] = []
		const processed = new Set<TokenCandidate>()

		for (const candidate of sorted) {
			if (processed.has(candidate)) continue

			// Создаем новую группу с этим кандидатом как внешним
			const group: TokenCandidate[] = [candidate]
			processed.add(candidate)

			// Находим все кандидаты, вложенные в этот
			for (const other of sorted) {
				if (processed.has(other)) continue

				if (this.isContainedIn(other.match, candidate.match)) {
					group.push(other)
					processed.add(other)
				}
			}

			groups.push(group)
		}

		return groups
	}
}

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
	 */
	private doCandidatesConflict(candidate1: TokenCandidate, candidate2: TokenCandidate): boolean {
		const match1 = candidate1.match
		const match2 = candidate2.match

		// Проверяем пересечение диапазонов
		return match1.start < match2.end && match2.start < match1.end
	}

	/**
	 * Выбирает непересекающиеся кандидаты, предпочитая более длинные
	 */
	private selectNonConflicting(candidates: TokenCandidate[]): TokenCandidate[] {
		// Сортируем по позиции начала, затем по длине (длинные первыми)
		candidates.sort((a, b) => {
			const matchA = a.match
			const matchB = b.match

			if (matchA.start !== matchB.start) {
				return matchA.start - matchB.start
			}

			const lengthA = matchA.end - matchA.start
			const lengthB = matchB.end - matchB.start
			return lengthB - lengthA // Длинные первыми
		})

		const selected: TokenCandidate[] = []
		const usedPositions = new Set<number>()

		for (const candidate of candidates) {
			const match = candidate.match
			const start = match.start
			const end = match.end

			// Проверяем, пересекается ли с уже выбранными
			let hasConflict = false
			for (let pos = start; pos < end; pos++) {
				if (usedPositions.has(pos)) {
					hasConflict = true
					break
				}
			}

			if (!hasConflict) {
				selected.push(candidate)
				// Помечаем позиции как занятые
				for (let pos = start; pos < end; pos++) {
					usedPositions.add(pos)
				}
			}
		}

		// Сортируем выбранные по позиции
		selected.sort((a, b) => a.match.start - b.match.start)

		return selected
	}
}

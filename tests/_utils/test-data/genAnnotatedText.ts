import {annotate} from 'rc-marked-input'
import {Markups_16} from '../consts'
import {readFile} from '../readFile'
import {writeFile} from '../writeFile'

/**
 * @example genAnnotatedText(1_000, [1, 2]) - generate 1000 lines text with 03, 05, 08 annotated ratio and 1, 2 annotations
 */
export async function genAnnotatedText(size: number, markupCount: number[]) {
	const filePath = `./data/${size}.txt`
	const data = await readFile(filePath)

	const words = data.split(/[\s\n]+/)

	//annotated ratio
	const k02 = Math.ceil(words.length * 0.2)
	const k05 = Math.ceil(words.length * 0.5)
	const k08 = Math.ceil(words.length * 0.8)

	//indexes for annotated
	const indexesK02 = genRandomIndexes(0, words.length - 1, k02)
	const indexesK05 = genRandomIndexes(0, words.length - 1, k05)
	const indexesK08 = genRandomIndexes(0, words.length - 1, k08)


	for (const count of markupCount) {
		const annotatedK02 = annotateWords([...words], indexesK02, count)
		const annotatedK05 = annotateWords([...words], indexesK05, count)
		const annotatedK08 = annotateWords([...words], indexesK08, count)

		//Concat and restore \n
		const textK02 = annotatedK02.join(' ').replaceAll('. ', '.\n')
		const textK05 = annotatedK05.join(' ').replaceAll('. ', '.\n')
		const textK08 = annotatedK08.join(' ').replaceAll('. ', '.\n')

		writeFile(`./data/${size}-k02-a${count}.txt`, textK02)
		writeFile(`./data/${size}-k05-a${count}.txt`, textK05)
		writeFile(`./data/${size}-k08-a${count}.txt`, textK08)
	}


	function annotateWords(words: string[], indexes: number[], markupCount: number) {
		for (let i = 0; i < indexes.length; i++) {
			const index = indexes[i]

			let word = words[index]
			let suffix = ''
			if (word.endsWith('.')) {
				suffix = '.'
				word = word.replace('.', '')
			}

			words[index] = annotate(Markups_16[i % markupCount], word) + suffix
		}
		return words
	}

	function genRandomIndexes(min: number, max: number, count: number) {
		const result = []
		const usedNumbers = new Set<number>()

		while (result.length < count) {
			const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min

			if (!usedNumbers.has(randomNumber)) {
				usedNumbers.add(randomNumber)
				result.push(randomNumber)
			}
		}

		return result.sort((a, b) => a < b ? -1 : 1)
	}
}
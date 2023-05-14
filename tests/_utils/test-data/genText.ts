import {faker} from '@faker-js/faker'
import {writeFile} from '../writeFile'

async function genText(lineCount: number) {
	const filePath = `./data/${lineCount}.txt`
	const content = faker.lorem.lines(lineCount)
	writeFile(filePath, content)
}
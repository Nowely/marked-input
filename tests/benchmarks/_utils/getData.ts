import {getFileNames} from './getFileNames'
import {DataFolderPath} from '../consts'
import {readFile} from './readFile'
import path from 'path'

//Allow to get specific text data by index
async function getData(index: number = 2) {
	const name = (await getFileNames(DataFolderPath))
		.filter(value => value.includes('-k'))
		//.filter(value => !value.includes('-a16')) //to 90
		.sort((a, b) => {
			const a1 = Number(a.split('-')[0])
			const b1 = Number(b.split('-')[0])
			return a1 - b1
		})[index]
	return await readFile(path.resolve(DataFolderPath, name))
}
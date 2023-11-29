import fs from 'fs'
import {DataFolderPath} from '../consts'

export async function getFileNames(path: string) {
	try {
		return await fs.promises.readdir(path)
		//files.forEach(file => console.log(file))
	} catch (error) {
		console.log('Unable to scan directory: ' + error)
		throw error
	}
}

export async function getFileNamesOfData() {
	return await getFileNames(DataFolderPath)
}
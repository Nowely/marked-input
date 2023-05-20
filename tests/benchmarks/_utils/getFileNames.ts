import fs from 'fs'

export async function getFileNames(path: string) {
	try {
		return await fs.promises.readdir(path)
		//files.forEach(file => console.log(file))
	} catch (error) {
		console.log('Unable to scan directory: ' + error)
		throw error
	}
}
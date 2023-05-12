import fs from 'fs'

export async function writeFile(path: string, data: string) {
	try {
		await fs.promises.writeFile(path, data, 'utf8')
		console.log(`${path} has been written`)
	} catch (error) {
		console.error('Error writing file:', error)
		throw error
	}
}
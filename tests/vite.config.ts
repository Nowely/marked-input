import react from '@vitejs/plugin-react-swc'
import path from 'path'
import {fileURLToPath} from 'url'
import {defineConfig} from 'vite'
import injectCssToJs from 'vite-plugin-css-injected-by-js'
import {getFileNames} from './_utils/getFileNames'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const __utils = path.resolve(__dirname, '_utils')

const __analyzers = path.resolve(__utils, 'analyzers')
const __parsers = path.resolve(__utils, 'parsers')
const __joiners = path.resolve(__utils, 'joiners')

const analyzerPaths = await getPaths(__analyzers)
const parserPaths = await getPaths(__parsers)
const joinerPaths = await getPaths(__joiners)

export default defineConfig(({command}) => ({
	build: {
		lib: {
			entry: [
				//...analyzerPaths,
				//...parserPaths,
				...joinerPaths,
			],
			//name: 'MarkedInput',
			formats: ['es'],
			//fileName: 'index'
		}
	}
}))

async function getPaths(dir: string) {
	const names = await getFileNames(dir)
	return names.map(name => path.resolve(dir, name))
}
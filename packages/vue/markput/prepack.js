import fs from 'fs'
import {createRequire} from 'module'
import path from 'path'
import {fileURLToPath} from 'url'

import vue from '@vitejs/plugin-vue'
import {dts} from 'rolldown-plugin-dts'

// Resolve rolldown through its peer: rolldown-plugin-dts
const {rolldown} = await import(createRequire(import.meta.resolve('rolldown-plugin-dts')).resolve('rolldown'))

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const __root = path.join(__dirname, '..', '..', '..')

await buildDts()
copyReadme()
prepareAndCopyPackage()

async function buildDts() {
	const bundle = await rolldown({
		input: path.resolve(__dirname, './index.ts'),
		plugins: [
			vue(),
			dts({
				vue: true,
				compilerOptions: {
					paths: {
						'@markput/core': ['../../core/index.ts'],
					},
				},
			}),
		],
		external: ['vue', /\.css$/],
	})

	await bundle.write({
		dir: path.resolve(__dirname, 'dist'),
		format: 'es',
		codeSplitting: false,
	})

	console.log('DTS built')
}

function copyReadme() {
	fs.copyFile(path.resolve(__root, 'README.md'), path.resolve(__dirname, 'dist/README.md'), err => {
		if (err) throw err
		console.log('README.md copied')
	})
}

function prepareAndCopyPackage() {
	const mainPackage = getPackageCopy()
	deleteUnnecessaryProperties(mainPackage)
	paste(mainPackage, err => {
		if (err) throw err
		console.log('package.json setup')
	})

	function getPackageCopy(pathSegment = '') {
		const copy = fs.readFileSync(path.resolve(__dirname, pathSegment, 'package.json'), 'utf-8')
		return JSON.parse(copy)
	}

	function deleteUnnecessaryProperties(copy) {
		delete copy.private
		delete copy.scripts
		delete copy.dependencies
		delete copy.devDependencies
		delete copy.workspaces
		return copy
	}

	function paste(obj, callback) {
		try {
			fs.writeFileSync(
				path.resolve(__dirname, 'dist/package.json'),
				Buffer.from(JSON.stringify(obj, null, 2), 'utf-8')
			)
			callback(null)
		} catch (err) {
			callback(err)
		}
	}
}
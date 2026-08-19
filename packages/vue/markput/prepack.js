import fs from 'fs'
import {createRequire} from 'module'
import path from 'path'
import {fileURLToPath, pathToFileURL} from 'url'

import {dts} from 'rolldown-plugin-dts'

// Resolve rolldown through its peer: rolldown-plugin-dts
const {rolldown} = await import(
	pathToFileURL(createRequire(import.meta.resolve('rolldown-plugin-dts')).resolve('rolldown')).href
)

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
			dts({
				vue: true,
				// The DTS pass is a full rolldown build, so without this it ALSO emits an
				// `index.js` chunk into the same `dir` and clobbers vite's. That chunk reaches
				// @markput/core through two module IDs (paths alias and workspace symlink), so
				// its CSS imports land as two specifiers that resolve from neither the tarball
				// nor npm — which is what shipped in 0.10.1 through 0.14.3.
				emitDtsOnly: true,
				// The map's `sources` point outside the tarball and it carries no
				// `sourcesContent`, so shipping it is 47 kB of paths a consumer cannot follow.
				sourcemap: false,
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
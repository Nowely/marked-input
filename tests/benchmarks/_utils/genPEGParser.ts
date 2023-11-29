import path from 'path'
import * as peggy from 'peggy'
import {UtilsFolderPath} from '../consts'
import {writeFile} from './writeFile'

const grammar = `
Start = el:Element* rest:rest {let a = el.flat(); a.push(rest); return a}
Element = text:Char tag:OpenTag label:Char CloseTag { return [text, {
 		tag,
 		annotation: "<" + tag + ">" + label + "</" + tag + ">", 
 		label,
 		optionIndex: options.markups.findIndex(markup => markup.startsWith("<" + tag + ">"))
 	}] }
OpenTag = "<" tagName:$TagName ">" { return tagName}
CloseTag = "</" tagName:TagName ">"
TagName = [a-z0-9]i+
Char = text:$[^<]* { return text }
rest = $.*
`

export async function genPEGParser() {
	const parserSource = peggy.generate(grammar, {
		format: "es",
		output: 'source',
	})
	await writeFile(path.resolve(UtilsFolderPath, 'GeneratedPEGParser.js'), parserSource)
}

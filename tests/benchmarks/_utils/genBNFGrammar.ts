import {UtilsFolderPath} from '../consts'

const nearley = require('nearley')
const compile = require('nearley/lib/compile')
const generate = require('nearley/lib/generate')
const nearleyGrammar = require('nearley/lib/nearley-language-bootstrapped')
const fs = require('fs')
const path = require('path')

const grammar = `@{%
const Markups_16 = [
	'<h1>__label__</h1>',
	'<h2>__label__</h2>',
	'<p>__label__</p>',
	'<a>__label__</a>',

	'<span>__label__</span>',
	'<b>__label__</b>',
	'<i>__label__</i>',
	'<abbr>__label__</abbr>',

	'<input>__label__</input>',
	'<button>__label__</button>',
	'<select>__label__</select>',
	'<section>__label__</section>',

	'<strong>__label__</strong>',
	'<article>__label__</article>',
	'<header>__label__</header>',
	'<footer>__label__</footer>',
]
%}

main -> Element:* rest {% (data) => { let a = data[0].flat(); a.push(data[1]); return a } %}

Element -> Char OpenTag Char CloseTag {% (data) => [data[0], {
    tag: data[1],
    annotation: "<" + data[1] + ">" + data[2] + "</" + data[1] + ">",
    label: data[2],
    optionIndex: Markups_16.findIndex(markup => markup.startsWith("<" + data[1] + ">"))
}] %}
OpenTag -> "<" TagName ">" {% (data) => data[1].join("") %}
CloseTag -> "</" TagName ">"
TagName -> [a-zA-Z0-9]:+ {% (data) => data[0] %}
Char -> [^<]:* {% (data) => data[0].join("") %}
rest -> .:* {% (data) => data[0].join("") %}`

export async function genBNFGrammar() {
	const grammarParser = new nearley.Parser(nearleyGrammar)
	grammarParser.feed(grammar)
	const grammarAst = grammarParser.results[0] // TODO check for errors

	// Compile the AST into a set of rules
	const grammarInfoObject = compile(grammarAst, {})
	// Generate JavaScript code from the rules
	const parserSource = generate.esmodule(grammarInfoObject, 'grammar')
	fs.writeFileSync(path.resolve(UtilsFolderPath, 'GeneratedBNFGrammar.js'), parserSource, "utf8")
}